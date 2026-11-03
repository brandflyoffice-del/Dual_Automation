// Dashboard login session: a signed cookie (HMAC-SHA256, Web Crypto so it also runs in middleware).
// Credentials come from DASH_USER / DASH_PASSWORD (deploy/.local/env.prod). Without a password the login is
// switched off in development only; in production it fails closed.

export const SESSION_COOKIE = "bf_session";
export const SESSION_HOURS = { short: 12, long: 24 * 30 };

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

function secret() {
  return process.env.AUTH_SECRET || process.env.WEBHOOK_SECRET || "";
}

export function authConfigured() {
  return !!(process.env.DASH_USER && process.env.DASH_PASSWORD && secret());
}

/** Login is required in production; in local development it is only on when a password is set. */
export function authRequired() {
  return process.env.NODE_ENV === "production" || authConfigured();
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function createSession(user: string, hours: number) {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: Date.now() + hours * 3600_000 })));
  return `${payload}.${b64url(await hmac(payload))}`;
}

export async function verifySession(token: string | undefined): Promise<{ user: string } | null> {
  if (!token || !secret()) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!sameBytes(await hmac(payload), fromB64url(sig))) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { u?: string; exp?: number };
    if (!data.u || !data.exp || data.exp < Date.now()) return null;
    return { user: data.u };
  } catch {
    return null;
  }
}

/** Constant-time check of the typed user name and password (both compared via their HMAC). */
export async function checkCredentials(user: string, password: string) {
  if (!authConfigured()) return false;
  const [a, b, c, d] = await Promise.all([hmac("u:" + user.trim().toLowerCase()), hmac("u:" + String(process.env.DASH_USER).toLowerCase()), hmac("p:" + password), hmac("p:" + process.env.DASH_PASSWORD)]);
  return sameBytes(a, b) && sameBytes(c, d);
}
