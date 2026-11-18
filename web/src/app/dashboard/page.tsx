"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3 } from "lucide-react";

const TOKEN = /([a-f0-9]{32})/i;

export default function DashboardLogin() {
  const router = useRouter();
  const [remembered, setRemembered] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this browser
    setRemembered(localStorage.getItem("dropos:key"));
  }, []);

  function open(e: React.FormEvent) {
    e.preventDefault();
    const m = value.trim().match(TOKEN);
    if (!m) return setError("Paste the DropOS link you added to Claude. It looks like https://hack.icedoutai.com/mcp/…");
    router.push(`/d/${m[1].toLowerCase()}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-10 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">D</div>
        <span className="font-semibold text-zinc-900">DropOS</span>
      </Link>
      <div className="flex items-center gap-2 text-emerald-600">
        <BarChart3 className="h-5 w-5" />
        <span className="text-xs font-semibold uppercase tracking-wider">Analytics dashboard</span>
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Open your team&apos;s dashboard</h1>
      <p className="mt-2 text-sm text-zinc-500">Charts for orders, RTO risk, product profit, Meta ads, shipments and who did what.</p>

      {remembered && (
        <Link
          href={`/d/${remembered}`}
          className="mt-8 flex items-center justify-between rounded-xl bg-zinc-900 px-5 py-4 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Open my dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <form onSubmit={open} className="mt-8 space-y-3">
        <label className="block text-xs font-medium text-zinc-600">{remembered ? "Or paste another DropOS link" : "Paste your DropOS link"}</label>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          placeholder="https://hack.icedoutai.com/mcp/…"
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
          Open dashboard
        </button>
      </form>
      <p className="mt-6 text-xs text-zinc-400">
        Find your link in Claude → Settings → Connectors → DropOS. Or just ask Claude: &quot;give me my DropOS dashboard link&quot;.
      </p>
    </main>
  );
}
