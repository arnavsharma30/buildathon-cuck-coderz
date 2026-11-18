"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-200";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Login failed");
      // Full navigation so the workspace provider boots in team mode.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-800 px-4 py-16">
      <div className="mx-auto mb-6 flex max-w-sm items-center gap-2 text-white">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">D</div>
        <div>
          <div className="text-sm font-semibold">DropOS</div>
          <div className="text-[11px] text-zinc-400">MU Dropship Challenge</div>
        </div>
      </div>
      <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-2xl bg-white p-7 shadow-2xl">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Log in to your team</h1>
          <p className="mt-1 text-sm text-zinc-500">Use the phone number your team registered you with.</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Mobile number</span>
          <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="10-digit mobile" autoFocus autoComplete="tel" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Password</span>
          <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Log in
        </button>
        <div className="flex justify-between text-xs text-zinc-500">
          <Link href="/onboarding" className="hover:text-zinc-900">
            New team? Get started
          </Link>
          <Link href="/" className="hover:text-zinc-900">
            Try the demo
          </Link>
        </div>
      </form>
    </div>
  );
}
