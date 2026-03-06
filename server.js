// Simple dev server: serves static files + proxies /route to GraphHopper
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = 5500;
const GH_PORT = 8989;
const ROOT    = __dirname;

const MIME = {
    '.html':    'text/html; charset=utf-8',
    '.js':      'application/javascript; charset=utf-8',
    '.css':     'text/css; charset=utf-8',
    '.json':    'application/json; charset=utf-8',
    '.geojson': 'application/json; charset=utf-8',
    '.png':     'image/png',
    '.jpg':     'image/jpeg',
    '.svg':     'image/svg+xml',
    '.ico':     'image/x-icon',
    '.osm':     'application/xml',
};

const server = http.createServer((req, res) => {
    const cors = {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
    };

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        res.end();
        return;
    }

    // Proxy POST /route → GraphHopper
    if (req.method === 'POST' && req.url.startsWith('/route')) {
        const options = {
            hostname: 'localhost',
            port: GH_PORT,
            path: req.url,
            method: 'POST',
            headers: { ...req.headers, host: `localhost:${GH_PORT}` },
        };
        const proxy = http.request(options, (ghRes) => {
            res.writeHead(ghRes.statusCode, { ...ghRes.headers, ...cors });
            ghRes.pipe(res);
        });
        proxy.on('error', (e) => {
            console.error('[proxy] GraphHopper error:', e.message);
            res.writeHead(502, cors);
            res.end(JSON.stringify({ error: 'GraphHopper not running: ' + e.message }));
        });
        req.pipe(proxy);
        return;
    }

    // Serve static files
    let url = req.url.split('?')[0]; // strip query string
    // Redirect root to app
    if (url === '/') {
        res.writeHead(302, { ...cors, Location: '/Web/AppUI/' });
        res.end();
        return;
    }
    // Directory index
    if (url === '/Web/AppUI' || url === '/Web/AppUI/') url = '/Web/AppUI/index.html';

    const filePath    = path.join(ROOT, url);
    const ext         = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500, cors);
            res.end(err.code === 'ENOENT' ? 'Not found: ' + url : 'Server error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType, ...cors });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`✅  Site       → http://localhost:${PORT}/`);
    console.log(`✅  GH proxy   → http://localhost:${PORT}/route → :${GH_PORT}`);
});
