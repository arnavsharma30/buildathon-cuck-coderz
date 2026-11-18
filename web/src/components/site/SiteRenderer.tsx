import type { ReactNode } from "react";
import type { SiteContent, SiteTheme } from "@/lib/types";
import { THEMES } from "@/lib/site";

// Presentational single-product store page. No hooks, so it renders on the server (/s/[slug]) and in the builder preview.

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function SiteRenderer({
  content: c,
  theme,
  imageUrl,
  productName,
  orderSlot,
  compact,
}: {
  content: SiteContent;
  theme: SiteTheme;
  imageUrl?: string;
  productName: string;
  variants?: string[];
  orderSlot?: ReactNode;
  /** Builder mobile preview: force single-column layout regardless of viewport. */
  compact?: boolean;
}) {
  const t = THEMES[theme] ?? THEMES.fresh;
  const two = compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";
  const four = compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  const three = compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3";
  const discount = c.offer.compareAtPrice && c.offer.compareAtPrice > c.offer.price ? Math.round((1 - c.offer.price / c.offer.compareAtPrice) * 100) : 0;

  return (
    <div className={cx("min-h-full", t.page, t.font)}>
      {c.announcement && <div className={cx("px-4 py-2 text-center text-xs font-medium", t.announcement)}>{c.announcement}</div>}

      <header className={cx("sticky top-0 z-10 backdrop-blur", t.header)}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className={cx("text-lg font-bold", t.brand)}>{c.brandName}</div>
          <a href="#order" className={cx("rounded-full px-4 py-2 text-sm font-semibold transition", t.button)}>
            {c.hero.cta || "Order now"}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className={t.heroBg}>
        <div className={cx("mx-auto grid max-w-6xl items-center gap-10 px-5 py-12", two)}>
          <div>
            {c.hero.badge && <span className={cx("inline-block rounded-full px-3 py-1 text-xs font-semibold", t.badge)}>{c.hero.badge}</span>}
            <h1 className={cx("mt-4 font-extrabold leading-tight tracking-tight", compact ? "text-3xl" : "text-4xl md:text-5xl")}>{c.hero.headline}</h1>
            <p className={cx("mt-4 text-base leading-relaxed", t.muted)}>{c.hero.subheadline}</p>
            {c.tagline && <p className={cx("mt-3 text-sm font-medium", t.accentText)}>{c.tagline}</p>}
            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold">{inr(c.offer.price)}</span>
              {discount > 0 && (
                <>
                  <span className={cx("text-lg line-through", t.muted)}>{inr(c.offer.compareAtPrice!)}</span>
                  <span className={cx("rounded-md px-2 py-0.5 text-xs font-bold", t.badge)}>{discount}% OFF</span>
                </>
              )}
            </div>
            <a href="#order" className={cx("mt-6 inline-block rounded-xl px-7 py-3.5 text-base font-bold shadow-lg transition", t.button)}>
              {c.hero.cta || "Order now"}
            </a>
            <div className={cx("mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs", t.muted)}>
              {c.offer.bullets.slice(0, 3).map((b) => (
                <span key={b}>✓ {b}</span>
              ))}
            </div>
          </div>
          <div className="aspect-square w-full overflow-hidden rounded-3xl shadow-xl">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary team-supplied image URLs
              <img src={imageUrl} alt={productName} className="h-full w-full object-cover" />
            ) : (
              <div className={cx("flex h-full w-full flex-col items-center justify-center p-8 text-center", t.heroFallback)}>
                <div className="text-6xl">{c.benefits[0]?.icon || "✨"}</div>
                <div className="mt-4 text-2xl font-extrabold">{productName}</div>
                <div className="mt-2 text-sm opacity-80">Add a product image URL in the builder</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Benefits */}
      {c.benefits.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-center text-2xl font-bold">Why you&apos;ll love it</h2>
          <div className={cx("mt-8 grid gap-4", four)}>
            {c.benefits.map((b, i) => (
              <div key={i} className={cx("rounded-2xl p-5", t.card)}>
                <div className="text-3xl">{b.icon}</div>
                <div className="mt-3 font-semibold">{b.title}</div>
                <p className={cx("mt-1 text-sm leading-relaxed", t.muted)}>{b.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      {c.howItWorks.length > 0 && (
        <section className={t.section}>
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-center text-2xl font-bold">How it works</h2>
            <div className={cx("mt-8 grid gap-6", three)}>
              {c.howItWorks.map((s, i) => (
                <div key={i} className="text-center">
                  <div className={cx("mx-auto grid h-10 w-10 place-items-center rounded-full text-sm font-bold", t.button)}>{i + 1}</div>
                  <div className="mt-3 font-semibold">{s.title}</div>
                  <p className={cx("mt-1 text-sm", t.muted)}>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Specs + offer */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className={cx("grid gap-8", two)}>
          {c.specs.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold">Details</h2>
              <dl className={cx("mt-5 divide-y overflow-hidden rounded-2xl", t.card)}>
                {c.specs.map((s, i) => (
                  <div key={i} className="flex justify-between gap-4 px-5 py-3 text-sm">
                    <dt className={t.muted}>{s.label}</dt>
                    <dd className="text-right font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div className={cx("rounded-2xl p-6", t.card)}>
            <div className={cx("text-xs font-semibold uppercase tracking-wider", t.accentText)}>Today&apos;s price</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-4xl font-extrabold">{inr(c.offer.price)}</span>
              {discount > 0 && <span className={cx("text-lg line-through", t.muted)}>{inr(c.offer.compareAtPrice!)}</span>}
            </div>
            <ul className="mt-5 space-y-2 text-sm">
              {c.offer.bullets.map((b, i) => (
                <li key={i}>✅ {b}</li>
              ))}
            </ul>
            {c.guarantee && <p className={cx("mt-5 rounded-xl px-4 py-3 text-sm", t.section)}>🛡️ {c.guarantee}</p>}
            <a href="#order" className={cx("mt-6 block rounded-xl px-6 py-3 text-center font-bold transition", t.button)}>
              {c.hero.cta || "Order now"}
            </a>
          </div>
        </div>
      </section>

      {/* Real reviews only */}
      {c.reviews.length > 0 && (
        <section className={t.section}>
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-center text-2xl font-bold">What customers say</h2>
            <div className={cx("mt-8 grid gap-4", three)}>
              {c.reviews.map((r, i) => (
                <figure key={i} className={cx("rounded-2xl p-5", t.card)}>
                  <div className="text-amber-500">{"★".repeat(Math.max(1, Math.min(5, Math.round(r.rating || 5))))}</div>
                  <blockquote className="mt-2 text-sm leading-relaxed">“{r.text}”</blockquote>
                  <figcaption className={cx("mt-3 text-xs", t.muted)}>
                    {r.name}
                    {r.city ? `, ${r.city}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {c.faq.length > 0 && (
        <section className="mx-auto max-w-3xl px-5 py-14">
          <h2 className="text-center text-2xl font-bold">FAQs</h2>
          <div className="mt-8 space-y-3">
            {c.faq.map((f, i) => (
              <details key={i} className={cx("group rounded-xl px-5 py-4", t.card)}>
                <summary className="cursor-pointer list-none font-semibold">
                  <span className="mr-2 inline-block transition group-open:rotate-45">＋</span>
                  {f.q}
                </summary>
                <p className={cx("mt-2 text-sm leading-relaxed", t.muted)}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Order */}
      <section id="order" className={t.section}>
        <div className="mx-auto max-w-xl px-5 py-14">
          <h2 className="text-center text-2xl font-bold">Order now: Cash on Delivery</h2>
          <p className={cx("mt-2 text-center text-sm", t.muted)}>Pay nothing now. Pay cash or UPI when it arrives.</p>
          <div className={cx("mt-6 rounded-2xl p-6", t.card)}>{orderSlot ?? <OrderPreview button={t.button} muted={t.muted} />}</div>
        </div>
      </section>

      <footer className={t.footer}>
        <div className="mx-auto max-w-6xl px-5 py-8 text-center text-xs">
          <div>{c.footerNote}</div>
          <div className="mt-2 opacity-60">Powered by DropOS</div>
        </div>
      </footer>
    </div>
  );
}

function OrderPreview({ button, muted }: { button: string; muted: string }) {
  const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-400";
  return (
    <div className="space-y-3">
      {["Full name", "10-digit mobile number", "House no., street, landmark", "City", "Pincode"].map((f) => (
        <div key={f} className={field}>
          {f}
        </div>
      ))}
      <div className={cx("rounded-xl px-6 py-3 text-center font-bold opacity-70", button)}>Place COD order</div>
      <p className={cx("text-center text-xs", muted)}>Preview: the live form works once you publish.</p>
    </div>
  );
}
