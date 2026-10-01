"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { PromiseQueue, sleep } from "@/gtor/primitives";
import { Button, Console, Panel, Tag } from "../ui";

type Cell = {
  index: number;
  put?: { label: string; delayed: boolean; at: number; ready: boolean };
  get?: { at: number; settledAt?: number; value?: string };
};

const WORDS = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"];

/**
 * A real PromiseQueue, plus a mirror of its cells for drawing. Cell i pairs the
 * i-th put with the i-th get, regardless of which came first.
 */
export function QueueDemo() {
  const queue = useRef(new PromiseQueue<string | Promise<string>>("queue"));
  const counts = useRef({ puts: 0, gets: 0, settled: 0 });
  const t0 = useRef(0);
  const [cells, setCells] = useState<Cell[]>([]);
  const [log, setLog] = useState<React.ReactNode[]>([]);

  const time = () => {
    if (!t0.current) t0.current = performance.now();
    return Math.round(performance.now() - t0.current);
  };
  const patch = (index: number, fn: (c: Cell) => Cell) =>
    setCells((cs) => {
      const next = cs.slice();
      while (next.length <= index) next.push({ index: next.length });
      next[index] = fn(next[index]);
      return next;
    });

  function get() {
    const index = counts.current.gets++;
    const at = time();
    patch(index, (c) => ({ ...c, get: { at } }));
    setLog((l) => [...l, <span key={l.length}><span className="text-faint">+{at}ms</span> <span className="text-getter">get()</span> #{index} {index >= counts.current.puts ? "→ waiting for a put" : "→ value already there"}</span>]);
    Promise.resolve(queue.current.get()).then((value: string) => {
      const settledAt = time();
      const order = ++counts.current.settled;
      patch(index, (c) => ({ ...c, get: { ...c.get!, settledAt, value } }));
      setLog((l) => [
        ...l,
        <span key={l.length}>
          <span className="text-faint">+{settledAt}ms</span> <span className="text-accent">get #{index} settled</span> with {JSON.stringify(value)}{" "}
          <span className="text-faint">(settled {ordinal(order)})</span>
        </span>,
      ]);
    });
  }

  function put(delayed: boolean) {
    const index = counts.current.puts++;
    const word = WORDS[index % WORDS.length];
    const at = time();
    patch(index, (c) => ({ ...c, put: { label: delayed ? `delay(1500) → ${word}` : word, delayed, at, ready: !delayed } }));
    const value = delayed ? sleep(1500).then(() => (patch(index, (c) => ({ ...c, put: { ...c.put!, ready: true } })), word)) : word;
    setLog((l) => [...l, <span key={l.length}><span className="text-faint">+{at}ms</span> <span className="text-setter">put({delayed ? "Promise.delay(1500)" : JSON.stringify(word)})</span> #{index}</span>]);
    queue.current.put(value);
  }

  function reset() {
    queue.current = new PromiseQueue("queue");
    counts.current = { puts: 0, gets: 0, settled: 0 };
    t0.current = 0;
    setCells([]);
    setLog([]);
  }

  function scenario() {
    reset();
    // From the essay: the later get settles sooner, because the first put is a promise.
    setTimeout(() => {
      get();
      get();
      put(true);
      put(false);
    });
  }

  const head = cells.findIndex((c) => !c.get);
  const tail = cells.findIndex((c) => !c.put);

  return (
    <Panel
      title="A promise queue: an asynchronous linked list"
      right={
        <div className="flex flex-wrap gap-2">
          <Button onClick={get} className="!text-getter">get()</Button>
          <Button onClick={() => put(false)} className="!text-setter">put(value)</Button>
          <Button onClick={() => put(true)}>put(Promise.delay(1500))</Button>
          <Button variant="ghost" onClick={scenario}>“Resolves sooner” scenario</Button>
          <Button variant="ghost" onClick={reset}>reset</Button>
        </div>
      }
    >
      <div className="overflow-x-auto pb-2">
        <div className="flex min-h-[128px] items-center gap-0">
          {cells.length === 0 && <p className="text-sm text-faint">Call get() or put() in any order. Each pair meets in one cell of the list.</p>}
          {cells.map((c, i) => (
            <div key={i} className="flex items-center">
              <CellView cell={c} isHead={i === (head === -1 ? cells.length : head)} isTail={i === (tail === -1 ? cells.length : tail)} />
              {i < cells.length - 1 && <span className="px-1 font-mono text-faint">→</span>}
            </div>
          ))}
          {cells.length > 0 && (
            <div className="ml-1 flex flex-col items-center gap-1 font-mono text-[10px] text-faint">
              <span className="px-1">→</span>
              <span className="rounded border border-dashed border-line px-2 py-3">next<br />deferred</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
        <Tag tone="setter">filled = a put arrived</Tag>
        <Tag tone="getter">hollow ring = a get is waiting</Tag>
        <Tag tone="accent">✓ = the get&apos;s promise settled</Tag>
        <span className="text-faint">head advances on get(); tail advances on put().</span>
      </div>
      <Console className="mt-4 h-40" lines={log} empty="The queue's history appears here." />
    </Panel>
  );
}

function CellView({ cell, isHead, isTail }: { cell: Cell; isHead: boolean; isTail: boolean }) {
  const { put, get } = cell;
  const settled = get?.settledAt != null;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={clsx("h-4 font-mono text-[10px]", isHead || isTail ? "text-accent" : "text-transparent")}>
        {[isHead && "head", isTail && "tail"].filter(Boolean).join(" · ") || "·"}
      </span>
      <div
        className={clsx(
          "relative flex h-16 w-28 animate-pop flex-col justify-between rounded-lg border p-2 transition-colors",
          put ? (put.ready ? "border-setter/60 bg-setter/15" : "border-setter/40 border-dashed bg-setter/5") : "border-line border-dashed bg-transparent",
          get && !settled && "ring-2 ring-getter/70 ring-offset-2 ring-offset-panel",
          settled && "border-accent/60 bg-accent/10",
        )}
      >
        <span className="font-mono text-[10px] text-faint">cell #{cell.index}</span>
        <span className={clsx("truncate font-mono text-xs", put ? "text-ink" : "text-faint")}>
          {put ? (put.ready ? JSON.stringify(put.label.replace(/^delay\(1500\) → /, "")) : "⏳ promise") : "no value yet"}
        </span>
        {settled && <span className="absolute -top-2 -right-2 flex size-5 animate-pop items-center justify-center rounded-full bg-accent text-[11px] text-black">✓</span>}
      </div>
      <span className="h-4 font-mono text-[10px] text-faint">{get ? (settled ? `get ✓ +${get.settledAt}ms` : "get waiting…") : ""}</span>
    </div>
  );
}

function ordinal(n: number) {
  return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
}
