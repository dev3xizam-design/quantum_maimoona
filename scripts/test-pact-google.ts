/**
 * "Sign in with Google" for the PACT mailbox, against a simulated Google: the
 * sign-in link, the code exchange, and the access token IMAP/SMTP use.
 *
 *   npx tsx --conditions=react-server --test scripts/test-pact-google.ts
 */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

process.env.GOOGLE_CLIENT_ID = "cid";
process.env.GOOGLE_CLIENT_SECRET = "secret";

let tokenReply: Record<string, unknown> = {};
let tokenCalls = 0;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!/oauth2\.googleapis\.com\/token/.test(url)) return new Response("not mocked", { status: 500 });
  tokenCalls += 1;
  return new Response(JSON.stringify(tokenReply), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const idToken = (email: string) => `x.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.y`;
const MAIL = "https://mail.google.com/";

beforeEach(() => {
  tokenCalls = 0;
});

test("sign-in link asks for offline access, consent and mail access only", async () => {
  const { googleAuthUrl } = await import("../src/lib/pact-email/google");
  const u = new URL(googleAuthUrl("https://q.test/api/google/oauth/callback", "st", "reporting@maxvapor.com"));
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("prompt"), "consent");
  assert.equal(u.searchParams.get("state"), "st");
  assert.equal(u.searchParams.get("login_hint"), "reporting@maxvapor.com");
  assert.deepEqual(u.searchParams.get("scope")!.split(" ").sort(), ["email", "openid", MAIL].sort());
});

test("code exchange keeps the refresh token and the signed-in address", async () => {
  const { exchangeCode } = await import("../src/lib/pact-email/google");
  tokenReply = { access_token: "a", refresh_token: "r1", expires_in: 3600, scope: `openid email ${MAIL}`, id_token: idToken("Reporting@MaxVapor.com") };
  assert.deepEqual(await exchangeCode("code", "https://q.test/cb"), { email: "reporting@maxvapor.com", refreshToken: "r1" });
});

test("code exchange refuses a sign-in without mail access", async () => {
  const { exchangeCode } = await import("../src/lib/pact-email/google");
  tokenReply = { access_token: "a", refresh_token: "r1", scope: "openid email https://www.googleapis.com/auth/gmail.readonly", id_token: idToken("x@y.com") };
  await assert.rejects(exchangeCode("code", "https://q.test/cb"), /did not grant mail access/);
});

test("the IMAP/SMTP access token is refreshed once and reused", async () => {
  const { googleAccessToken } = await import("../src/lib/pact-email/google");
  tokenReply = { access_token: "imap-token", expires_in: 3600, scope: MAIL };
  assert.equal(await googleAccessToken("r-reuse"), "imap-token");
  assert.equal(await googleAccessToken("r-reuse"), "imap-token");
  assert.equal(tokenCalls, 1);
});

test("a sign-in from before mail access was needed asks to sign in again", async () => {
  const { googleAccessToken } = await import("../src/lib/pact-email/google");
  tokenReply = { access_token: "old", expires_in: 3600, scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send" };
  await assert.rejects(googleAccessToken("r-old"), /Sign in with Google again/);
});
