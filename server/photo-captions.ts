type CaptionEnvironment = Record<string, string | undefined>;

const captionReadError = "Could not load photo captions.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mediaId(value: unknown): number {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || Number(value.id) < 1) {
    throw new Error(captionReadError);
  }
  return Number(value.id);
}

function mediaPage(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error(captionReadError);
  }
  return value;
}

/** Return only actual captions belonging to anonymously visible photos. */
export function projectPhotoCaptions(value: unknown, publicIds: ReadonlySet<number>): Record<string, string> {
  const captions: Record<string, string> = {};
  for (const item of mediaPage(value)) {
    const id = mediaId(item);
    if (!isRecord(item) || !isRecord(item.caption) || typeof item.caption.raw !== "string") {
      throw new Error(captionReadError);
    }
    if (publicIds.has(id)) captions[String(id)] = item.caption.raw;
  }
  return captions;
}

function mediaOrigin(value: string): string {
  // Zero's query sandbox does not provide the browser URL constructor.
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?\/?$/i.test(value)) {
    throw new Error("Invalid WordPress media origin.");
  }
  return value.replace(/\/$/, "");
}

/** Runs only on the server; the media token never enters the public query result. */
export async function readPhotoCaptions(env: CaptionEnvironment): Promise<Record<string, string>> {
  const configuredOrigin = env.WP_MEDIA_ORIGIN?.trim();
  const token = env.WP_MEDIA_TOKEN?.trim();
  if (!configuredOrigin || !token) return {};

  const origin = mediaOrigin(configuredOrigin);
  const mediaUrl = `${origin}/wp-json/wp/v2/media?media_type=image&per_page=100&orderby=date&order=desc`;

  try {
    const publicResponse = await fetch(`${mediaUrl}&context=view&_fields=id`, {
      headers: { Accept: "application/json" }, credentials: "omit", redirect: "error", cache: "no-store",
    });
    if (!publicResponse.ok) throw new Error();
    const publicIds = new Set(mediaPage(await publicResponse.json()).map(mediaId));
    if (!publicIds.size) return {};

    const captionsUrl = `${mediaUrl}&context=edit&include=${[...publicIds].join(",")}&_fields=id,caption`;
    const response = await fetch(captionsUrl, {
      headers: { Accept: "application/json", "X-SF-Authorization": `Bearer ${token}` },
      credentials: "omit", redirect: "error", cache: "no-store",
    });
    if (!response.ok) throw new Error();
    return projectPhotoCaptions(await response.json(), publicIds);
  } catch {
    // Upstream errors may contain request headers or private response content.
    throw new Error(captionReadError);
  }
}
