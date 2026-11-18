import { TeamSetupForm } from "@/components/TeamSetupForm";
import { listTools } from "@/mcp/registry";

export const dynamic = "force-dynamic";

const PROMPTS = [
  "Here are our 6 product ideas with prices and landed costs. Which ones actually make money after COD RTO?",
  "This IndiaMART supplier replied: \"rate 180 + 18% gst, moq 20, dispatch 2 din, cod nahi\". Log it and compare with the others.",
  "Write our store page for the posture belt in Hinglish and publish it.",
  "Here are yesterday's Meta numbers for our 3 ad sets. What do I kill and what do I scale?",
  "Import today's Shopify orders and tell me which COD orders not to ship yet.",
  "Ship the confirmed orders with Delhivery and send customers their tracking links.",
  "What did Aarush do today?",
];

export default function Home() {
  const tools = listTools();
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-lg font-bold text-zinc-950">D</div>
        <div>
          <div className="text-lg font-semibold text-zinc-900">DropOS</div>
          <div className="text-xs text-zinc-500">MCP server for the Masters&apos; Union Dropship Challenge</div>
        </div>
      </header>

      <section className="mt-10 grid gap-10 lg:grid-cols-[1fr_440px]">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">Run your dropship business by talking to Claude.</h1>
          <p className="mt-4 text-base text-zinc-600">
            Add DropOS to your own Claude account as a connector. Tell Claude your 5-10 product ideas and it does the rest through DropOS: RTO-adjusted
            unit economics, supplier quotes from messy Hinglish replies, a live store page with COD checkout, Meta ad kill/scale calls, RTO checks on
            every COD order, and courier tracking with WhatsApp + email updates to your customers.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            Everything is stored on the DropOS server and shared by your team. Each teammate has a personal URL, so everyone can see who did what.
          </p>

          <ol className="mt-8 space-y-4 text-sm text-zinc-700">
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white">1</span>
              <span>Create your team (right) and send each teammate their connector URL.</span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white">2</span>
              <span>
                In Claude: <b>Settings → Connectors → Add custom connector</b>. Name it &quot;DropOS&quot; and paste your URL.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white">3</span>
              <span>Start a chat with DropOS enabled and talk about your store, for example:</span>
            </li>
          </ol>
          <ul className="mt-3 space-y-2 pl-9">
            {PROMPTS.map((p) => (
              <li key={p} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                “{p}”
              </li>
            ))}
          </ul>
        </div>

        <div>
          <TeamSetupForm />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{tools.length} tools Claude gets</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <div key={t.name} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="font-mono text-xs font-semibold text-emerald-700">{t.name}</div>
              <div className="mt-1 text-sm font-medium text-zinc-900">{t.title}</div>
              <div className="mt-1 line-clamp-3 text-xs text-zinc-500">{t.description}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-14 text-xs text-zinc-400">Built at the Masters&apos; Union Buildathon · Team Cuck Coderz</footer>
    </main>
  );
}
