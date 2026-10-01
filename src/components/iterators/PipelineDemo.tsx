"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { trace } from "@/gtor/trace";
import { Button, Panel, Stat, Tag } from "../ui";

type Stage = 0 | 1 | 2 | 3;
type Hop = { stage: Stage; kind: "pull" | "yield" | "done" | "reject"; value?: number };
type It = { value: number | undefined; done: boolean };

const STAGES = [
  { name: "range", code: "range(0, N, 1)" },
  { name: "map", code: "map(n => n * 2)" },
  { name: "filter", code: "filter(n => n % 3 !== 0)" },
  { name: "reduce", code: "reduce((a, b) => a + b)" },
] as const;

const SIZES = [10, 1000, Infinity] as const;

/**
 * Hand-written iterators (no generators, no arrays) so that every next() call
 * can be recorded as a hop and replayed slowly.
 */
function makeLazy(n: number, record: (h: Hop) => void) {
  let i = 0;
  const range = {
    next(): It {
      record({ stage: 0, kind: "pull" });
      if (i < n) {
        const value = i;
        i += 1;
        record({ stage: 0, kind: "yield", value });
        return { value, done: false };
      }
      record({ stage: 0, kind: "done" });
      return { value: undefined, done: true };
    },
  };
  const map = {
    next(): It {
      record({ stage: 1, kind: "pull" });
      const it = range.next();
      if (it.done) {
        record({ stage: 1, kind: "done" });
        return it;
      }
      const value = it.value! * 2;
      record({ stage: 1, kind: "yield", value });
      return { value, done: false };
    },
  };
  const filter = {
    next(): It {
      record({ stage: 2, kind: "pull" });
      for (;;) {
        const it = map.next();
        if (it.done) {
          record({ stage: 2, kind: "done" });
          return it;
        }
        if (it.value! % 3 !== 0) {
          record({ stage: 2, kind: "yield", value: it.value });
          return it;
        }
        record({ stage: 2, kind: "reject", value: it.value });
      }
    },
  };
  return filter;
}

type View = {
  last: (number | undefined)[];
  pulls: number[];
  rejected: number[];
  acc: number | null;
  active: Hop | null;
  iterations: It[];
  finished: boolean;
};

const freshView = (): View => ({
  last: [undefined, undefined, undefined, undefined],
  pulls: [0, 0, 0, 0],
  rejected: [],
  acc: null,
  active: null,
  iterations: [],
  finished: false,
});

function apply(v: View, h: Hop): View {
  const last = v.last.slice();
  const pulls = v.pulls.slice();
  let { rejected, acc, iterations, finished } = v;
  if (h.kind === "pull") pulls[h.stage] += 1;
  if (h.kind === "yield") {
    if (h.stage === 3) acc = h.value!;
    else last[h.stage] = h.value;
    if (h.stage === 2) iterations = [...iterations.slice(-7), { value: h.value, done: false }];
  }
  if (h.kind === "reject") rejected = [...rejected.slice(-11), h.value!];
  if (h.kind === "done" && h.stage === 2) {
    iterations = [...iterations.slice(-7), { value: undefined, done: true }];
    finished = true;
  }
  return { last, pulls, rejected, acc, iterations, finished, active: h };
}

export function PipelineDemo() {
  const [n, setN] = useState<(typeof SIZES)[number]>(10);
  const [mode, setMode] = useState<"lazy" | "eager">("lazy");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted">Interpret as</span>
          <Segmented value={mode} options={["lazy", "eager"]} onChange={(m) => setMode(m)} labels={{ lazy: "iterators (lazy)", eager: "arrays (eager)" }} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted">N =</span>
          <Segmented value={String(n)} options={SIZES.map(String)} onChange={(s) => setN(Number(s) as (typeof SIZES)[number])} labels={{ Infinity: "∞" }} />
        </div>
      </div>
      {mode === "lazy" ? <Lazy key={n} n={n} /> : <Eager key={n} n={n} />}
    </div>
  );
}

function Lazy({ n }: { n: number }) {
  const [view, setView] = useState<View>(freshView);
  const [busy, setBusy] = useState(false);
  const pipeline = useRef<ReturnType<typeof makeLazy> | null>(null);
  const accRef = useRef<number | null>(null);
  const hops = useRef<Hop[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function ensure() {
    if (!pipeline.current) pipeline.current = makeLazy(n, (h) => hops.current.push(h));
    return pipeline.current;
  }

  /** Runs one reducer step synchronously, recording hops. Returns false when exhausted. */
  function pullOne(): boolean {
    const filter = ensure();
    hops.current.push({ stage: 3, kind: "pull" });
    const it = filter.next();
    if (it.done) return false;
    accRef.current = accRef.current == null ? it.value! : accRef.current + it.value!;
    hops.current.push({ stage: 3, kind: "yield", value: accRef.current });
    return true;
  }

  function step(count: number) {
    if (busy || view.finished) return;
    hops.current = [];
    for (let i = 0; i < count; i++) if (!pullOne()) break;
    const queue = hops.current.slice();
    trace.emit("Iterator", "reduce", "get", `filter.next() ×${count} → ${queue.filter((h) => h.stage === 0 && h.kind === "pull").length} pulls reached range`);
    setBusy(true);
    const delay = count > 1 ? 70 : 260;
    const tick = () => {
      const h = queue.shift();
      if (!h) {
        setBusy(false);
        setView((v) => ({ ...v, active: null }));
        return;
      }
      if (h.stage === 0 && h.kind === "yield") trace.emit("Iterator", "range", "set", `{value: ${h.value}, done: false}`);
      if (h.stage === 2 && h.kind === "done") trace.emit("Iterator", "filter", "settle", "{done: true}");
      setView((v) => apply(v, h));
      timer.current = setTimeout(tick, delay);
    };
    tick();
  }

  function runToEnd() {
    hops.current = [];
    let v = view;
    let guard = 0;
    while (pullOne() && guard++ < 100000) {
      for (const h of hops.current) v = apply(v, h);
      hops.current = [];
    }
    for (const h of hops.current) v = apply(v, h);
    hops.current = [];
    trace.emit("Iterator", "reduce", "settle", `exhausted → ${accRef.current}`);
    setView({ ...v, active: null });
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    pipeline.current = null;
    accRef.current = null;
    setBusy(false);
    setView(freshView());
  }

  return (
    <Panel
      title="Lazy: the reducer pulls one value at a time"
      right={
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => step(1)} disabled={busy || view.finished}>
            Pull one value
          </Button>
          <Button onClick={() => step(10)} disabled={busy || view.finished}>
            Pull ×10
          </Button>
          <Button onClick={runToEnd} disabled={busy || view.finished || !Number.isFinite(n)}>
            Run to end
          </Button>
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        </div>
      }
    >
      <Stages
        render={(s) => {
          const active = view.active?.stage === s ? view.active : null;
          return (
            <div
              className={clsx(
                "h-full rounded-lg border bg-panel-2/60 p-3 transition",
                active ? (active.kind === "pull" ? "border-getter shadow-[0_0_0_1px_var(--color-getter)]" : active.kind === "reject" ? "border-bad" : "border-setter shadow-[0_0_0_1px_var(--color-setter)]") : "border-line",
              )}
            >
              <StageTitle s={s} />
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-[11px] text-faint uppercase">{s === 3 ? "accumulator" : "last value"}</span>
                <span className="font-mono text-2xl tabular-nums">{s === 3 ? (view.acc ?? "—") : (view.last[s] ?? "—")}</span>
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-faint">
                <span>next() called</span>
                <span className="font-mono tabular-nums text-muted">{view.pulls[s]}×</span>
              </div>
              {s === 2 && (
                <div className="mt-2 flex min-h-5 flex-wrap gap-1">
                  {view.rejected.map((r, i) => (
                    <span key={`${r}-${i}`} className="animate-pop rounded bg-bad/10 px-1 font-mono text-[10px] text-bad line-through">
                      {r}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 h-5 font-mono text-[11px]">
                {active?.kind === "pull" && <span className="text-getter">← next()</span>}
                {active?.kind === "yield" && <span className="text-setter">{s === 3 ? `a + b = ${active.value}` : `{value: ${active.value}} →`}</span>}
                {active?.kind === "reject" && <span className="text-bad">{active.value} % 3 === 0, pull again</span>}
                {active?.kind === "done" && <span className="text-accent">{"{done: true} →"}</span>}
              </div>
            </div>
          );
        }}
      />
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-1.5 text-[11px] tracking-wide text-faint uppercase">Iterations filter returned to the reducer</div>
          <div className="flex min-h-9 flex-wrap gap-1.5">
            {view.iterations.length === 0 && <span className="text-xs text-faint">Nothing pulled yet. Nothing has been computed either.</span>}
            {view.iterations.map((it, i) => (
              <code key={i} className={clsx("animate-pop rounded-md border px-2 py-1 font-mono text-[11px]", it.done ? "border-accent/50 text-accent" : "border-line text-ink")}>
                {it.done ? "{ done: true }" : `{ value: ${it.value}, done: false }`}
              </code>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="arrays allocated" value={0} tone="good" />
          <Stat label="values in memory" value={view.pulls[0] ? "≤ 4" : 0} tone="good" />
        </div>
      </div>
      {!Number.isFinite(n) && (
        <p className="mt-3 text-xs text-muted">
          With <code className="font-mono text-ink">stop = Infinity</code> the range never produces <code className="font-mono">done</code>, yet an
          indefinite iterator costs no more memory than an empty one. Pull as long as you like.
        </p>
      )}
      {view.finished && (
        <p className="mt-3 text-xs text-muted">
          Exhausted after {view.pulls[0]} pulls of range. Result: <span className="font-mono text-ok">{view.acc ?? "undefined"}</span>.
        </p>
      )}
    </Panel>
  );
}

function Eager({ n }: { n: number }) {
  const [filled, setFilled] = useState(-1);
  const [arrays, setArrays] = useState<number[][] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const infinite = !Number.isFinite(n);

  function run() {
    const range: number[] = [];
    for (let i = 0; i < n; i++) range.push(i);
    const mapped = range.map((x) => x * 2);
    const filtered = mapped.filter((x) => x % 3 !== 0);
    const sum = filtered.reduce((a, b) => a + b, 0);
    setArrays([range, mapped, filtered, [sum]]);
    setFilled(-1);
    trace.emit("Array", "range", "set", `allocated ${range.length} values`);
    let s = 0;
    const tick = () => {
      setFilled(s);
      if (s < 3) trace.emit("Array", STAGES[s + 1].name, "set", `allocated ${[mapped, filtered, [sum]][s].length} value${s === 2 ? "" : "s"}`);
      s += 1;
      if (s < 4) timer.current = setTimeout(tick, 450);
    };
    tick();
  }

  const cells = arrays ? arrays.slice(0, 3).reduce((a, arr, i) => a + (i <= filled ? arr.length : 0), 0) : 0;

  return (
    <Panel
      title="Eager: every stage builds a whole array first"
      right={
        <div className="flex gap-2">
          <Button variant="primary" onClick={run} disabled={infinite}>
            Run eagerly
          </Button>
          <Button variant="ghost" onClick={() => (setArrays(null), setFilled(-1))}>
            Reset
          </Button>
        </div>
      }
    >
      {infinite ? (
        <div className="rounded-lg border border-bad/40 bg-bad/5 p-4 text-sm leading-relaxed text-muted">
          <div className="mb-1 font-mono text-xs text-bad">never returns</div>
          The eager <code className="font-mono text-ink">range(0, Infinity, 1)</code> must build an exhaustive array in memory before returning. It would
          push values until the tab runs out of memory, and <code className="font-mono">map</code> would never even start. Switch to iterators: the lazy
          version handles ∞ in constant space.
        </div>
      ) : (
        <>
          <Stages
            render={(s) => {
              const arr = arrays?.[s];
              const done = s <= filled;
              return (
                <div className={clsx("h-full rounded-lg border bg-panel-2/60 p-3 transition", done && filled === s ? "border-setter" : "border-line")}>
                  <StageTitle s={s} />
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-[11px] text-faint uppercase">{s === 3 ? "result" : "array length"}</span>
                    <span className="font-mono text-2xl tabular-nums">{done && arr ? (s === 3 ? arr[0] : arr.length) : "—"}</span>
                  </div>
                  <div className="mt-2 flex min-h-12 flex-wrap content-start gap-0.5">
                    {done &&
                      arr &&
                      s < 3 &&
                      arr.slice(0, 30).map((x, i) => (
                        <span key={i} className="animate-pop rounded bg-setter/10 px-1 font-mono text-[10px] text-setter" style={{ animationDelay: `${i * 8}ms` }}>
                          {x}
                        </span>
                      ))}
                    {done && arr && s < 3 && arr.length > 30 && <span className="px-1 font-mono text-[10px] text-faint">… +{arr.length - 30} more</span>}
                  </div>
                </div>
              );
            }}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-md">
            <Stat label="arrays allocated" value={arrays ? Math.min(filled + 1, 3) : 0} tone={arrays ? "bad" : undefined} />
            <Stat label="values in memory" value={cells} tone={cells > 100 ? "bad" : undefined} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Same answer as the lazy pipeline, but <code className="font-mono">map</code> waits for all of <code className="font-mono">range</code>, and{" "}
            <code className="font-mono">filter</code> waits for all of <code className="font-mono">map</code>. Try N = 1000.
          </p>
        </>
      )}
    </Panel>
  );
}

function Stages({ render }: { render: (s: Stage) => React.ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
      {([0, 1, 2, 3] as Stage[]).map((s) => (
        <div key={s} className="contents">
          {render(s)}
          {s < 3 && (
            <div className="flex items-center justify-center text-faint md:flex-col">
              <span className="font-mono text-xs text-setter">→</span>
              <span className="font-mono text-xs text-getter">←</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StageTitle({ s }: { s: Stage }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <code className="truncate font-mono text-xs text-ink">{STAGES[s].code}</code>
      <Tag tone={s === 0 ? "setter" : s === 3 ? "getter" : "muted"}>{s === 0 ? "source" : s === 3 ? "sink" : "transform"}</Tag>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, labels }: { value: T; options: readonly T[]; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={clsx("rounded-md px-2.5 py-1 font-mono text-xs transition", value === o ? "bg-accent text-black" : "text-muted hover:text-ink")}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
