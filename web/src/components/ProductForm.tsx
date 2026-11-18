"use client";

import { useState } from "react";
import { ImageOff, X } from "lucide-react";
import type { EconomicsSettings, Product, ProductScores, ProductStatus } from "@/lib/types";
import { inr, pct, unitEconomics } from "@/lib/economics";
import { Button, Field, cx, inputCls } from "./ui";

const STATUSES: ProductStatus[] = ["idea", "shortlisted", "sourcing", "live", "dropped"];

const SCORE_FIELDS: { key: keyof ProductScores; label: string; hint: string }[] = [
  { key: "demand", label: "Demand", hint: "How many people want it" },
  { key: "margin", label: "Margin", hint: "Room for a 3x markup" },
  { key: "wow", label: "Wow factor", hint: "Thumb-stopping on a Reel" },
  { key: "rtoRisk", label: "RTO risk", hint: "Higher = riskier (impulse, fragile, sizing)" },
  { key: "competition", label: "Competition", hint: "Higher = more saturated" },
];

export type ProductDraft = Omit<Product, "id" | "createdAt">;

export const BLANK_PRODUCT: ProductDraft = {
  name: "",
  category: "",
  why: "",
  targetAudience: "",
  description: "",
  sourcingCost: 0,
  sellingPrice: 0,
  compareAtPrice: undefined,
  shippingCost: 65,
  scores: { demand: 5, margin: 5, rtoRisk: 5, competition: 5, wow: 5 },
  risks: [],
  indiamartQuery: "",
  status: "idea",
  images: [],
  variants: [],
  tags: [],
  sku: "",
};

const list = (s: string, sep: RegExp) =>
  s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

export function ProductForm({
  initial,
  settings,
  mode,
  onSave,
  onClose,
}: {
  initial: ProductDraft;
  settings: EconomicsSettings;
  mode: "add" | "edit";
  onSave: (p: ProductDraft) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState<ProductDraft>(initial);
  // Free-text mirrors for list fields so typing commas/newlines feels natural.
  const [imagesText, setImagesText] = useState((initial.images ?? []).join("\n"));
  const [variantsText, setVariantsText] = useState((initial.variants ?? []).join(", "));
  const [tagsText, setTagsText] = useState((initial.tags ?? []).join(", "));
  const [risksText, setRisksText] = useState(initial.risks.join("\n"));

  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => setP((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  const images = list(imagesText, /\n+/);
  const r = unitEconomics({ sellingPrice: p.sellingPrice, productCost: p.sourcingCost, shippingFwd: p.shippingCost }, settings);
  const valid = p.name.trim().length > 1 && p.sellingPrice > 0 && p.sourcingCost > 0;

  function save() {
    if (!valid) return;
    onSave({
      ...p,
      name: p.name.trim(),
      category: p.category.trim() || "General",
      indiamartQuery: p.indiamartQuery.trim() || p.name.trim().toLowerCase(),
      images,
      variants: list(variantsText, /,/),
      tags: list(tagsText, /,/),
      risks: list(risksText, /\n+/),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{mode === "add" ? "Add a product" : `Edit ${initial.name}`}</h2>
            <p className="text-xs text-zinc-500">Catalogue details, pricing and your own scoring. Profit updates live as you type.</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="grid gap-3 md:grid-cols-2">
            <Field label="Product name *">
              <input className={inputCls} value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Adjustable Posture Corrector Belt" autoFocus />
            </Field>
            <Field label="Category">
              <input className={inputCls} value={p.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Health & Fitness" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description (used on your website)">
                <textarea className={cx(inputCls, "h-20")} value={p.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="What it is, what it's made of, who it's for." />
              </Field>
            </div>
            <Field label="Why it will sell">
              <textarea className={cx(inputCls, "h-16")} value={p.why} onChange={(e) => set("why", e.target.value)} placeholder="The hook / trend / pain it solves" />
            </Field>
            <Field label="Target audience">
              <textarea className={cx(inputCls, "h-16")} value={p.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} placeholder="e.g. Women 22-30 in metros, desk workers" />
            </Field>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pricing</h3>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Selling price (₹) *">
                <input className={inputCls} type="number" min={0} value={p.sellingPrice || ""} onChange={(e) => set("sellingPrice", num(e.target.value))} />
              </Field>
              <Field label="MRP / compare-at (₹)" hint="Shown struck-through">
                <input className={inputCls} type="number" min={0} value={p.compareAtPrice ?? ""} onChange={(e) => set("compareAtPrice", e.target.value === "" ? undefined : Number(e.target.value))} />
              </Field>
              <Field label="Landed cost (₹) *" hint="Supplier price incl. GST">
                <input className={inputCls} type="number" min={0} value={p.sourcingCost || ""} onChange={(e) => set("sourcingCost", num(e.target.value))} />
              </Field>
              <Field label="Shipping / order (₹)">
                <input className={inputCls} type="number" min={0} value={p.shippingCost || ""} onChange={(e) => set("shippingCost", num(e.target.value))} />
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm md:grid-cols-4">
              <Mini label="Naive margin" value={p.sellingPrice ? `${inr(r.naiveMargin)} (${pct(r.naiveMarginPct)})` : "—"} />
              <Mini label="Real profit / order placed" value={p.sellingPrice ? inr(r.profitPerOrder) : "—"} tone={r.profitPerOrder >= 0 ? "good" : "bad"} />
              <Mini label="Break-even CPA" value={p.sellingPrice ? inr(r.profitBeforeAds) : "—"} />
              <Mini label="Max COD RTO" value={r.maxRtoCod == null ? "never profitable" : pct(r.maxRtoCod)} />
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <Field label="Image URLs (one per line)" hint="Paste supplier / product photo links">
              <textarea className={cx(inputCls, "h-24 font-mono text-xs")} value={imagesText} onChange={(e) => setImagesText(e.target.value)} placeholder="https://…/product-1.jpg" />
            </Field>
            <div>
              <span className="mb-1 block text-xs font-medium text-zinc-600">Preview</span>
              <div className="flex h-24 gap-2 overflow-x-auto rounded-lg border border-dashed border-zinc-300 p-2">
                {images.length === 0 ? (
                  <div className="flex w-full items-center justify-center gap-2 text-xs text-zinc-400">
                    <ImageOff className="h-4 w-4" /> No images yet
                  </div>
                ) : (
                  images.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied URLs
                    <img key={src} src={src} alt="" className="h-full w-20 shrink-0 rounded-md bg-zinc-100 object-cover" />
                  ))
                )}
              </div>
            </div>
            <Field label="Variants (comma separated)">
              <input className={inputCls} value={variantsText} onChange={(e) => setVariantsText(e.target.value)} placeholder="e.g. Black, Beige  or  S, M, L" />
            </Field>
            <Field label="SKU">
              <input className={inputCls} value={p.sku ?? ""} onChange={(e) => set("sku", e.target.value)} placeholder="e.g. POST-BLK-01" />
            </Field>
            <Field label="Tags (comma separated)">
              <input className={inputCls} value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="fitness, office, gifting" />
            </Field>
            <Field label="IndiaMART search query">
              <input className={inputCls} value={p.indiamartQuery} onChange={(e) => set("indiamartQuery", e.target.value)} placeholder="what suppliers call it" />
            </Field>
            <Field label="Status">
              <select className={inputCls} value={p.status} onChange={(e) => set("status", e.target.value as ProductStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Risks (one per line)">
              <textarea className={cx(inputCls, "h-16")} value={risksText} onChange={(e) => setRisksText(e.target.value)} placeholder="e.g. Size mismatch → returns" />
            </Field>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Your scoring (0-10)</h3>
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              {SCORE_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-700">{f.label}</span>
                    <span className="tabular-nums text-zinc-900">{p.scores[f.key]}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={p.scores[f.key]}
                    onChange={(e) => set("scores", { ...p.scores, [f.key]: Number(e.target.value) })}
                    className="w-full accent-zinc-900"
                  />
                  <div className="text-[11px] text-zinc-400">{f.hint}</div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
          <span className="text-xs text-zinc-500">{valid ? "" : "Name, selling price and landed cost are required."}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!valid}>
              {mode === "add" ? "Add product" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={cx("font-semibold tabular-nums", tone === "good" && "text-emerald-600", tone === "bad" && "text-red-600")}>{value}</div>
    </div>
  );
}
