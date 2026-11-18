import { json, normalizeIndianMobile, sessionCookieHeader, verifyPassword } from "@/lib/auth";
import { getTeam, lookupPhone, publicMember } from "@/lib/team-store";

export async function POST(req: Request) {
  const { phone: raw, password } = (await req.json().catch(() => ({}))) as { phone?: string; password?: string };
  const phone = normalizeIndianMobile(raw ?? "");
  const hit = await lookupPhone(phone);
  const team = hit ? await getTeam(hit.teamId) : null;
  const member = team?.members.find((m) => m.id === hit?.memberId);
  if (!team || !member || !verifyPassword(password ?? "", member.passwordHash)) {
    return json({ error: "Wrong phone number or password." }, { status: 401 });
  }
  return json({ team: team.team, member: publicMember(member) }, { cookie: sessionCookieHeader(req, { teamId: team.team.id, memberId: member.id }) });
}
