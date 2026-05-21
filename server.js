const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'writings.json');

function readWritings() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error('Error reading writings:', err);
    return [];
  }
}

function writeWritings(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function generateId() {
  return 'w-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      callback(null, parsed);
    } catch (err) {
      callback(err);
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === '/api/writings' && req.method === 'GET') {
    const items = readWritings();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(items));
    return;
  }

  if (pathname === '/api/writings' && req.method === 'POST') {
    parseBody(req, (err, body) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      const { title, category, bab, content, references, createdAt } = body;
      if (!title || !category || !content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: title, category, content' }));
        return;
      }
      const items = readWritings();
      const writing = {
        id: generateId(),
        title: String(title),
        category: String(category),
        bab: bab ? String(bab) : '',
        content: String(content),
        references: Array.isArray(references) ? references.map(String) : [],
        createdAt: createdAt ? String(createdAt) : new Date().toISOString()
      };
      items.unshift(writing);
      writeWritings(items);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(writing));
    });
    return;
  }

  if (pathname.match(/^\/api\/writings\/[^/]+$/) && req.method === 'DELETE') {
    const id = decodeURIComponent(pathname.split('/').pop());
    const items = readWritings();
    const filtered = items.filter(item => item.id !== id);
    if (filtered.length === items.length) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Writing not found' }));
      return;
    }
    writeWritings(filtered);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname.match(/^\/api\/writings\/[^/]+\/pdf$/) && req.method === 'GET') {
    const id = decodeURIComponent(pathname.split('/')[3]);
    const items = readWritings();
    const writing = items.find(item => item.id === id);
    if (!writing) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Writing not found' }));
      return;
    }
    const safe = (writing.title || 'document').replace(/[^a-z0-9\-_\. ]/gi, '_');
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${safe}.txt"`
    });
    res.end(`${writing.title}\n${'='.repeat(writing.title.length)}\n\nCategory: ${writing.category}${writing.bab ? '\nBab: ' + writing.bab : ''}\nPublished: ${new Date(writing.createdAt).toLocaleString()}\n\n${writing.content}${writing.references.length ? '\n\nReferences:\n' + writing.references.map((r, i) => `${i + 1}. ${r}`).join('\n') : ''}`);
    return;
  }

  const filePath = pathname === '/' ? path.join(__dirname, 'index.html') : path.join(__dirname, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(filePath, res);
  } else {
    serveFile(path.join(__dirname, 'index.html'), res);
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
