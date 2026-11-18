"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";

export interface SupplierRow {
  id: string;
  name: string;
  city?: string;
  stage: string;
  productName: string;
  url?: string;
  phone?: string; // 10 digits, already normalised
  message?: string; // drafted outreach
  landed?: number;
}

const STAGE: Record<string, string> = {
  found: "bg-zinc-100 text-zinc-700",
  contacted: "bg-sky-50 text-sky-700",
  quoted: "bg-amber-50 text-amber-800",
  sampling: "bg-violet-50 text-violet-700",
  finalized: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

export function SupplierOutreach({ rows }: { rows: SupplierRow[] }) {
  const [copied, setCopied] = useState<string>();
  async function copy(r: SupplierRow) {
    if (!r.message) return;
    await navigator.clipboard.writeText(r.message);
    setCopied(r.id);
    setTimeout(() => setCopied(undefined), 1500);
  }
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
        No suppliers yet. Ask Claude: &quot;find IndiaMART suppliers for our product and draft WhatsApp messages&quot;.
      </div>
    );
  }
  const drafted = rows.filter((r) => r.message).length;
  return (
    <div>
      <p className="mb-3 text-xs text-zinc-500">
        {rows.length} suppliers · {drafted} WhatsApp drafts ready. Tap <b>Send on WhatsApp</b> to open the chat with the message filled in, or copy it into
        IndiaMART&apos;s &quot;Contact supplier&quot;.
      </p>
      <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
        {rows.map((r) => {
          const wa = r.message ? `https://wa.me/${r.phone ? `91${r.phone}` : ""}?text=${encodeURIComponent(r.message)}` : undefined;
          return (
            <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">{r.name}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${STAGE[r.stage] ?? STAGE.found}`}>{r.stage}</span>
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {r.productName}
                  {r.city ? ` · ${r.city}` : ""}
                  {r.landed ? ` · ₹${Math.round(r.landed)} landed` : ""}
                  {r.phone ? ` · +91 ${r.phone}` : ""}
                </div>
                {r.message && <p className="mt-2 line-clamp-2 text-xs text-zinc-600">{r.message}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Send on WhatsApp
                  </a>
                )}
                {r.message && (
                  <button
                    onClick={() => copy(r)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    {copied === r.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied === r.id ? "Copied" : "Copy message"}
                  </button>
                )}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Listing
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
