import { hashPassword, isIndianMobile, json, normalizeIndianMobile, sessionCookieHeader } from "@/lib/auth";
import { createTeam, emptyWorkspace, PhoneTakenError, publicMember, rid, ROLES, type Member, type Role, type TeamRecord } from "@/lib/team-store";
import type { Product } from "@/lib/types";

interface MemberInput {
  name?: string;
  phone?: string;
  email?: string;
  role?: string;
  password?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    team?: { name?: string; storeName?: string; college?: string };
    members?: MemberInput[];
    product?: Product;
  };
  const teamName = (body.team?.name ?? "").trim();
  const storeName = (body.team?.storeName ?? "").trim() || teamName;
  const inputs = (body.members ?? []).filter((m) => (m.name ?? "").trim() || (m.phone ?? "").trim());
  if (teamName.length < 2) return json({ error: "Team name is required." }, { status: 400 });
  if (!inputs.length) return json({ error: "Add at least yourself as a member." }, { status: 400 });

  const now = Date.now();
  const seen = new Set<string>();
  const members: Member[] = [];
  for (const [i, m] of inputs.entries()) {
    const name = (m.name ?? "").trim();
    const phone = normalizeIndianMobile(m.phone ?? "");
    const who = i === 0 ? "Your" : `${name || `Teammate ${i}`}'s`;
    if (name.length < 2) return json({ error: `${who} name is required.` }, { status: 400 });
    if (!isIndianMobile(phone)) return json({ error: `${who} phone must be a 10-digit Indian mobile number.` }, { status: 400 });
    if (seen.has(phone)) return json({ error: `Phone ${phone} is used twice.` }, { status: 400 });
    if ((m.password ?? "").length < 6) return json({ error: `${who} password must be at least 6 characters.` }, { status: 400 });
    seen.add(phone);
    const role = (ROLES as readonly string[]).includes(m.role ?? "") ? (m.role as Role) : i === 0 ? "Founder" : "Member";
    members.push({
      id: rid("mem"),
      name,
      phone,
      email: (m.email ?? "").trim() || undefined,
      role,
      passwordHash: hashPassword(m.password!),
      createdAt: now,
      lastActiveAt: i === 0 ? now : undefined,
    });
  }

  const workspace = emptyWorkspace(storeName);
  if (body.product?.name && body.product.sellingPrice > 0) {
    workspace.products = [{ ...body.product, id: body.product.id || rid("prd"), createdAt: body.product.createdAt || now }];
  }

  const founder = members[0];
  const ev = (text: string, href?: string, kind: "team" | "products" = "team") => ({
    id: rid("ev"),
    at: now,
    memberId: founder.id,
    memberName: founder.name,
    kind,
    text,
    href,
  });
  const activity = [
    ...(workspace.products[0] ? [ev(`added product ${workspace.products[0].name}`, "/products", "products")] : []),
    ...members.slice(1).map((m) => ev(`added ${m.name} to the team`, "/team")),
    ev(`created the team ${teamName}`, "/team"),
  ];

  const record: TeamRecord = {
    team: { id: rid("team"), name: teamName, storeName, college: (body.team?.college ?? "").trim() || undefined, createdAt: now },
    members,
    workspace,
    version: 1,
    activity,
  };
  try {
    await createTeam(record);
  } catch (e) {
    if (e instanceof PhoneTakenError) return json({ error: `${e.phone} is already registered. Log in instead.` }, { status: 409 });
    throw e;
  }
  return json(
    { team: record.team, member: publicMember(founder), members: members.map(publicMember) },
    { cookie: sessionCookieHeader(req, { teamId: record.team.id, memberId: founder.id }) },
  );
}
