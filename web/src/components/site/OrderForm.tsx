"use client";

import { useState } from "react";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";

export function normalizeMobile(raw: string) {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export function OrderForm({ slug, price, variants, buttonClass }: { slug: string; price: number; variants?: string[]; buttonClass?: string }) {
  const [f, setF] = useState({ name: "", phone: "", address: "", city: "", state: "", pincode: "", quantity: 1, variant: variants?.[0] ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; amount: number } | null>(null);
  const [failure, setFailure] = useState("");

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: k === "quantity" ? Number(e.target.value) : e.target.value });

  function validate() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 3) e.name = "Please enter your full name";
    if (!/^[6-9]\d{9}$/.test(normalizeMobile(f.phone))) e.phone = "Enter a valid 10-digit mobile number";
    if (f.address.trim().length < 10) e.address = "Add house no., street and a landmark";
    if (f.city.trim().length < 2) e.city = "Enter your city";
    if (f.state.trim().length < 2) e.state = "Enter your state";
    if (!/^[1-9]\d{5}$/.test(f.pincode.trim())) e.pincode = "Enter a valid 6-digit pincode";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFailure("");
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sites/${slug}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, phone: normalizeMobile(f.phone), pincode: f.pincode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setDone({ id: data.order.id, amount: data.order.amount });
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="py-6 text-center">
        <div className="text-5xl">🎉</div>
        <div className="mt-3 text-xl font-bold">Order placed! We&apos;ll confirm on WhatsApp</div>
        <p className="mt-2 text-sm opacity-70">
          Order {done.id} · {inr(done.amount)} payable on delivery
        </p>
      </div>
    );
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>;

  return (
    <form onSubmit={submit} className="space-y-3 text-left" noValidate>
      <div>
        <input className={field} placeholder="Full name" value={f.name} onChange={set("name")} autoComplete="name" />
        {err("name")}
      </div>
      <div>
        <input className={field} placeholder="10-digit mobile number" inputMode="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" />
        {err("phone")}
      </div>
      <div>
        <textarea className={field} rows={2} placeholder="House / flat no., street, area, landmark" value={f.address} onChange={set("address")} autoComplete="street-address" />
        {err("address")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input className={field} placeholder="City" value={f.city} onChange={set("city")} autoComplete="address-level2" />
          {err("city")}
        </div>
        <div>
          <input className={field} placeholder="State" value={f.state} onChange={set("state")} autoComplete="address-level1" />
          {err("state")}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input className={field} placeholder="Pincode" inputMode="numeric" maxLength={6} value={f.pincode} onChange={set("pincode")} autoComplete="postal-code" />
          {err("pincode")}
        </div>
        <select className={field} value={f.quantity} onChange={set("quantity")} aria-label="Quantity">
          {[1, 2, 3, 4, 5].map((q) => (
            <option key={q} value={q}>
              Qty {q}
            </option>
          ))}
        </select>
      </div>
      {variants && variants.length > 0 && (
        <select className={field} value={f.variant} onChange={set("variant")} aria-label="Option">
          {variants.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
        <span>💵 Payment: Cash on Delivery</span>
        <span className="font-bold">{inr(price * f.quantity)}</span>
      </div>
      {failure && <p className="text-sm text-red-600">{failure}</p>}
      <button
        type="submit"
        disabled={busy}
        className={(buttonClass ?? "bg-zinc-900 text-white hover:bg-zinc-700") + " w-full rounded-xl px-6 py-3.5 text-base font-bold transition disabled:opacity-60"}
      >
        {busy ? "Placing order…" : `Place COD order · ${inr(price * f.quantity)}`}
      </button>
      <p className="text-center text-xs opacity-60">We&apos;ll confirm your order on WhatsApp before dispatch.</p>
    </form>
  );
}
