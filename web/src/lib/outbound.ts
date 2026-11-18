// Per-team marketing store: data/marketing/<teamId>.json (contacts, outbound campaigns, Meta launches).
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Contact {
  id: string;
  name: string;
  phone?: string; // 10 digits
  email?: string;
  city?: string;
  source?: string;
  tags: string[];
  optedIn: boolean; // consent to receive marketing messages
  optedOut?: boolean; // asked to stop: never message again
  createdAt: number;
}

export interface OutboundRecipient {
  contactId: string;
  name: string;
  to: string;
  status: "sent" | "queued" | "failed";
  message: string;
  link?: string; // one-click wa.me / mailto when queued
  error?: string;
  at: number;
}

export interface OutboundCampaign {
  id: string;
  name: string;
  channel: "whatsapp" | "email";
  audience: { tags?: string[]; segment?: "leads" | "customers" | "all" };
  message: string; // with {{name}} / {{store}}
  subject?: string;
  whatsappTemplateName?: string;
  status: "draft" | "sent";
  createdAt: number;
  createdBy: string;
  sentAt?: number;
  recipients: OutboundRecipient[];
}

export interface MetaLaunchAdset {
  adsetRowId: string; // ws.adsets id
  name: string;
  metaAdsetId: string;
  metaCreativeId?: string;
  metaAdId?: string;
  dailyBudget: number;
  status: "PAUSED" | "ACTIVE";
  lastDecision?: string; // e.g. "KILL", "SCALE" (last applied)
  error?: string;
}

export interface MetaLaunch {
  id: string;
  productId: string;
  mode: "live" | "demo";
  campaignId: string;
  campaignName: string;
  objective: string;
  landingUrl: string;
  createdAt: number;
  createdBy: string;
  adsets: MetaLaunchAdset[];
}

export interface MarketingRecord {
  contacts: Contact[];
  campaigns: OutboundCampaign[];
  metaLaunches: MetaLaunch[];
}

const EMPTY = (): MarketingRecord => ({ contacts: [], campaigns: [], metaLaunches: [] });
const file = (teamId: string) => path.join(process.cwd(), "data", "marketing", `${teamId.replace(/[^a-z0-9_-]/gi, "")}.json`);

export async function getMarketing(teamId: string): Promise<MarketingRecord> {
  try {
    return { ...EMPTY(), ...(JSON.parse(await readFile(file(teamId), "utf8")) as MarketingRecord) };
  } catch {
    return EMPTY();
  }
}

const queues = new Map<string, Promise<unknown>>();
/** Serialized read-modify-write of a team's marketing record. */
export function mutateMarketing<T>(teamId: string, fn: (m: MarketingRecord) => T | Promise<T>): Promise<T> {
  const prev = queues.get(teamId) ?? Promise.resolve();
  const run = prev.then(async () => {
    const m = await getMarketing(teamId);
    const out = await fn(m);
    const f = file(teamId);
    await mkdir(path.dirname(f), { recursive: true });
    const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(m, null, 1));
    await rename(tmp, f);
    return out;
  });
  queues.set(
    teamId,
    run.catch(() => undefined),
  );
  return run;
}

export async function sendResendEmail(cfg: { resendApiKey: string; from: string }, to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: cfg.from, to: [to], subject, text }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Resend ${res.status}`);
  }
}
