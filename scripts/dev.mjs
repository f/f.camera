import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { siteFiles } from './site-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };

// Development only. WordPress remains the source of truth on the hosted site.
export async function createDevServer({ wpOrigin, fixture } = {}) {
  const origin = new URL(wpOrigin || 'https://f.camera');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('--wp-origin must be an HTTP(S) origin without a path or credentials.');
  }
  const demo = fixture ?? (wpOrigin ? null : JSON.parse(await readFile(new URL('../tests/fixtures/media.json', import.meta.url), 'utf8')));
  const imagePaths = new Set();

  function localMedia(items, localOrigin) {
    const imageUrl = (value) => {
      const url = new URL(value, origin);
      if (url.origin !== origin.origin) return url.href;
      imagePaths.add(url.pathname);
      return `${localOrigin}${url.pathname}${url.search}`;
    };
    return items.map((item) => {
      const details = item.media_details || {};
      if (details.original_image) imageUrl(new URL(details.original_image, new URL(item.source_url, origin)).href);
      return {
        ...item,
        source_url: imageUrl(item.source_url),
        media_details: { ...details, sizes: Object.fromEntries(Object.entries(details.sizes || {}).map(([name, size]) => [name, { ...size, source_url: imageUrl(size.source_url) }])) },
      };
    });
  }

  async function remote(url, maximum = 20 * 1024 * 1024) {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Public WordPress origin returned HTTP ${response.status}.`);
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > maximum) throw new Error('Public WordPress response exceeded the preview limit.');
      chunks.push(chunk);
    }
    return { bytes: Buffer.concat(chunks), type: response.headers.get('content-type') || 'application/octet-stream' };
  }

  return createServer(async (request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      response.writeHead(status, { 'content-type': type });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('allow', 'GET, HEAD');
      return send(405, 'This preview is read-only.');
    }
    try {
      // Derive local URLs from the listener, never from an untrusted Host header.
      const localOrigin = `http://127.0.0.1:${response.socket.localPort}`;
      const url = new URL(request.url, localOrigin);
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === '/wp-json/wp/v2/media') {
        const items = demo || JSON.parse((await remote(new URL(`/wp-json/wp/v2/media${url.search}`, origin), 1024 * 1024)).bytes);
        if (!Array.isArray(items)) throw new Error('Expected a public WordPress media list.');
        return send(200, JSON.stringify(localMedia(items, localOrigin)), types['.json']);
      }
      if (imagePaths.has(pathname)) {
        const file = await remote(new URL(`${url.pathname}${url.search}`, origin));
        return send(200, file.bytes, file.type);
      }
      const file = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!siteFiles.includes(file)) return send(404, 'Not found.');
      return send(200, await readFile(join(root, file)), types[extname(file)]);
    } catch (error) {
      console.error(error.message);
      send(502, 'Preview data could not load. Check the public WordPress origin and your internet connection.');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '4173' }, 'wp-origin': { type: 'string' } } });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be between 1 and 65535.');
  const server = await createDevServer({ wpOrigin: values['wp-origin'] });
  server.listen(port, '127.0.0.1', () => {
    console.log(`f.camera preview: http://127.0.0.1:${port}`);
    console.log(values['wp-origin'] ? 'Using anonymous public WordPress data.' : 'Using demo JSON; sample images load anonymously from f.camera.');
  });
  server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}
