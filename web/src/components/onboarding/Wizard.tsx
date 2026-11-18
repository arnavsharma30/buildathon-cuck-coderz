"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Plus, X } from "lucide-react";
import { DEFAULT_ECONOMICS, inr, unitEconomics } from "@/lib/economics";

const ROLES = ["Founder", "Sourcing", "Ads", "Ops", "Creative"] as const;
type Role = (typeof ROLES)[number];
type MemberRow = { name: string; phone: string; role: Role };
type ProductRow = { name: string; price: string; cost: string };
type Integration = "Meta ads" | "WhatsApp Business" | "Shiprocket" | "Delhivery";
const INTEGRATIONS: { id: Integration; hint: string; say: string }[] = [
  { id: "Meta ads", hint: "Create campaigns, ad sets & ads in your ad account", say: "Connect my Meta ad account" },
  { id: "WhatsApp Business", hint: "Order and shipping updates to customers", say: "Connect our WhatsApp Business number" },
  { id: "Shiprocket", hint: "Track every AWB across 25+ couriers", say: "Connect my Shiprocket account" },
  { id: "Delhivery", hint: "Track Delhivery shipments directly", say: "Connect our Delhivery API token" },
];

interface State {
  step: number;
  teamName: string;
  storeName: string;
  members: MemberRow[];
  products: ProductRow[];
  integrations: Integration[];
}
interface Result {
  team: { name: string; storeName: string };
  members: { name: string; role: string; mcpUrl: string }[];
  statusKey: string;
  products: { name: string; sellingPrice: number }[];
}
interface Status {
  members: { name: string; role: string; connected: boolean }[];
}

const KEY = "dropos:onboarding:v1";
const EMPTY: State = {
  step: 0,
  teamName: "",
  storeName: "",
  members: [{ name: "", phone: "", role: "Founder" }],
  products: [
    { name: "", price: "", cost: "" },
    { name: "", price: "", cost: "" },
    { name: "", price: "", cost: "" },
  ],
  integrations: [],
};
const STEPS = ["Team", "Store", "People", "Products", "Tools", "Review"];

const digits = (p: string) => {
  let d = p.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
};
const validPhone = (p: string) => /^[6-9]\d{9}$/.test(digits(p));
const filledProducts = (s: State) => s.products.filter((p) => p.name.trim());

function profitOf(p: ProductRow) {
  const price = Number(p.price);
  if (!price) return null;
  const est = !Number(p.cost);
  const cost = est ? Math.round(price * 0.3) : Number(p.cost);
  const r = unitEconomics({ sellingPrice: price, productCost: cost, shippingFwd: 65 }, DEFAULT_ECONOMICS);
  return { profit: r.profitPerOrder, naive: Math.round(r.naiveMarginPct * 100), est };
}

const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5";

export function Wizard() {
  const [s, setS] = useState<State>(EMPTY);
  const [result, setResult] = useState<Result | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Restore progress after a refresh.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { s: State; result: Result | null };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage
        setS({ ...EMPTY, ...saved.s });
        setResult(saved.result);
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) sessionStorage.setItem(KEY, JSON.stringify({ s, result }));
  }, [s, result, loaded]);

  const set = (patch: Partial<State>) => setS((x) => ({ ...x, ...patch }));

  const stepError = useMemo(() => {
    switch (s.step) {
      case 0:
        return s.teamName.trim().length < 2 ? "Give your team a name" : null;
      case 1:
        return s.storeName.trim().length < 2 ? "Give your store a name" : null;
      case 2: {
        const [me, ...rest] = s.members;
        if (me.name.trim().length < 2) return "Add your name";
        if (!validPhone(me.phone)) return "Enter your 10-digit mobile number";
        for (const m of rest) {
          if (!m.name.trim() && !m.phone.trim()) continue;
          if (m.name.trim().length < 2) return "Each teammate needs a name";
          if (!validPhone(m.phone)) return `${m.name || "Teammate"}: enter a 10-digit mobile number`;
        }
        const phones = s.members.filter((m) => m.phone.trim()).map((m) => digits(m.phone));
        if (new Set(phones).size !== phones.length) return "Two people have the same number";
        return null;
      }
      case 3:
        for (const p of filledProducts(s)) if (!(Number(p.price) > 0)) return `${p.name}: add a selling price`;
        return null;
      default:
        return null;
    }
  }, [s]);

  function next() {
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(undefined);
    if (s.step === 5) void create();
    else set({ step: s.step + 1 });
  }
  function back() {
    setError(undefined);
    set({ step: Math.max(0, s.step - 1) });
  }

  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamName: s.teamName,
          storeName: s.storeName,
          members: s.members.filter((m) => m.name.trim()).map((m) => ({ name: m.name, phone: digits(m.phone), role: m.role })),
          products: filledProducts(s).map((p) => ({
            name: p.name,
            sellingPrice: Number(p.price),
            ...(Number(p.cost) ? { landedCost: Number(p.cost) } : {}),
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong");
      setResult(body as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;
  if (result) return <Success result={result} integrations={s.integrations} onRestart={() => { sessionStorage.removeItem(KEY); setResult(null); setS(EMPTY); }} />;

  const progress = ((s.step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <style>{`@keyframes dropos-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-xs font-medium text-zinc-500">
          <span>
            Step {s.step + 1} of {STEPS.length} · {STEPS[s.step]}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-200">
          <div className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form
        key={s.step}
        style={{ animation: "dropos-in .3s ease-out" }}
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {s.step === 0 && (
          <Question title="What's your team called?" hint="The name your batch knows you by.">
            <input className={input} autoFocus value={s.teamName} onChange={(e) => set({ teamName: e.target.value })} placeholder="e.g. Cuck Coderz" />
          </Question>
        )}

        {s.step === 1 && (
          <Question title={`Nice. What's ${s.teamName || "your team"}'s store called?`} hint="Your brand name. It goes on your store page, WhatsApp messages and tracking links.">
            <input className={input} autoFocus value={s.storeName} onChange={(e) => set({ storeName: e.target.value })} placeholder="e.g. Seedha Posture" />
          </Question>
        )}

        {s.step === 2 && (
          <Question title="Who's on the team?" hint="Start with you. Everyone gets their own private Claude link, so DropOS knows who did what.">
            <div className="space-y-3">
              {s.members.map((m, i) => (
                <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{i === 0 ? "You" : `Teammate ${i}`}</span>
                    {i > 0 && (
                      <button type="button" onClick={() => set({ members: s.members.filter((_, j) => j !== i) })} className="text-zinc-400 hover:text-red-600" aria-label="Remove">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className={input}
                      autoFocus={i === s.members.length - 1}
                      value={m.name}
                      onChange={(e) => set({ members: s.members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                      placeholder="Full name"
                    />
                    <input
                      className={input}
                      inputMode="tel"
                      value={m.phone}
                      onChange={(e) => set({ members: s.members.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)) })}
                      placeholder="10-digit mobile"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => set({ members: s.members.map((x, j) => (j === i ? { ...x, role: r } : x)) })}
                        className={
                          m.role === r
                            ? "rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white"
                            : "rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-500"
                        }
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {s.members.length < 8 && (
                <button
                  type="button"
                  onClick={() => set({ members: [...s.members, { name: "", phone: "", role: "Sourcing" }] })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:border-zinc-500"
                >
                  <Plus className="h-4 w-4" /> Add a teammate
                </button>
              )}
            </div>
          </Question>
        )}

        {s.step === 3 && (
          <Question
            title="What are you thinking of selling?"
            hint="Add the 5-10 products you're considering. Don't know the cost yet? Leave it blank and we'll estimate. Watch what each one really makes per order after COD returns."
          >
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_110px_110px_130px_28px] gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400 sm:grid">
                <span>Product</span>
                <span>Sell at ₹</span>
                <span>Cost ₹</span>
                <span>Real / order</span>
                <span />
              </div>
              {s.products.map((p, i) => {
                const r = profitOf(p);
                const upd = (patch: Partial<ProductRow>) => set({ products: s.products.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_110px_110px_130px_28px] sm:items-center">
                    <input className={`${input} col-span-2 sm:col-span-1`} autoFocus={i === 0} value={p.name} onChange={(e) => upd({ name: e.target.value })} placeholder={["e.g. Posture corrector belt", "e.g. Portable blender", "e.g. LED strip lights"][i] ?? "Another product"} />
                    <input className={input} inputMode="numeric" value={p.price} onChange={(e) => upd({ price: e.target.value.replace(/[^\d]/g, "") })} placeholder="699" />
                    <input className={input} inputMode="numeric" value={p.cost} onChange={(e) => upd({ cost: e.target.value.replace(/[^\d]/g, "") })} placeholder="optional" />
                    <div className="col-span-2 sm:col-span-1">
                      {r ? (
                        <span
                          className={
                            r.profit >= 50
                              ? "inline-flex rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-semibold text-emerald-700"
                              : r.profit >= 0
                                ? "inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-semibold text-amber-700"
                                : "inline-flex rounded-lg bg-red-50 px-2.5 py-1.5 text-sm font-semibold text-red-700"
                          }
                          title={`Looks like ${r.naive}% margin before returns and ads`}
                        >
                          {inr(r.profit)}
                          {r.est && <span className="ml-1 text-[10px] font-medium opacity-70">est.</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">add a price</span>
                      )}
                    </div>
                    <button type="button" onClick={() => set({ products: s.products.filter((_, j) => j !== i) })} className="hidden text-zinc-400 hover:text-red-600 sm:block" aria-label="Remove">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              {s.products.length < 10 && (
                <button
                  type="button"
                  onClick={() => set({ products: [...s.products, { name: "", price: "", cost: "" }] })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:border-zinc-500"
                >
                  <Plus className="h-4 w-4" /> Add product
                </button>
              )}
              <p className="pt-2 text-xs text-zinc-500">
                &quot;Real / order&quot; = what you keep per order placed, assuming 70% COD, 30% of COD orders returned, ₹65 shipping and ₹220 ad cost per
                order. Claude can change these assumptions for your team later.
              </p>
            </div>
          </Question>
        )}

        {s.step === 4 && (
          <Question title="Which of these will you use?" hint="Optional. You connect them later just by telling Claude, e.g. “connect my Shiprocket”. Nothing to set up now.">
            <div className="grid gap-3 sm:grid-cols-2">
              {INTEGRATIONS.map((x) => {
                const on = s.integrations.includes(x.id);
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => set({ integrations: on ? s.integrations.filter((y) => y !== x.id) : [...s.integrations, x.id] })}
                    className={
                      on
                        ? "flex items-start gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-left"
                        : "flex items-start gap-3 rounded-2xl border-2 border-zinc-200 bg-white p-4 text-left hover:border-zinc-300"
                    }
                  >
                    <span className={on ? "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-emerald-500 text-white" : "mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-zinc-300"}>
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span>
                      <span className="block font-semibold text-zinc-900">{x.id}</span>
                      <span className="block text-sm text-zinc-500">{x.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Question>
        )}

        {s.step === 5 && (
          <Question title="All set. Look right?" hint="You can change all of this later by talking to Claude.">
            <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white text-sm">
              <Row label="Team" value={s.teamName} onEdit={() => set({ step: 0 })} />
              <Row label="Store" value={s.storeName} onEdit={() => set({ step: 1 })} />
              <Row label="People" value={s.members.filter((m) => m.name.trim()).map((m) => `${m.name} (${m.role})`).join(", ")} onEdit={() => set({ step: 2 })} />
              <Row
                label="Products"
                value={filledProducts(s).length ? filledProducts(s).map((p) => p.name).join(", ") : "None yet: you can add them in Claude"}
                onEdit={() => set({ step: 3 })}
              />
              <Row label="Tools" value={s.integrations.length ? s.integrations.join(", ") : "Decide later"} onEdit={() => set({ step: 4 })} />
            </div>
          </Question>
        )}

        {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}

        <div className="mt-8 flex items-center justify-between">
          {s.step > 0 ? (
            <button type="button" onClick={back} className="inline-flex items-center gap-1.5 px-2 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <Link href="/" className="px-2 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900">
              Cancel
            </Link>
          )}
          <div className="flex items-center gap-3">
            {s.step === 3 && filledProducts(s).length === 0 && (
              <button type="button" onClick={() => set({ step: 4 })} className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
                Skip for now
              </button>
            )}
            <span className="hidden text-xs text-zinc-400 sm:inline">press Enter ↵</span>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {s.step === 5 ? "Create my team" : "Continue"} {!busy && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
      {hint && <p className="mt-2 text-zinc-500">{hint}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      <span className="flex-1 text-zinc-800">{value}</span>
      <button type="button" onClick={onEdit} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
        Edit
      </button>
    </div>
  );
}

function Success({ result, integrations, onRestart }: { result: Result; integrations: Integration[]; onRestart: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [copied, setCopied] = useState<string>();

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/teams/status?key=${encodeURIComponent(result.statusKey)}`, { cache: "no-store" });
        if (res.ok && alive) setStatus((await res.json()) as Status);
      } catch {}
    };
    void poll();
    const t = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [result.statusKey]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(undefined), 1500);
  }

  const names = result.products.map((p) => p.name);
  const list = names.length ? names.slice(0, 4).join(", ") : "our product ideas";
  const prompts = [
    names.length ? `Which of our products (${list}) actually make money after COD returns? Rank them.` : "We're choosing what to sell. Suggest 5 products that survive COD returns in India and add them.",
    `Help me find IndiaMART suppliers for ${names[0] ?? "our best product"} and write the first WhatsApp message to them.`,
    `Write our ${result.team.storeName} store page in Hinglish and publish it.`,
    ...integrations.map((i) => INTEGRATIONS.find((x) => x.id === i)!.say + "."),
  ];
  const connected = status?.members.filter((m) => m.connected).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl" style={{ animation: "dropos-in .4s ease-out" }}>
      <style>{`@keyframes dropos-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900">{result.team.name} is ready 🎉</h1>
        <p className="mt-2 text-zinc-500">
          Last step: everyone adds DropOS to their Claude. {result.members.length > 1 ? "Send each teammate their own link." : ""}
        </p>
      </div>

      <div className="mt-8 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm sm:grid-cols-3">
        {[
          ["Open Claude", "claude.ai or the Claude app → Settings → Connectors"],
          ["Add custom connector", "Name it “DropOS” and paste your link"],
          ["Start a chat", "Make sure DropOS is switched on, then just talk"],
        ].map(([t, d], i) => (
          <div key={t} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{i + 1}</span>
            <div>
              <div className="font-semibold text-zinc-900">{t}</div>
              <div className="text-xs text-zinc-500">{d}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {result.members.map((m) => {
          const live = status?.members.find((x) => x.name === m.name)?.connected;
          return (
            <div key={m.mcpUrl} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
                    {m.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-900">{m.name}</div>
                    <div className="text-xs text-zinc-500">{m.role}</div>
                  </div>
                </div>
                {live ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600"
                    title="Turns green the moment this person's Claude connects with this link"
                  >
                    <span className="h-2 w-2 rounded-full border border-zinc-400" /> Not added to Claude yet
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <code className="flex-1 truncate rounded-xl bg-zinc-50 px-3 py-3 font-mono text-xs text-zinc-700">{m.mcpUrl}</code>
                <button
                  onClick={() => copy(m.mcpUrl)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700"
                >
                  {copied === m.mcpUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === m.mcpUrl ? "Copied" : "Copy link"}
                </button>
              </div>
              <a
                href={m.mcpUrl.replace("/mcp/", "/d/")}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                Analytics dashboard →
              </a>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-zinc-500">
        {connected}/{result.members.length} connected · each link is personal, so keep it private
      </p>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="text-sm font-semibold text-zinc-900">Your first messages to Claude</div>
        <div className="mt-3 space-y-2">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => copy(p)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm text-zinc-700 hover:border-zinc-400"
            >
              <span>“{p}”</span>
              <span className="shrink-0 text-xs font-medium text-zinc-400">{copied === p ? "Copied" : "Copy"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-4 text-sm">
        <Link href="/" className="font-medium text-zinc-500 hover:text-zinc-900">
          Back to home
        </Link>
        <button onClick={onRestart} className="font-medium text-zinc-500 hover:text-zinc-900">
          Set up another team
        </button>
      </div>
    </div>
  );
}
