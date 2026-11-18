"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Product, Workspace } from "./types";
import { DEFAULT_ECONOMICS } from "./economics";
import { stripLocal, threeWayMerge, type SharedWorkspace } from "./merge";

const KEY = "dropos:workspace:v1";
const activeKey = (memberId: string) => `dropos:active:${memberId}`;

export const EMPTY_WORKSPACE: Workspace = {
  teamName: "Team Dropship",
  products: [],
  suppliers: [],
  creatives: [],
  adsets: [],
  orders: [],
  websites: [],
  economics: DEFAULT_ECONOMICS,
};

export type Mode = "loading" | "demo" | "team";
export type SyncState = "saved" | "saving" | "offline";
export interface Me {
  id: string;
  name: string;
  role: string;
  phone?: string;
}
export interface TeamInfo {
  id: string;
  name: string;
  storeName: string;
}

interface Ctx {
  ws: Workspace;
  ready: boolean;
  /** Immutable update: return a new workspace (spread what you change). */
  update: (fn: (w: Workspace) => Workspace) => void;
  activeProduct?: Product;
  setActiveProduct: (id: string) => void;
  reset: () => void;
  mode: Mode;
  me: Me | null;
  team: TeamInfo | null;
  syncState: SyncState;
  logout: () => Promise<void>;
}

const WorkspaceContext = createContext<Ctx | null>(null);

const SAVE_DEBOUNCE_MS = 700;
const POLL_MS = 5000;
/** Canonical key order, so "did anything change?" is a plain string compare on both sides. */
const norm = (w: SharedWorkspace): SharedWorkspace => stripLocal({ ...EMPTY_WORKSPACE, ...w });
const key = (w: Workspace | SharedWorkspace) => JSON.stringify(norm(stripLocal(w)));

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ws, setWs] = useState<Workspace>(EMPTY_WORKSPACE);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("saved");

  // Team-mode sync bookkeeping.
  const wsRef = useRef(ws);
  const serverBase = useRef<SharedWorkspace | null>(null);
  const version = useRef(0);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  const withActive = useCallback((w: SharedWorkspace, memberId: string): Workspace => {
    let activeProductId: string | undefined;
    try {
      activeProductId = localStorage.getItem(activeKey(memberId)) ?? undefined;
    } catch {}
    return { ...EMPTY_WORKSPACE, ...w, activeProductId };
  }, []);

  // ---- boot: team session or demo mode ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        const { member, team } = meRes.ok ? ((await meRes.json()) as { member: Me | null; team: TeamInfo | null }) : { member: null, team: null };
        if (member && team) {
          const wRes = await fetch("/api/workspace", { cache: "no-store" });
          if (wRes.ok && !cancelled) {
            const { workspace: raw, version: v } = (await wRes.json()) as { workspace: SharedWorkspace; version: number };
            const workspace = norm(raw);
            serverBase.current = workspace;
            version.current = v;
            setMe(member);
            setTeam(team);
            setWs(withActive(workspace, member.id));
            setMode("team");
            setReady(true);
            return;
          }
        }
      } catch {}
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) setWs({ ...EMPTY_WORKSPACE, ...JSON.parse(raw) });
      } catch {}
      setMode("demo");
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [withActive]);

  // ---- demo mode: persist to this browser ----
  useEffect(() => {
    if (ready && mode === "demo") localStorage.setItem(KEY, JSON.stringify(ws));
  }, [ws, ready, mode]);

  // ---- team mode: push local edits ----
  const save = useCallback(async () => {
    if (saving.current || !serverBase.current || !me) return;
    const sent = norm(stripLocal(wsRef.current));
    if (JSON.stringify(sent) === JSON.stringify(serverBase.current)) {
      setSyncState("saved");
      return;
    }
    saving.current = true;
    setSyncState("saving");
    try {
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ base: serverBase.current, next: sent, baseVersion: version.current }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { workspace: raw, version: v } = (await res.json()) as { workspace: SharedWorkspace; version: number };
      const workspace = norm(raw);
      serverBase.current = workspace;
      version.current = v;
      const now = wsRef.current;
      // Re-apply anything typed while the request was in flight on top of the merged server copy.
      const rebased = key(now) === JSON.stringify(sent) ? workspace : norm(threeWayMerge(workspace, sent, norm(stripLocal(now))));
      setWs({ ...EMPTY_WORKSPACE, ...rebased, activeProductId: now.activeProductId });
      setSyncState(key(rebased) === JSON.stringify(workspace) ? "saved" : "saving");
    } catch {
      setSyncState("offline");
    } finally {
      saving.current = false;
    }
  }, [me]);

  useEffect(() => {
    if (!ready || mode !== "team" || !serverBase.current) return;
    if (key(ws) === JSON.stringify(serverBase.current)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), SAVE_DEBOUNCE_MS);
  }, [ws, ready, mode, save]);

  // ---- team mode: pull teammates' changes ----
  useEffect(() => {
    if (mode !== "team" || !me) return;
    const t = setInterval(async () => {
      if (saving.current || !serverBase.current) return;
      if (key(wsRef.current) !== JSON.stringify(serverBase.current)) return; // local edits pending; save() will merge
      try {
        const res = await fetch("/api/workspace", { cache: "no-store" });
        if (res.status === 401) return setSyncState("offline");
        if (!res.ok) return;
        const { workspace: raw, version: v } = (await res.json()) as { workspace: SharedWorkspace; version: number };
        if (v === version.current) return setSyncState("saved");
        const workspace = norm(raw);
        if (saving.current || key(wsRef.current) !== JSON.stringify(serverBase.current)) return;
        serverBase.current = workspace;
        version.current = v;
        setWs((w) => ({ ...EMPTY_WORKSPACE, ...workspace, activeProductId: w.activeProductId }));
        setSyncState("saved");
      } catch {
        setSyncState("offline");
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [mode, me]);

  const update = useCallback((fn: (w: Workspace) => Workspace) => setWs((w) => fn(w)), []);

  const setActiveProduct = useCallback(
    (id: string) => {
      if (me) {
        try {
          localStorage.setItem(activeKey(me.id), id);
        } catch {}
      }
      setWs((w) => ({ ...w, activeProductId: id }));
    },
    [me],
  );

  const reset = useCallback(() => {
    if (mode === "team") {
      // Never wipe the team's shared data from one browser: discard unsynced local edits instead.
      if (serverBase.current && me) setWs(withActive(serverBase.current, me.id));
      return;
    }
    setWs(EMPTY_WORKSPACE);
  }, [mode, me, withActive]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    // Full reload on purpose: drops every bit of in-memory team state from this tab.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }, []);

  const activeProduct = useMemo(
    () => ws.products.find((p) => p.id === ws.activeProductId) ?? ws.products[0],
    [ws.products, ws.activeProductId],
  );

  return (
    <WorkspaceContext.Provider value={{ ws, ready, update, activeProduct, setActiveProduct, reset, mode, me, team, syncState, logout }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

/** POST JSON to one of our API routes. */
export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const newId = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
