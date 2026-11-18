import { shiprocketLogin } from "@/lib/couriers";
import { PROVIDERS, getIntegrations, publicIntegrations, saveIntegrations, type Provider } from "@/lib/shipping-store";

// Connect / disconnect delivery partners and messaging providers. Secrets stay on the server.

export async function GET() {
  return Response.json(publicIntegrations(await getIntegrations()));
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function POST(req: Request) {
  const { provider, credentials } = (await req.json().catch(() => ({}))) as { provider?: Provider; credentials?: Record<string, unknown> };
  if (!provider || !PROVIDERS.includes(provider)) return Response.json({ error: "Unknown provider" }, { status: 400 });
  const c = credentials ?? {};
  const all = await getIntegrations();

  switch (provider) {
    case "shiprocket": {
      const email = str(c.email);
      const password = str(c.password);
      if (!email || !password) return Response.json({ error: "Shiprocket API user email and password are required" }, { status: 400 });
      try {
        const token = await shiprocketLogin(email, password);
        all.shiprocket = { email, password, token, tokenAt: Date.now() };
      } catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
      }
      break;
    }
    case "delhivery": {
      const apiToken = str(c.apiToken);
      if (apiToken.length < 8) return Response.json({ error: "Delhivery API token looks too short" }, { status: 400 });
      all.delhivery = { apiToken };
      break;
    }
    case "whatsapp": {
      const phoneNumberId = str(c.phoneNumberId);
      const accessToken = str(c.accessToken);
      if (!/^\d{6,}$/.test(phoneNumberId) || accessToken.length < 20) {
        return Response.json({ error: "Need the WhatsApp phone number ID (digits) and a permanent access token" }, { status: 400 });
      }
      all.whatsapp = { phoneNumberId, accessToken };
      break;
    }
    case "email": {
      const resendApiKey = str(c.resendApiKey);
      const from = str(c.from);
      if (!resendApiKey.startsWith("re_") || !from.includes("@")) {
        return Response.json({ error: "Need a Resend API key (re_…) and a from address on your verified domain" }, { status: 400 });
      }
      all.email = { resendApiKey, from };
      break;
    }
  }
  await saveIntegrations(all);
  return Response.json({ ok: true, integrations: publicIntegrations(all) });
}

export async function DELETE(req: Request) {
  const provider = new URL(req.url).searchParams.get("provider") as Provider | null;
  if (!provider || !PROVIDERS.includes(provider)) return Response.json({ error: "Unknown provider" }, { status: 400 });
  const all = await getIntegrations();
  delete all[provider];
  await saveIntegrations(all);
  return Response.json({ ok: true, integrations: publicIntegrations(all) });
}
