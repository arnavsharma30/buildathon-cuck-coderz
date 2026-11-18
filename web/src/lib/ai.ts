import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type * as z from "zod/v4";

export const MODEL = "claude-opus-5-5";

export type AISource = "claude" | "demo";
export interface AIResult<T> {
  data: T;
  source: AISource;
  error?: string;
}

export function hasAI() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let _client: Anthropic | null = null;
export function client() {
  if (!_client) _client = new Anthropic();
  return _client;
}

export const DROPSHIP_SYSTEM = `You are DropOS, a hands-on operator who has run profitable Indian D2C dropshipping stores (Shopify + Meta ads + COD via Shiprocket/Delhivery).
You coach first-year business-school students in the Masters' Union Dropship Challenge: they have a few weeks, a small ad budget (₹15k-50k), no inventory, and they source from Indian wholesalers on IndiaMART.
Be concrete and India-specific: prices in INR, Indian festivals and buying behaviour, COD/RTO realities, tier-2/3 pincodes, Hinglish where it helps.
Never invent statistics you present as facts; give estimates as estimates.`;

/**
 * One structured Claude call. If no API key is configured, the call fails, or Claude declines,
 * the deterministic `fallback` is returned instead so the product always works in a demo.
 */
export async function aiJSON<S extends z.ZodType>(opts: {
  schema: S;
  prompt: string;
  system?: string;
  fallback: () => z.infer<S>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<AIResult<z.infer<S>>> {
  if (!hasAI()) return { data: opts.fallback(), source: "demo" };
  try {
    const res = await client().messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 12000,
      system: opts.system ?? DROPSHIP_SYSTEM,
      messages: [{ role: "user", content: opts.prompt }],
      output_config: { effort: opts.effort ?? "low", format: zodOutputFormat(opts.schema) },
    });
    if (res.stop_reason === "refusal" || res.parsed_output == null) {
      return { data: opts.fallback(), source: "demo", error: `Claude returned no usable output (${res.stop_reason})` };
    }
    return { data: res.parsed_output as z.infer<S>, source: "claude" };
  } catch (e) {
    console.error("[ai] falling back to demo output:", e);
    return { data: opts.fallback(), source: "demo", error: e instanceof Error ? e.message : String(e) };
  }
}

export const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
