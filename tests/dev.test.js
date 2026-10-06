import assert from "node:assert/strict";
import test from "node:test";
import { createServer, request } from "node:http";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createDevServer } from "../scripts/dev.mjs";

async function listen(server, context) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(async () => {
    if (server.stop) return server.stop();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("native Zero preview serves its compiled client and runtime beside read-only demo media", async (context) => {
  const origin = await listen(await createDevServer({ watch: false }), context);
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
  for (const headers of [
    { host: "rebound.example" },
    { host: "rebound.example", connection: "Upgrade", upgrade: "websocket" },
  ]) {
    const wrongHostStatus = await new Promise((resolve, reject) => {
      const probe = request(origin, { headers }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      probe.once("error", reject);
      probe.end();
    });
    assert.equal(wrongHostStatus, 403);
  }
  assert.equal(
    (
      await fetch(`${origin}/__zero/config`, {
        headers: { origin: "https://other.example" },
      })
    ).status,
    403,
  );
  const client = await fetch(`${origin}/client.js`);
  assert.equal(client.status, 200);
  assert.equal(
    client.headers.get("content-type"),
    "application/javascript; charset=utf-8",
  );
  const config = await (await fetch(`${origin}/__zero/config`)).json();
  assert.equal(config.runtimeKind, "zero");
  assert.equal(
    config.realtime.centralUrl,
    `${origin.replace("http:", "ws:")}/__zero/realtime`,
  );
  const auth = await (
    await fetch(`${origin}/__zero/run`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ op: "auth.get", id: 1 }),
    })
  ).json();
  assert.equal(auth.op, "auth.result");
  await new Promise((resolve, reject) => {
    const upgrade = request(
      `${origin}/__zero/realtime`,
      {
        headers: {
          connection: "Upgrade",
          upgrade: "websocket",
          "sec-websocket-version": "13",
          "sec-websocket-key": randomBytes(16).toString("base64"),
          origin,
        },
      },
      () => reject(new Error("Native WebSocket upgrade refused.")),
    );
    upgrade.setTimeout(5000, () =>
      upgrade.destroy(new Error("Native WebSocket upgrade timed out.")),
    );
    upgrade.once("upgrade", (response, socket) => {
      assert.equal(response.statusCode, 101);
      socket.destroy();
      resolve();
    });
    upgrade.once("error", reject);
    upgrade.end();
  });
  const media = await (await fetch(`${origin}/wp-json/wp/v2/media`)).json();
  assert.equal(media.length, 6);
  assert.equal(new URL(media[0].source_url).origin, origin);
  assert.equal(
    media.filter((photo) => photo.description.rendered.trim()).length,
    2,
  );
  for (const path of [
    "/.env",
    "/package.json",
    "/server/index.ts",
    "/scripts/dev.mjs",
    "/tests/fixtures/media.json",
  ]) {
    assert.equal((await fetch(`${origin}${path}`)).status, 404);
  }
  assert.equal(
    (await fetch(`${origin}/wp-json/wp/v2/media`, { method: "POST" })).status,
    405,
  );
});

test("optional public WordPress origin returns local image URLs and proxies only listed media", async (context) => {
  const jpeg = await readFile(
    new URL("./fixtures/exif-gps.jpg", import.meta.url),
  );
  const upstream = await listen(
    createServer((request, response) => {
      if (request.url.startsWith("/wp-json/wp/v2/media")) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify([
            {
              id: 91,
              source_url: "/photo.jpg",
              media_details: { width: 1, height: 1, sizes: {} },
            },
          ]),
        );
      } else if (request.url === "/photo.jpg") {
        response.setHeader("content-type", "image/jpeg");
        response.end(jpeg);
      } else {
        response.writeHead(404).end();
      }
    }),
    context,
  );
  const origin = await listen(
    await createDevServer({ wpOrigin: upstream, watch: false }),
    context,
  );
  const photos = await (
    await fetch(`${origin}/wp-json/wp/v2/media?per_page=100`)
  ).json();
  assert.equal(photos[0].id, 91);
  assert.equal(photos[0].source_url, `${origin}/photo.jpg`);
  const image = await fetch(photos[0].source_url);
  assert.equal(image.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), jpeg);
  assert.equal((await fetch(`${origin}/unlisted.jpg`)).status, 404);
});
