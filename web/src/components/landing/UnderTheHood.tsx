type Tool = { name: string; title: string; description: string };

const GROUPS: { label: string; test: (n: string) => boolean }[] = [
  { label: "Team", test: (n) => /team|overview/.test(n) },
  { label: "Products & economics", test: (n) => /product|economics/.test(n) },
  { label: "Suppliers", test: (n) => /supplier|quote/.test(n) },
  { label: "Store", test: (n) => /store_page/.test(n) },
  { label: "Meta ads & creatives", test: (n) => /meta|creative|ad_|_ad|adset|campaign_plan/.test(n) },
  { label: "Outbound", test: (n) => /lead|outbound|broadcast|contact|audience|opt|campaign/.test(n) },
  { label: "Orders & RTO", test: (n) => /order|rto|customer_message/.test(n) },
  { label: "Shipping & integrations", test: (n) => /ship|track|notify|integration/.test(n) },
];

export function UnderTheHood({ tools }: { tools: Tool[] }) {
  const grouped = new Map<string, Tool[]>();
  for (const t of tools) {
    const g = GROUPS.find((x) => x.test(t.name))?.label ?? "More";
    grouped.set(g, [...(grouped.get(g) ?? []), t]);
  }
  const order = [...GROUPS.map((g) => g.label), "More"].filter((g) => grouped.has(g));

  return (
    <details className="group rounded-2xl border border-zinc-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Under the hood</div>
          <div className="mt-1 text-lg font-semibold text-zinc-900">{tools.length} tools your Claude gets</div>
          <div className="text-sm text-zinc-500">You never have to call these yourself: Claude picks the right one from what you say.</div>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 group-open:hidden">Show</span>
        <span className="hidden shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 group-open:inline">Hide</span>
      </summary>
      <div className="grid gap-6 border-t border-zinc-100 px-6 py-6 md:grid-cols-2">
        {order.map((g) => (
          <div key={g}>
            <div className="mb-2 text-sm font-semibold text-zinc-900">{g}</div>
            <ul className="space-y-2">
              {grouped.get(g)!.map((t) => (
                <li key={t.name} className="text-xs">
                  <span className="font-mono font-semibold text-emerald-700">{t.name}</span>
                  <span className="text-zinc-500"> · {t.title}</span>
                  <div className="line-clamp-2 text-zinc-500">{t.description}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
