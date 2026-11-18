// Server-only: password hashing and signed session cookies (no external auth service needed).
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";

export const SESSION_COOKIE = "dropos_session";
const MAX_AGE_S = 30 * 24 * 3600;

export interface Session {
  teamId: string;
  memberId: string;
  exp: number; // epoch seconds
}

let cachedSecret: Buffer | null = null;
function secret(): Buffer {
  if (cachedSecret) return cachedSecret;
  if (process.env.DROPOS_SECRET) return (cachedSecret = Buffer.from(process.env.DROPOS_SECRET));
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, ".secret");
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, randomBytes(32).toString("hex"));
    chmodSync(file, 0o600);
  }
  return (cachedSecret = Buffer.from(readFileSync(file, "utf8").trim()));
}

// ---- passwords ----

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---- sessions ----

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function encodeSession(s: Omit<Session, "exp">): string {
  const payload = b64(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S }));
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!s.teamId || !s.memberId || s.exp < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}

function cookieValue(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function readSession(req: Request): Session | null {
  return decodeSession(cookieValue(req, SESSION_COOKIE));
}

function isHttps(req: Request) {
  return req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
}

export function sessionCookieHeader(req: Request, s: Omit<Session, "exp">): string {
  return `${SESSION_COOKIE}=${encodeSession(s)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${isHttps(req) ? "; Secure" : ""}`;
}

export function clearSessionCookieHeader(req: Request): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps(req) ? "; Secure" : ""}`;
}

/** JSON response with an optional Set-Cookie header. */
export function json(body: unknown, init: { status?: number; cookie?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.cookie) headers.append("set-cookie", init.cookie);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export const normalizeIndianMobile = (raw: string) => {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
};
export const isIndianMobile = (d: string) => /^[6-9]\d{9}$/.test(d);
