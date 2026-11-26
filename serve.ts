// Tiny static file server for local development only (Node 22,
// standard library only). Serves the app/ folder so HomeLedger can
// be tried in a browser without any build step:
//   node serve.ts            -> http://localhost:8080
//   node serve.ts --port 8090 -> http://localhost:8090
// Only files inside app/ are ever served; anything else gets a 404.

import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const flagAt = process.argv.indexOf('--port');
const wanted = flagAt === -1 ? NaN : Number(process.argv[flagAt + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

const server = createServer((req, res) => {
  const raw = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  let path = raw;
  try { path = decodeURIComponent(raw); } catch { res.writeHead(400); res.end('bad path'); return; }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(appRoot, path));
  const inside = file === appRoot || file.startsWith(appRoot + sep);
  if (!inside) { res.writeHead(403); res.end('forbidden'); return; }
  let body;
  try {
    if (!statSync(file).isFile()) throw new Error('nope');
    body = readFileSync(file);
  } catch {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, {
    'content-type': types.get(extname(file).toLowerCase()) || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`HomeLedger is on http://localhost:${port}`);
});
