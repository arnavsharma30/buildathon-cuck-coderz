import { promises as fs } from "fs";
import path from "path";
import type { Order, Product, Website } from "./types";

// File-based storage for published stores. DropOS is self-hosted, so the local disk is the database.
const ROOT = path.join(process.cwd(), "data");
const SITES = path.join(ROOT, "sites");
const ORDERS = path.join(ROOT, "site-orders");

export const SLUG_RE = /^[a-z0-9-]{3,40}$/;

export interface StoredSite {
  website: Website;
  product: Product;
}

function safe(slug: string) {
  if (!SLUG_RE.test(slug)) throw new Error("invalid slug");
  return slug;
}

export async function saveSite(site: StoredSite) {
  await fs.mkdir(SITES, { recursive: true });
  await fs.writeFile(path.join(SITES, `${safe(site.website.slug)}.json`), JSON.stringify(site, null, 2));
}

export async function getSite(slug: string): Promise<StoredSite | null> {
  if (!SLUG_RE.test(slug)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(SITES, `${slug}.json`), "utf8")) as StoredSite;
  } catch {
    return null;
  }
}

export async function listSites(): Promise<{ slug: string; brandName: string; updatedAt: number }[]> {
  try {
    const files = (await fs.readdir(SITES)).filter((f) => f.endsWith(".json"));
    const out = [];
    for (const f of files) {
      const s = await getSite(f.replace(/\.json$/, ""));
      if (s) out.push({ slug: s.website.slug, brandName: s.website.content.brandName, updatedAt: s.website.updatedAt });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function getSiteOrders(slug: string): Promise<Order[]> {
  if (!SLUG_RE.test(slug)) return [];
  try {
    return JSON.parse(await fs.readFile(path.join(ORDERS, `${slug}.json`), "utf8")) as Order[];
  } catch {
    return [];
  }
}

// Serialise writes per slug so two simultaneous orders can't overwrite each other.
const locks = new Map<string, Promise<unknown>>();

export async function appendSiteOrder(slug: string, build: (existing: Order[]) => Order): Promise<Order> {
  safe(slug);
  const prev = locks.get(slug) ?? Promise.resolve();
  const next = prev.then(async () => {
    const existing = await getSiteOrders(slug);
    const order = build(existing);
    await fs.mkdir(ORDERS, { recursive: true });
    await fs.writeFile(path.join(ORDERS, `${slug}.json`), JSON.stringify([...existing, order], null, 2));
    return order;
  });
  locks.set(slug, next.catch(() => undefined));
  return next;
}
