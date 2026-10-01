"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Button } from "../ui";

type Cell = {
  key: string;
  number: "Singular" | "Plural";
  axis: "Spatial" | "Temporal";
  value: string;
  getter: string;
  setter: string;
  getterHref: string;
  setterHref: string;
  example: string;
};

const CELLS: Cell[] = [
  { key: "value", number: "Singular", axis: "Spatial", value: "Value", getter: "Getter", setter: "Setter", getterHref: "/iterators", setterHref: "/generators", example: "let x = 10; x" },
  { key: "array", number: "Plural", axis: "Spatial", value: "Array", getter: "Iterator", setter: "Generator", getterHref: "/iterators", setterHref: "/generators", example: "iterator.next() → {value, done}" },
  { key: "deferred", number: "Singular", axis: "Temporal", value: "Deferred", getter: "Promise", setter: "Resolver", getterHref: "/promises", setterHref: "/promises", example: "promise.then(fn) · resolver.return(v)" },
  { key: "stream", number: "Plural", axis: "Temporal", value: "Stream", getter: "Reader", setter: "Writer", getterHref: "/streams", setterHref: "/streams", example: "reader.next() → Promise<{value, done}>" },
];

/**
 * The essay's 2×2: singular/plural × spatial/temporal, with each cell split
 * into its getter and setter. A small animation rotates the plural spatial
 * cell (an array) onto the time axis, where it becomes a stream.
 */
export function TheoryGrid() {
  const [active, setActive] = useState<string>("stream");
  const cell = CELLS.find((c) => c.key === active)!;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
      <div className="grid grid-cols-[auto_1fr_1fr] grid-rows-[auto_1fr_1fr] gap-2">
        <div />
        <AxisLabel>Singular</AxisLabel>
        <AxisLabel>Plural</AxisLabel>
        <AxisLabel vertical tone="space">
          Spatial
        </AxisLabel>
        {CELLS.slice(0, 2).map((c) => (
          <GridCell key={c.key} cell={c} active={active === c.key} onSelect={() => setActive(c.key)} />
        ))}
        <AxisLabel vertical tone="time">
          Temporal
        </AxisLabel>
        {CELLS.slice(2).map((c) => (
          <GridCell key={c.key} cell={c} active={active === c.key} onSelect={() => setActive(c.key)} />
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel-2/40 p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className={clsx("font-mono", cell.axis === "Spatial" ? "text-space" : "text-time")}>{cell.axis.toLowerCase()}</span>
          <span className="text-faint">·</span>
          <span className="font-mono text-muted">{cell.number.toLowerCase()}</span>
        </div>
        <div className="text-xl font-semibold">{cell.value}</div>
        <FlowDiagram cell={cell} />
        <code className="rounded-md border border-line bg-bg/60 px-2 py-1.5 font-mono text-xs text-muted">{cell.example}</code>
        <p className="text-sm leading-relaxed text-muted">{DESCRIPTIONS[cell.key]}</p>
        <div className="mt-auto flex flex-wrap gap-2 text-xs">
          <Link href={cell.getterHref} className="rounded-md border border-getter/40 px-2 py-1 text-getter hover:bg-getter/10">
            {cell.getter} →
          </Link>
          {cell.setterHref !== cell.getterHref && (
            <Link href={cell.setterHref} className="rounded-md border border-setter/40 px-2 py-1 text-setter hover:bg-setter/10">
              {cell.setter} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const DESCRIPTIONS: Record<string, string> = {
  value: "Break the atom and it falls into a getter and a setter. Data flows one way: from the setter to the getter.",
  array: "Any collection holds many values. An iterator is a plural getter; a generator is its setter dual.",
  deferred: "A promise is a getter for one value from the past or the future. The resolver is its setter. Together: a deferred.",
  stream: "Rotate an array from the space axis onto the time axis and it becomes a stream. A reader is an async iterator, a writer an async generator.",
};

function AxisLabel({ children, vertical, tone }: { children: string; vertical?: boolean; tone?: "space" | "time" }) {
  return (
    <div
      className={clsx(
        "flex items-center justify-center text-[11px] font-semibold tracking-widest uppercase",
        tone === "space" ? "text-space" : tone === "time" ? "text-time" : "text-faint",
        vertical && "[writing-mode:vertical-rl] rotate-180 px-1",
        !vertical && "pb-1",
      )}
    >
      {children}
    </div>
  );
}

function GridCell({ cell, active, onSelect }: { cell: Cell; active: boolean; onSelect: () => void }) {
  const temporal = cell.axis === "Temporal";
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onSelect}
      className={clsx(
        "group flex min-h-36 flex-col justify-between rounded-xl border p-4 text-left transition",
        active ? (temporal ? "border-time/60 bg-time/[0.06]" : "border-space/60 bg-space/[0.06]") : "border-line bg-panel hover:border-faint",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg font-semibold">{cell.value}</span>
        <Glyph cell={cell} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5 font-mono text-[11px]">
        <span className="rounded border border-setter/40 bg-setter/10 px-1.5 py-px text-setter">{cell.setter}</span>
        <span className="text-faint">→</span>
        <span className="rounded border border-getter/40 bg-getter/10 px-1.5 py-px text-getter">{cell.getter}</span>
      </div>
    </button>
  );
}

/** Squares for space, circles for time; one or many. */
function Glyph({ cell }: { cell: Cell }) {
  const color = cell.axis === "Spatial" ? "var(--color-space)" : "var(--color-time)";
  const n = cell.number === "Singular" ? 1 : 4;
  return (
    <svg width={n === 1 ? 18 : 60} height={18} aria-hidden>
      {Array.from({ length: n }, (_, i) =>
        cell.axis === "Spatial" ? (
          <rect key={i} x={i * 14 + 1} y={2} width={13} height={13} rx={3} fill={color} opacity={1 - i * 0.2} />
        ) : (
          <circle key={i} cx={i * 14 + 8} cy={9} r={6.5} fill={color} opacity={1 - i * 0.2} />
        ),
      )}
    </svg>
  );
}

function FlowDiagram({ cell }: { cell: Cell }) {
  const temporal = cell.axis === "Temporal";
  const plural = cell.number === "Plural";
  const color = temporal ? "var(--color-time)" : "var(--color-space)";
  return (
    <svg viewBox="0 0 320 70" className="w-full" role="img" aria-label={`${cell.setter} sends to ${cell.getter}`}>
      <rect x={2} y={18} width={84} height={34} rx={8} fill="none" stroke="var(--color-setter)" />
      <text x={44} y={40} textAnchor="middle" fontSize={12} fill="var(--color-setter)">
        {cell.setter}
      </text>
      <rect x={234} y={18} width={84} height={34} rx={8} fill="none" stroke="var(--color-getter)" />
      <text x={276} y={40} textAnchor="middle" fontSize={12} fill="var(--color-getter)">
        {cell.getter}
      </text>
      <line x1={90} y1={35} x2={230} y2={35} stroke="var(--color-line)" strokeWidth={2} />
      {Array.from({ length: plural ? 4 : 1 }, (_, i) => (
        <g key={`${cell.key}-${i}`}>
          {temporal ? <circle r={6} cy={35} fill={color} /> : <rect y={29} width={12} height={12} rx={2} fill={color} />}
          <animateTransform
            attributeName="transform"
            type="translate"
            from={`${temporal ? 94 : 88} 0`}
            to={`${temporal ? 224 : 218} 0`}
            dur={temporal ? "2.4s" : "0.01s"}
            begin={temporal ? `${i * 0.6}s` : "0s"}
            fill="freeze"
            repeatCount={temporal ? "indefinite" : "1"}
          />
        </g>
      ))}
      <text x={160} y={66} textAnchor="middle" fontSize={10} fill="var(--color-faint)">
        {temporal ? (plural ? "many values, arriving over time" : "one value, arriving later") : plural ? "many values, all here now" : "one value, here now"}
      </text>
    </svg>
  );
}

/**
 * "If you rotate an array from the space axis to the time axis, it would
 * become a stream." Values laid out left-to-right become values arriving
 * one after another.
 */
export function RotateArray() {
  const [temporal, setTemporal] = useState(false);
  const [tick, setTick] = useState(0);
  const values = [3, 1, 4, 1, 5, 9];

  useEffect(() => {
    if (!temporal) return;
    setTick(0);
    const id = setInterval(() => setTick((t) => t + 1), 600);
    return () => clearInterval(id);
  }, [temporal]);

  const arrived = temporal ? Math.min(tick, values.length) : values.length;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 flex-col gap-2">
        <Button variant={temporal ? "default" : "primary"} onClick={() => setTemporal((t) => !t)}>
          {temporal ? "↺ back to space" : "↻ rotate onto time"}
        </Button>
        <span className="font-mono text-[11px] text-faint">{temporal ? "Stream<number>" : "Array<number>"}</span>
      </div>
      <div className="relative h-24 flex-1 overflow-hidden rounded-lg border border-line bg-bg/50">
        <div className="absolute top-2 left-3 font-mono text-[10px] tracking-wide text-faint uppercase">
          {temporal ? "time →" : "space →"}
        </div>
        {values.map((v, i) => {
          const here = i < arrived;
          return (
            <div
              key={i}
              className={clsx(
                "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center font-mono text-sm font-semibold text-black transition-all duration-500",
                temporal ? "rounded-full bg-time" : "rounded-lg bg-space",
                !here && "opacity-0",
              )}
              style={{ left: `calc(${12 + i * 14}% - 20px)`, transitionDelay: temporal ? "0ms" : `${i * 40}ms` }}
            >
              {v}
            </div>
          );
        })}
        {temporal && arrived < values.length && (
          <div className="absolute right-3 bottom-2 font-mono text-[10px] text-time">waiting for value #{arrived + 1}…</div>
        )}
      </div>
    </div>
  );
}
