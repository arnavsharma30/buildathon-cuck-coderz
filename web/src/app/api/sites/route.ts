import { listSites, saveSite, SLUG_RE } from "@/lib/site-store";
import type { Product, Website } from "@/lib/types";

export async function POST(req: Request) {
  const { website, product } = (await req.json()) as { website?: Website; product?: Product };
  if (!website?.content || !product?.name) return Response.json({ error: "website and product are required" }, { status: 400 });
  const slug = String(website.slug || "").trim();
  if (!SLUG_RE.test(slug)) {
    return Response.json({ error: "Slug must be 3-40 characters: lowercase letters, numbers and dashes" }, { status: 400 });
  }
  await saveSite({ website: { ...website, slug, publishedAt: website.publishedAt ?? Date.now(), updatedAt: Date.now() }, product });
  return Response.json({ url: `/s/${slug}` });
}

export async function GET() {
  return Response.json({ sites: await listSites() });
}
