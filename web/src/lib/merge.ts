import type { Workspace } from "./types";

/**
 * Team workspace sync.
 *
 * Every teammate edits a local copy. When a client saves, it sends the workspace it last got from the
 * server (`base`) and its edited copy (`next`). The server works out what *this client* changed
 * (base → next) and applies only those changes onto whatever is current on the server, so two people
 * editing different records at the same time never overwrite each other. The same diff becomes the
 * activity feed ("Aarush moved supplier Shree Balaji to quoted").
 */

export const COLLECTIONS = ["products", "suppliers", "creatives", "adsets", "orders", "websites"] as const;
export type CollectionKey = (typeof COLLECTIONS)[number];

export type SharedWorkspace = Omit<Workspace, "activeProductId">;

export interface ActivityEvent {
  id: string;
  at: number;
  memberId: string;
  memberName: string;
  kind: CollectionKey | "team" | "economics";
  text: string;
  href?: string;
}

type WithId = { id: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function stripLocal(w: Workspace | SharedWorkspace): SharedWorkspace {
  const { activeProductId: _drop, ...rest } = w as Workspace;
  void _drop;
  return rest;
}

interface CollectionDiff<T extends WithId> {
  added: T[];
  removed: T[];
  modified: { before: T; after: T }[];
}

function diffCollection<T extends WithId>(base: T[] = [], next: T[] = []): CollectionDiff<T> {
  const b = new Map(base.map((x) => [x.id, x]));
  const n = new Map(next.map((x) => [x.id, x]));
  const added: T[] = [];
  const removed: T[] = [];
  const modified: { before: T; after: T }[] = [];
  for (const [id, item] of n) {
    const prev = b.get(id);
    if (!prev) added.push(item);
    else if (!same(prev, item)) modified.push({ before: prev, after: item });
  }
  for (const [id, item] of b) if (!n.has(id)) removed.push(item);
  return { added, removed, modified };
}

function applyDiff<T extends WithId>(current: T[] = [], d: CollectionDiff<T>, nextOrder: T[]): T[] {
  const removedIds = new Set(d.removed.map((x) => x.id));
  const modifiedById = new Map(d.modified.map((m) => [m.after.id, m.after]));
  let out = current.filter((x) => !removedIds.has(x.id)).map((x) => modifiedById.get(x.id) ?? x);
  // A record this client modified that someone else had deleted comes back (edits win over deletes).
  for (const m of d.modified) if (!out.some((x) => x.id === m.after.id)) out.push(m.after);
  const existing = new Set(out.map((x) => x.id));
  const fresh = d.added.filter((x) => !existing.has(x.id));
  if (fresh.length) {
    // Keep the client's placement: items it put at the front (most pages prepend new records) stay at the front.
    const nextIndex = new Map(nextOrder.map((x, i) => [x.id, i]));
    const front = fresh.filter((x) => (nextIndex.get(x.id) ?? 0) < nextOrder.length / 2);
    const back = fresh.filter((x) => !front.includes(x));
    out = [...front, ...out, ...back];
  }
  return out;
}

export function threeWayMerge(current: SharedWorkspace, base: SharedWorkspace, next: SharedWorkspace): SharedWorkspace {
  const merged: SharedWorkspace = { ...current };
  for (const key of COLLECTIONS) {
    const d = diffCollection<WithId>(base[key] as WithId[], next[key] as WithId[]);
    if (d.added.length || d.removed.length || d.modified.length) {
      (merged as unknown as Record<string, WithId[]>)[key] = applyDiff(current[key] as WithId[], d, next[key] as WithId[]);
    }
  }
  if (base.teamName !== next.teamName) merged.teamName = next.teamName;
  if (!same(base.economics, next.economics)) merged.economics = { ...current.economics, ...changedFields(base.economics, next.economics) };
  return merged;
}

function changedFields<T extends object>(base: T, next: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(next) as (keyof T)[]) if (!same(base?.[k], next[k])) out[k] = next[k];
  return out;
}

// ---- Activity feed ----

const HREF: Record<CollectionKey, string> = {
  products: "/products",
  suppliers: "/suppliers",
  creatives: "/creatives",
  adsets: "/ads",
  orders: "/orders",
  websites: "/website",
};

const NOUN: Record<CollectionKey, [string, string]> = {
  products: ["product", "products"],
  suppliers: ["supplier", "suppliers"],
  creatives: ["creative", "creatives"],
  adsets: ["ad set", "ad sets"],
  orders: ["order", "orders"],
  websites: ["website", "websites"],
};

type AnyRec = Record<string, unknown> & WithId;

function label(key: CollectionKey, x: AnyRec): string {
  switch (key) {
    case "products":
    case "suppliers":
    case "adsets":
      return String(x.name ?? x.id);
    case "creatives":
      return `'${String(x.angle ?? x.headline ?? x.id)}'`;
    case "orders":
      return String(x.id);
    case "websites":
      return `/s/${String(x.slug ?? x.id)}`;
  }
}

function describeChange(key: CollectionKey, before: AnyRec, after: AnyRec): string | null {
  const name = label(key, after);
  switch (key) {
    case "suppliers":
      if (before.stage !== after.stage) return `moved supplier ${name} to ${String(after.stage)}`;
      if (!before.quote && after.quote) return `logged a quote from ${name}`;
      if (!before.outreach && after.outreach) return `drafted outreach to ${name}`;
      return `updated supplier ${name}`;
    case "orders":
      if (before.status !== after.status) return `set order ${name} to ${String(after.status)}`;
      return `updated order ${name}`;
    case "products":
      if (before.status !== after.status) return `moved product ${name} to ${String(after.status)}`;
      if (before.sellingPrice !== after.sellingPrice) return `repriced ${name} to ₹${String(after.sellingPrice)}`;
      return `edited product ${name}`;
    case "websites":
      if (!before.publishedAt && after.publishedAt) return `published website ${name}`;
      if (before.publishedAt !== after.publishedAt) return `republished website ${name}`;
      return null; // draft autosaves are noise
    case "adsets": {
      if (before.dailyBudget !== after.dailyBudget) return `changed budget of ${name} to ₹${String(after.dailyBudget)}/day`;
      return `updated results for ad set ${name}`;
    }
    case "creatives":
      return `edited creative ${name}`;
  }
}

let seq = 0;
const eid = () => `ev_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function diffToEvents(base: SharedWorkspace, next: SharedWorkspace, who: { memberId: string; memberName: string }): ActivityEvent[] {
  const at = Date.now();
  const events: ActivityEvent[] = [];
  const push = (kind: ActivityEvent["kind"], text: string, href?: string) =>
    events.push({ id: eid(), at, memberId: who.memberId, memberName: who.memberName, kind, text, href });

  for (const key of COLLECTIONS) {
    const d = diffCollection(base[key] as unknown as AnyRec[], next[key] as unknown as AnyRec[]);
    const [one, many] = NOUN[key];
    const href = HREF[key];

    if (d.added.length > 3) push(key, key === "orders" ? `imported ${d.added.length} orders` : `added ${d.added.length} ${many}`, href);
    else
      for (const x of d.added) {
        if (key === "websites") push(key, x.publishedAt ? `published website ${label(key, x)}` : `started a website draft`, href);
        else if (key === "creatives") push(key, `saved creative ${label(key, x)}`, href);
        else if (key === "orders") push(key, `added order ${label(key, x)}`, href);
        else push(key, `added ${one} ${label(key, x)}`, href);
      }

    if (d.removed.length > 3) push(key, `removed ${d.removed.length} ${many}`, href);
    else for (const x of d.removed) push(key, `removed ${one} ${label(key, x)}`, href);

    const changes = d.modified.map((m) => describeChange(key, m.before, m.after)).filter((t): t is string => Boolean(t));
    if (changes.length > 3) {
      // Group bulk edits by verb, e.g. "set 5 orders to confirmed".
      const statusGroups = new Map<string, number>();
      for (const m of d.modified) {
        const s = key === "orders" ? m.after.status : key === "suppliers" ? m.after.stage : undefined;
        if (s) statusGroups.set(String(s), (statusGroups.get(String(s)) ?? 0) + 1);
      }
      if (statusGroups.size && key === "orders") for (const [s, n] of statusGroups) push(key, `set ${n} orders to ${s}`, href);
      else push(key, `updated ${changes.length} ${many}`, href);
    } else for (const t of changes) push(key, t, href);
  }

  if (base.teamName !== next.teamName) push("team", `renamed the store to ${next.teamName}`, "/");
  if (!same(base.economics, next.economics)) push("economics", "updated unit economics assumptions", "/products");
  return events;
}
