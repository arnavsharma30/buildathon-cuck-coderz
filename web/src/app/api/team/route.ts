import { hashPassword, isIndianMobile, json, normalizeIndianMobile, readSession } from "@/lib/auth";
import { addMemberToIndex, getTeam, mutateTeam, PhoneTakenError, publicMember, rid, ROLES, type Member, type Role, type TeamRecord } from "@/lib/team-store";

function view(t: TeamRecord) {
  const stats = new Map<string, Record<string, number>>();
  for (const e of t.activity) {
    const s = stats.get(e.memberId) ?? {};
    s[e.kind] = (s[e.kind] ?? 0) + 1;
    s.total = (s.total ?? 0) + 1;
    stats.set(e.memberId, s);
  }
  return {
    team: t.team,
    members: t.members.map((m) => ({ ...publicMember(m), stats: stats.get(m.id) ?? { total: 0 } })),
    activity: t.activity.slice(0, 100),
    version: t.version,
  };
}

export async function GET(req: Request) {
  const s = readSession(req);
  const t = s ? await getTeam(s.teamId) : null;
  if (!s || !t || !t.members.some((m) => m.id === s.memberId)) return json({ error: "not logged in" }, { status: 401 });
  return json(view(t));
}

export async function POST(req: Request) {
  const s = readSession(req);
  const current = s ? await getTeam(s.teamId) : null;
  const actor = current?.members.find((m) => m.id === s?.memberId);
  if (!s || !current || !actor) return json({ error: "not logged in" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { name?: string; phone?: string; email?: string; role?: string; password?: string };
  const name = (b.name ?? "").trim();
  const phone = normalizeIndianMobile(b.phone ?? "");
  if (name.length < 2) return json({ error: "Name is required." }, { status: 400 });
  if (!isIndianMobile(phone)) return json({ error: "Phone must be a 10-digit Indian mobile number." }, { status: 400 });
  if ((b.password ?? "").length < 6) return json({ error: "Temporary password must be at least 6 characters." }, { status: 400 });

  const member: Member = {
    id: rid("mem"),
    name,
    phone,
    email: (b.email ?? "").trim() || undefined,
    role: (ROLES as readonly string[]).includes(b.role ?? "") ? (b.role as Role) : "Member",
    passwordHash: hashPassword(b.password!),
    createdAt: Date.now(),
  };
  try {
    await addMemberToIndex(phone, s.teamId, member.id);
  } catch (e) {
    if (e instanceof PhoneTakenError) return json({ error: `${phone} is already registered.` }, { status: 409 });
    throw e;
  }
  const { team } = await mutateTeam(s.teamId, (t) => {
    t.members.push(member);
    t.activity.unshift({ id: rid("ev"), at: Date.now(), memberId: actor.id, memberName: actor.name, kind: "team", text: `added ${name} to the team`, href: "/team" });
  });
  return json({ member: publicMember(member), ...view(team) });
}
