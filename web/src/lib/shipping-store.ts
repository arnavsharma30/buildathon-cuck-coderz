import { promises as fs } from "fs";
import path from "path";
import type { Shipment } from "./couriers";

// File-backed storage for shipments and courier / messaging credentials (DropOS is self-hosted).
const ROOT = path.join(process.cwd(), "data");
const SHIPMENTS = path.join(ROOT, "shipments");
const INTEGRATIONS = path.join(ROOT, "integrations.json");
// Per-team credentials (MCP mode). The global file above is the legacy single-tenant fallback.
const TEAM_INTEGRATIONS = path.join(ROOT, "integrations");
const integrationsFile = (teamId?: string) =>
  teamId ? path.join(TEAM_INTEGRATIONS, `${teamId.replace(/[^a-z0-9_-]/gi, "")}.json`) : INTEGRATIONS;

/** A shipment tagged with the team that created it (older shipments may have no teamId). */
export type TeamShipment = Shipment & { teamId?: string };

export const SHIPMENT_ID_RE = /^[a-z0-9]{6,20}$/;

export interface Integrations {
  shiprocket?: { email: string; password: string; token?: string; tokenAt?: number };
  delhivery?: { apiToken: string };
  whatsapp?: { phoneNumberId: string; accessToken: string };
  email?: { resendApiKey: string; from: string };
  meta?: { adAccountId: string; accessToken: string; pageId: string; pixelId?: string; accountName?: string; currency?: string };
}
export type Provider = keyof Integrations;
export const PROVIDERS: Provider[] = ["shiprocket", "delhivery", "whatsapp", "email", "meta"];

// ---------- shipments ----------

export async function saveShipment(s: Shipment) {
  if (!SHIPMENT_ID_RE.test(s.id)) throw new Error("invalid shipment id");
  await fs.mkdir(SHIPMENTS, { recursive: true });
  await fs.writeFile(path.join(SHIPMENTS, `${s.id}.json`), JSON.stringify(s, null, 2));
}

export async function getShipment(id: string): Promise<Shipment | null> {
  if (!SHIPMENT_ID_RE.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(SHIPMENTS, `${id}.json`), "utf8")) as Shipment;
  } catch {
    return null;
  }
}

export async function listShipmentsForTeam(teamId: string): Promise<TeamShipment[]> {
  return ((await listShipments()) as TeamShipment[]).filter((s) => s.teamId === teamId);
}

export async function listShipments(): Promise<Shipment[]> {
  try {
    const files = (await fs.readdir(SHIPMENTS)).filter((f) => f.endsWith(".json"));
    const all = await Promise.all(files.map((f) => getShipment(f.replace(/\.json$/, ""))));
    return all.filter((s): s is Shipment => Boolean(s)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

// Serialise read-modify-write per shipment so a refresh and a notify can't clobber each other.
const locks = new Map<string, Promise<unknown>>();
export async function withShipment<T>(id: string, fn: (s: Shipment) => Promise<T>): Promise<T | null> {
  const prev = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  locks.set(id, prev.then(() => mine));
  await prev.catch(() => {});
  try {
    const s = await getShipment(id);
    if (!s) return null;
    return await fn(s);
  } finally {
    release();
    if (locks.get(id) === mine) locks.delete(id);
  }
}

// ---------- integrations ----------

export async function getIntegrations(teamId?: string): Promise<Integrations> {
  try {
    return JSON.parse(await fs.readFile(integrationsFile(teamId), "utf8")) as Integrations;
  } catch {
    return {};
  }
}

export async function saveIntegrations(i: Integrations, teamId?: string) {
  const file = integrationsFile(teamId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(i, null, 2), { mode: 0o600 });
}

const mask = (v?: string) => (v ? `••••${v.slice(-4)}` : undefined);

/** Safe-to-send view: never includes secrets. */
export function publicIntegrations(i: Integrations) {
  return {
    shiprocket: { connected: Boolean(i.shiprocket), hint: i.shiprocket?.email },
    delhivery: { connected: Boolean(i.delhivery), hint: mask(i.delhivery?.apiToken) },
    whatsapp: { connected: Boolean(i.whatsapp), hint: i.whatsapp ? `ID ${mask(i.whatsapp.phoneNumberId)}` : undefined },
    email: { connected: Boolean(i.email), hint: i.email?.from },
    meta: {
      connected: Boolean(i.meta),
      hint: i.meta ? `${i.meta.accountName ?? "ad account"} ${mask(i.meta.adAccountId)}${i.meta.pixelId ? " + pixel" : ""}` : undefined,
    },
  };
}
export type PublicIntegrations = ReturnType<typeof publicIntegrations>;

/** Public origin for customer tracking links (behind the Cloudflare tunnel the Host header is the public one). */
export function originOf(req: Request, bodyOrigin?: string) {
  if (bodyOrigin && /^https?:\/\/[^/]+$/.test(bodyOrigin)) return bodyOrigin;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
