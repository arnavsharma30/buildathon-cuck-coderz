"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, ExternalLink, Globe, Monitor, Plus, Smartphone, Sparkles, Trash2 } from "lucide-react";
import { useWorkspace, postJSON, newId } from "@/lib/store";
import type { Product, SiteContent, SiteTheme, Website } from "@/lib/types";
import { THEMES, THEME_KEYS, defaultBrandName, fallbackSiteContent, slugify } from "@/lib/site";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { Badge, Button, Card, Empty, Field, PageHeader, SourceBadge, cx, inputCls } from "@/components/ui";

type Lang = Website["language"];

export default function WebsiteBuilderPage() {
  const { activeProduct } = useWorkspace();
  if (!activeProduct) {
    return (
      <div>
        <PageHeader step="Step 3 · Store" title="AI website builder" />
        <Empty>
          Pick a product first. <Link href="/products" className="font-medium text-zinc-900 underline">Go to Product research →</Link>
        </Empty>
      </div>
    );
  }
  // Remount the builder per product so its local state starts from that product's saved site.
  return <Builder key={activeProduct.id} product={activeProduct} />;
}

function Builder({ product }: { product: Product }) {
  const { ws, update } = useWorkspace();
  const saved = (ws.websites ?? []).find((w) => w.productId === product.id);

  const [brandName, setBrandName] = useState(saved?.content.brandName ?? defaultBrandName(product));
  const [theme, setTheme] = useState<SiteTheme>(saved?.theme ?? "fresh");
  const [language, setLanguage] = useState<Lang>(saved?.language ?? "Hinglish");
  const [imageUrl, setImageUrl] = useState(saved?.imageUrl ?? product.images?.[0] ?? "");
  const [content, setContent] = useState<SiteContent>(() => saved?.content ?? fallbackSiteContent(product, { brandName: defaultBrandName(product), language: "Hinglish" }));
  const [slug, setSlug] = useState(saved?.slug ?? slugify(saved?.content.brandName ?? defaultBrandName(product)));
  const [source, setSource] = useState<"claude" | "demo" | undefined>();
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [liveUrl, setLiveUrl] = useState(saved?.publishedAt ? `/s/${saved.slug}` : "");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [origin, setOrigin] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- window is only available after mount
  useEffect(() => setOrigin(window.location.origin), []);

  // Persist edits to the workspace (debounced) so they survive navigation.
  useEffect(() => {
    const t = setTimeout(() => {
      update((w) => {
        const list = w.websites ?? [];
        const prev = list.find((x) => x.productId === product.id);
        const next: Website = {
          id: prev?.id ?? newId("site"),
          productId: product.id,
          slug,
          theme,
          language,
          content: { ...content, brandName },
          imageUrl: imageUrl || undefined,
          publishedAt: prev?.publishedAt,
          updatedAt: Date.now(),
        };
        return { ...w, websites: prev ? list.map((x) => (x.productId === product.id ? next : x)) : [...list, next] };
      });
    }, 400);
    return () => clearTimeout(t);
  }, [brandName, theme, language, imageUrl, content, slug, product.id, update]);

  const fullContent = useMemo(() => ({ ...content, brandName }), [content, brandName]);
  const patch = (p: Partial<SiteContent>) => setContent((c) => ({ ...c, ...p }));

  async function generate() {
    setGenerating(true);
    try {
      const res = await postJSON<{ content: SiteContent; source: "claude" | "demo" }>("/api/website/generate", {
        product,
        brandName,
        language,
        theme,
      });
      // Keep any real reviews the team already added.
      setContent((c) => ({ ...res.content, reviews: c.reviews }));
      if (res.content.brandName && res.content.brandName !== brandName) {
        setBrandName(res.content.brandName);
        if (!liveUrl) setSlug(slugify(res.content.brandName));
      }
      setSource(res.source);
    } finally {
      setGenerating(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setPublishError("");
    try {
      const s = slugify(slug);
      setSlug(s);
      const website: Website = {
        id: saved?.id ?? newId("site"),
        productId: product.id,
        slug: s,
        theme,
        language,
        content: fullContent,
        imageUrl: imageUrl || undefined,
        publishedAt: saved?.publishedAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ website, product }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setLiveUrl(data.url);
      update((w) => {
        const list = w.websites ?? [];
        const exists = list.some((x) => x.productId === product.id);
        return { ...w, websites: exists ? list.map((x) => (x.productId === product.id ? website : x)) : [...list, website] };
      });
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  const absoluteUrl = liveUrl ? `${origin}${liveUrl}` : "";

  return (
    <div>
      <PageHeader
        step="Step 3 · Store"
        title="AI website builder"
        subtitle={`Generate a COD-ready store page for ${product.name}, edit every section, and publish it live in one click. Orders placed on the site land in Orders & RTO.`}
      />

      {/* Publish bar */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <Field label="Store address">
              <div className="flex items-center rounded-lg border border-zinc-300 bg-white text-sm focus-within:ring-2 focus-within:ring-zinc-200">
                <span className="select-none pl-3 text-zinc-400">{origin ? origin.replace(/^https?:\/\//, "") : ""}/s/</span>
                <input className="w-full bg-transparent px-1 py-2 outline-none" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="my-store" />
              </div>
            </Field>
          </div>
          <Button onClick={publish} loading={publishing} disabled={slug.length < 3}>
            <Globe className="h-4 w-4" /> {liveUrl ? "Update live site" : "Publish"}
          </Button>
          {liveUrl && (
            <div className="flex items-center gap-2">
              <Badge tone="green">● Live</Badge>
              <a href={liveUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <ExternalLink className="h-4 w-4" /> Open
                </Button>
              </a>
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(absoluteUrl)}>
                <Copy className="h-4 w-4" /> Copy link
              </Button>
            </div>
          )}
        </div>
        {liveUrl && <p className="mt-2 text-xs text-zinc-500">{absoluteUrl}</p>}
        {publishError && <p className="mt-2 text-xs text-red-600">{publishError}</p>}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Editor */}
        <div className="space-y-4">
          <Card title="Brand & style" right={<SourceBadge source={source} />}>
            <div className="space-y-3">
              <Field label="Brand name">
                <input
                  className={inputCls}
                  value={brandName}
                  onChange={(e) => {
                    setBrandName(e.target.value);
                    if (!liveUrl) setSlug(slugify(e.target.value));
                  }}
                />
              </Field>
              <Field label="Theme">
                <div className="grid grid-cols-4 gap-2">
                  {THEME_KEYS.map((k) => (
                    <button
                      key={k}
                      onClick={() => setTheme(k)}
                      className={cx("rounded-lg border p-1.5 text-center text-[11px] font-medium", theme === k ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200 hover:border-zinc-400")}
                    >
                      <div className={cx("mb-1 h-8 rounded-md", THEMES[k].swatch)} />
                      {THEMES[k].label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Language">
                <div className="flex rounded-lg border border-zinc-300 p-0.5">
                  {(["Hinglish", "English", "Hindi"] as Lang[]).map((l) => (
                    <button key={l} onClick={() => setLanguage(l)} className={cx("flex-1 rounded-md py-1.5 text-xs font-medium", language === l ? "bg-zinc-900 text-white" : "text-zinc-600")}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Product image URL" hint="Paste a supplier or product photo link (optional).">
                <input className={inputCls} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/product.jpg" />
              </Field>
              <Button className="w-full" onClick={generate} loading={generating}>
                <Sparkles className="h-4 w-4" /> {generating ? "Writing your store…" : "Generate with AI"}
              </Button>
            </div>
          </Card>

          <Section title="Hero & announcement" defaultOpen>
            <Field label="Announcement bar">
              <input className={inputCls} value={content.announcement} onChange={(e) => patch({ announcement: e.target.value })} />
            </Field>
            <Field label="Headline">
              <input className={inputCls} value={content.hero.headline} onChange={(e) => patch({ hero: { ...content.hero, headline: e.target.value } })} />
            </Field>
            <Field label="Subheadline">
              <textarea rows={3} className={inputCls} value={content.hero.subheadline} onChange={(e) => patch({ hero: { ...content.hero, subheadline: e.target.value } })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Button text">
                <input className={inputCls} value={content.hero.cta} onChange={(e) => patch({ hero: { ...content.hero, cta: e.target.value } })} />
              </Field>
              <Field label="Badge">
                <input className={inputCls} value={content.hero.badge ?? ""} onChange={(e) => patch({ hero: { ...content.hero, badge: e.target.value || undefined } })} />
              </Field>
            </div>
            <Field label="Tagline">
              <input className={inputCls} value={content.tagline} onChange={(e) => patch({ tagline: e.target.value })} />
            </Field>
          </Section>

          <Section title={`Benefits (${content.benefits.length})`}>
            <ListEditor
              items={content.benefits}
              onChange={(benefits) => patch({ benefits })}
              blank={{ icon: "✨", title: "", text: "" }}
              render={(b, set) => (
                <>
                  <div className="flex gap-2">
                    <input className={cx(inputCls, "w-14 text-center")} value={b.icon} onChange={(e) => set({ ...b, icon: e.target.value })} />
                    <input className={inputCls} placeholder="Title" value={b.title} onChange={(e) => set({ ...b, title: e.target.value })} />
                  </div>
                  <textarea rows={2} className={inputCls} placeholder="One sentence" value={b.text} onChange={(e) => set({ ...b, text: e.target.value })} />
                </>
              )}
            />
          </Section>

          <Section title={`How it works (${content.howItWorks.length})`}>
            <ListEditor
              items={content.howItWorks}
              onChange={(howItWorks) => patch({ howItWorks })}
              blank={{ title: "", text: "" }}
              render={(s, set) => (
                <>
                  <input className={inputCls} placeholder="Step title" value={s.title} onChange={(e) => set({ ...s, title: e.target.value })} />
                  <input className={inputCls} placeholder="Step detail" value={s.text} onChange={(e) => set({ ...s, text: e.target.value })} />
                </>
              )}
            />
          </Section>

          <Section title={`Details / specs (${content.specs.length})`}>
            <ListEditor
              items={content.specs}
              onChange={(specs) => patch({ specs })}
              blank={{ label: "", value: "" }}
              render={(s, set) => (
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="Label" value={s.label} onChange={(e) => set({ ...s, label: e.target.value })} />
                  <input className={inputCls} placeholder="Value" value={s.value} onChange={(e) => set({ ...s, value: e.target.value })} />
                </div>
              )}
            />
          </Section>

          <Section title="Offer & guarantee">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Price (₹)">
                <input type="number" className={inputCls} value={content.offer.price} onChange={(e) => patch({ offer: { ...content.offer, price: Number(e.target.value) || 0 } })} />
              </Field>
              <Field label="MRP / compare-at (₹)">
                <input
                  type="number"
                  className={inputCls}
                  value={content.offer.compareAtPrice ?? ""}
                  onChange={(e) => patch({ offer: { ...content.offer, compareAtPrice: e.target.value ? Number(e.target.value) : undefined } })}
                />
              </Field>
            </div>
            <Field label="Offer bullets (one per line)" hint="Only promise policies you actually offer.">
              <textarea
                rows={3}
                className={inputCls}
                value={content.offer.bullets.join("\n")}
                onChange={(e) => patch({ offer: { ...content.offer, bullets: e.target.value.split("\n").filter((x) => x.trim()) } })}
              />
            </Field>
            <Field label="Guarantee line">
              <input className={inputCls} value={content.guarantee} onChange={(e) => patch({ guarantee: e.target.value })} />
            </Field>
          </Section>

          <Section title={`FAQ (${content.faq.length})`}>
            <ListEditor
              items={content.faq}
              onChange={(faq) => patch({ faq })}
              blank={{ q: "", a: "" }}
              render={(f, set) => (
                <>
                  <input className={inputCls} placeholder="Question" value={f.q} onChange={(e) => set({ ...f, q: e.target.value })} />
                  <textarea rows={2} className={inputCls} placeholder="Answer" value={f.a} onChange={(e) => set({ ...f, a: e.target.value })} />
                </>
              )}
            />
          </Section>

          <Section title={`Customer reviews (${content.reviews.length})`}>
            <p className="text-xs text-amber-700">Add only real customer reviews. DropOS never writes reviews for you; the section stays hidden until you add one.</p>
            <ListEditor
              items={content.reviews}
              onChange={(reviews) => patch({ reviews })}
              blank={{ name: "", city: "", text: "", rating: 5 }}
              render={(r, set) => (
                <>
                  <div className="flex gap-2">
                    <input className={inputCls} placeholder="Customer name" value={r.name} onChange={(e) => set({ ...r, name: e.target.value })} />
                    <input className={inputCls} placeholder="City" value={r.city} onChange={(e) => set({ ...r, city: e.target.value })} />
                    <select className={cx(inputCls, "w-20")} value={r.rating} onChange={(e) => set({ ...r, rating: Number(e.target.value) })}>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n}★
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea rows={2} className={inputCls} placeholder="What they actually said" value={r.text} onChange={(e) => set({ ...r, text: e.target.value })} />
                </>
              )}
            />
          </Section>

          <Section title="Footer">
            <Field label="Footer note">
              <input className={inputCls} value={content.footerNote} onChange={(e) => patch({ footerNote: e.target.value })} />
            </Field>
          </Section>
        </div>

        {/* Preview */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-100 px-3 py-2">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 truncate rounded-md bg-white px-3 py-1 text-xs text-zinc-500">
                {origin ? origin.replace(/^https?:\/\//, "") : "your-store"}/s/{slug || "…"}
              </div>
              <div className="flex rounded-md bg-white p-0.5">
                <button onClick={() => setDevice("desktop")} className={cx("rounded px-2 py-1", device === "desktop" ? "bg-zinc-900 text-white" : "text-zinc-500")} aria-label="Desktop preview">
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setDevice("mobile")} className={cx("rounded px-2 py-1", device === "mobile" ? "bg-zinc-900 text-white" : "text-zinc-500")} aria-label="Mobile preview">
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className={cx("h-[78vh] overflow-y-auto", device === "mobile" && "bg-zinc-200 py-4")}>
              <div className={cx(device === "mobile" && "mx-auto max-w-[390px] overflow-hidden rounded-2xl shadow-xl")}>
                <SiteRenderer content={fullContent} theme={theme} imageUrl={imageUrl || undefined} productName={product.name} variants={product.variants} compact={device === "mobile"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-zinc-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-sm font-semibold text-zinc-900">
        {title}
        <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-zinc-100 px-5 py-4">{children}</div>
    </details>
  );
}

function ListEditor<T>({
  items,
  onChange,
  blank,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: T;
  render: (item: T, set: (next: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="relative space-y-2 rounded-lg border border-zinc-200 p-3 pr-9">
          {render(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="absolute right-2 top-2 text-zinc-400 hover:text-red-600" aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button variant="secondary" className="w-full text-xs" onClick={() => onChange([...items, blank])}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}
