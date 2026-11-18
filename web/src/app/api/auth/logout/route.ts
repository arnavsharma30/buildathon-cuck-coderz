import { clearSessionCookieHeader, json } from "@/lib/auth";

export async function POST(req: Request) {
  return json({ ok: true }, { cookie: clearSessionCookieHeader(req) });
}
