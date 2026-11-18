import { json, readSession } from "@/lib/auth";
import { getTeam, publicMember } from "@/lib/team-store";

// 200 with nulls when logged out, so demo-mode visitors don't see a failed request in the console.
export async function GET(req: Request) {
  const s = readSession(req);
  const team = s ? await getTeam(s.teamId) : null;
  const member = team?.members.find((m) => m.id === s?.memberId);
  if (!team || !member) return json({ member: null, team: null });
  return json({ team: team.team, member: publicMember(member) });
}
