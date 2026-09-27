import "server-only";

/**
 * One fetch wrapper for every store API: no caching, a timeout, backoff on 429,
 * and an error that says which platform failed and why in words a person can act
 * on - never the credential, which some APIs echo back in their error bodies.
 */

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function request(
  platform: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
      });
    } catch (e) {
      throw new ConnectorError(
        `Could not reach ${platform} at ${new URL(url).host}. ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (res.status !== 429 && res.status !== 503) return res;
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
  }
  throw new ConnectorError(`${platform} kept rate-limiting the sync. Try again in a few minutes.`, 429);
}

/** Throws a readable error for anything but 2xx. */
export async function json<T>(platform: string, res: Response, what: string): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  const body = (await res.text()).replace(/(ck|cs|sk|shpat|shpca|shpss)_[A-Za-z0-9]+/g, "[key]").slice(0, 240);
  if (res.status === 401 || res.status === 403) {
    throw new ConnectorError(
      `${platform} refused the credentials while ${what} (${res.status}). Reconnect the store, and check the key has read access to orders. ${body}`,
      res.status,
    );
  }
  if (res.status === 404) {
    throw new ConnectorError(`${platform} returned 404 while ${what} — check the store address. ${body}`, 404);
  }
  throw new ConnectorError(`${platform} returned ${res.status} while ${what}. ${body}`, res.status);
}

/** https://, no trailing slash, no path beyond what the user typed for a subfolder install. */
export function normalizeSiteUrl(raw: string): string {
  let s = raw.trim();
  if (!s) throw new ConnectorError("Enter the store's web address.");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const u = new URL(s);
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
}
