"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { defer, sleep } from "@/gtor/primitives";
import { trace } from "@/gtor/trace";
import { Button, Panel } from "../ui";

type Node = { label: string; code: string; status: "pending" | "fulfilled" | "rejected"; value?: string };

const INITIAL: Node[] = [
  { label: "promiseForTen", code: "defer()", status: "pending" },
  { label: "promiseForThirty", code: ".then(ten => ten + 20)", status: "pending" },
  { label: "promiseForSixty", code: ".then(n => n * 2)", status: "pending" },
  { label: "recovered", code: ".catch(e => 0)", status: "pending" },
];

export function ThenChain() {
  const [nodes, setNodes] = useState<Node[]>(INITIAL);
  const [flat, setFlat] = useState(true);
  const [fail, setFail] = useState(false);
  const [running, setRunning] = useState(false);
  const gen = useRef(0);

  const mark = (g: number, i: number, patch: Partial<Node>) =>
    g === gen.current && setNodes((ns) => ns.map((n, j) => (j === i ? { ...n, ...patch } : n)));

  async function run() {
    const g = ++gen.current;
    setNodes(INITIAL);
    setRunning(true);
    const ten = defer<number>("promiseForTen");
    // Each then() creates a new deferred internally and forwards the observer's return value to its resolver.
    const thirty = ten.promise.then((n) => {
      trace.emit("Promise", "promiseForThirty", "get", `observer saw ${n}, returns ${flat ? "a promise for" : ""} ${n + 20}`);
      return flat ? sleep(900).then(() => n + 20) : n + 20;
    });
    const sixty = thirty.then((n) => {
      if (fail) {
        trace.emit("Promise", "promiseForSixty", "error", "observer threw Error(\"nope\")");
        throw new Error("nope");
      }
      trace.emit("Promise", "promiseForSixty", "get", `observer saw ${n}, returns ${n * 2}`);
      return flat ? sleep(900).then(() => n * 2) : n * 2;
    });
    const recovered = sixty.catch((e: Error) => {
      trace.emit("Promise", "recovered", "settle", `catch(${e.message}) → 0`);
      return 0;
    });
    const watch = (p: Promise<number>, i: number) =>
      p.then(
        (v) => mark(g, i, { status: "fulfilled", value: String(v) }),
        (e: Error) => mark(g, i, { status: "rejected", value: e.message }),
      );
    watch(ten.promise, 0);
    watch(thirty, 1);
    watch(sixty, 2);
    watch(recovered, 3);
    await sleep(400);
    if (g !== gen.current) return;
    ten.resolver.return(10);
    await recovered;
    if (g === gen.current) setRunning(false);
  }

  return (
    <Panel
      title="then: the map and flatMap of a singular value"
      right={
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-muted">
            <input type="checkbox" checked={flat} onChange={(e) => setFlat(e.target.checked)} className="accent-[var(--color-accent)]" />
            observers return promises
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-muted">
            <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} className="accent-[var(--color-bad)]" />
            second observer throws
          </label>
          <Button variant="primary" onClick={run} disabled={running}>
            resolver.return(10)
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex flex-1 flex-col items-stretch gap-2 md:flex-row md:items-center">
            {i > 0 && <span className="self-center text-faint">{i === 3 ? "⤳" : "→"}</span>}
            <div
              key={n.status}
              className={clsx(
                "flex-1 animate-pop rounded-lg border p-3",
                n.status === "pending" && "border-dashed border-line",
                n.status === "fulfilled" && "border-time/60 bg-time/5",
                n.status === "rejected" && "border-bad/60 bg-bad/5",
              )}
            >
              <div className="font-mono text-[11px] text-faint">{n.code}</div>
              <div className="mt-1 text-sm font-medium">{n.label}</div>
              <div
                className={clsx(
                  "mt-1 font-mono text-xs",
                  n.status === "pending" && "text-faint",
                  n.status === "fulfilled" && "text-time",
                  n.status === "rejected" && "text-bad",
                )}
              >
                {n.status === "pending" ? "pending" : n.status === "fulfilled" ? `→ ${n.value}` : `✕ ${n.value}`}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        When an observer returns a promise, the next link is resolved with that promise and waits for it — a deferred value
        deferred further. When an observer throws, the error skips every <code className="font-mono">then</code> until a{" "}
        <code className="font-mono">catch</code> recovers.
      </p>
    </Panel>
  );
}
