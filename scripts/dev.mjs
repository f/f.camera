import { createServer, request as httpRequest } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { siteFiles } from "./site-files.mjs";
import { startZeroRuntime } from "./zero-runtime.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};
const isRuntimePath = (path) =>
  ["/", "/client.js", "/zero.css"].includes(path) ||
  path.startsWith("/_spacefast/platform/") ||
  path.startsWith("/__zero/") ||
  path.startsWith("/__spacefast/zero/");

// Development only. WordPress remains the source of truth on the hosted site.
export async function createDevServer({
  wpOrigin,
  watch = true,
} = {}) {
  const origin = new URL(wpOrigin || "https://f.camera");
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(
      "--wp-origin must be an HTTP(S) origin without a path or credentials.",
    );
  }
  const imagePaths = new Set();
  const remoteCache = new Map();
  const pendingReads = new Map();
  let cachedBytes = 0;
  const forget = (key) => {
    cachedBytes -= remoteCache.get(key).file.bytes.length;
    remoteCache.delete(key);
  };
  const runtime = await startZeroRuntime(root, { watch });
  const runtimeHeaders = (request) => ({
    ...request.headers,
    host: new URL(runtime.origin).host,
    origin: runtime.origin,
    authorization: `Bearer ${runtime.capability}`,
  });

  function localMedia(items, localOrigin) {
    const imageUrl = (value) => {
      const url = new URL(value, origin);
      if (url.origin !== origin.origin) return url.href;
      imagePaths.add(url.pathname);
      return `${localOrigin}${url.pathname}${url.search}`;
    };
    return items.map((item) => {
      const details = item.media_details || {};
      if (details.original_image)
        imageUrl(
          new URL(details.original_image, new URL(item.source_url, origin))
            .href,
        );
      return {
        ...item,
        source_url: imageUrl(item.source_url),
        media_details: {
          ...details,
          sizes: Object.fromEntries(
            Object.entries(details.sizes || {}).map(([name, size]) => [
              name,
              { ...size, source_url: imageUrl(size.source_url) },
            ]),
          ),
        },
      };
    });
  }

  async function fetchRemote(url, maximum) {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        `Public WordPress origin returned HTTP ${response.status}.`,
      );
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > maximum)
        throw new Error(
          "Public WordPress response exceeded the preview limit.",
        );
      chunks.push(chunk);
    }
    return {
      bytes: Buffer.concat(chunks),
      type: response.headers.get("content-type") || "application/octet-stream",
    };
  }

  async function remote(
    url,
    { maximum = 20 * 1024 * 1024, maxAge = 10 * 60 * 1000, validate } = {},
  ) {
    const key = url.href;
    for (const [entryKey, entry] of remoteCache) {
      if (entry.expires <= Date.now()) forget(entryKey);
    }
    if (remoteCache.has(key)) return remoteCache.get(key).file;
    if (pendingReads.has(key)) return pendingReads.get(key);
    const pending = (async () => {
      const file = await fetchRemote(url, maximum);
      validate?.(file);
      // Bound both image storage and tiny metadata entries in this preview only.
      while (
        remoteCache.size &&
        (cachedBytes + file.bytes.length > 64 * 1024 * 1024 ||
          remoteCache.size >= 128)
      ) {
        forget(remoteCache.keys().next().value);
      }
      remoteCache.set(key, { file, expires: Date.now() + maxAge });
      cachedBytes += file.bytes.length;
      return file;
    })();
    pendingReads.set(key, pending);
    try {
      return await pending;
    } finally {
      pendingReads.delete(key);
    }
  }

  const server = createServer(async (request, response) => {
    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    const send = (status, body, type = "text/plain; charset=utf-8") => {
      response.writeHead(status, { "content-type": type });
      response.end(request.method === "HEAD" ? undefined : body);
    };
    try {
      // Derive local URLs from the listener, never from an untrusted Host header.
      const localOrigin = `http://127.0.0.1:${response.socket.localPort}`;
      if (request.headers.host !== new URL(localOrigin).host)
        return send(403, "Unexpected preview Host header.");
      const url = new URL(request.url, localOrigin);
      const pathname = decodeURIComponent(url.pathname);
      if (isRuntimePath(pathname)) {
        if (request.headers.origin && request.headers.origin !== localOrigin)
          return send(403, "Cross-origin runtime request refused.");
        const upstream = httpRequest(
          new URL(request.url, runtime.origin),
          { method: request.method, headers: runtimeHeaders(request) },
          (incoming) => {
            if (
              request.method === "GET" &&
              ["/__zero/config", "/__spacefast/zero/config"].includes(pathname)
            ) {
              const chunks = [];
              incoming.on("data", (chunk) => chunks.push(chunk));
              incoming.on("end", () => {
                try {
                  const config = JSON.parse(Buffer.concat(chunks).toString());
                  if (config.realtime?.centralUrl)
                    config.realtime.centralUrl =
                      config.realtime.centralUrl.replace(
                        runtime.origin.replace("http:", "ws:"),
                        localOrigin.replace("http:", "ws:"),
                      );
                  send(
                    incoming.statusCode,
                    JSON.stringify(config),
                    types[".json"],
                  );
                } catch {
                  send(
                    502,
                    "Zero dev returned an invalid runtime configuration.",
                  );
                }
              });
            } else {
              response.writeHead(incoming.statusCode, incoming.headers);
              incoming.pipe(response);
            }
          },
        );
        upstream.on("error", () => {
          if (!response.headersSent)
            send(502, "Zero dev runtime is unavailable.");
          else response.destroy();
        });
        request.pipe(upstream);
        return;
      }
      if (!["GET", "HEAD"].includes(request.method)) {
        response.setHeader("allow", "GET, HEAD");
        return send(405, "WordPress preview data is read-only.");
      }
      if (pathname === "/wp-json/wp/v2/media") {
        const items = JSON.parse(
          (
            await remote(
              new URL(`/wp-json/wp/v2/media${url.search}`, origin),
              {
                maximum: 1024 * 1024,
                maxAge: 45 * 1000,
                validate: (file) => {
                  if (!Array.isArray(JSON.parse(file.bytes)))
                    throw new Error("Expected a public WordPress media list.");
                },
              },
            )
          ).bytes,
        );
        if (!Array.isArray(items))
          throw new Error("Expected a public WordPress media list.");
        return send(
          200,
          JSON.stringify(localMedia(items, localOrigin)),
          types[".json"],
        );
      }
      if (imagePaths.has(pathname)) {
        const file = await remote(
          new URL(`${url.pathname}${url.search}`, origin),
        );
        return send(200, file.bytes, file.type);
      }
      const file = pathname === "/" ? "index.html" : pathname.slice(1);
      if (!siteFiles.includes(file)) return send(404, "Not found.");
      return send(200, await readFile(join(root, file)), types[extname(file)]);
    } catch (error) {
      console.error(error.message);
      send(
        502,
        "Preview data could not load. Check the public WordPress origin and your internet connection.",
      );
    }
  });
  server.on("close", () => {
    void runtime.stop();
  });
  server.on("error", () => {
    void runtime.stop();
  });
  server.stop = async () => {
    await runtime.stop();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
  server.on("upgrade", (request, socket, head) => {
    const localOrigin = `http://127.0.0.1:${socket.localPort}`;
    if (request.headers.host !== new URL(localOrigin).host)
      return socket.end(
        "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
      );
    const url = new URL(request.url, localOrigin);
    if (
      !["/__zero/realtime", "/__spacefast/zero/realtime"].includes(
        url.pathname,
      ) ||
      request.headers.origin !== localOrigin
    )
      return socket.destroy();
    const upstream = httpRequest(new URL(request.url, runtime.origin), {
      headers: runtimeHeaders(request),
    });
    upstream.on("upgrade", (response, peer, remainder) => {
      socket.write(
        `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${response.rawHeaders.reduce((lines, value, index, values) => (index % 2 === 0 ? `${lines}${value}: ${values[index + 1]}\r\n` : lines), "")}\r\n`,
      );
      if (head.length) peer.write(head);
      if (remainder.length) socket.write(remainder);
      socket.on("error", () => peer.destroy());
      peer.on("error", () => socket.destroy());
      socket.pipe(peer).pipe(socket);
    });
    upstream.on("response", () => socket.destroy());
    upstream.on("error", () => socket.destroy());
    upstream.end();
  });
  return server;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({
    options: {
      port: { type: "string", default: "4173" },
      "wp-origin": { type: "string" },
    },
  });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("--port must be between 1 and 65535.");
  const server = await createDevServer({ wpOrigin: values["wp-origin"] });
  server.listen(port, "127.0.0.1", () => {
    console.log(`f.camera Zero preview: http://127.0.0.1:${port}`);
    console.log("Using anonymous public WordPress data.");
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      void server.stop();
    });
}
