"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

export function PageHeader({ n, title, quote, children }: { n: string; title: string; quote?: string; children: ReactNode }) {
  return (
    <header className="mb-8 max-w-3xl animate-rise">
      <div className="mb-2 font-mono text-xs text-accent">{n}</div>
      <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
      <div className="mt-3 text-[15px] leading-relaxed text-muted text-pretty">{children}</div>
      {quote && (
        <blockquote className="mt-4 border-l-2 border-accent/60 pl-4 text-sm leading-relaxed text-muted italic">
          {quote}
        </blockquote>
      )}
    </header>
  );
}

export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx("flex min-w-0 flex-col rounded-xl border border-line bg-panel", className)}>
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
          {right}
        </div>
      )}
      <div className={clsx("min-w-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Takeaways({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-8 grid gap-3 md:grid-cols-3">
      {items.map((item, i) => (
        <li key={i} className="rounded-xl border border-line bg-panel/60 p-4 text-sm leading-relaxed text-muted">
          <span className="mb-2 block font-mono text-xs text-accent">why it matters</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "bad" | "neutral" }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2/60 px-3 py-2">
      <div className="text-[11px] tracking-wide text-faint uppercase">{label}</div>
      <div className={clsx("mt-0.5 font-mono text-lg tabular-nums", tone === "good" && "text-ok", tone === "bad" && "text-bad")}>
        {value}
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "default",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "ghost" | "danger";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-black hover:brightness-110",
        variant === "default" && "border border-line bg-panel-2 text-ink hover:border-faint",
        variant === "ghost" && "text-muted hover:bg-panel-2 hover:text-ink",
        variant === "danger" && "border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A labeled range input with a mono readout. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  className,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <label className={clsx("flex items-center gap-3 text-sm", className)}>
      <span className="text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-[var(--color-accent)]"
      />
      <span className="w-16 font-mono text-xs tabular-nums">
        {value}
        {unit && ` ${unit}`}
      </span>
    </label>
  );
}

/** Small colored tag for the axes of the theory. */
export function Tag({ children, tone }: { children: ReactNode; tone: "space" | "time" | "getter" | "setter" | "accent" | "bad" | "ok" | "muted" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-1.5 py-px font-mono text-[11px]",
        tone === "space" && "border-space/40 bg-space/10 text-space",
        tone === "time" && "border-time/40 bg-time/10 text-time",
        tone === "getter" && "border-getter/40 bg-getter/10 text-getter",
        tone === "setter" && "border-setter/40 bg-setter/10 text-setter",
        tone === "accent" && "border-accent/40 bg-accent/10 text-accent",
        tone === "bad" && "border-bad/40 bg-bad/10 text-bad",
        tone === "ok" && "border-ok/40 bg-ok/10 text-ok",
        tone === "muted" && "border-line bg-panel-2 text-muted",
      )}
    >
      {children}
    </span>
  );
}

/** A scrolling console. Lines may be strings or nodes. Auto-scrolls to the end. */
export function Console({ lines, empty = "Nothing yet.", className }: { lines: ReactNode[]; empty?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length]);
  return (
    <div ref={ref} className={clsx("h-48 overflow-auto rounded-lg border border-line bg-bg/60 p-3 font-mono text-xs leading-relaxed", className)}>
      {lines.length === 0 ? <span className="text-faint">{empty}</span> : lines.map((l, i) => <div key={i} className="animate-rise">{l}</div>)}
    </div>
  );
}

/** Re-render every animation frame while `active`; returns performance.now(). */
export function useFrame(active = true) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}
