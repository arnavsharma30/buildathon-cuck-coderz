import type { Metadata } from "next";
import Link from "next/link";
import { Wizard } from "@/components/onboarding/Wizard";

export const metadata: Metadata = { title: "Set up your team · DropOS" };

export default function StartPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">D</div>
          <span className="font-semibold text-zinc-900">DropOS</span>
        </Link>
        <span className="text-xs text-zinc-500">Takes about 2 minutes</span>
      </header>
      <main className="px-6 pb-20 pt-6 sm:pt-12">
        <Wizard />
      </main>
    </div>
  );
}
