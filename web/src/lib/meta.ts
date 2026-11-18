// Minimal Meta Graph API client (Marketing API + WhatsApp Cloud API), server-only.
// Budgets are sent in the ad account's minor unit (INR paise = ₹ × 100).

export const GRAPH = "https://graph.facebook.com/v21.0";

export interface MetaCreds {
  adAccountId: string; // with or without "act_"
  accessToken: string;
  pageId: string;
  pixelId?: string;
}

export const actId = (id: string) => (id.trim().startsWith("act_") ? id.trim() : `act_${id.trim()}`);

type GraphError = { error?: { message?: string; error_user_msg?: string; code?: number } };

export async function graph<T>(path: string, token: string, method: "GET" | "POST" = "GET", params: Record<string, unknown> = {}): Promise<T> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  body.set("access_token", token);
  const res =
    method === "GET"
      ? await fetch(`${GRAPH}/${path}?${body.toString()}`, { cache: "no-store" })
      : await fetch(`${GRAPH}/${path}`, { method: "POST", body, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(`Meta API: ${e?.error_user_msg || e?.message || `HTTP ${res.status}`}`);
  }
  return json;
}

export async function verifyAdAccount(c: Pick<MetaCreds, "adAccountId" | "accessToken">) {
  return graph<{ id: string; name?: string; currency?: string; account_status?: number }>(actId(c.adAccountId), c.accessToken, "GET", {
    fields: "name,currency,account_status",
  });
}

export async function createCampaign(c: MetaCreds, p: { name: string; objective: string; status: "PAUSED" | "ACTIVE" }) {
  return graph<{ id: string }>(`${actId(c.adAccountId)}/campaigns`, c.accessToken, "POST", {
    name: p.name,
    objective: p.objective,
    status: p.status,
    special_ad_categories: [],
  });
}

export async function createAdSet(
  c: MetaCreds,
  p: { campaignId: string; name: string; dailyBudgetInr: number; ageMin: number; ageMax: number; gender?: "male" | "female"; status: "PAUSED" | "ACTIVE" },
) {
  const targeting: Record<string, unknown> = { geo_locations: { countries: ["IN"] }, age_min: p.ageMin, age_max: p.ageMax };
  if (p.gender) targeting.genders = [p.gender === "male" ? 1 : 2];
  return graph<{ id: string }>(`${actId(c.adAccountId)}/adsets`, c.accessToken, "POST", {
    name: p.name,
    campaign_id: p.campaignId,
    daily_budget: String(Math.round(p.dailyBudgetInr * 100)),
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    optimization_goal: c.pixelId ? "OFFSITE_CONVERSIONS" : "LINK_CLICKS",
    ...(c.pixelId ? { promoted_object: { pixel_id: c.pixelId, custom_event_type: "PURCHASE" } } : { destination_type: "WEBSITE" }),
    targeting,
    status: p.status,
  });
}

export async function createAdCreative(c: MetaCreds, p: { name: string; link: string; message: string; headline: string; imageUrl?: string }) {
  return graph<{ id: string }>(`${actId(c.adAccountId)}/adcreatives`, c.accessToken, "POST", {
    name: p.name,
    object_story_spec: {
      page_id: c.pageId,
      link_data: {
        link: p.link,
        message: p.message,
        name: p.headline,
        call_to_action: { type: "SHOP_NOW", value: { link: p.link } },
        ...(p.imageUrl ? { picture: p.imageUrl } : {}),
      },
    },
  });
}

export async function createAd(c: MetaCreds, p: { name: string; adsetId: string; creativeId: string; status: "PAUSED" | "ACTIVE" }) {
  return graph<{ id: string }>(`${actId(c.adAccountId)}/ads`, c.accessToken, "POST", {
    name: p.name,
    adset_id: p.adsetId,
    creative: { creative_id: p.creativeId },
    status: p.status,
  });
}

export interface AdsetInsights {
  spend: number;
  impressions: number;
  clicks: number;
  addToCarts: number;
  purchases: number;
}

const ATC = ["offsite_conversion.fb_pixel_add_to_cart", "omni_add_to_cart", "add_to_cart"];
const PURCHASE = ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"];

export async function adsetInsights(c: MetaCreds, adsetId: string): Promise<AdsetInsights> {
  const res = await graph<{
    data?: { spend?: string; impressions?: string; clicks?: string; inline_link_clicks?: string; actions?: { action_type: string; value: string }[] }[];
  }>(`${adsetId}/insights`, c.accessToken, "GET", { fields: "spend,impressions,clicks,inline_link_clicks,actions", date_preset: "maximum" });
  const row = res.data?.[0];
  if (!row) return { spend: 0, impressions: 0, clicks: 0, addToCarts: 0, purchases: 0 };
  const pick = (types: string[]) => Math.max(0, ...(row.actions ?? []).filter((a) => types.includes(a.action_type)).map((a) => Number(a.value) || 0));
  return {
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.inline_link_clicks ?? row.clicks) || 0,
    addToCarts: pick(ATC),
    purchases: pick(PURCHASE),
  };
}

export async function updateAdSet(c: MetaCreds, adsetId: string, p: { status?: "PAUSED" | "ACTIVE"; dailyBudgetInr?: number }) {
  return graph<{ success?: boolean }>(adsetId, c.accessToken, "POST", {
    ...(p.status ? { status: p.status } : {}),
    ...(p.dailyBudgetInr != null ? { daily_budget: String(Math.round(p.dailyBudgetInr * 100)) } : {}),
  });
}

/**
 * WhatsApp Cloud API send. Business-initiated (marketing) messages must use a Meta-approved template;
 * free-form text only reaches people who messaged the business in the last 24 hours.
 */
export async function sendWhatsApp(
  cfg: { phoneNumberId: string; accessToken: string },
  to: string,
  msg: { text: string } | { template: string; language?: string; bodyParams?: string[] },
) {
  const payload =
    "template" in msg
      ? {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: msg.template,
            language: { code: msg.language ?? "en" },
            ...(msg.bodyParams?.length ? { components: [{ type: "body", parameters: msg.bodyParams.map((t) => ({ type: "text", text: t })) }] } : {}),
          },
        }
      : { messaging_product: "whatsapp", to, type: "text", text: { preview_url: true, body: msg.text } };
  const res = await fetch(`${GRAPH}/${encodeURIComponent(cfg.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphError;
    throw new Error(body.error?.message ?? `WhatsApp API ${res.status}`);
  }
}
