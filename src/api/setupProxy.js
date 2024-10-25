// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
    app.use(
        '/api',
        createProxyMiddleware({
            target: 'https://rafael-correia-y0tjz.ws.msging.net',
            changeOrigin: true,
            pathRewrite: {
                '^/api': '/api', // Reescreve a URL para manter a mesma estrutura
            },
        })
    );
};
