import * as z from "zod/v4";
import type { ToolDef } from "./types";
import { teamTools } from "./tools/team";
import { growthTools } from "./tools/growth";
import { opsTools } from "./tools/ops";
import { marketingTools } from "./tools/marketing";

export const TOOLS: ToolDef[] = [...teamTools, ...growthTools, ...opsTools, ...marketingTools];

/**
 * Keep advertised schemas to the plain JSON Schema subset every MCP client accepts.
 * Arguments are still validated in full by zod on our side (route.ts), so nothing is lost.
 */
function simplify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplify);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "$schema" || k === "propertyNames" || k === "format" || k === "pattern") continue;
    if (k === "exclusiveMinimum" && typeof v === "number") {
      out.minimum = v;
      continue;
    }
    if (k === "exclusiveMaximum" && typeof v === "number") {
      out.maximum = v;
      continue;
    }
    out[k] = simplify(v);
  }
  return out;
}

export function listTools() {
  return TOOLS.map((t) => {
    const inputSchema = simplify(z.toJSONSchema(t.schema, { io: "input" })) as Record<string, unknown>;
    return {
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: { type: "object", ...inputSchema },
      annotations: { title: t.title, readOnlyHint: Boolean(t.readOnly) },
    };
  });
}

export const findTool = (name: string) => TOOLS.find((t) => t.name === name);
