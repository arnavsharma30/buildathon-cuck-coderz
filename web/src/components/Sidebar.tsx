"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Factory, Palette, Megaphone, PackageCheck } from "lucide-react";
import { useWorkspace } from "@/lib/store";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Command center", icon: LayoutDashboard, step: "" },
  { href: "/products", label: "Product research", icon: Search, step: "1" },
  { href: "/suppliers", label: "Suppliers & quotes", icon: Factory, step: "2" },
  { href: "/creatives", label: "Ad creatives", icon: Palette, step: "3" },
  { href: "/ads", label: "Meta ads", icon: Megaphone, step: "4" },
  { href: "/orders", label: "Orders & RTO", icon: PackageCheck, step: "5" },
];

export function Sidebar() {
  const path = usePathname();
  const { ws, activeProduct, setActiveProduct } = useWorkspace();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-300">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">D</div>
          <div>
            <div className="text-sm font-semibold text-white">DropOS</div>
            <div className="text-[11px] text-zinc-500">MU Dropship Challenge</div>
          </div>
        </div>
      </div>

      <div className="px-3">
        <label className="mb-1 block px-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Active product</label>
        <select
          className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none"
          value={activeProduct?.id ?? ""}
          onChange={(e) => setActiveProduct(e.target.value)}
        >
          {ws.products.length === 0 && <option value="">No product yet</option>}
          {ws.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="mt-4 flex-1 space-y-0.5 px-3">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition",
                active ? "bg-zinc-800 text-white" : "hover:bg-zinc-900 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {n.step && <span className="text-[10px] text-zinc-600">{n.step}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 px-5 py-3 text-[11px] text-zinc-500">{ws.teamName}</div>
    </aside>
  );
}
