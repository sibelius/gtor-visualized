"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { defer, sleep } from "@/gtor/primitives";
import { trace } from "@/gtor/trace";
import { Button, Panel, Tag, useFrame } from "../ui";

// The generator version and the async/await version, line for line.
const GEN_LINES = [
  "var authenticate = Promise.async(function *() {",
  "  var username = yield getUsernameFromConsole();",
  "  var user = getUserFromDatabase(username);",
  "  var password = getPasswordFromConsole();",
  "  [user, password] = yield Promise.all([user, password]);",
  "  if (hash(password) !== user.passwordHash) {",
  '    throw new Error("password is invalid");',
  "  }",
  "  return user.name;",
  "});",
];
const AWAIT_LINES = [
  "var authenticate = async function () {",
  "  var username = await getUsernameFromConsole();",
  "  var user = getUserFromDatabase(username);",
  "  var password = getPasswordFromConsole();",
  "  [user, password] = await Promise.all([user, password]);",
  "  if (hash(password) !== user.passwordHash) {",
  '    throw new Error("password is invalid");',
  "  }",
  "  return user.name;",
  "};",
];

type Op = { id: number; name: string; start: number; ms: number; status: "pending" | "fulfilled" | "rejected"; value?: string };
type Step = { verb: "next" | "throw" | "start"; text: string; tone: "getter" | "setter" | "bad" | "accent" | "muted" };
type Outer = { status: "idle" | "pending" | "fulfilled" | "rejected"; value?: string };

const hash = (s: string) => `#${[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16)}`;
const fmt = (v: unknown) => (v instanceof Error ? `Error("${v.message}")` : v instanceof Promise ? "Promise {pending}" : JSON.stringify(v));

export function TrampolineDemo() {
  const [mode, setMode] = useState<"step" | "auto">("step");
  const [wrongPassword, setWrongPassword] = useState(false);
  const [dbFails, setDbFails] = useState(false);
  const [line, setLine] = useState<number | null>(null);
  const [executed, setExecuted] = useState<Set<number>>(new Set());
  const [ops, setOps] = useState<Op[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [outer, setOuter] = useState<Outer>({ status: "idle" });
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const gate = useRef<(() => void) | null>(null);
  const modeRef = useRef(mode);
  const gen = useRef(0);
  const opSeq = useRef(0);
  const now = useFrame(running);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modeRef.current = mode;
    if (mode === "auto") gate.current?.();
  }, [mode]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [steps.length]);

  async function run() {
    const g = ++gen.current;
    const alive = () => g === gen.current;
    setLine(null);
    setExecuted(new Set());
    setOps([]);
    setSteps([]);
    setRunning(true);
    setOuter({ status: "pending" });

    const log = (s: Step) => alive() && setSteps((ss) => [...ss, s]);
    const at = (n: number) => {
      if (!alive()) return;
      setLine(n);
      setExecuted((e) => new Set(e).add(n));
    };
    // Each pending operation is a real timer-backed promise.
    const op = (name: string, ms: number, value: unknown, fail?: string) => {
      const id = ++opSeq.current;
      setOps((os) => [...os, { id, name, start: performance.now(), ms, status: "pending" }]);
      trace.emit("Promise", name, "get", `started (${ms}ms)`);
      return sleep(ms).then(() => {
        if (fail) {
          trace.emit("Promise", name, "error", `rejected ${fail}`);
          if (alive()) setOps((os) => os.map((o) => (o.id === id ? { ...o, status: "rejected", value: fail } : o)));
          throw new Error(fail);
        }
        trace.emit("Promise", name, "settle", `fulfilled ${fmt(value)}`);
        if (alive()) setOps((os) => os.map((o) => (o.id === id ? { ...o, status: "fulfilled", value: fmt(value) } : o)));
        return value;
      });
    };
    const wait = async (label: string) => {
      if (!alive()) throw new Error("stale");
      setWaitingFor(label);
      if (modeRef.current === "auto") await sleep(500);
      else await new Promise<void>((r) => (gate.current = r));
      gate.current = null;
      if (!alive()) throw new Error("stale");
      setWaitingFor(null);
    };

    const realPassword = "correct horse";
    const typed = wrongPassword ? "hunter2" : realPassword;
    const fails = dbFails;

    // The generator function, instrumented with line markers.
    function* authenticate(): Generator<unknown, string, unknown> {
      at(1);
      const username = (yield op("getUsernameFromConsole()", 900, "ada")) as string;
      at(2);
      const userP = op("getUserFromDatabase()", 1400, { name: "Ada Lovelace", passwordHash: hash(realPassword) }, fails ? "database is down" : undefined);
      void username;
      at(3);
      const passwordP = op("getPasswordFromConsole()", 1000, typed);
      at(4);
      const [user, password] = (yield Promise.all([userP, passwordP])) as [{ name: string; passwordHash: string }, string];
      at(5);
      if (hash(password) !== user.passwordHash) {
        at(6);
        throw new Error("password is invalid");
      }
      at(8);
      return user.name;
    }

    // Mark Miller's trampoline, with a pause before each resume so you can step it.
    const result = defer<string>("authenticate()");
    trace.emit("Async", "authenticate", "get", "authenticate() → returns outer promise immediately");
    const generator = authenticate();
    const resume = async (verb: "next" | "throw", argument?: unknown) => {
      try {
        await wait(`resume("${verb}", ${argument === undefined ? "undefined" : fmt(argument)})`);
      } catch {
        return;
      }
      log({ verb, text: `generator.${verb}(${argument === undefined ? "" : fmt(argument)})`, tone: verb === "throw" ? "bad" : "setter" });
      trace.emit("Async", "authenticate", verb === "throw" ? "error" : "set", `generator.${verb}(${argument === undefined ? "" : fmt(argument)})`);
      let it: IteratorResult<unknown, string>;
      try {
        it = verb === "next" ? generator.next(argument) : generator.throw(argument);
      } catch (exception) {
        log({ verb, text: `  ⤷ threw ${fmt(exception)} → outer promise rejects`, tone: "bad" });
        result.resolver.throw(exception);
        return;
      }
      if (it.done) {
        log({ verb, text: `  ⤷ {value: ${fmt(it.value)}, done: true} → outer promise fulfills`, tone: "getter" });
        result.resolver.return(it.value);
        return;
      }
      log({ verb, text: `  ⤷ {value: Promise, done: false} — trampoline waits on it`, tone: "muted" });
      Promise.resolve(it.value).then(
        (v) => {
          log({ verb: "next", text: `yielded promise fulfilled with ${fmt(v)}`, tone: "accent" });
          resume("next", v);
        },
        (e) => {
          log({ verb: "throw", text: `yielded promise rejected with ${fmt(e)}`, tone: "bad" });
          resume("throw", e);
        },
      );
    };
    log({ verb: "start", text: "authenticate() → outer promise (pending)", tone: "muted" });
    resume("next");

    result.promise.then(
      (v) => alive() && setOuter({ status: "fulfilled", value: fmt(v) }),
      (e) => alive() && setOuter({ status: "rejected", value: fmt(e) }),
    ).finally(() => {
      if (!alive()) return;
      setRunning(false);
      setWaitingFor(null);
    });
  }

  function reset() {
    gen.current++;
    gate.current?.();
    setLine(null);
    setExecuted(new Set());
    setOps([]);
    setSteps([]);
    setOuter({ status: "idle" });
    setWaitingFor(null);
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
        <div className="flex overflow-hidden rounded-lg border border-line">
          {(["step", "auto"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={clsx("px-3 py-1 text-xs", mode === m ? "bg-panel-2 text-ink" : "text-muted hover:text-ink")}
            >
              {m === "step" ? "Step through" : "Run freely"}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-muted">
          <input type="checkbox" checked={wrongPassword} onChange={(e) => setWrongPassword(e.target.checked)} disabled={running} className="accent-[var(--color-bad)]" />
          type the wrong password
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-muted">
          <input type="checkbox" checked={dbFails} onChange={(e) => setDbFails(e.target.checked)} disabled={running} className="accent-[var(--color-bad)]" />
          database rejects
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="primary" onClick={run} disabled={running}>
            Call authenticate()
          </Button>
          {mode === "step" && (
            <Button onClick={() => gate.current?.()} disabled={!waitingFor}>
              Step ▸
            </Button>
          )}
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CodePane title="Generator + promise trampoline" lines={GEN_LINES} line={line} executed={executed} keyword="yield" running={running} />
        <CodePane title="The same function with async / await" lines={AWAIT_LINES} line={line} executed={executed} keyword="await" running={running} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel
          title="Trampoline"
          right={
            waitingFor ? (
              <span className="font-mono text-[11px] text-accent">next: {waitingFor}</span>
            ) : (
              <span className="font-mono text-[11px] text-faint">{running ? "waiting on a yielded promise…" : "idle"}</span>
            )
          }
        >
          <div ref={logRef} className="h-56 overflow-auto font-mono text-xs leading-relaxed">
            {steps.length === 0 && <span className="text-faint">Call authenticate(). Each resume of the generator is one step.</span>}
            {steps.map((s, i) => (
              <div
                key={i}
                className={clsx(
                  "animate-rise",
                  s.tone === "getter" && "text-getter",
                  s.tone === "setter" && "text-setter",
                  s.tone === "bad" && "text-bad",
                  s.tone === "accent" && "text-accent",
                  s.tone === "muted" && "text-muted",
                )}
              >
                {s.text}
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Pending promises">
            <div className="space-y-2">
              {ops.length === 0 && <span className="text-xs text-faint">Nothing in flight.</span>}
              {ops.map((o) => {
                const p = o.status === "pending" ? Math.min((now - o.start) / o.ms, 1) : 1;
                return (
                  <div key={o.id} className="animate-rise">
                    <div className="mb-1 flex justify-between font-mono text-[11px]">
                      <span className="text-ink">{o.name}</span>
                      <span className={clsx(o.status === "pending" && "text-faint", o.status === "fulfilled" && "text-time", o.status === "rejected" && "text-bad")}>
                        {o.status === "pending" ? "pending" : o.value}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                      <div className={clsx("h-full rounded-full", o.status === "rejected" ? "bg-bad" : "bg-time")} style={{ width: `${Math.max(p, 0) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel title="The outer promise">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-muted">authenticate()</span>
              <span
                key={outer.status}
                className={clsx(
                  "animate-pop rounded-md border px-2 py-1 font-mono text-xs",
                  outer.status === "idle" && "border-line text-faint",
                  outer.status === "pending" && "border-dashed border-time text-time",
                  outer.status === "fulfilled" && "border-getter/60 bg-getter/10 text-getter",
                  outer.status === "rejected" && "border-bad/60 bg-bad/10 text-bad",
                )}
              >
                {outer.status === "idle" ? "not called" : outer.status === "pending" ? "pending" : `${outer.status} ${outer.value}`}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-faint">
              Returned synchronously the moment you call the function. The trampoline forwards the generator&apos;s{" "}
              <code className="font-mono">return</code> to its resolver, and any uncaught <code className="font-mono">throw</code> to its
              rejection.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CodePane({
  title,
  lines,
  line,
  executed,
  keyword,
  running,
}: {
  title: string;
  lines: string[];
  line: number | null;
  executed: Set<number>;
  keyword: string;
  running: boolean;
}) {
  return (
    <Panel title={title} right={<Tag tone={keyword === "yield" ? "setter" : "time"}>{keyword}</Tag>} bodyClassName="!p-0">
      <pre className="overflow-x-auto py-3 font-mono text-[12.5px] leading-relaxed">
        {lines.map((l, i) => {
          const active = line === i;
          return (
            <div
              key={i}
              className={clsx(
                "flex gap-3 border-l-2 px-3 transition-colors",
                active ? (running ? "border-accent bg-accent/10" : "border-getter bg-getter/5") : "border-transparent",
                !active && executed.has(i) && "text-muted",
                !active && !executed.has(i) && "text-ink/80",
              )}
            >
              <span className="w-4 shrink-0 text-right text-faint select-none">{i + 1}</span>
              <span>{highlight(l, keyword)}</span>
            </div>
          );
        })}
      </pre>
    </Panel>
  );
}

function highlight(l: string, keyword: string) {
  const parts = l.split(new RegExp(`(\\b${keyword}\\b)`));
  return parts.map((p, i) =>
    p === keyword ? (
      <span key={i} className={keyword === "yield" ? "font-semibold text-setter" : "font-semibold text-time"}>
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
