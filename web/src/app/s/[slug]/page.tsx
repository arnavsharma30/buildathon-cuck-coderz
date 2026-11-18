import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/site-store";
import { THEMES } from "@/lib/site";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { OrderForm } from "@/components/site/OrderForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) return { title: "Store not found" };
  const c = site.website.content;
  return { title: `${c.brandName}: ${c.hero.headline}`, description: c.tagline || c.hero.subheadline };
}

export default async function PublishedStore({ params }: Props) {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) notFound();
  const { website, product } = site;
  const theme = THEMES[website.theme] ? website.theme : "fresh";
  return (
    <SiteRenderer
      content={website.content}
      theme={theme}
      imageUrl={website.imageUrl}
      productName={product.name}
      variants={product.variants}
      orderSlot={
        <OrderForm slug={slug} price={website.content.offer.price || product.sellingPrice} variants={product.variants} buttonClass={THEMES[theme].button} />
      }
    />
  );
}
