// server.mjs - NexusMind HTTP server
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

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

server.listen(PORT, () => {
  console.log(`\n  NexusMind → http://localhost:${PORT}\n`);
  console.log(`  Ollama    → http://localhost:11434\n`);
});
