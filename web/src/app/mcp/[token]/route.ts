// DropOS MCP endpoint: stateless JSON-RPC over MCP "Streamable HTTP" (POST, JSON responses).
// Each team member adds <origin>/mcp/<their-token> to Claude as a custom connector.
import * as z from "zod/v4";
import { buildContext } from "@/mcp/context";
import { findTool, listTools } from "@/mcp/registry";
import { originOf } from "@/lib/shipping-store";

export const dynamic = "force-dynamic";

const SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS = `DropOS runs a Masters' Union Dropship Challenge team's dropshipping business (India, COD-heavy, Shopify + Meta ads + IndiaMART suppliers).
All data is stored on the DropOS server and shared with the caller's teammates; every change is attributed to the caller in the team activity log.
Typical flow: get_team_overview → add_products (the team's 5-10 candidate products) → analyze_products (RTO-adjusted unit economics, pick winners) → suppliers (record_supplier, record_quote with the supplier's raw WhatsApp reply, compare_quotes) → publish_store_page (you write the copy; never invent reviews, ratings, sales counts or scarcity) → save_creatives → plan_meta_campaign / log_ad_results / ad_decisions → import_orders or sync_website_orders → rto_check before shipping → create_shipment / track_shipments (customers get WhatsApp + email updates with a tracking link).
Numbers from tools are computed, not guessed: prefer them over your own estimates. Prices are INR.`;

type RpcId = string | number | null;
interface RpcMessage {
  jsonrpc: "2.0";
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
}

const ok = (id: RpcId, result: unknown) => ({ jsonrpc: "2.0" as const, id, result });
const fail = (id: RpcId, code: number, message: string) => ({ jsonrpc: "2.0" as const, id, error: { code, message } });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Connection diagnostics: see whether a team's Claude reaches us (token prefix only, never the full token).
  console.log(`[mcp] POST ${token.slice(0, 6)}… ua="${req.headers.get("user-agent") ?? ""}" ip=${req.headers.get("cf-connecting-ip") ?? "-"}`);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(fail(null, -32700, "Parse error"), { status: 400 });
  }

  const ctx = await buildContext(token, originOf(req));
  if (!ctx) return Response.json(fail(null, -32001, "Unknown DropOS MCP URL. Create your team at the DropOS home page to get yours."), { status: 404 });

  const messages = (Array.isArray(body) ? body : [body]) as RpcMessage[];
  for (const m of messages) {
    const tool = m?.method === "tools/call" ? ` tool=${String(m.params?.name ?? "")}` : "";
    const ver = m?.method === "initialize" ? ` proto=${String(m.params?.protocolVersion ?? "")}` : "";
    console.log(`[mcp]   method=${m?.method ?? "?"}${tool}${ver} member=${ctx.memberName}`);
  }
  const replies = [];
  for (const m of messages) {
    if (m?.id === undefined || m.id === null) continue; // notifications need no reply
    replies.push(await handle(m, ctx));
  }
  if (replies.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? replies : replies[0], { headers: { "cache-control": "no-store" } });
}

async function handle(m: RpcMessage, ctx: NonNullable<Awaited<ReturnType<typeof buildContext>>>) {
  const id = m.id as RpcId;
  switch (m.method) {
    case "initialize": {
      await ctx.markConnected().catch((e) => console.error("[mcp] markConnected", e));
      const asked = String(m.params?.protocolVersion ?? "");
      return ok(id, {
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "dropos", title: "DropOS", version: "1.0.0" },
        instructions: `${INSTRUCTIONS}\nYou are connected as ${ctx.memberName}.`,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: listTools() });
    case "tools/call": {
      const name = String(m.params?.name ?? "");
      const tool = findTool(name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${name}`);
      const parsed = tool.schema.safeParse(m.params?.arguments ?? {});
      if (!parsed.success) {
        return ok(id, { isError: true, content: [{ type: "text", text: `Invalid arguments for ${name}: ${z.prettifyError(parsed.error)}` }] });
      }
      try {
        const out = await tool.run(ctx, parsed.data);
        const content = [{ type: "text", text: out.text }];
        if (out.data !== undefined) content.push({ type: "text", text: JSON.stringify(out.data) });
        return ok(id, { content });
      } catch (e) {
        console.error(`[mcp] ${name} failed`, e);
        return ok(id, { isError: true, content: [{ type: "text", text: `${name} failed: ${e instanceof Error ? e.message : String(e)}` }] });
      }
    }
    case "resources/list":
      return ok(id, { resources: [] });
    case "prompts/list":
      return ok(id, { prompts: [] });
    default:
      return fail(id, -32601, `Method not found: ${m.method}`);
  }
}

export function GET(req: Request) {
  console.log(`[mcp] GET ${new URL(req.url).pathname.slice(0, 12)}… ua="${req.headers.get("user-agent") ?? ""}"`);
  return new Response("DropOS MCP endpoint. Add this URL to Claude: Settings → Connectors → Add custom connector.", {
    status: 405,
    headers: { allow: "POST", "content-type": "text/plain; charset=utf-8" },
  });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}
