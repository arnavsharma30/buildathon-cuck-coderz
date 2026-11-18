import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { diffToEvents, type ActivityEvent, type SharedWorkspace } from "@/lib/merge";
import { getTeam, mutateTeam } from "@/lib/team-store";
import type { McpCtx } from "./types";

// Each team member gets a personal MCP URL: <origin>/mcp/<token>. The token identifies team + member.
type TokenIndex = Record<string, { teamId: string; memberId: string }>;
const indexFile = () => path.join(process.cwd(), "data", "mcp-index.json");

async function readIndex(): Promise<TokenIndex> {
  try {
    return JSON.parse(await readFile(indexFile(), "utf8")) as TokenIndex;
  } catch {
    return {};
  }
}

let indexQueue: Promise<unknown> = Promise.resolve();
export function issueToken(teamId: string, memberId: string): Promise<string> {
  const run = indexQueue.then(async () => {
    const idx = await readIndex();
    const existing = Object.entries(idx).find(([, v]) => v.teamId === teamId && v.memberId === memberId);
    if (existing) return existing[0];
    const token = randomBytes(16).toString("hex");
    idx[token] = { teamId, memberId };
    await mkdir(path.dirname(indexFile()), { recursive: true });
    const tmp = `${indexFile()}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(idx, null, 1), { mode: 0o600 });
    await rename(tmp, indexFile());
    return token;
  });
  indexQueue = run.catch(() => undefined);
  return run;
}

export async function resolveToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  return (await readIndex())[token] ?? null;
}

export const mcpUrl = (origin: string, token: string) => `${origin}/mcp/${token}`;

const eventId = () => `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function buildContext(token: string, origin: string): Promise<McpCtx | null> {
  const who = await resolveToken(token);
  if (!who) return null;
  const team = await getTeam(who.teamId);
  const member = team?.members.find((m) => m.id === who.memberId);
  if (!team || !member) return null;

  const touch = (t: { members: { id: string; lastActiveAt?: number }[] }) => {
    const m = t.members.find((x) => x.id === member.id);
    if (m) m.lastActiveAt = Date.now();
  };

  return {
    teamId: team.team.id,
    memberId: member.id,
    memberName: member.name,
    origin,
    async read() {
      const t = await getTeam(who.teamId);
      if (!t) throw new Error("Team not found");
      return t;
    },
    async update<T>(fn: (ws: SharedWorkspace) => T | Promise<T>) {
      const { result } = await mutateTeam(who.teamId, async (t) => {
        const base: SharedWorkspace = structuredClone(t.workspace);
        const out = await fn(t.workspace);
        const events = diffToEvents(base, t.workspace, { memberId: member.id, memberName: member.name });
        t.activity = [...events, ...t.activity];
        t.version += 1;
        touch(t);
        return out;
      });
      return result;
    },
    async log(text: string, kind: ActivityEvent["kind"] = "team") {
      await mutateTeam(who.teamId, (t) => {
        t.activity = [{ id: eventId(), at: Date.now(), memberId: member.id, memberName: member.name, kind, text }, ...t.activity];
        touch(t);
      });
    },
  };
}
