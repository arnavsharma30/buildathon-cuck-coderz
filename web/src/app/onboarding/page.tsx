"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { DEFAULT_ECONOMICS, inr, unitEconomics } from "@/lib/economics";
import type { Product } from "@/lib/types";

const ROLES = ["Founder", "Sourcing", "Ads", "Ops", "Creative", "Member"] as const;
const STEPS = ["Team", "You", "Teammates", "First product", "Review"];

interface MemberRow {
  name: string;
  phone: string;
  email: string;
  role: string;
  password: string;
}

const blankMember = (role = "Member"): MemberRow => ({ name: "", phone: "", email: "", role, password: "" });
const digits = (s: string) => {
  let d = s.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return d;
};
const validPhone = (s: string) => /^[6-9]\d{9}$/.test(digits(s));
const tempPassword = () => `mu-${Math.random().toString(36).slice(2, 8)}`;

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-200";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [team, setTeam] = useState({ name: "", storeName: "", college: "Masters' Union" });
  const [me, setMe] = useState<MemberRow>(blankMember("Founder"));
  const [mates, setMates] = useState<MemberRow[]>([]);
  const [product, setProduct] = useState({ name: "", category: "", sellingPrice: "", sourcingCost: "", shippingCost: "65", image: "" });
  const [skipProduct, setSkipProduct] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ teamName: string; logins: MemberRow[] } | null>(null);

  const productOk = Number(product.sellingPrice) > 0 && Number(product.sourcingCost) > 0 && product.name.trim().length > 1;
  const stepError = (): string | undefined => {
    if (step === 0 && team.name.trim().length < 2) return "Give your team a name.";
    if (step === 1) {
      if (me.name.trim().length < 2) return "Enter your name.";
      if (!validPhone(me.phone)) return "Enter a valid 10-digit mobile number.";
      if (me.password.length < 6) return "Password needs at least 6 characters.";
    }
    if (step === 2) {
      for (const m of mates) {
        if (m.name.trim().length < 2) return "Every teammate needs a name (or remove the row).";
        if (!validPhone(m.phone)) return `${m.name || "A teammate"} needs a valid 10-digit mobile number.`;
        if (m.password.length < 6) return `${m.name}'s temporary password needs 6+ characters.`;
      }
      const all = [me, ...mates].map((m) => digits(m.phone));
      if (new Set(all).size !== all.length) return "Two people have the same phone number.";
    }
    if (step === 3 && !skipProduct && !productOk) return "Add name, selling price and landed cost, or skip for now.";
  };

  function next() {
    const e = stepError();
    setError(e);
    if (!e) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function create() {
    setBusy(true);
    setError(undefined);
    const p: Product | undefined =
      !skipProduct && productOk
        ? {
            id: `prd_${Math.random().toString(36).slice(2, 9)}`,
            name: product.name.trim(),
            category: product.category.trim() || "General",
            why: "",
            targetAudience: "",
            sourcingCost: Number(product.sourcingCost),
            sellingPrice: Number(product.sellingPrice),
            shippingCost: Number(product.shippingCost) || 0,
            scores: { demand: 5, margin: 5, rtoRisk: 5, competition: 5, wow: 5 },
            risks: [],
            indiamartQuery: product.name.trim().toLowerCase(),
            status: "shortlisted",
            createdAt: 0, // server stamps it
            images: product.image.trim() ? [product.image.trim()] : [],
          }
        : undefined;
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ team, members: [me, ...mates], product: p }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || `Signup failed (${res.status})`);
      setDone({ teamName: team.name, logins: mates });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const econ =
    productOk && unitEconomics({ sellingPrice: Number(product.sellingPrice), productCost: Number(product.sourcingCost), shippingFwd: Number(product.shippingCost) || 0 }, DEFAULT_ECONOMICS);

  if (done) {
    const share = done.logins.map((m) => `${m.name}: login at ${typeof window !== "undefined" ? window.location.origin : ""}/login with phone ${digits(m.phone)} and password ${m.password}`).join("\n");
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-zinc-900">{done.teamName} is ready</h1>
          <p className="mt-1 text-sm text-zinc-500">You&apos;re logged in. Everything your team does is now shared and tracked.</p>
        </div>
        {done.logins.length > 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-800">Share these logins with your teammates</div>
              <button onClick={() => navigator.clipboard.writeText(share)} className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900">
                <Copy className="h-3.5 w-3.5" /> Copy all
              </button>
            </div>
            <ul className="space-y-1.5 text-sm">
              {done.logins.map((m) => (
                <li key={m.phone} className="flex justify-between gap-3">
                  <span className="text-zinc-800">
                    {m.name} <span className="text-zinc-400">· {m.role}</span>
                  </span>
                  <span className="font-mono text-xs text-zinc-600">
                    {digits(m.phone)} / {m.password}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-zinc-500">They log in with their phone number and this temporary password.</p>
          </div>
        )}
        <Link href="/" className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700">
          Open the command center <ArrowRight className="h-4 w-4" />
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-emerald-500" : "bg-zinc-200"}`} />
            <span className={`text-[11px] font-medium ${i === step ? "text-zinc-900" : "text-zinc-400"}`}>{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Section title="Set up your team" subtitle="This is the team you run your Dropship Challenge store with.">
          <L label="Team name">
            <input className={field} value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} placeholder="e.g. Cuck Coderz" autoFocus />
          </L>
          <L label="Store / brand name" hint="What customers will see. You can change it later.">
            <input className={field} value={team.storeName} onChange={(e) => setTeam({ ...team, storeName: e.target.value })} placeholder="e.g. Seedha Posture" />
          </L>
          <L label="College / cohort">
            <input className={field} value={team.college} onChange={(e) => setTeam({ ...team, college: e.target.value })} />
          </L>
        </Section>
      )}

      {step === 1 && (
        <Section title="About you" subtitle="You'll log in with your phone number and password.">
          <MemberFields m={me} onChange={setMe} passwordLabel="Password" />
        </Section>
      )}

      {step === 2 && (
        <Section title="Add your teammates" subtitle="Each teammate gets their own login, so everyone's work is tracked. You can also add them later from the Team page.">
          <div className="space-y-4">
            {mates.map((m, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Teammate {i + 1}</span>
                  <button onClick={() => setMates(mates.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-600" title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <MemberFields m={m} onChange={(v) => setMates(mates.map((x, j) => (j === i ? v : x)))} passwordLabel="Temporary password" />
              </div>
            ))}
            <button
              onClick={() => setMates([...mates, { ...blankMember(), password: tempPassword() }])}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
            >
              <Plus className="h-4 w-4" /> Add teammate
            </button>
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section title="Your first product" subtitle="Already know what you'll sell? Add it now. Otherwise skip and use Product research.">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={skipProduct} onChange={(e) => setSkipProduct(e.target.checked)} className="accent-zinc-900" />
            Skip, we&apos;ll research products inside DropOS
          </label>
          {!skipProduct && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <L label="Product name">
                  <input className={field} value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} placeholder="e.g. Posture Corrector Belt" />
                </L>
                <L label="Category">
                  <input className={field} value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })} placeholder="e.g. Health & Fitness" />
                </L>
                <L label="Selling price (₹)">
                  <input className={field} type="number" value={product.sellingPrice} onChange={(e) => setProduct({ ...product, sellingPrice: e.target.value })} placeholder="699" />
                </L>
                <L label="Landed cost (₹)" hint="Supplier price incl. GST">
                  <input className={field} type="number" value={product.sourcingCost} onChange={(e) => setProduct({ ...product, sourcingCost: e.target.value })} placeholder="140" />
                </L>
                <L label="Shipping per order (₹)">
                  <input className={field} type="number" value={product.shippingCost} onChange={(e) => setProduct({ ...product, shippingCost: e.target.value })} />
                </L>
                <L label="Image URL (optional)">
                  <input className={field} value={product.image} onChange={(e) => setProduct({ ...product, image: e.target.value })} placeholder="https://…" />
                </L>
              </div>
              {econ && (
                <div className={`rounded-xl p-4 text-sm ${econ.profitPerOrder >= 0 ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
                  Naive margin looks like <b>{inr(econ.naiveMargin)}</b> per order, but after COD RTO, reverse shipping and ads you&apos;d make about{" "}
                  <b>{inr(econ.profitPerOrder)}</b> per order placed. You can tune these assumptions later.
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {step === 4 && (
        <Section title="Review" subtitle="Create the team and you're in.">
          <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm">
            <Row k="Team" v={`${team.name}${team.storeName ? ` · store "${team.storeName}"` : ""}`} />
            <Row k="College" v={team.college || "—"} />
            <Row k="You" v={`${me.name} · ${me.role} · ${digits(me.phone)}`} />
            <Row k="Teammates" v={mates.length ? mates.map((m) => `${m.name} (${m.role})`).join(", ") : "None yet"} />
            <Row k="First product" v={!skipProduct && productOk ? `${product.name} · ₹${product.sellingPrice}` : "Skipped"} />
          </dl>
        </Section>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-8 flex items-center justify-between">
        {step > 0 ? (
          <button onClick={() => (setError(undefined), setStep(step - 1))} className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : (
          <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900">
            Already have a team? Log in
          </Link>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={next} className="flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700">
            {step === 2 && mates.length === 0 ? "Skip for now" : "Continue"} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={create} disabled={busy} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create team
          </button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-800 px-4 py-10">
      <div className="mx-auto mb-6 flex max-w-xl items-center gap-2 text-white">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">D</div>
        <div>
          <div className="text-sm font-semibold">DropOS</div>
          <div className="text-[11px] text-zinc-400">Team onboarding · MU Dropship Challenge</div>
        </div>
      </div>
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-7 shadow-2xl">{children}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="mb-5 mt-1 text-sm text-zinc-500">{subtitle}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function L({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-400">{hint}</span>}
    </label>
  );
}

function MemberFields({ m, onChange, passwordLabel }: { m: MemberRow; onChange: (m: MemberRow) => void; passwordLabel: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <L label="Full name">
        <input className={field} value={m.name} onChange={(e) => onChange({ ...m, name: e.target.value })} placeholder="e.g. Arnav Sharma" />
      </L>
      <L label="Mobile number">
        <input className={field} value={m.phone} inputMode="tel" onChange={(e) => onChange({ ...m, phone: e.target.value })} placeholder="10-digit mobile" />
      </L>
      <L label="Email (optional)">
        <input className={field} type="email" value={m.email} onChange={(e) => onChange({ ...m, email: e.target.value })} placeholder="you@college.edu" />
      </L>
      <L label="Role">
        <select className={field} value={m.role} onChange={(e) => onChange({ ...m, role: e.target.value })}>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </L>
      <div className="sm:col-span-2">
        <L label={passwordLabel} hint="At least 6 characters.">
          <input className={field} value={m.password} onChange={(e) => onChange({ ...m, password: e.target.value })} type={passwordLabel === "Password" ? "password" : "text"} />
        </L>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-right font-medium text-zinc-900">{v}</dd>
    </div>
  );
}
