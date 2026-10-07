import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { loadPhotoMedia } from "../client/data/photos.ts";

test("public media loads without a session and rejects failed or malformed responses", async (context) => {
  const photos = [{ id: 30, source_url: "/photo.jpg", caption: { raw: "A real caption" } }];
  const responses = [
    [429, "Too Many Requests"],
    [200, "{broken json"],
    [200, JSON.stringify({ code: "upstream_error" })],
    [200, JSON.stringify([{ id: 30 }])],
    [200, JSON.stringify(photos)],
    [200, "[]"],
  ];
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ url: new URL(request.url, "http://localhost"), headers: request.headers });
    const [status, body] = responses.shift();
    response.writeHead(status, { "content-type": "application/json" });
    response.end(body);
  });
  context.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (let failure = 0; failure < 4; failure++) {
    await assert.rejects(loadPhotoMedia(origin));
  }
  assert.deepEqual(await loadPhotoMedia(origin), photos);
  assert.deepEqual(await loadPhotoMedia(origin), []);
  assert.equal(requests.length, 6);
  for (const { url, headers } of requests) {
    assert.equal(url.pathname, "/wp-json/wp/v2/media");
    assert.equal(url.searchParams.get("media_type"), "image");
    assert.equal(url.searchParams.get("order"), "desc");
    assert.equal(headers.authorization, undefined);
  }
});
