"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, step, actions }: { title: string; subtitle?: string; step?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {step && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-600">{step}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, right }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode }) {
  return (
    <section className={cx("rounded-xl border border-zinc-200 bg-white p-5 shadow-sm", className)}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "primary",
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700",
    secondary: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
    ghost: "text-zinc-600 hover:bg-zinc-100",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

type Tone = "zinc" | "green" | "amber" | "red" | "blue" | "violet";
export function Badge({ children, tone = "zinc", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  const tones: Record<Tone, string> = {
    zinc: "bg-zinc-100 text-zinc-700",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Shows whether a result came from live Claude or the offline demo fallback. */
export function SourceBadge({ source }: { source?: "claude" | "demo" | "indiamart-live" | "sample" }) {
  if (!source) return null;
  const live = source === "claude" || source === "indiamart-live";
  return <Badge tone={live ? "violet" : "zinc"}>{live ? "● Live AI" : "Demo data"}</Badge>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div
        className={cx(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-600",
          tone === "warn" && "text-amber-600",
          !tone && "text-zinc-900",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-400">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";

export function ScoreBar({ value, invert, label }: { value: number; invert?: boolean; label: string }) {
  // value 0-10; invert = higher is worse
  const good = invert ? 10 - value : value;
  const color = good >= 7 ? "bg-emerald-500" : good >= 4 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-zinc-500">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-zinc-100">
        <div className={cx("h-1.5 rounded-full", color)} style={{ width: `${Math.max(4, value * 10)}%` }} />
      </div>
      <span className="w-6 text-right tabular-nums text-zinc-700">{value}</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center text-sm text-zinc-500">{children}</div>;
}
