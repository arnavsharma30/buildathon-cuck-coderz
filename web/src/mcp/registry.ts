import * as z from "zod/v4";
import type { ToolDef } from "./types";
import { teamTools } from "./tools/team";
import { growthTools } from "./tools/growth";
import { opsTools } from "./tools/ops";

export const TOOLS: ToolDef[] = [...teamTools, ...growthTools, ...opsTools];

export function listTools() {
  return TOOLS.map((t) => {
    const inputSchema = z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>;
    delete inputSchema.$schema;
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
