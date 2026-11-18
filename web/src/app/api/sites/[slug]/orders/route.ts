import { appendSiteOrder, getSite, getSiteOrders } from "@/lib/site-store";
import type { Order } from "@/lib/types";

type Ctx = { params: Promise<{ slug: string }> };

function normalizeMobile(raw: string) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) return Response.json({ error: "Store not found" }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = str(b.name, 80);
  const phone = normalizeMobile(str(b.phone, 20));
  const address = str(b.address, 300);
  const city = str(b.city, 60);
  const state = str(b.state, 60);
  const pincode = str(b.pincode, 10);
  const quantity = Math.min(5, Math.max(1, Math.round(Number(b.quantity) || 1)));
  const variants = site.product.variants ?? [];
  const variant = variants.includes(str(b.variant, 60)) ? str(b.variant, 60) : undefined;

  const errors: string[] = [];
  if (name.length < 3) errors.push("name");
  if (!/^[6-9]\d{9}$/.test(phone)) errors.push("phone");
  if (address.length < 10) errors.push("address");
  if (city.length < 2) errors.push("city");
  if (state.length < 2) errors.push("state");
  if (!/^[1-9]\d{5}$/.test(pincode)) errors.push("pincode");
  if (errors.length) return Response.json({ error: `Please check: ${errors.join(", ")}` }, { status: 400 });

  const price = site.website.content.offer.price || site.product.sellingPrice;
  const order = await appendSiteOrder(slug, (existing) => {
    const o: Order & { variant?: string; site?: string } = {
      // Store slug in the id keeps ids unique across a team's stores (slugs are unique).
      id: `#${slug}-${1001 + existing.length}`,
      productId: site.product.id,
      createdAt: new Date().toISOString(),
      customerName: name,
      phone,
      address,
      city,
      state,
      pincode,
      amount: price * quantity,
      payment: "COD",
      quantity,
      source: "website",
      status: "new",
      site: slug,
      ...(variant ? { variant } : {}),
    };
    return o;
  });
  return Response.json({ order });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  return Response.json({ orders: await getSiteOrders(slug) });
}
