import { randomBytes } from "node:crypto";
import * as z from "zod/v4";
import { hashPassword, isIndianMobile, normalizeIndianMobile } from "@/lib/auth";
import { createTeam, emptyWorkspace, PhoneTakenError, ROLES, rid, type Member, type TeamRecord } from "@/lib/team-store";
import { issueToken, mcpUrl } from "@/mcp/context";
import { originOf } from "@/lib/shipping-store";

// Creates a team and returns one personal MCP URL per member (no passwords: the URL is the credential).
const Body = z.object({
  teamName: z.string().trim().min(2).max(60),
  storeName: z.string().trim().min(2).max(60),
  college: z.string().trim().max(80).optional(),
  members: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(60),
        phone: z.string(),
        email: z.string().trim().email().optional().or(z.literal("")),
        role: z.enum(ROLES).default("Member"),
      }),
    )
    .min(1)
    .max(8),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const b = parsed.data;

  const now = Date.now();
  const members: Member[] = [];
  for (const m of b.members) {
    const phone = normalizeIndianMobile(m.phone);
    if (!isIndianMobile(phone)) return Response.json({ error: `${m.name}: enter a valid 10-digit Indian mobile number` }, { status: 400 });
    if (members.some((x) => x.phone === phone)) return Response.json({ error: `Phone ${phone} is listed twice` }, { status: 400 });
    members.push({
      id: rid("mem"),
      name: m.name,
      phone,
      email: m.email || undefined,
      role: m.role,
      passwordHash: hashPassword(randomBytes(24).toString("hex")),
      createdAt: now,
    });
  }

  const teamId = rid("team");
  const record: TeamRecord = {
    team: { id: teamId, name: b.teamName, storeName: b.storeName, college: b.college || "Masters' Union", createdAt: now },
    members,
    workspace: emptyWorkspace(b.storeName),
    version: 1,
    activity: [{ id: rid("ev"), at: now, memberId: members[0].id, memberName: members[0].name, kind: "team", text: `created the team ${b.teamName}` }],
  };
  try {
    await createTeam(record);
  } catch (e) {
    if (e instanceof PhoneTakenError) return Response.json({ error: `Phone ${e.phone} is already on a team` }, { status: 409 });
    throw e;
  }

  const origin = originOf(req);
  const out = [];
  for (const m of members) out.push({ name: m.name, role: m.role, mcpUrl: mcpUrl(origin, await issueToken(teamId, m.id)) });
  return Response.json({ team: record.team, members: out });
}
