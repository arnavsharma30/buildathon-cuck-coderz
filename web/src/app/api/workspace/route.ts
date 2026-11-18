import { json, readSession } from "@/lib/auth";
import { diffToEvents, stripLocal, threeWayMerge, type SharedWorkspace } from "@/lib/merge";
import { getTeam, mutateTeam } from "@/lib/team-store";

async function auth(req: Request) {
  const s = readSession(req);
  const t = s ? await getTeam(s.teamId) : null;
  const member = t?.members.find((m) => m.id === s?.memberId);
  return s && t && member ? { s, member } : null;
}

export async function GET(req: Request) {
  const a = await auth(req);
  if (!a) return json({ error: "not logged in" }, { status: 401 });
  const t = await getTeam(a.s.teamId);
  return json({ workspace: t!.workspace, version: t!.version });
}

export async function PUT(req: Request) {
  const a = await auth(req);
  if (!a) return json({ error: "not logged in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { base?: SharedWorkspace; next?: SharedWorkspace } | null;
  if (!body?.next) return json({ error: "next workspace required" }, { status: 400 });
  const next = stripLocal(body.next);
  const base = body.base ? stripLocal(body.base) : null;

  const { team } = await mutateTeam(a.s.teamId, (t) => {
    const merged = base ? threeWayMerge(t.workspace, base, next) : next;
    const events = diffToEvents(base ?? t.workspace, next, { memberId: a.member.id, memberName: a.member.name });
    const changed = JSON.stringify(merged) !== JSON.stringify(t.workspace);
    t.workspace = merged;
    if (changed) t.version += 1;
    t.activity.unshift(...events.reverse());
    const m = t.members.find((x) => x.id === a.member.id);
    if (m) m.lastActiveAt = Date.now();
  });
  return json({ workspace: team.workspace, version: team.version });
}
