/** Read the native Zero query with an explicit argument object. */
export async function loadPhotoCaptions(origin = "") {
  const response = await fetch(`${origin}/__zero/run`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    // Keep this read's argument shape consistent across dev and hosted runtimes.
    body: JSON.stringify({ op: "query.run", name: "photoCaptions", args: {} }),
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true || result.op !== "query.result" ||
      result.name !== "photoCaptions" || !result.data ||
      typeof result.data !== "object" || Array.isArray(result.data) ||
      Object.values(result.data).some((value) => typeof value !== "string")) {
    throw new Error("Could not load photo notes.");
  }
  return /** @type {Record<string, string>} */ (result.data);
}
