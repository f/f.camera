import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { loadWithRetry, waitToRetry } from "../client/lib/load-retry.js";

test("failed loads keep retrying with capped delays, then stop on success", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  context.mock.method(Math, "random", () => 0);
  let failures = 0;
  const controller = new AbortController();
  const result = loadWithRetry(async () => {
    if (failures++ < 8) throw new Error("Temporary 429");
    return { 30: "A saved caption" };
  }, controller.signal);
  await setImmediate();
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]) {
    const previous = failures;
    context.mock.timers.tick(delay - 1);
    await setImmediate();
    assert.equal(failures, previous);
    context.mock.timers.tick(1);
    await setImmediate();
    assert.equal(failures, previous + 1);
  }
  assert.deepEqual(await result, { 30: "A saved caption" });
  context.mock.timers.tick(120000);
  await setImmediate();
  assert.equal(failures, 9);
});

test("leaving cancels pending image and note retries and the active request", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const controller = new AbortController();
  const waiting = waitToRetry(0, controller.signal);
  let requestSignal;
  const loading = loadWithRetry((signal) => {
    requestSignal = signal;
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }, controller.signal);
  const rejected = Promise.all([
    assert.rejects(waiting, { name: "AbortError" }),
    assert.rejects(loading, { name: "AbortError" }),
  ]);
  controller.abort();
  await rejected;
  assert.equal(requestSignal.aborted, true);
  context.mock.timers.tick(120000);
});

test("a stalled request times out so a later attempt can load", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  context.mock.method(Math, "random", () => 0);
  let attempts = 0;
  const result = loadWithRetry((signal) => {
    if (++attempts > 1) return Promise.resolve("loaded");
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }, new AbortController().signal);
  context.mock.timers.tick(20000);
  await setImmediate();
  assert.equal(attempts, 1);
  context.mock.timers.tick(1000);
  assert.equal(await result, "loaded");
  assert.equal(attempts, 2);
});
