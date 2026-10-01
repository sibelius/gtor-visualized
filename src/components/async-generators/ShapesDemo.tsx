"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { sleep } from "@/gtor/primitives";
import { trace } from "@/gtor/trace";
import { Button, Panel } from "../ui";

type Call = { n: number; doneKnown: boolean; done?: boolean; value?: string; valueKnown: boolean };

const SOURCE = ["Hamlet", "Macbeth", "Othello"];

/**
 * The same async source of three titles, read through the two candidate
 * shapes. Iteration<Promise<T>> must answer `done` synchronously, before the
 * source knows; Promise<Iteration<T>> waits and answers both together.
 */
export function ShapesDemo() {
  const [a, setA] = useState<Call[]>([]);
  const [b, setB] = useState<Call[]>([]);
  const n = useRef(0);

  async function next() {
    const i = n.current++;
    const ended = i >= SOURCE.length;
    trace.emit("AsyncIterator", "shapes", "get", `next() #${i}`);
    // Iterator of promises: the iteration exists now; done must be decided now.
    setA((xs) => [...xs, { n: i, doneKnown: true, done: false, valueKnown: false }]);
    // Promise iterator: nothing is known until the promise settles.
    setB((xs) => [...xs, { n: i, doneKnown: false, valueKnown: false }]);
    await sleep(900);
    setA((xs) => xs.map((x) => (x.n === i ? { ...x, valueKnown: true, value: ended ? "⚠ no value" : SOURCE[i] } : x)));
    setB((xs) => xs.map((x) => (x.n === i ? { ...x, doneKnown: true, done: ended, valueKnown: true, value: ended ? undefined : SOURCE[i] } : x)));
    trace.emit("AsyncIterator", "shapes", "settle", ended ? "← {done: true}" : `← {value: "${SOURCE[i]}", done: false}`);
  }

  function reset() {
    n.current = 0;
    setA([]);
    setB([]);
  }

  return (
    <Panel
      title="Two shapes for an asynchronous next()"
      right={
        <div className="flex gap-2">
          <Button variant="primary" onClick={next}>next()</Button>
          <Button variant="ghost" onClick={reset}>reset</Button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-muted">
        The source holds three titles but only learns each one (and whether there is another) after 900ms. Call{" "}
        <code className="font-mono">next()</code> four times.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Column title="Iterator<Promise<T>>" sub="next() returns Iteration<Promise<T>>" bad>
          {a.map((c) => (
            <div key={c.n} className="flex animate-rise items-center gap-2 font-mono text-xs">
              <span className="w-5 text-faint">#{c.n}</span>
              <span className="rounded-md border border-line bg-panel-2 px-2 py-1">
                {"{ value: "}
                <span className={clsx("rounded px-1", c.valueKnown ? (c.value?.startsWith("⚠") ? "bg-bad/20 text-bad" : "bg-ok/15 text-ok") : "bg-time/15 text-time")}>
                  {c.valueKnown ? (c.value?.startsWith("⚠") ? "rejected: no more" : `"${c.value}"`) : "Promise ⏳"}
                </span>
                {", done: "}
                <span className="text-setter">false</span>
                {" }"}
              </span>
            </div>
          ))}
          <Note>
            <code className="font-mono">done</code> is decided synchronously, before the source knows whether a 4th value exists. The
            iterator had to guess <span className="text-setter">false</span>; the 4th promise can only reject. An error here means
            “couldn&apos;t transport one value”, not “the sequence ended”.
          </Note>
        </Column>
        <Column title="PromiseIterator<T>" sub="next() returns Promise<Iteration<T>>">
          {b.map((c) => (
            <div key={c.n} className="flex animate-rise items-center gap-2 font-mono text-xs">
              <span className="w-5 text-faint">#{c.n}</span>
              {!c.doneKnown ? (
                <span className="rounded-md border border-time/40 bg-time/10 px-2 py-1 text-time">Promise ⏳</span>
              ) : (
                <span className="animate-pop rounded-md border border-line bg-panel-2 px-2 py-1">
                  {"{ "}
                  {c.done ? (
                    <>done: <span className="text-accent">true</span></>
                  ) : (
                    <>value: <span className="text-ok">&quot;{c.value}&quot;</span>, done: <span className="text-setter">false</span></>
                  )}
                  {" }"}
                </span>
              )}
            </div>
          ))}
          <Note>
            Both <code className="font-mono">value</code> and <code className="font-mono">done</code> arrive together, when the source
            knows. Rejection models abnormal termination of the whole sequence. This is the shape gtor — and{" "}
            <code className="font-mono">Symbol.asyncIterator</code> — chose: the output side of a stream.
          </Note>
        </Column>
      </div>
    </Panel>
  );
}

function Column({ title, sub, bad, children }: { title: string; sub: string; bad?: boolean; children: React.ReactNode }) {
  return (
    <div className={clsx("rounded-xl border p-3", bad ? "border-bad/30 bg-bad/5" : "border-ok/30 bg-ok/5")}>
      <div className="font-mono text-sm text-ink">{title}</div>
      <div className="mb-3 font-mono text-[11px] text-faint">{sub}</div>
      <div className="flex min-h-36 flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-auto pt-3 text-xs leading-relaxed text-muted">{children}</p>;
}
