#!/usr/bin/env node
/**
 * TripSalama - Live Reload Server
 *
 * Lance un serveur de développement avec Live Reload
 * pour tester sur navigateur ET téléphone via WiFi
 *
 * Usage:
 *   npm run dev          # Navigateur seulement
 *   npm run dev:mobile   # Navigateur + téléphone WiFi
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');

// Get local IP for WiFi testing
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

// Live reload script to inject
const liveReloadScript = `
<script>
(function() {
    const ws = new WebSocket('ws://' + location.host.split(':')[0] + ':${PORT + 1}');
    ws.onmessage = function(e) {
        if (e.data === 'reload') {
            console.log('[Live Reload] Reloading...');
            location.reload();
        }
    };
    ws.onopen = function() {
        console.log('[Live Reload] Connected');
    };
    ws.onclose = function() {
        console.log('[Live Reload] Disconnected, reconnecting...');
        setTimeout(() => location.reload(), 2000);
    };
})();
</script>
`;

// File watcher for auto-reload
let wsClients = [];
let debounceTimer = null;

function notifyClients() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        wsClients.forEach(ws => {
            try {
                ws.send('reload');
            } catch (e) {}
        });
    }, 100);
}

// Watch for file changes
function watchFiles(dir) {
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename && !filename.includes('node_modules')) {
            console.log(`[Watch] ${filename} changed`);
            notifyClients();
        }
    });
}

// HTTP Server
const server = http.createServer((req, res) => {
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);

    // Remove query string
    filePath = filePath.split('?')[0];

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // Try index.html for SPA routing
                fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, content2) => {
                    if (err2) {
                        res.writeHead(404);
                        res.end('Not Found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        // Inject live reload script
                        const html = content2.toString().replace('</body>', liveReloadScript + '</body>');
                        res.end(html);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });

            // Inject live reload script into HTML
            if (ext === '.html') {
                const html = content.toString().replace('</body>', liveReloadScript + '</body>');
                res.end(html);
            } else {
                res.end(content);
            }
        }
    });
});

// WebSocket for live reload
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: PORT + 1 });

wss.on('connection', (ws) => {
    wsClients.push(ws);
    ws.on('close', () => {
        wsClients = wsClients.filter(c => c !== ws);
    });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 TripSalama Live Reload Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📱 Local:    http://localhost:${PORT}`);
    console.log(`📡 WiFi:     http://${localIP}:${PORT}`);
    console.log(`🔄 Reload:   ws://${localIP}:${PORT + 1}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Pour tester sur téléphone:');
    console.log(`1. Connecte ton téléphone au même WiFi`);
    console.log(`2. Ouvre http://${localIP}:${PORT} dans le navigateur`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Watch for file changes
    watchFiles(PUBLIC_DIR);
    console.log('[Watch] Watching public/ for changes...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    wss.close();
    server.close();
    process.exit(0);
});
