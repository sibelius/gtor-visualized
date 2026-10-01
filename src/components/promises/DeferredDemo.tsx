"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { defer, sleep, type Deferred } from "@/gtor/primitives";
import { trace } from "@/gtor/trace";
import { Button, Panel, Tag } from "../ui";

type Producer = { id: string; label: string; value: string; delayed?: boolean };
const PRODUCERS: Producer[] = [
  { id: "A", label: "producer A", value: "🍎 apple" },
  { id: "B", label: "producer B", value: "🍌 banana" },
  { id: "C", label: "producer C", value: "🍒 cherry" },
  { id: "D", label: "producer D", value: "🫐 blueberry", delayed: true },
];

type Call = { producer: string; value: string; at: number; won: boolean };
type Observer = { id: number; when: "before" | "after"; received: string | null; at: number };
type State =
  | { status: "pending" }
  | { status: "deferred"; by: string } // resolved with another promise, still pending
  | { status: "fulfilled"; value: string; by: string };

export function DeferredDemo() {
  const deferred = useRef<Deferred<string> | null>(null);
  const t0 = useRef(0);
  const [state, setState] = useState<State>({ status: "pending" });
  const [calls, setCalls] = useState<Call[]>([]);
  const [observers, setObservers] = useState<Observer[]>([]);
  const [racing, setRacing] = useState(false);
  const generation = useRef(0);
  const nextObserver = useRef(1);
  const won = useRef(false);

  function current() {
    if (!deferred.current) {
      deferred.current = defer<string>("promise");
      t0.current = performance.now();
    }
    return deferred.current;
  }

  function reset() {
    generation.current++;
    deferred.current = null;
    won.current = false;
    nextObserver.current = 1;
    setState({ status: "pending" });
    setCalls([]);
    setObservers([]);
    setRacing(false);
  }

  function resolveFrom(p: Producer) {
    const d = current();
    const gen = generation.current;
    const first = !won.current;
    won.current = true;
    const at = performance.now() - t0.current;
    if (p.delayed) {
      // Resolve with another promise: the deferred is "resolved" (locked in)
      // but stays pending until that promise settles.
      const inner = sleep(1500).then(() => p.value);
      d.resolver.return(inner);
      if (first) {
        setState({ status: "deferred", by: p.id });
        inner.then(() => gen === generation.current && setState({ status: "fulfilled", value: p.value, by: p.id }));
      }
    } else {
      d.resolver.return(p.value);
      if (first) setState({ status: "fulfilled", value: p.value, by: p.id });
    }
    // Every producer gets the same experience: return() returns undefined.
    setCalls((cs) => [...cs, { producer: p.id, value: p.value, at, won: first }]);
  }

  function observe() {
    const d = current();
    const gen = generation.current;
    const id = nextObserver.current++;
    const when = state.status === "fulfilled" ? "after" : "before";
    trace.emit("Promise", "promise", "get", `then(observer #${id}) — registered ${when} resolution`);
    setObservers((os) => [...os, { id, when, received: null, at: performance.now() - t0.current }]);
    d.promise.then((value) => {
      if (gen !== generation.current) return;
      trace.emit("Promise", "promise", "settle", `observer #${id} sees ${JSON.stringify(value)}`);
      setObservers((os) => os.map((o) => (o.id === id ? { ...o, received: value } : o)));
    });
  }

  async function race() {
    reset();
    const gen = generation.current;
    setRacing(true);
    current();
    // Three observers subscribe first, then three producers race.
    await Promise.resolve();
    for (let i = 0; i < 3; i++) observeFresh(gen);
    const order = [...PRODUCERS.slice(0, 3)].sort(() => Math.random() - 0.5);
    for (const p of order) {
      await sleep(300 + Math.random() * 500);
      if (gen !== generation.current) return;
      resolveFrom(p);
    }
    setRacing(false);
  }

  // `observe` reads React state for the before/after label; during a race we know it's "before".
  function observeFresh(gen: number) {
    const d = current();
    const id = nextObserver.current++;
    trace.emit("Promise", "promise", "get", `then(observer #${id}) — registered before resolution`);
    setObservers((os) => [...os, { id, when: "before", received: null, at: performance.now() - t0.current }]);
    d.promise.then((value) => {
      if (gen !== generation.current) return;
      trace.emit("Promise", "promise", "settle", `observer #${id} sees ${JSON.stringify(value)}`);
      setObservers((os) => os.map((o) => (o.id === id ? { ...o, received: value } : o)));
    });
  }

  const resolvedBy = state.status !== "pending" ? state.by : null;

  return (
    <Panel
      title="One deferred: a resolver and a promise"
      right={
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={race} disabled={racing}>
            Race 3 producers
          </Button>
          <Button onClick={reset}>Reset</Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {/* Producers (setter side) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Tag tone="setter">setter</Tag> producers hold the resolver
          </div>
          {PRODUCERS.map((p) => {
            const myCalls = calls.filter((c) => c.producer === p.id);
            const isWinner = resolvedBy === p.id;
            return (
              <div
                key={p.id}
                className={clsx(
                  "rounded-lg border bg-panel-2/60 p-2.5 transition",
                  isWinner ? "border-setter/70" : "border-line",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{p.label}</span>
                  <Button className="!px-2 !py-1 !text-xs" onClick={() => resolveFrom(p)}>
                    {p.delayed ? "return(promise)" : `return(${p.value.split(" ")[0]})`}
                  </Button>
                </div>
                <div className="mt-1 font-mono text-[11px] text-faint">
                  {p.delayed ? `resolver.return(sleep(1500) → "${p.value}")` : `resolver.return("${p.value}")`}
                </div>
                {myCalls.map((c, i) => (
                  <div key={i} className="mt-1 animate-rise font-mono text-[11px]">
                    <span className="text-muted">+{Math.round(c.at)}ms → undefined</span>{" "}
                    <span className={c.won ? "text-setter" : "text-faint"}>{c.won ? "(won)" : "(ignored)"}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <Arrow />

        {/* The deferred value */}
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="text-xs text-muted">deferred</div>
          <div
            key={state.status}
            className={clsx(
              "flex size-40 animate-pop flex-col items-center justify-center rounded-full border-2 text-center",
              state.status === "pending" && "border-dashed border-faint",
              state.status === "deferred" && "border-dashed border-time",
              state.status === "fulfilled" && "border-time bg-time/10",
            )}
          >
            <span className="font-mono text-xs text-muted">Promise</span>
            <span className="mt-1 px-3 text-sm font-medium">
              {state.status === "pending" && "pending"}
              {state.status === "deferred" && "resolved to a promise… still pending"}
              {state.status === "fulfilled" && state.value}
            </span>
            {resolvedBy && <span className="mt-1 font-mono text-[10px] text-faint">by producer {resolvedBy}</span>}
          </div>
          <p className="max-w-52 text-center text-xs leading-relaxed text-faint">
            Only the first call to the resolver counts. Every later call is silently ignored — the losers can&apos;t tell
            they lost.
          </p>
        </div>

        <Arrow />

        {/* Observers (getter side) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span className="flex items-center gap-2">
              <Tag tone="getter">getter</Tag> consumers hold the promise
            </span>
            <Button className="!px-2 !py-1 !text-xs" onClick={observe}>
              + then()
            </Button>
          </div>
          {observers.length === 0 && (
            <p className="rounded-lg border border-dashed border-line p-3 text-xs text-faint">
              Add observers before or after resolution. Every one of them sees the same value.
            </p>
          )}
          {observers.map((o) => (
            <div key={o.id} className="flex animate-rise items-center justify-between rounded-lg border border-line bg-panel-2/60 px-2.5 py-2">
              <span className="text-sm">
                observer #{o.id} <span className="text-[11px] text-faint">({o.when})</span>
              </span>
              <span className={clsx("font-mono text-xs", o.received ? "text-getter" : "text-faint")}>
                {o.received ?? "waiting…"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-faint" aria-hidden>
      <svg viewBox="0 0 40 20" className="h-5 w-10 rotate-90 lg:rotate-0">
        <path d="M2 10 H32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4">
          <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.8s" repeatCount="indefinite" />
        </path>
        <path d="M30 4 L38 10 L30 16 z" fill="currentColor" />
      </svg>
    </div>
  );
}
