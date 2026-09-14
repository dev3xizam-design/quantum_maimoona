import "server-only";
import {
  authHeader,
  normalizeBaseUrl,
  type AuthScheme,
  type MedusaProduct,
} from "./match";

export * from "./match";

const SCHEMES: AuthScheme[] = ["basic-colon", "basic-raw", "bearer"];

/**
 * Minimal Medusa Admin API client.
 *
 * Medusa v2 secret API keys authenticate with HTTP Basic, not Bearer - and
 * different versions disagree on whether the token is base64'd with a trailing
 * colon or raw. Rather than guess, `detectAuthScheme` tries each once and the
 * working one is stored, so every later call is a single request.
 */

export class MedusaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function call(
  baseUrl: string,
  path: string,
  secret: string,
  scheme: AuthScheme,
  signal?: AbortSignal,
) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: authHeader(secret, scheme), Accept: "application/json" },
    signal,
    cache: "no-store",
  });
  return res;
}

export type DetectResult = { scheme: AuthScheme; storeName?: string };

export async function detectAuthScheme(baseUrl: string, secret: string): Promise<DetectResult> {
  let lastStatus = 0;
  let lastBody = "";

  for (const scheme of SCHEMES) {
    let res: Response;
    try {
      res = await call(baseUrl, "/admin/products?limit=1", secret, scheme);
    } catch (e) {
      throw new MedusaError(
        `Could not reach ${baseUrl}. Check the URL is your Medusa backend and that it is running. (${
          e instanceof Error ? e.message : String(e)
        })`,
      );
    }

    if (res.ok) return { scheme };
    lastStatus = res.status;
    lastBody = (await res.text()).slice(0, 200);

    // A 404 means we reached something that is not a Medusa admin API at all.
    if (res.status === 404) {
      throw new MedusaError(
        `${baseUrl}/admin/products returned 404. That does not look like a Medusa backend — use the backend URL, not the storefront.`,
        404,
      );
    }
  }

  throw new MedusaError(
    lastStatus === 401 || lastStatus === 403
      ? "Medusa rejected that key. Make sure it is a SECRET API key (Settings → Secret API Keys), not a Publishable key — publishable keys only reach the storefront API."
      : `Medusa responded ${lastStatus}. ${lastBody}`,
    lastStatus,
  );
}



/** Pages through /admin/products, yielding a page at a time. */
export async function* iterateProducts(
  baseUrl: string,
  secret: string,
  scheme: AuthScheme,
  opts: { pageSize?: number; maxPages?: number } = {},
): AsyncGenerator<MedusaProduct[]> {
  const limit = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 200;
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const res = await call(
      baseUrl,
      `/admin/products?limit=${limit}&offset=${offset}&fields=id,title,metadata,*variants`,
      secret,
      scheme,
    );
    if (!res.ok) {
      throw new MedusaError(
        `Medusa returned ${res.status} while listing products. ${(await res.text()).slice(0, 200)}`,
        res.status,
      );
    }
    const body = (await res.json()) as { products?: MedusaProduct[]; count?: number };
    const products = body.products ?? [];
    if (!products.length) return;

    yield products;
    offset += products.length;
    if (typeof body.count === "number" && offset >= body.count) return;
    if (products.length < limit) return;
  }
}
