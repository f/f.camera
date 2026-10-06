import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createRequire } from "node:module";

// Run the installed Zero compiler/runtime unchanged. Its printed bootstrap URL
// supplies an ephemeral local capability, kept here rather than in the browser.
export async function startZeroRuntime(directory, { watch = true } = {}) {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const cli = createRequire(import.meta.url).resolve("spacefast");
  const child = spawn(
    process.execPath,
    [
      cli,
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      watch ? "--watch" : "--no-watch",
    ],
    {
      cwd: directory,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const redact = (text) =>
    text.replace(
      /zero-dev-capability=[\w-]+/g,
      "zero-dev-capability=[private]",
    );
  let output = "";
  let ready = false;
  const capability = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Zero dev did not start within 30 seconds."));
    }, 30000);
    const fail = (error) => {
      clearTimeout(timer);
      reject(error);
    };
    child.once("error", fail);
    child.once("exit", (code) => {
      if (!ready)
        fail(new Error(`Zero dev exited (${code}): ${redact(output)}`));
    });
    child.stdout.on("data", (bytes) => {
      output = (output + bytes).slice(-32768);
      const match = output.match(/#zero-dev-capability=([\w-]+)/);
      if (!ready && match) {
        ready = true;
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.stderr.on("data", (bytes) => {
      output = (output + bytes).slice(-32768);
      if (ready) process.stderr.write(redact(String(bytes)));
    });
  });
  return {
    origin: `http://127.0.0.1:${port}`,
    capability,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await once(child, "exit");
    },
  };
}
