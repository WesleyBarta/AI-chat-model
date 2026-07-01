// server.mjs - NexusMind HTTP server + API proxy
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const OLLAMA_URL = 'http://localhost:11434';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.onnx': 'application/octet-stream',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ─── API Routes ───────────────────────────────────────────────
  if (req.url.startsWith('/api/chat')) {
    proxyChat(req, res);
    return;
  }

  if (req.url === '/api/status') {
    checkOllamaStatus(res);
    return;
  }

  // ─── Static Files ─────────────────────────────────────────────
  let filePath = req.url === '/' ? '/public/index.html' : req.url;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const type = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

// ─── Chat Proxy ────────────────────────────────────────────────
function proxyChat(req, res) {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString());

      const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: body.model || 'llama3.2',
          messages: body.messages || [],
          stream: body.stream || false,
          options: body.options || {}
        })
      });

      if (!ollamaRes.ok) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ollama error', status: ollamaRes.status }));
        return;
      }

      if (body.stream) {
        // Streaming — pipe SSE directly
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        ollamaRes.body.pipe(res);
      } else {
        const data = await ollamaRes.json();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

// ─── Ollama Status ─────────────────────────────────────────────
function checkOllamaStatus(res) {
  fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    .then(r => r.json())
    .then(data => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ available: true, models: data.models || [] }));
    })
    .catch(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ available: false, models: [] }));
    });
}

// ─── Start ─────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`  NexusMind → http://localhost:${PORT}`);
  console.log(`  Ollama    → http://localhost:11434`);
  console.log(`  API       → http://localhost:${PORT}/api/chat`);
  console.log();
});