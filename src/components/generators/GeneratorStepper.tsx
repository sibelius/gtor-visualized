"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { trace } from "@/gtor/trace";
import { Button, Console, Panel, Tag } from "../ui";

type Probe = { at: (line: number) => void; log: (msg: string) => void };

type Variant = {
  key: "echo" | "cleanup";
  label: string;
  lines: string[];
  make: (p: Probe) => Generator<unknown, unknown, unknown>;
};

// Each real generator reports the line it is about to run, so the listing on
// screen tracks where the state machine actually paused.
const VARIANTS: Variant[] = [
  {
    key: "echo",
    label: "echo",
    lines: [
      "function *echo() {",
      "    var message;",
      "    while (true) {",
      '        console.log("tick");',
      "        message = yield message;",
      '        console.log("tock");',
      "    }",
      "}",
    ],
    make: function* ({ at, log }) {
      at(2);
      let message: unknown;
      for (;;) {
        at(4);
        log("tick");
        at(5);
        message = yield message;
        at(6);
        log("tock");
      }
    },
  },
  {
    key: "cleanup",
    label: "echo with try / catch / finally",
    lines: [
      "function *echo() {",
      "    try {",
      "        var message;",
      "        while (true) {",
      '            console.log("tick");',
      "            message = yield message;",
      '            console.log("tock");',
      "        }",
      "    } catch (error) {",
      '        console.log("caught", error.message);',
      '        yield "recovered";',
      "    } finally {",
      '        console.log("finally: cleanup");',
      "    }",
      "}",
    ],
    make: function* ({ at, log }) {
      try {
        at(3);
        let message: unknown;
        for (;;) {
          at(5);
          log("tick");
          at(6);
          message = yield message;
          at(7);
          log("tock");
        }
      } catch (error) {
        at(10);
        log(`caught ${(error as Error).message}`);
        at(11);
        yield "recovered";
      } finally {
        at(13);
        log("finally: cleanup");
      }
    },
  },
];

type GenState = "suspended start" | "suspended yield" | "completed";
type Call = { verb: string; result: string; tone: "ok" | "done" | "bad" };

export function GeneratorStepper() {
  const [variantKey, setVariantKey] = useState<Variant["key"]>("echo");
  const variant = VARIANTS.find((v) => v.key === variantKey)!;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {VARIANTS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setVariantKey(v.key)}
            className={clsx(
              "rounded-md border px-2.5 py-1 font-mono text-xs",
              v.key === variantKey ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:text-ink",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <Stepper key={variant.key} variant={variant} />
    </div>
  );
}

function Stepper({ variant }: { variant: Variant }) {
  const [state, setState] = useState<GenState>("suspended start");
  const [paused, setPaused] = useState<number | null>(null);
  const [trail, setTrail] = useState<number[]>([]);
  const [out, setOut] = useState<React.ReactNode[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [msg, setMsg] = useState("Hello");
  const [err, setErr] = useState("Do not want!");
  const [ret, setRet] = useState("42");

  const visited = useRef<number[]>([]);
  const make = () =>
    variant.make({
      at: (line) => visited.current.push(line),
      log: (m) => setOut((o) => [...o, <span key={o.length} className={m.startsWith("finally") ? "text-accent" : m.startsWith("caught") ? "text-bad" : "text-ink"}>{m}</span>]),
    });
  const gen = useRef<Generator<unknown, unknown, unknown> | null>(null);
  if (gen.current == null) gen.current = make();

  function call(verb: "next" | "throw" | "return", arg: unknown, argLabel: string) {
    visited.current = [];
    const label = `${verb}(${argLabel})`;
    trace.emit("Generator", variant.label, verb === "next" ? "get" : verb === "throw" ? "error" : "cancel", label);
    try {
      const r = gen.current![verb](arg as never);
      const shown = `{ value: ${JSON.stringify(r.value) ?? "undefined"}, done: ${r.done} }`;
      trace.emit("Generator", variant.label, r.done ? "settle" : "set", r.done ? `returned ${shown}` : `yielded ${shown}`);
      setCalls((c) => [...c, { verb: label, result: shown, tone: r.done ? "done" : "ok" }]);
      setState(r.done ? "completed" : "suspended yield");
      setPaused(r.done ? null : visited.current.at(-1) ?? null);
    } catch (e) {
      const m = e instanceof Error ? `Error("${e.message}")` : String(e);
      trace.emit("Generator", variant.label, "error", `${label} threw ${m} out of the generator`);
      setCalls((c) => [...c, { verb: label, result: `throws ${m}`, tone: "bad" }]);
      setState("completed");
      setPaused(null);
    }
    setTrail(visited.current.slice());
  }

  function reset() {
    gen.current = make();
    setState("suspended start");
    setPaused(null);
    setTrail([]);
    setOut([]);
    setCalls([]);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Panel
        title="The generator function"
        right={
          <Tag tone={state === "completed" ? "muted" : state === "suspended yield" ? "accent" : "setter"}>
            {state}
            {paused != null && ` · line ${paused}`}
          </Tag>
        }
      >
        <pre className="overflow-x-auto rounded-lg border border-line bg-bg/60 py-2 font-mono text-[12.5px] leading-relaxed">
          {variant.lines.map((line, i) => {
            const n = i + 1;
            const isPaused = n === paused;
            const ran = trail.includes(n);
            return (
              <div
                key={n}
                className={clsx(
                  "flex gap-3 border-l-2 px-3 transition-colors",
                  isPaused ? "border-accent bg-accent/15" : ran ? "border-getter/60 bg-getter/5" : "border-transparent",
                )}
              >
                <span className="w-4 shrink-0 text-right text-faint select-none">{n}</span>
                <span className={clsx("whitespace-pre", isPaused ? "text-ink" : "text-muted")}>{line}</span>
                {isPaused && <span className="ml-auto pl-3 text-[10px] text-accent">◀ paused</span>}
              </div>
            );
          })}
        </pre>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-faint">
          <span>
            <span className="mr-1 inline-block size-2 rounded-sm bg-getter/60" />
            ran during the last call
          </span>
          <span>
            <span className="mr-1 inline-block size-2 rounded-sm bg-accent" />
            suspended at this yield
          </span>
        </div>
      </Panel>

      <Panel title="The iterator: you drive it" bodyClassName="space-y-3">
        <div className="space-y-2">
          <Row>
            <Button variant="primary" onClick={() => call("next", state === "suspended start" ? undefined : msg, state === "suspended start" ? "" : JSON.stringify(msg))}>
              next({state === "suspended start" ? "" : "message"})
            </Button>
            <input value={msg} onChange={(e) => setMsg(e.target.value)} className="w-32 rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs" disabled={state === "suspended start"} />
            {state === "suspended start" && <span className="text-[11px] text-faint">first call primes it: no yield to receive a value yet</span>}
          </Row>
          <Row>
            <Button variant="danger" onClick={() => call("throw", new Error(err), `new Error(${JSON.stringify(err)})`)}>
              throw(error)
            </Button>
            <input value={err} onChange={(e) => setErr(e.target.value)} className="w-32 rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs" />
          </Row>
          <Row>
            <Button onClick={() => call("return", ret, JSON.stringify(ret))}>return(value)</Button>
            <input value={ret} onChange={(e) => setRet(e.target.value)} className="w-32 rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs" />
            <Button variant="ghost" onClick={reset} className="ml-auto">
              Reset
            </Button>
          </Row>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] tracking-wide text-faint uppercase">Calls and the iterations they returned</div>
          <div className="max-h-40 min-h-16 space-y-1 overflow-auto rounded-lg border border-line bg-bg/60 p-3 font-mono text-xs">
            {calls.length === 0 && <span className="text-faint">Calling the generator function ran nothing. It only built the state machine.</span>}
            {calls.map((c, i) => (
              <div key={i} className="animate-rise">
                <span className="text-getter">iterator.{c.verb}</span>
                <span className="text-faint"> → </span>
                <span className={c.tone === "bad" ? "text-bad" : c.tone === "done" ? "text-accent" : "text-ink"}>{c.result}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] tracking-wide text-faint uppercase">console</div>
          <Console lines={out} empty="No output yet." className="h-32" />
        </div>
      </Panel>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
