var express = require('express');
var proxy = require('http-proxy-middleware');

// Setup proxying to terminal application. If no terminal session is
// provided, redirect to session 1. This ensures user always get the
// same session and not a new one each time if refresh the web browser
// or access same URL from another browser window.

var app = express();

app.get('^/?$', function (req, res) {
    res.redirect(req.baseUrl + '/session/1');
})

app.use(proxy({
    target: 'http://127.0.0.1:8081',
    ws: true
}));

module.exports = app
