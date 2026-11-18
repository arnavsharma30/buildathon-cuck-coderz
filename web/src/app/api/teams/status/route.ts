import { resolveToken } from "@/mcp/context";
import { getTeam } from "@/lib/team-store";

export const dynamic = "force-dynamic";

// Onboarding polls this to show when each teammate's Claude has connected to DropOS.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const who = await resolveToken(key);
  const team = who ? await getTeam(who.teamId) : null;
  if (!team) return Response.json({ error: "Unknown key" }, { status: 404 });
  return Response.json(
    {
      team: { name: team.team.name, storeName: team.team.storeName },
      members: team.members.map((m) => ({ name: m.name, role: m.role, connected: Boolean(m.mcpConnectedAt), connectedAt: m.mcpConnectedAt })),
      products: team.workspace.products.length,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
