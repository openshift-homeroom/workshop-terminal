var express = require('express');
var basic_auth = require('express-basic-auth')
var session = require('express-session');
var uuid = require('uuid');
var http = require('http');
var https = require('https');
var axios = require('axios');
var path = require('path');
var url = require('url');
var fs = require('fs');

var Promise = require('promise');

// Setup the root application. Everything will actually be under a
// mount point corresponding to the specific user. This is added in
// each of the routes when defined.

var app = express();

var uri_root_path = process.env.URI_ROOT_PATH || '';

// In OpenShift we are always behind a proxy, so trust the headers sent.

app.set('trust proxy', true);

// For standalone container deployment, provide the ability to enable
// authentication using HTTP Basic authentication. In this case there
// will be no user object added to the client session.

var auth_username = process.env.AUTH_USERNAME;
var auth_password = process.env.AUTH_PASSWORD;

function install_basic_auth() {
    console.log('Register basic auth handler');

    app.use(basic_auth({
        challenge: true,
        realm: 'Terminal',
        authorizer: function (username, password) {
            return username == auth_username && password == auth_password;
        }
    }));
}

// Enable use of a client session for the user. This is used to track
// whether the user has logged in when using oauth. The expiry for the
// cookie is relatively short as the oauth handshake is hidden from the
// user as it is only negoitating with JupyterHub itself. Having a short
// timeout means that the user will be periodically checked as still
// being allowed to access the instance. This is so that a change by a
// JupyterHub admin to status of a user is detected early and they are
// kicked out.

var handshakes = {}

app.use(session({
    name: 'workshop-session-id',
    genid: function(req) {
        return uuid.v4()
    },
    secret: uuid.v4(),
    cookie: {
        path: uri_root_path,
        maxAge: 60*1000
    },
    resave: false,
    saveUninitialized: true
}));

// For JupyterHub, to ensure that only the user, or an admin can access
// anything, we need to perform an oauth handshake with JupyterHub and
// then validate that the user making the request is allowed to access
// the specific instance.

var jupyterhub_user = process.env.JUPYTERHUB_USER;
var jupyterhub_client_id = process.env.JUPYTERHUB_CLIENT_ID;
var jupyterhub_api_url = process.env.JUPYTERHUB_API_URL;
var jupyterhub_api_token = process.env.JUPYTERHUB_API_TOKEN;
var jupyterhub_route = process.env.JUPYTERHUB_ROUTE

function install_jupyterhub_auth() {
    var api_url = url.parse(jupyterhub_api_url);

    var credentials = {
        client: {
            id: jupyterhub_client_id,
            secret: jupyterhub_api_token
        },
        auth: {
            tokenHost: jupyterhub_route,
            authorizePath: api_url.pathname + '/oauth2/authorize',
            tokenPath: api_url.pathname + '/oauth2/token'
        },
        options: {
            authorizationMethod: 'body',
        },
        http: {
            rejectUnauthorized: false
        }
    };

    var oauth2 = require('simple-oauth2').create(credentials);

    // Define the oauth callback URL. This is the means that the access
    // token is passed back from JupyterHub for the user. From within
    // this we also check back with JupyterHub that the user has access
    // to this instance by fetching the user details and ensuring they
    // are an admin or they are the user for the instance.

    app.get(uri_root_path + '/oauth_callback', async (req, res) => {
        try {
            var code = req.query.code;
            var state = req.query.state;

            // If we seem to have no record of the specific handshake
            // state, redirect back to the main page and start over.

            if (handshakes[state] === undefined) {
                return res.redirect(uri_root_path + '/');
            }

            // This retrieves the next URL to redirect to from the session
            // for this particular oauth handshake.

            var next_url = handshakes[state];
            delete handshakes[state];

            var options = {
                code: code,
                redirect_uri: uri_root_path + '/oauth_callback',
            };

            var auth_result = await oauth2.authorizationCode.getToken(options);
            var token_result = oauth2.accessToken.create(auth_result);

            var user_url = jupyterhub_api_url + '/user';

            var parsed_user_url = url.parse(user_url);

            var user_url_options = {
                host: parsed_user_url.hostname,
                port: parsed_user_url.port,
                path: parsed_user_url.path,
                headers: {
                    authorization: 'token ' + token_result.token.access_token
                }
            };

            // This is the callback to fetch the user details from
            // JupyterHub so we can authorize that they have access.

            http.get(user_url_options, (user_res) => {
                let data = '';

                user_res.on('data', (chunk) => {
                    data += chunk;
                });

                user_res.on('end', () => {
                    user = JSON.parse(data);

                    // The user who has logged in must be an admin or
                    // the user of the instance.

                    if (!user.admin) {
                        if (user.name != jupyterhub_user) {
                            return res.status(403).json('Access forbidden');
                        }
                    }

                    req.session.user = user;

                    console.log('Allowing access to', user);

                    res.redirect(next_url);

                    return;
                });
            }).on('error', (err) => {
                console.error('Error', err.message);
                return res.status(500).json('Error occurred');
            });

            return;
        } catch(err) {
            console.error('Error', err.message);
            return res.status(500).json('Authentication failed');
        }
    });

    // Handler which triggers the oauth handshake. Will be redirected
    // here whenever any request arrives and user has not been verified
    // or when the user session has expired and need to revalidate.

    app.get(uri_root_path + '/oauth_handshake', (req, res) => {
        // Stash the next URL after authentication in the user session
        // keyed by unique code for this oauth handshake. Use the code
        // as the state for oauth requests.

        var state = uuid.v4();
        handshakes[state] = req.query.next;

        const authorization_uri = oauth2.authorizationCode.authorizeURL({
            redirect_uri: uri_root_path + '/oauth_callback',
            state: state
        });

        res.redirect(authorization_uri);
    });

    // This intercepts all incoming requests and if the user hasn't been
    // validated, or validation has expired, then will redirect into the
    // oauth handshake.

    app.use(function (req, res, next) {
        if (!req.session.user) {
            next_url = encodeURIComponent(req.url);
            res.redirect(uri_root_path + '/oauth_handshake?next=' + next_url);
        }
        else {
            next();
        }
    })
}

// For authentication using OpenShift OAuth, we perform the handshake
// and then also need to validate that the user is a member of the
// project the terminal is deployed in and with appropriate role.

var oauth_service_account = process.env.OAUTH_SERVICE_ACCOUNT;

async function get_oauth_metadata(server) {
    const options = {
        baseURL: server,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        responseType: 'json'
    };

    const url = '/.well-known/oauth-authorization-server';

    return (await axios.get(url, options)).data;
}

function project_name() {
    const account_path = '/var/run/secrets/kubernetes.io/serviceaccount';
    const namespace_path = path.join(account_path, 'namespace');

    return fs.readFileSync(namespace_path, 'utf8');
}

function service_account_name(name) {
    const prefix = 'system:serviceaccount';
    const namespace = project_name();

    return prefix + ':' + namespace + ':' + name;
}

function service_account_token() {
    const account_path = '/var/run/secrets/kubernetes.io/serviceaccount';
    const token_path = path.join(account_path, 'token');

    return fs.readFileSync(token_path, 'utf8');
}

function setup_openshift_credentials(metadata, client_id, client_secret) {
    var credentials = {
        client: {
            id: client_id,
            secret: client_secret
        },
        auth: {
            tokenHost: metadata['issuer'],
            authorizePath: metadata['authorization_endpoint'],
            tokenPath: metadata['token_endpoint']
        },
        options: {
            authorizationMethod: 'body',
        },
        http: {
            rejectUnauthorized: false
        }
    };

    return credentials;
}

var kubernetes_host = process.env.KUBERNETES_PORT_443_TCP_ADDR;
var kubernetes_port = process.env.KUBERNETES_PORT_443_TCP_PORT;

async function get_openshift_user_details(access_token) {
    const options = {
        baseURL: 'https://' + kubernetes_host + ':' + kubernetes_port,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: { 'Authorization': 'Bearer ' + access_token },
        responseType: 'json'
    };

    const url = '/apis/user.openshift.io/v1/users/~';

    var details = (await axios.get(url, options)).data;
    var name = details['metadata']['name'];

    return name;
}

async function get_openshift_admin_users() {
    const namespace = project_name();
    const token = service_account_token();

    const options = {
        baseURL: 'https://' + kubernetes_host + ':' + kubernetes_port,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        headers: { 'Authorization': 'Bearer ' + token },
        responseType: 'json'
    };

    const url = '/apis/authorization.openshift.io/v1/namespaces/' +
        namespace + '/rolebindings';

    var details = (await axios.get(url, options)).data;

    var users = [];

    for (var i=0; i<details['items'].length; i++) {
        var rolebinding = details['items'][i];
        if (rolebinding['roleRef']['name'] == 'admin') {
            for (var j=0; j<rolebinding['subjects'].length; j++) {
                var subject = rolebinding['subjects'][j];
                users.push(subject['name']);
            }
        }
    }

    return users;
}

async function verify_openshift_user(access_token) {
    var users = await get_openshift_admin_users();

    console.log('OpenShift admin users', users);

    var name = await get_openshift_user_details(access_token);

    console.log('OpenShift user name', name);

    if (users.includes(name))
        return name;

    console.log('User forbidden access', name);
}

function register_openshift_callback(oauth2) {
    // Define the oauth callback URL. This is the means that the access
    // token is passed back from JupyterHub for the user. From within
    // this we also check back with JupyterHub that the user has access
    // to this instance by fetching the user details and ensuring they
    // are an admin or they are the user for the instance.

    console.log('Register OAuth callback');

    app.get(uri_root_path + '/oauth_callback', async (req, res) => {
        try {
            var code = req.query.code;
            var state = req.query.state;

            // If we seem to have no record of the specific handshake
            // state, redirect back to the main page and start over.

            if (handshakes[state] === undefined) {
                return res.redirect(uri_root_path + '/');
            }

            // This retrieves the next URL to redirect to from the session
            // for this particular oauth handshake.

            var next_url = handshakes[state];
            delete handshakes[state];

            // Obtain the user access token using the authorization code.

            var redirect_uri = [req.protocol, '://', req.hostname,
                uri_root_path, '/oauth_callback'].join('');

            var options = {
                redirect_uri: redirect_uri,
                scope: 'user:info',
                code: code
            };

            var auth_result = await oauth2.authorizationCode.getToken(options);
            var token_result = oauth2.accessToken.create(auth_result);

            console.log('auth_result', auth_result);
            console.log('token_result', token_result);

            // Now we need to verify whether this user is allowed access
            // to the project. For this we require that the user have the
            // admin role in the project since full control of the project
            // would be given to the container. First we need to work out
            // who the user is.

            req.session.user = await verify_openshift_user(
                token_result['token']['access_token']);

            if (!req.session.user) {
                return res.status(403).json('Forbidden');
            }

            return res.redirect(next_url);
        } catch(err) {
            console.error('Error', err.message);
            return res.status(500).json('Authentication failed');
        }
    });

    return oauth2;
}

function register_oauth_handshake(oauth2) {
    console.log('Register OAuth handshake');

    app.get(uri_root_path + '/oauth_handshake', (req, res) => {
        // Stash the next URL after authentication in the user session
        // keyed by unique code for this oauth handshake. Use the code
        // as the state for oauth requests.

        var state = uuid.v4();
        handshakes[state] = req.query.next;

        var redirect_uri = [req.protocol, '://', req.hostname,
            uri_root_path, '/oauth_callback'].join('');

        const authorization_uri = oauth2.authorizationCode.authorizeURL({
            redirect_uri: redirect_uri,
            scope: 'user:info',
            state: state
        });

        res.redirect(authorization_uri);
    });

    app.use(function (req, res, next) {
        if (!req.session.user) {
            next_url = encodeURIComponent(req.url);
            res.redirect(uri_root_path + '/oauth_handshake?next=' + next_url);
        }
        else {
            next();
        }
    })
}

async function install_openshift_auth() {
    var server = 'https://openshift.default.svc.cluster.local';
    var client_id = service_account_name(oauth_service_account);
    var client_secret = service_account_token();

    var metadata = await get_oauth_metadata(server);

    console.log('OAuth server metadata', metadata);

    var credentials = setup_openshift_credentials(metadata, client_id,
        client_secret);

    console.log('OAuth server credentials', credentials);

    var oauth2 = require('simple-oauth2').create(credentials);

    register_openshift_callback(oauth2);
    register_oauth_handshake(oauth2);
}

async function setup_access() {
    if (jupyterhub_client_id) {
        console.log('Install JupyterHub auth support');
        install_jupyterhub_auth();
    }
    else if (oauth_service_account) {
        console.log('Install OpenShift auth support');
        await install_openshift_auth();
    }
    else if (auth_username) {
        console.log('Install HTTP Basic auth support');
        install_basic_auth();
    }
}

// Setup handler for default page and routes. If no overrides of any
// sort are defined then redirect to /terminal.

function set_default_page() {
    var default_route = process.env.DEFAULT_ROUTE || '/terminal';

    var default_index = path.join(__dirname, 'routes', 'index.js');
    var override_index = '/opt/app-root/gateway/routes/index.js';

    if (fs.existsSync(override_index)) {
        console.log('Set index to', override_index); 
        app.get('^' + uri_root_path + '/?$', require(override_index));
    }
    else if (fs.existsSync(default_index)) {
        console.log('Set index to', default_index); 
        app.get('^' + uri_root_path + '/?$', require(default_index));
    }
    else {
        console.log('Set index to', default_route); 
        app.get('^' + uri_root_path + '/?$', function (req, res) {
            res.redirect(uri_root_path + default_route);
        });
    }
}

function install_routes(directory) {
    if (fs.existsSync(directory)) {
        var files = fs.readdirSync(directory);

        for (var i=0; i<files.length; i++) {
            var filename = files[i];

            if (filename.endsWith('.js')) {
                var basename = filename.split('.').slice(0, -1).join('.');

                if (basename != 'index') {
                    var prefix = uri_root_path + '/' + basename;

                    app.get('^' + prefix + '$', function (req, res) {
                        res.redirect(url.parse(req.url).pathname + '/');
                    });

                    var pathname = path.join(directory, filename);
                    var router = require(pathname);

                    console.log('Install route for', pathname);

                    app.use(prefix + '/', router);
                }
            }
        }
    }
}

function setup_routing() {
    set_default_page();

    install_routes(path.join(__dirname, 'routes'));
    install_routes('/opt/workshop/gateway/routes');
}

// Start the listener.

function start_listener() {
    console.log('Start listener.');

    app.listen(10080);
}

// Setup everything and start listener.

async function main() {
    try {
        await setup_access();
        setup_routing();
        start_listener();
    } catch (err) {
        console.log('ERROR', err);
    }
}

main();
