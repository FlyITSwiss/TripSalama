/**
 * Simple HTTPS Proxy for Android Emulator
 * Routes requests from emulator to production API through host
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PROXY_PORT = 8888;
const TARGET_HOST = 'stabilis-it.ch';

const server = http.createServer((req, res) => {
    const targetPath = req.url;
    const timestamp = new Date().toISOString();
    const origin = req.headers.origin || 'no-origin';

    console.log(`\n[${timestamp}] ==================`);
    console.log(`[PROXY] ${req.method} ${targetPath}`);
    console.log(`[PROXY] Origin: ${origin}`);
    console.log(`[PROXY] User-Agent: ${req.headers['user-agent'] || 'none'}`);

    // Handle CORS preflight - echo back exact origin for credentials support
    const allowedOrigin = origin !== 'no-origin' ? origin : '*';

    if (req.method === 'OPTIONS') {
        console.log(`[PROXY] CORS preflight - responding 204 with origin: ${allowedOrigin}`);
        res.writeHead(204, {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, Accept, Origin, X-Requested-With',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    // Build target URL
    const targetUrl = `https://${TARGET_HOST}${targetPath}`;

    // Collect request body
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
        body = Buffer.concat(body);

        // Forward headers (excluding host)
        const headers = { ...req.headers };
        delete headers.host;
        headers['host'] = TARGET_HOST;

        const options = {
            hostname: TARGET_HOST,
            port: 443,
            path: targetPath,
            method: req.method,
            headers: headers,
            rejectUnauthorized: true
        };

        const proxyReq = https.request(options, (proxyRes) => {
            console.log(`[PROXY] Response: ${proxyRes.statusCode}`);
            console.log(`[PROXY] Content-Type: ${proxyRes.headers['content-type'] || 'none'}`);

            // Forward response headers with CORS override - use exact origin for credentials
            const responseHeaders = { ...proxyRes.headers };
            responseHeaders['access-control-allow-origin'] = allowedOrigin;
            responseHeaders['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            responseHeaders['access-control-allow-headers'] = 'Content-Type, Authorization, X-CSRF-Token, Accept, Origin, X-Requested-With';
            responseHeaders['access-control-allow-credentials'] = 'true';

            res.writeHead(proxyRes.statusCode, responseHeaders);

            // Collect and log body for debugging
            let responseBody = [];
            proxyRes.on('data', chunk => {
                responseBody.push(chunk);
                res.write(chunk);
            });
            proxyRes.on('end', () => {
                const fullBody = Buffer.concat(responseBody).toString();
                if (fullBody.length < 500) {
                    console.log(`[PROXY] Body: ${fullBody}`);
                } else {
                    console.log(`[PROXY] Body (truncated): ${fullBody.substring(0, 200)}...`);
                }
                res.end();
            });
        });

        proxyReq.on('error', (e) => {
            console.error(`[PROXY] Error: ${e.message}`);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Proxy error', message: e.message }));
        });

        // Send request body
        if (body.length > 0) {
            proxyReq.write(body);
        }
        proxyReq.end();
    });
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Proxy server running on port ${PROXY_PORT}`);
    console.log(`   Target: https://${TARGET_HOST}`);
    console.log(`   Emulator should use: http://10.0.2.2:${PROXY_PORT}/internal/tripsalama/api\n`);
});
