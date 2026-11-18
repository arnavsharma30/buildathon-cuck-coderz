// Server-only file storage for teams: data/teams/<teamId>.json and data/phone-index.json.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_ECONOMICS } from "./economics";
import type { ActivityEvent, SharedWorkspace } from "./merge";

export const ROLES = ["Founder", "Sourcing", "Ads", "Ops", "Creative", "Member"] as const;
export type Role = (typeof ROLES)[number];

export interface Member {
  id: string;
  name: string;
  phone: string; // 10 digits
  email?: string;
  role: Role;
  passwordHash: string;
  createdAt: number;
  lastActiveAt?: number;
}

export type PublicMember = Omit<Member, "passwordHash">;

export interface TeamInfo {
  id: string;
  name: string;
  storeName: string;
  college?: string;
  createdAt: number;
}

export interface TeamRecord {
  team: TeamInfo;
  members: Member[];
  workspace: SharedWorkspace;
  version: number;
  activity: ActivityEvent[]; // newest first, capped
}

const ACTIVITY_CAP = 500;
const DATA = () => path.join(process.cwd(), "data");
const teamFile = (id: string) => path.join(DATA(), "teams", `${id.replace(/[^a-z0-9_-]/gi, "")}.json`);
const indexFile = () => path.join(DATA(), "phone-index.json");

export function emptyWorkspace(name: string): SharedWorkspace {
  return {
    teamName: name,
    products: [],
    suppliers: [],
    creatives: [],
    adsets: [],
    orders: [],
    websites: [],
    economics: DEFAULT_ECONOMICS,
  };
}

async function writeAtomic(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 1));
  await rename(tmp, file);
}

async function readJSON<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

// Serialize every read-modify-write per key so concurrent requests can't lose updates.
const queues = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  queues.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}

export async function getTeam(teamId: string): Promise<TeamRecord | null> {
  const t = await readJSON<TeamRecord>(teamFile(teamId));
  if (t) t.workspace = { ...emptyWorkspace(t.team.storeName || t.team.name), ...t.workspace };
  return t;
}

/** Read-modify-write a team. `fn` may mutate and return the record, or throw to abort. */
export function mutateTeam<T>(teamId: string, fn: (t: TeamRecord) => T | Promise<T>): Promise<{ team: TeamRecord; result: T }> {
  return serialize(`team:${teamId}`, async () => {
    const t = await getTeam(teamId);
    if (!t) throw new Error("team not found");
    const result = await fn(t);
    t.activity = t.activity.slice(0, ACTIVITY_CAP);
    await writeAtomic(teamFile(teamId), t);
    return { team: t, result };
  });
}

export async function createTeam(t: TeamRecord): Promise<void> {
  await serialize("index", async () => {
    const idx = (await readJSON<Record<string, { teamId: string; memberId: string }>>(indexFile())) ?? {};
    for (const m of t.members) if (idx[m.phone]) throw new PhoneTakenError(m.phone);
    for (const m of t.members) idx[m.phone] = { teamId: t.team.id, memberId: m.id };
    await writeAtomic(teamFile(t.team.id), t);
    await writeAtomic(indexFile(), idx);
  });
}

export async function addMemberToIndex(phone: string, teamId: string, memberId: string): Promise<void> {
  await serialize("index", async () => {
    const idx = (await readJSON<Record<string, { teamId: string; memberId: string }>>(indexFile())) ?? {};
    if (idx[phone]) throw new PhoneTakenError(phone);
    idx[phone] = { teamId, memberId };
    await writeAtomic(indexFile(), idx);
  });
}

export async function phoneTaken(phone: string): Promise<boolean> {
  const idx = (await readJSON<Record<string, unknown>>(indexFile())) ?? {};
  return Boolean(idx[phone]);
}

export async function lookupPhone(phone: string): Promise<{ teamId: string; memberId: string } | null> {
  const idx = (await readJSON<Record<string, { teamId: string; memberId: string }>>(indexFile())) ?? {};
  return idx[phone] ?? null;
}

export class PhoneTakenError extends Error {
  constructor(public phone: string) {
    super(`Phone ${phone} is already registered`);
  }
}

export const publicMember = ({ passwordHash: _h, ...m }: Member): PublicMember => {
  void _h;
  return m;
};

export const rid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
