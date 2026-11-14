import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const port = Number(process.env.TRAINING_PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.zip': 'application/zip' };

createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      .replace(/^\/AI_teach_website(?=\/|$)/, '');
    let file = resolve(root, '.' + path);
    if (file !== root && !file.startsWith(root + sep)) throw new Error('outside dist');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    if (!(await stat(file)).isFile()) throw new Error('missing file');
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Page not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/AI_teach_website/`));
