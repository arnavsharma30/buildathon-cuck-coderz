import Link from "next/link";
import { ArrowRight, BarChart3, Factory, Megaphone, PackageCheck, Search, Send, ShieldAlert, Store, Truck, Users } from "lucide-react";
import { listTools } from "@/mcp/registry";
import { ChatMock } from "@/components/landing/ChatMock";
import { UnderTheHood } from "@/components/landing/UnderTheHood";
import { MarginBarChart, RtoAreaChart, ShipmentsDonut } from "@/components/landing/Charts";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Search,
    title: "Find products that survive COD",
    text: "Real profit per order after COD returns and ad cost.",
  },
  {
    icon: Factory,
    title: "Source suppliers on IndiaMART",
    text: "Message suppliers, paste their Hinglish replies, compare quotes.",
  },
  {
    icon: Store,
    title: "Launch your store",
    text: "A live store page with COD checkout. No fake reviews.",
  },
  {
    icon: Megaphone,
    title: "Meta ads on autopilot",
    text: "Campaigns created via the Meta Marketing API, with kill/scale calls.",
  },
  {
    icon: Send,
    title: "Outbound to customers & leads",
    text: "WhatsApp and email campaigns to opted-in contacts.",
  },
  {
    icon: ShieldAlert,
    title: "Stop RTO before it ships",
    text: "Every COD order risk-scored, with the fix, before dispatch.",
  },
];

const INTEGRATIONS = ["Meta Marketing API", "WhatsApp Business (Cloud API)", "Shiprocket", "Delhivery", "Resend email", "IndiaMART"];

const TIMELINE = [
  { label: "Shipped", note: "WhatsApp + email with tracking link", done: true },
  { label: "In transit", note: "Delhi hub → Gurugram", done: true },
  { label: "Out for delivery", note: "Customer pinged on WhatsApp", done: true },
  { label: "Delivered", note: "Order closed automatically", done: false },
];

export default function Home() {
  const tools = listTools();
  return (
    <div className="bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">D</div>
            <span className="font-semibold text-zinc-900">DropOS</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
            <a href="#features" className="hover:text-zinc-900">Features</a>
            <a href="#tracking" className="hover:text-zinc-900">Shipping & tracking</a>
            <a href="#how" className="hover:text-zinc-900">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900">
              My dashboard
            </Link>
            <Link href="/start" className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-700">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-50/70 to-white" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700">
              Built for the Masters&apos; Union Dropship Challenge
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl">
              Everything your dropshipping team needs.
              <span className="block text-emerald-600">End to end. Inside Claude.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-zinc-600">
              You talk to Claude. DropOS does the work, from sourcing to delivery.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/start"
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-900/10 hover:bg-zinc-700"
              >
                Get started — takes 2 minutes <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="px-3 py-3 text-sm font-medium text-zinc-700 hover:text-zinc-900">
                See how it works
              </a>
            </div>
            <p className="mt-4 text-xs text-zinc-500">Works with your own Claude account.</p>
          </div>
          <ChatMock />
        </div>
      </section>

      {/* Integrations */}
      <section className="border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-6">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Connects to</span>
          {INTEGRATIONS.map((i) => (
            <span key={i} className="text-sm font-semibold text-zinc-500">
              {i}
            </span>
          ))}
        </div>
      </section>

      {/* Why teams lose money */}
      <section className="mx-auto max-w-6xl px-6 pt-20">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Why teams lose money</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Margins lie. COD returns don&apos;t.</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <MarginBarChart />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <RtoAreaChart />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">The whole journey</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">From first product idea to delivered parcel.</h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-300 hover:shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-400">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-zinc-600">{f.text}</p>
              </div>
            );
          })}
        </div>

        {/* Highlight: shipping & tracking */}
        <div id="tracking" className="mt-4 grid gap-8 overflow-hidden rounded-2xl bg-zinc-950 p-8 text-white lg:grid-cols-[1.1fr_1fr] lg:p-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-zinc-950">
                <Truck className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-zinc-500">07</span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold">Ship &amp; track every parcel</h3>
            <p className="mt-3 text-zinc-300">
              Refreshes every in-flight shipment from <b className="text-white">Shiprocket</b> and <b className="text-white">Delhivery</b>. Customers get{" "}
              <b className="text-white">WhatsApp + email</b> updates with a live tracking link at every milestone.
            </p>
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <ShipmentsDonut />
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Order #1042 · Delhivery</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-400">Out for delivery</span>
            </div>
            <ol className="mt-5 space-y-4">
              {TIMELINE.map((s) => (
                <li key={s.label} className="flex gap-3">
                  <span className={s.done ? "mt-1 h-3 w-3 shrink-0 rounded-full bg-emerald-400" : "mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-zinc-600"} />
                  <div>
                    <div className={s.done ? "text-sm font-medium text-white" : "text-sm font-medium text-zinc-500"}>{s.label}</div>
                    <div className="text-xs text-zinc-500">{s.note}</div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-lg bg-emerald-950/60 px-3 py-2.5 text-xs text-emerald-200">
              💬 &quot;Hi Riya! Aapka order aaj deliver hoga 🚚 Track: hack.icedoutai.com/t/…&quot;
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900">One shared team brain</h3>
            <p className="mt-1 text-sm text-zinc-600">Everyone&apos;s Claude works on the same data. Ask &quot;what did Aarush do today?&quot;</p>
          </div>
        </div>
      </section>

      {/* Dashboard (secondary) */}
      <section className="mx-auto -mt-12 max-w-6xl px-6 pb-16">
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-zinc-700 shadow-sm">
            <BarChart3 className="h-5 w-5" />
          </div>
          <p className="text-sm text-zinc-600">
            <b className="text-zinc-900">Prefer charts?</b> Every member also gets a read-only analytics dashboard, linked from their setup screen.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">How it works</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">Set up in two minutes. Then just talk.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { n: "1", t: "Create your team", d: "Team, store and 5-10 products. Everyone gets a private link." },
              { n: "2", t: "Add DropOS to Claude", d: "Settings → Connectors → Add custom connector → paste link." },
              { n: "3", t: "Just talk", d: "“Which products make money?” “Ship today's safe orders.”" },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-sm font-semibold text-white">{s.n}</div>
                <h3 className="mt-4 font-semibold text-zinc-900">{s.t}</h3>
                <p className="mt-2 text-sm text-zinc-600">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link
              href="/start"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
            >
              <PackageCheck className="h-4 w-4" /> Set up my team
            </Link>
          </div>
        </div>
      </section>

      {/* Under the hood */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <UnderTheHood tools={tools} />
      </section>

      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-zinc-400">
          <span>DropOS · built at the Masters&apos; Union Buildathon by Team Cuck Coderz</span>
          <span>Your data stays on DropOS, shared only with your team.</span>
        </div>
      </footer>
    </div>
  );
}
