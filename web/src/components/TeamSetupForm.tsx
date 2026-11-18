"use client";

import { useState } from "react";

const ROLES = ["Founder", "Sourcing", "Ads", "Ops", "Creative", "Member"] as const;
type Row = { name: string; phone: string; role: (typeof ROLES)[number] };
type Result = { team: { name: string; storeName: string }; members: { name: string; role: string; mcpUrl: string }[] };

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";

export function TeamSetupForm() {
  const [teamName, setTeamName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { name: "", phone: "", role: "Founder" },
    { name: "", phone: "", role: "Member" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Result>();
  const [copied, setCopied] = useState<string>();

  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const members = rows.filter((r) => r.name.trim() || r.phone.trim());
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamName, storeName, members }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong");
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(undefined), 1500);
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
        <div className="text-sm font-semibold text-emerald-800">✓ {result.team.name} is set up</div>
        <p className="mt-1 text-sm text-emerald-900/80">
          Send each teammate <b>their own</b> link. It identifies them, so keep it private. Their actions show up in the team activity log.
        </p>
        <div className="mt-4 space-y-3">
          {result.members.map((m) => (
            <div key={m.mcpUrl} className="rounded-xl border border-emerald-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-zinc-900">
                  {m.name} <span className="text-xs font-normal text-zinc-500">· {m.role}</span>
                </div>
                <button onClick={() => copy(m.mcpUrl)} className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700">
                  {copied === m.mcpUrl ? "Copied" : "Copy URL"}
                </button>
              </div>
              <code className="mt-2 block break-all rounded-md bg-zinc-50 px-2 py-1.5 font-mono text-xs text-zinc-700">{m.mcpUrl}</code>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Team name</span>
          <input className={input} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Cuck Coderz" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Store / brand name</span>
          <input className={input} value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Seedha Posture" required />
        </label>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-zinc-600">Team members (each gets their own Claude connector URL)</span>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_120px_auto] gap-2">
              <input className={input} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Name" />
              <input className={input} value={r.phone} onChange={(e) => setRow(i, { phone: e.target.value })} placeholder="10-digit mobile" inputMode="tel" />
              <select className={input} value={r.role} onChange={(e) => setRow(i, { role: e.target.value as Row["role"] })}>
                {ROLES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setRows((rr) => rr.filter((_, j) => j !== i))}
                disabled={rows.length === 1}
                className="px-2 text-zinc-400 hover:text-red-600 disabled:opacity-30"
                aria-label="Remove member"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { name: "", phone: "", role: "Member" }])}
          className="mt-2 text-xs font-medium text-zinc-700 hover:underline"
        >
          + Add teammate
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create team & get connector URLs"}
      </button>
    </form>
  );
}
