"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { trace } from "@/gtor/trace";
import { Button } from "../ui";

const SOURCE = [1, 2, 3];

/** iterate([1, 2, 3]) by hand: each next() returns an iteration object. */
export function NextPlayground() {
  const it = useRef<Iterator<number>>(SOURCE[Symbol.iterator]());
  const [log, setLog] = useState<IteratorResult<number>[]>([]);

  function next() {
    const r = it.current.next();
    trace.emit("Iterator", "iterate([1, 2, 3])", r.done ? "settle" : "get", `next() → ${r.done ? "{done: true}" : `{value: ${r.value}, done: false}`}`);
    setLog((l) => [...l, r]);
  }

  function reset() {
    it.current = SOURCE[Symbol.iterator]();
    setLog([]);
  }

  const consumed = log.filter((r) => !r.done).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted">[</span>
        {SOURCE.map((v, i) => (
          <span
            key={v}
            className={clsx(
              "flex size-8 items-center justify-center rounded-md border font-mono text-sm transition",
              i < consumed ? "border-line text-faint" : i === consumed ? "border-getter text-getter" : "border-line text-ink",
            )}
          >
            {v}
          </span>
        ))}
        <span className="font-mono text-xs text-muted">]</span>
        <div className="ml-auto flex gap-2">
          <Button variant="primary" onClick={next}>
            iterator.next()
          </Button>
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>
      <div className="min-h-24 space-y-1 rounded-lg border border-line bg-bg/60 p-3 font-mono text-xs">
        {log.length === 0 && <span className="text-faint">Call next() to get an iteration.</span>}
        {log.map((r, i) => (
          <div key={i} className="animate-rise">
            <span className="text-faint">iteration = iterator.next(); </span>
            <span className={r.done ? "text-accent" : "text-ink"}>{r.done ? "// { value: undefined, done: true }" : `// { value: ${r.value}, done: false }`}</span>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Calling <code className="font-mono">next()</code> after the end keeps returning <code className="font-mono">done: true</code>. There is no{" "}
        <code className="font-mono">hasNext()</code>: the iterator only knows it is finished once it tries to produce a value.
      </p>
    </div>
  );
}
