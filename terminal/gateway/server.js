var express = require('express');
var basic_auth = require('express-basic-auth')
var session = require('express-session');
var uuid = require('uuid');
var http = require('http');
var path = require('path');
var url = require('url');
var fs = require('fs');

// Setup the root application. Everything will actually be under a
// mount point corresponding to the specific user. This is added in
// each of the routes when defined.

var app = express();

var uri_root_path = process.env.URI_ROOT_PATH || '';

// For standalone container deployment, provide the ability to enable
// authentication using HTTP Basic authentication. In this case there
// will be no user object added to the client session.

var auth_username = process.env.AUTH_USERNAME;
var auth_password = process.env.AUTH_PASSWORD;

if (auth_username) {
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

var hostname = process.env.HOSTNAME;

if (jupyterhub_client_id) {
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

            // This retrieves the next URL to redirect to from the session
            // for this particular oauth handshake.

            var next_url = req.session.handshakes[state];
            delete req.session.handshakes[state];

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

        if (Object.keys(req.session.handshakes).length > 10) {
            // If the number of oustanding auth handshakes gets to be
            // too many, something fishy going on so clear them all and
            // start over again.

            req.session.handshakes = {}
        }

        state = uuid.v4();
        req.session.handshakes[state] = req.query.next;

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
        if (!req.session.handshakes)
            req.session.handshakes = {};

        if (!req.session.user) {
            next_url = encodeURIComponent(req.url);
            res.redirect(uri_root_path + '/oauth_handshake?next=' + next_url);
        }
        else {
            next();
        }
    })
}

// Setup handler for default page. If no overrides of any sort are
// defined then redirect to /terminal.

var default_route = process.env.DEFAULT_ROUTE || '/terminal';

var default_index = '/opt/workshop/gateway/routes/index.js';
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

// Setup routes for handlers.

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

install_routes('/opt/app-root/gateway/routes');
install_routes('/opt/workshop/gateway/routes');

// Start listening for requests.

app.listen(8080);
