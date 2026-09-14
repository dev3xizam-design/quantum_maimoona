"use client";

/**
 * A failing API call does not always answer in JSON. A timed-out function, a
 * rejected body size or a proxy error come back as HTML or plain text, and
 * calling res.json() on those produced the useless
 * "Unexpected token 'A', "An error o"... is not valid JSON".
 * Read the body as text first and turn it into something a person can act on.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly sessionExpired = false,
  ) {
    super(message);
  }
}

export async function postJson<T = unknown>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (res.ok) return parsed as T;

  const fromJson =
    parsed && typeof parsed === "object" && "error" in parsed
      ? String((parsed as { error: unknown }).error)
      : null;

  if (res.status === 401) {
    throw new ApiError(
      "Your session has expired. Sign in again, then retry the upload — nothing was saved.",
      401,
      true,
    );
  }
  if (res.status === 413) {
    throw new ApiError(
      "That batch was too large for one request. This is a bug — please report it.",
      413,
    );
  }
  if (res.status === 504 || /timed? ?out|FUNCTION_INVOCATION_TIMEOUT/i.test(text)) {
    throw new ApiError(
      "The server took too long and gave up. Try a smaller file, or upload it again — rows already stored are not duplicated.",
      504,
    );
  }

  throw new ApiError(
    fromJson ?? `The server returned an error (${res.status}). ${text.slice(0, 160)}`.trim(),
    res.status,
  );
}
