import type * as z from "zod/v4";
import type { ActivityEvent, SharedWorkspace } from "@/lib/merge";
import type { TeamRecord } from "@/lib/team-store";

/** Everything a tool needs: who is calling, and safe access to their team's data on our server. */
export interface McpCtx {
  teamId: string;
  memberId: string;
  memberName: string;
  /** Public base URL, e.g. https://hack.icedoutai.com, for store and tracking links. */
  origin: string;
  /** Fresh copy of the team record (workspace, members, activity). */
  read(): Promise<TeamRecord>;
  /**
   * Change the team's shared workspace. Mutate `ws` in place and return whatever the tool wants.
   * Writes are serialized per team; activity lines are derived from the diff and attributed to the caller.
   */
  update<T>(fn: (ws: SharedWorkspace) => T | Promise<T>): Promise<T>;
  /** Add an explicit activity line (for actions that don't change the workspace, e.g. sending a message). */
  log(text: string, kind?: ActivityEvent["kind"]): Promise<void>;
}

export interface ToolResult {
  /** Short human summary the agent can relay. */
  text: string;
  /** Structured data for the agent to reason over (sent as a second JSON text block). */
  data?: unknown;
}

export interface ToolDef<S extends z.ZodObject = z.ZodObject> {
  name: string; // snake_case
  title: string;
  description: string; // when to use it + what it returns; the agent reads this
  schema: S;
  readOnly?: boolean;
  run: (ctx: McpCtx, args: z.infer<S>) => Promise<ToolResult>;
}

export function defineTool<S extends z.ZodObject>(t: ToolDef<S>): ToolDef {
  return t as unknown as ToolDef;
}
