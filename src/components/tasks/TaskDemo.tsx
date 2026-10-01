"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { CancelError, Task, sleep } from "@/gtor/primitives";
import { trace } from "@/gtor/trace";
import { Button, Panel, Slider, Tag } from "../ui";

const STEPS = 40;
const STEP_MS = 120;

type Sub = { id: number; status: "waiting" | "received" | "cancelled" | "errored"; value?: string };
type Work = { progress: number; status: "idle" | "running" | "done" | "aborted"; events: number };

export function TaskDemo() {
  const [n, setN] = useState(3);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-panel px-4 py-3">
        <Slider label="Consumers" value={n} min={1} max={4} onChange={setN} />
        <span className="text-xs text-faint">Start both, then cancel consumers one at a time and watch the work.</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TaskSide n={n} />
        <PromiseSide n={n} />
      </div>
      <ObserveTwice />
    </div>
  );
}

function WorkBar({ work, tone }: { work: Work; tone: "time" | "accent" }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2/60 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted">the work (an expensive job upstream)</span>
        <span
          className={clsx(
            "font-mono",
            work.status === "running" && "text-ink",
            work.status === "done" && "text-ok",
            work.status === "aborted" && "text-bad",
            work.status === "idle" && "text-faint",
          )}
        >
          {work.status === "aborted" ? `aborted at ${Math.round(work.progress * 100)}%` : work.status === "done" ? "finished" : work.status === "running" ? `${Math.round(work.progress * 100)}%` : "idle"}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-bg">
        <div
          className={clsx(
            "h-full rounded-full transition-[width] duration-100",
            work.status === "aborted" ? "bg-bad" : tone === "time" ? "bg-time" : "bg-accent",
          )}
          style={{ width: `${work.progress * 100}%` }}
        />
      </div>
    </div>
  );
}

function SubRow({ sub, onCancel, cancelLabel }: { sub: Sub; onCancel: () => void; cancelLabel: string }) {
  return (
    <div className="flex animate-rise items-center justify-between gap-2 rounded-lg border border-line bg-panel-2/60 px-3 py-2">
      <span className="text-sm">consumer #{sub.id}</span>
      <span className="flex items-center gap-2">
        <span
          className={clsx(
            "font-mono text-xs",
            sub.status === "waiting" && "text-faint",
            sub.status === "received" && "text-getter",
            sub.status === "cancelled" && "text-bad",
            sub.status === "errored" && "text-warn",
          )}
        >
          {sub.status === "waiting" ? "waiting…" : sub.status === "received" ? sub.value : sub.status === "cancelled" ? "cancelled" : sub.value}
        </span>
        {sub.status === "waiting" && (
          <Button variant="danger" className="!px-2 !py-0.5 !text-xs" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
      </span>
    </div>
  );
}

function TaskSide({ n }: { n: number }) {
  const [work, setWork] = useState<Work>({ progress: 0, status: "idle", events: 0 });
  const [subs, setSubs] = useState<Sub[]>([]);
  const forks = useRef<Task<string>[]>([]);
  const gen = useRef(0);

  function start() {
    const g = ++gen.current;
    setWork({ progress: 0, status: "running", events: 0 });
    const root = new Task<string>((resolver, signal) => {
      (async () => {
        try {
          for (let i = 1; i <= STEPS; i++) {
            await sleep(STEP_MS, signal);
            if (g === gen.current) setWork((w) => ({ ...w, progress: i / STEPS }));
          }
          resolver.return("🎁 result");
          if (g === gen.current) setWork((w) => ({ ...w, status: "done" }));
        } catch {
          trace.emit("Task", "work", "cancel", "AbortSignal fired — work stopped");
          if (g === gen.current) setWork((w) => ({ ...w, status: "aborted" }));
        }
      })();
    }, "work");
    forks.current = Array.from({ length: n }, (_, i) => root.fork(`consumer #${i + 1}`));
    setSubs(forks.current.map((_, i) => ({ id: i + 1, status: "waiting" })));
    forks.current.forEach((f, i) =>
      f.done(
        (value) => g === gen.current && setSubs((s) => s.map((x, j) => (j === i ? { ...x, status: "received", value } : x))),
        (e) =>
          g === gen.current &&
          setSubs((s) =>
            s.map((x, j) => (j === i && x.status === "waiting" ? { ...x, status: e instanceof CancelError && e.message === "cancelled" ? "cancelled" : "errored", value: e instanceof Error ? e.message : String(e) } : x)),
          ),
      ),
    );
  }

  const alive = subs.filter((s) => s.status === "waiting").length;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Task <Tag tone="accent">unicast</Tag> <Tag tone="ok">cancelable</Tag>
        </span>
      }
      right={
        <Button variant="primary" onClick={start} disabled={work.status === "running"}>
          Start task
        </Button>
      }
    >
      <div className="space-y-3">
        <WorkBar work={work} tone="accent" />
        <div className="font-mono text-[11px] text-faint">
          {subs.length > 0 ? `${alive} of ${subs.length} forks still interested` : `task.fork() × ${n}`}
        </div>
        {subs.map((s, i) => (
          <SubRow key={s.id} sub={s} cancelLabel="fork.cancel()" onCancel={() => forks.current[i]?.cancel()} />
        ))}
        <p className="text-xs leading-relaxed text-faint">
          Each consumer holds its own fork. Cancelling one fork only unsubscribes that consumer. When the last fork is
          cancelled no one can ever observe the result, so the task aborts the work upstream.
        </p>
      </div>
    </Panel>
  );
}

function PromiseSide({ n }: { n: number }) {
  const [work, setWork] = useState<Work>({ progress: 0, status: "idle", events: 0 });
  const [subs, setSubs] = useState<Sub[]>([]);
  const gen = useRef(0);
  const ignored = useRef<Set<number>>(new Set());

  function start() {
    const g = ++gen.current;
    ignored.current = new Set();
    setWork({ progress: 0, status: "running", events: 0 });
    trace.emit("Promise", "work", "set", "new Promise(work) — no way to stop it");
    const promise = (async () => {
      for (let i = 1; i <= STEPS; i++) {
        await sleep(STEP_MS);
        if (g === gen.current) setWork((w) => ({ ...w, progress: i / STEPS }));
      }
      if (g === gen.current) setWork((w) => ({ ...w, status: "done" }));
      trace.emit("Promise", "work", "settle", `finished — ${n - ignored.current.size} consumer(s) still listening`);
      return "🎁 result";
    })();
    setSubs(Array.from({ length: n }, (_, i) => ({ id: i + 1, status: "waiting" })));
    for (let i = 0; i < n; i++) {
      trace.emit("Promise", "work", "get", `then(consumer #${i + 1})`);
      promise.then((value) => {
        if (g !== gen.current || ignored.current.has(i)) return;
        setSubs((s) => s.map((x, j) => (j === i ? { ...x, status: "received", value } : x)));
      });
    }
  }

  function ignore(i: number) {
    ignored.current.add(i);
    trace.emit("Promise", `consumer #${i + 1}`, "cancel", "stops caring — but the work keeps running");
    setSubs((s) => s.map((x, j) => (j === i ? { ...x, status: "cancelled" } : x)));
  }

  const alive = subs.filter((s) => s.status === "waiting").length;

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          Promise <Tag tone="time">broadcast</Tag> <Tag tone="bad">not cancelable</Tag>
        </span>
      }
      right={
        <Button variant="primary" onClick={start} disabled={work.status === "running"}>
          Start promise
        </Button>
      }
    >
      <div className="space-y-3">
        <WorkBar work={work} tone="time" />
        <div className="font-mono text-[11px] text-faint">
          {subs.length > 0 ? `${alive} of ${subs.length} consumers still interested` : `promise.then() × ${n}`}
        </div>
        {subs.map((s, i) => (
          <SubRow key={s.id} sub={s} cancelLabel="ignore result" onCancel={() => ignore(i)} />
        ))}
        {work.status === "done" && subs.length > 0 && alive === 0 && (
          <p className="animate-rise rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
            The work ran to completion for nobody. A promise represents a result, not the work leading to it.
          </p>
        )}
        <p className="text-xs leading-relaxed text-faint">
          A consumer can stop listening, but it can&apos;t stop the producer: other consumers might depend on the same
          result, and no consumer may interfere with another.
        </p>
      </div>
    </Panel>
  );
}

function ObserveTwice() {
  const [log, setLog] = useState<{ ok: boolean; text: string }[]>([]);

  function tryIt(fork: boolean) {
    const task = new Task<number>((r) => {
      setTimeout(() => r.return(42), 300);
    }, fork ? "shared (forked)" : "shared");
    const lines: { ok: boolean; text: string }[] = [];
    const observe = (t: Task<number>, who: string) => {
      try {
        t.done((v) => setLog((l) => [...l, { ok: true, text: `${who} received ${v}` }]));
        lines.push({ ok: true, text: `${who}: ${fork ? "task.fork()" : "task"}.done(…) subscribed` });
      } catch (e) {
        lines.push({ ok: false, text: `${who}: ${(e as Error).message}` });
      }
    };
    observe(fork ? task.fork("first") : task, "first");
    observe(fork ? task.fork("second") : task, "second");
    setLog(lines);
  }

  return (
    <Panel
      title="Unicast: a task has exactly one observer"
      right={
        <div className="flex gap-2">
          <Button onClick={() => tryIt(false)}>Observe the same task twice</Button>
          <Button onClick={() => tryIt(true)}>Fork, then observe each</Button>
        </div>
      }
    >
      <div className="space-y-1 font-mono text-xs">
        {log.length === 0 && <span className="text-faint">A task refuses a second subscriber: sharing must be explicit, via fork().</span>}
        {log.map((l, i) => (
          <div key={i} className={clsx("animate-rise", l.ok ? "text-getter" : "text-bad")}>
            {l.ok ? "✓" : "✕"} {l.text}
          </div>
        ))}
      </div>
    </Panel>
  );
}
