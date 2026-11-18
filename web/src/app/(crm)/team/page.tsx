"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Plus, UserPlus, Users } from "lucide-react";
import { useWorkspace } from "@/lib/store";
import { Badge, Button, Card, Empty, Field, PageHeader, cx, inputCls } from "@/components/ui";

interface MemberView {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  createdAt: number;
  lastActiveAt?: number;
  stats: Record<string, number>;
}
interface EventView {
  id: string;
  at: number;
  memberId: string;
  memberName: string;
  kind: string;
  text: string;
  href?: string;
}
interface TeamView {
  team: { id: string; name: string; storeName: string; college?: string; createdAt: number };
  members: MemberView[];
  activity: EventView[];
}

const ROLES = ["Founder", "Sourcing", "Ads", "Ops", "Creative", "Member"];
const STAT_LABELS: [string, string][] = [
  ["products", "Products"],
  ["suppliers", "Suppliers"],
  ["websites", "Website"],
  ["creatives", "Creatives"],
  ["adsets", "Ads"],
  ["orders", "Orders"],
];
const AVATAR = ["bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700"];

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const maskPhone = (p: string) => `${p.slice(0, 2)}xxxxx${p.slice(-3)}`;

function ago(ts: number | undefined, now: number) {
  if (!ts) return "not yet";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function TeamPage() {
  const { mode, me, ready } = useWorkspace();
  const [data, setData] = useState<TeamView | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [now, setNow] = useState(0);
  const [form, setForm] = useState({ name: "", phone: "", email: "", role: "Member", password: "" });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const load = useCallback(async () => {
    const res = await fetch("/api/team", { cache: "no-store" });
    if (res.ok) {
      setData((await res.json()) as TeamView);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    if (mode !== "team") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of team data
    void load();
    const t = setInterval(() => void load(), 5000); // teammates' activity shows up live
    return () => clearInterval(t);
  }, [mode, load]);

  const index = useMemo(() => new Map((data?.members ?? []).map((m, i) => [m.id, i])), [data]);
  const feed = (data?.activity ?? []).filter((e) => filter === "all" || e.memberId === filter);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(undefined);
    try {
      const res = await fetch("/api/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Could not add teammate");
      setMsg({ ok: true, text: `${form.name} can now log in with ${form.phone.replace(/\D/g, "").slice(-10)} / ${form.password}` });
      setForm({ name: "", phone: "", email: "", role: "Member", password: "" });
      setAdding(false);
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  if (mode !== "team") {
    return (
      <div>
        <PageHeader title="Team" subtitle="Give every teammate their own login, share one workspace, and see who did what." />
        <Empty>
          <Users className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
          <p className="mx-auto max-w-md">
            You&apos;re in demo mode, so data lives only in this browser. Create your team to get a separate login for each member, a shared live
            workspace, and an activity feed of everyone&apos;s work.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/onboarding" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
              Create your team
            </Link>
            <Link href="/login" className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
              Log in
            </Link>
          </div>
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        step={data?.team.college ? `${data.team.college}` : "Team"}
        title={data ? `${data.team.name}` : "Team"}
        subtitle={data ? `Store: ${data.team.storeName} · ${data.members.length} members · every change anyone makes is logged below.` : "Loading…"}
        actions={
          <Button onClick={() => setAdding((a) => !a)}>
            <UserPlus className="h-4 w-4" /> Add teammate
          </Button>
        }
      />

      {msg && <p className={cx("mb-4 rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>{msg.text}</p>}

      {adding && (
        <Card className="mb-5" title="Add a teammate">
          <form onSubmit={addMember} className="grid gap-3 md:grid-cols-5 md:items-end">
            <Field label="Name">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Mobile">
              <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" required />
            </Field>
            <Field label="Role">
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Temporary password">
              <input className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </Field>
            <Button type="submit" loading={busy}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data?.members ?? []).map((m, i) => (
          <button
            key={m.id}
            onClick={() => setFilter(filter === m.id ? "all" : m.id)}
            className={cx(
              "rounded-xl border bg-white p-4 text-left shadow-sm transition",
              filter === m.id ? "border-zinc-900 ring-2 ring-zinc-200" : "border-zinc-200 hover:border-zinc-400",
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cx("grid h-10 w-10 place-items-center rounded-full text-sm font-semibold", AVATAR[i % AVATAR.length])}>{initials(m.name)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-zinc-900">{m.name}</span>
                  {m.id === me?.id && <Badge tone="green">You</Badge>}
                </div>
                <div className="text-xs text-zinc-500">
                  {m.role} · {maskPhone(m.phone)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular-nums text-zinc-900">{m.stats.total ?? 0}</div>
                <div className="text-[11px] text-zinc-500">actions</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STAT_LABELS.filter(([k]) => m.stats[k]).map(([k, l]) => (
                <Badge key={k}>
                  {l} {m.stats[k]}
                </Badge>
              ))}
              {!STAT_LABELS.some(([k]) => m.stats[k]) && <span className="text-xs text-zinc-400">No work logged yet</span>}
            </div>
            <div className="mt-2 text-[11px] text-zinc-400">Last active {ago(m.lastActiveAt, now)}</div>
          </button>
        ))}
      </div>

      <Card
        className="mt-5"
        title={
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Team activity
            {filter !== "all" && <Badge tone="blue">{data?.members.find((m) => m.id === filter)?.name}</Badge>}
          </span>
        }
        right={
          filter !== "all" && (
            <button onClick={() => setFilter("all")} className="text-xs font-medium text-zinc-600 hover:text-zinc-900">
              Show everyone
            </button>
          )
        }
      >
        {feed.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet. Work done anywhere in DropOS shows up here.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-zinc-200 pl-5">
            {feed.map((e) => (
              <li key={e.id} className="relative">
                <span className={cx("absolute -left-[27px] grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold", AVATAR[(index.get(e.memberId) ?? 0) % AVATAR.length])}>
                  {initials(e.memberName)}
                </span>
                <div className="text-sm text-zinc-800">
                  <b className="font-medium text-zinc-900">{e.memberName}</b> {e.text}
                  {e.href && (
                    <Link href={e.href} className="ml-2 text-xs text-zinc-400 hover:text-zinc-900">
                      open →
                    </Link>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400">{ago(e.at, now)}</div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
