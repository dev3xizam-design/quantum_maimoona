import "server-only";

/**
 * "Sign in with Google" for the reporting mailbox. Quantum then reads and sends
 * over Gmail's ordinary mail connection (IMAP and SMTP with the Google token),
 * not the Gmail REST API: a new Cloud project's Gmail API "Total Query Cost"
 * quota refused every message listing, and IMAP/SMTP do not use that quota.
 * Gmail only accepts a token on IMAP/SMTP with the full-mail scope, so that is
 * what the consent screen asks for. Quantum still only reads Sent and sends.
 *
 * Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from an OAuth client the
 * Workspace admin created once (user type INTERNAL: no Google review, and the
 * refresh token does not expire weekly the way an unverified public app's does).
 */
export const MAIL_SCOPE = "https://mail.google.com/";
export const GOOGLE_SCOPES = ["openid", "email", MAIL_SCOPE];

export const GOOGLE_STATE_COOKIE = "q_google_oauth_state";

/** Where Google sends the browser back. Must match the OAuth client's redirect URI exactly. */
export function googleRedirectUri(req: Request) {
  return `${process.env.APP_URL ?? new URL(req.url).origin}/api/google/oauth/callback`;
}

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function googleAuthUrl(redirectUri: string, state: string, loginHint?: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    // Always show consent so Google returns a refresh token, even on a second connect.
    prompt: "consent",
    state,
  });
  if (loginHint) p.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || json.error) {
    throw new Error(
      json.error === "invalid_grant"
        ? "Google no longer accepts this sign-in (revoked or expired). Sign in with Google again."
        : `Google refused: ${json.error_description ?? json.error ?? res.status}`,
    );
  }
  return json;
}

/** The address an ID token was issued for. */
function emailFromIdToken(idToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string, redirectUri: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  if (!t.refresh_token) throw new Error("Google did not return a long-lived token. Remove Quantum's access in your Google account and sign in again.");
  if (!(t.scope ?? "").split(" ").includes(MAIL_SCOPE)) {
    throw new Error("Google sign-in did not grant mail access. Sign in again and allow Quantum to read and send email.");
  }
  const email = t.id_token ? emailFromIdToken(t.id_token) : null;
  if (!email) throw new Error("Google did not say which mailbox signed in.");
  return { email, refreshToken: t.refresh_token };
}

const accessCache = ((globalThis as unknown as { __gAccess?: Map<string, { token: string; until: number }> }).__gAccess ??= new Map());

/** A short-lived access token for IMAP/SMTP, refreshed from the stored refresh token. */
export async function googleAccessToken(refreshToken: string): Promise<string> {
  const hit = accessCache.get(refreshToken);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  if (t.scope && !t.scope.split(" ").includes(MAIL_SCOPE)) {
    throw new Error("This Google sign-in was made before Quantum needed mail access. Press 'Sign in with Google again'.");
  }
  accessCache.set(refreshToken, { token: t.access_token!, until: Date.now() + (t.expires_in ?? 3600) * 1000 });
  return t.access_token!;
}
