"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { PromiseQueue, sleep } from "@/gtor/primitives";
import { Button, Panel, Stat, useFrame } from "../ui";

type Worker = {
  id: number;
  state: "waiting" | "working" | "done";
  db?: string;
  requestedAt: number;
  startedAt?: number;
  duration: number;
  endedAt?: number;
};

const POOL = ["db1", "db2", "db3"];
const POOL_COLOR: Record<string, string> = { db1: "bg-f1", db2: "bg-f2", db3: "bg-f4" };

/** A promise queue used as a non-blocking semaphore over three connections. */
export function SemaphoreDemo() {
  const connections = useRef<PromiseQueue<string> | null>(null);
  const seq = useRef(0);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [idle, setIdle] = useState<string[]>(POOL);
  const [auto, setAuto] = useState(false);
  const busy = workers.some((w) => w.state !== "done");
  const now = useFrame(busy);

  function pool() {
    if (!connections.current) {
      connections.current = new PromiseQueue<string>("connections");
      for (const db of POOL) connections.current.put(db);
    }
    return connections.current;
  }

  const patch = (id: number, p: Partial<Worker>) => setWorkers((ws) => ws.map((w) => (w.id === id ? { ...w, ...p } : w)));

  function work() {
    const id = ++seq.current;
    const duration = 900 + Math.round(Math.random() * 1600);
    const q = pool();
    setWorkers((ws) => [...ws.filter((w) => w.state !== "done" || performance.now() - (w.endedAt ?? 0) < 4000).slice(-14), { id, state: "waiting", requestedAt: performance.now(), duration }]);
    // connections.get().then(db => workWithDb(db).finally(() => connections.put(db)))
    return q.get().then((db) => {
      if (q !== connections.current) return;
      setIdle((i) => i.filter((d) => d !== db));
      patch(id, { state: "working", db, startedAt: performance.now() });
      return sleep(duration).finally(() => {
        if (q !== connections.current) return;
        patch(id, { state: "done", endedAt: performance.now() });
        setIdle((i) => [...i, db]);
        q.put(db);
      });
    });
  }

  const workRef = useRef(work);
  workRef.current = work;
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => workRef.current(), 550);
    return () => clearInterval(t);
  }, [auto]);

  function reset() {
    setAuto(false);
    connections.current = null;
    setWorkers([]);
    setIdle(POOL);
  }

  const waiting = workers.filter((w) => w.state === "waiting");
  const working = workers.filter((w) => w.state === "working");
  const done = workers.filter((w) => w.state === "done");

  return (
    <Panel
      title="A non-blocking semaphore: three connections in a queue"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={work}>work()</Button>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[var(--color-accent)]" />
            auto (every 550ms)
          </label>
          <Button variant="ghost" onClick={reset}>reset</Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_220px_1fr]">
        <Column title={`waiting on connections.get() · ${waiting.length}`}>
          {waiting.map((w) => (
            <div key={w.id} className="flex animate-rise items-center justify-between rounded-lg border border-dashed border-getter/50 px-3 py-1.5 font-mono text-xs">
              <span>worker {w.id}</span>
              <span className="text-faint">{Math.round((now || performance.now()) - w.requestedAt)}ms</span>
            </div>
          ))}
          {waiting.length === 0 && <Empty>No one is waiting. Nothing blocks: waiters hold promises.</Empty>}
        </Column>

        <div className="flex flex-col items-center rounded-xl border border-line bg-panel-2/40 p-3">
          <div className="mb-2 text-[11px] tracking-wide text-faint uppercase">pool (the queue)</div>
          <div className="flex gap-2">
            {POOL.map((db) => {
              const free = idle.includes(db);
              return (
                <div
                  key={db}
                  className={clsx(
                    "flex size-14 flex-col items-center justify-center rounded-lg border font-mono text-xs transition",
                    free ? "border-ok/50 bg-ok/10 text-ok" : "border-line text-faint opacity-50",
                  )}
                >
                  <span className={clsx("mb-1 size-2 rounded-full", POOL_COLOR[db])} />
                  {db}
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-center text-xs text-muted">
            {idle.length} free · {3 - idle.length} in use
          </div>
        </div>

        <Column title={`holding a connection · ${working.length}`}>
          {working.map((w) => {
            const p = Math.min(1, ((now || performance.now()) - (w.startedAt ?? 0)) / w.duration);
            return (
              <div key={w.id} className="animate-rise rounded-lg border border-line bg-panel-2/60 px-3 py-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span>worker {w.id}</span>
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className={clsx("size-2 rounded-full", POOL_COLOR[w.db!])} />
                    {w.db}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded bg-line">
                  <div className={clsx("h-full", POOL_COLOR[w.db!])} style={{ width: `${p * 100}%` }} />
                </div>
              </div>
            );
          })}
          {working.length === 0 && <Empty>All connections idle.</Empty>}
          {done.length > 0 && (
            <div className="mt-2 font-mono text-[11px] text-faint">
              finally → put(db): {done.slice(-6).map((w) => `w${w.id}`).join(", ")}
            </div>
          )}
        </Column>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="waiting" value={waiting.length} tone={waiting.length > 3 ? "bad" : "neutral"} />
        <Stat label="working" value={`${working.length} / 3`} />
        <Stat label="completed" value={seq.current - waiting.length - working.length} tone="good" />
      </div>
    </Panel>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-[11px] tracking-wide text-faint uppercase">{title}</div>
      <div className="flex max-h-64 flex-col gap-1.5 overflow-auto">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-xs text-faint">{children}</p>;
}
