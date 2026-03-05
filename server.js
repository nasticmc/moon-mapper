const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'pois.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]\n', 'utf8');
  }
}

async function readPOIs() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid POI data format');
  }
  return parsed;
}

async function writePOIs(pois) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, `${JSON.stringify(pois, null, 2)}\n`, 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function isValidPOI(poi) {
  return (
    poi &&
    typeof poi.id === 'string' &&
    typeof poi.name === 'string' && poi.name.trim().length > 0 &&
    typeof poi.description === 'string' &&
    typeof poi.lat === 'number' && Number.isFinite(poi.lat) && poi.lat >= -90 && poi.lat <= 90 &&
    typeof poi.lon === 'number' && Number.isFinite(poi.lon) && poi.lon >= -180 && poi.lon <= 180 &&
    Array.isArray(poi.links) &&
    Array.isArray(poi.files)
  );
}

async function parseRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function safeJoin(root, requestedPath) {
  const candidate = path.normalize(path.join(root, requestedPath));
  if (!candidate.startsWith(root)) {
    return null;
  }
  return candidate;
}

async function handleStatic(req, res) {
  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const pathname = requestPath.split('?')[0];
  const filePath = safeJoin(ROOT, pathname);

  if (!filePath) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      sendText(res, 403, 'Forbidden');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    sendText(res, 404, 'Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendText(res, 400, 'Bad Request');
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/pois')) {
      const pois = await readPOIs();
      sendJson(res, 200, { pois });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/pois') {
      const incoming = await parseRequestBody(req);
      if (!isValidPOI(incoming)) {
        sendJson(res, 400, { error: 'Invalid POI payload.' });
        return;
      }

      const pois = await readPOIs();
      pois.unshift(incoming);
      await writePOIs(pois);
      sendJson(res, 201, { poi: incoming, total: pois.length });
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      await handleStatic(req, res);
      return;
    }

    sendText(res, 405, 'Method Not Allowed');
  } catch (error) {
    sendJson(res, 500, { error: 'Server error', details: error.message });
  }
});

server.listen(PORT, HOST, async () => {
  await ensureDataFile();
  console.log(`Moon Mapper server running at http://${HOST}:${PORT}`);
});
