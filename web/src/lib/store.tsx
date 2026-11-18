"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Product, Workspace } from "./types";
import { DEFAULT_ECONOMICS } from "./economics";

const KEY = "dropos:workspace:v1";

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

interface Ctx {
  ws: Workspace;
  ready: boolean;
  /** Immutable update: return a new workspace (spread what you change). */
  update: (fn: (w: Workspace) => Workspace) => void;
  activeProduct?: Product;
  setActiveProduct: (id: string) => void;
  reset: () => void;
}

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ws, setWs] = useState<Workspace>(EMPTY_WORKSPACE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage once on mount
      if (raw) setWs({ ...EMPTY_WORKSPACE, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(ws));
  }, [ws, ready]);

  const update = useCallback((fn: (w: Workspace) => Workspace) => setWs((w) => fn(w)), []);
  const setActiveProduct = useCallback((id: string) => setWs((w) => ({ ...w, activeProductId: id })), []);
  const reset = useCallback(() => setWs(EMPTY_WORKSPACE), []);

  const activeProduct = useMemo(
    () => ws.products.find((p) => p.id === ws.activeProductId) ?? ws.products[0],
    [ws.products, ws.activeProductId],
  );

  return (
    <WorkspaceContext.Provider value={{ ws, ready, update, activeProduct, setActiveProduct, reset }}>
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
