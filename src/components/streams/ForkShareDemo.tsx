"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { StreamBuffer, sleep } from "@/gtor/primitives";
import { Button, Panel, Slider, Stat, useFrame } from "../ui";

type Mode = "share" | "fork";
type Lane = { name: "slow" | "fast"; ms: number; seen: number[]; count: number; busy: number | null };
type Run = { id: number; mode: Mode; t0: number; produced: number; lanes: Lane[]; stoppedAt: number | null };

const COLOR = { slow: "bg-f4/25 border-f4/60", fast: "bg-f1/25 border-f1/60" };

/**
 * One source stream, two consumers: a slow map (200ms per value) and a fast
 * map (100ms). Sharing the reader round-robins values; forking copies every
 * value to both branches, so the slowest branch sets the pressure.
 */
export function ForkShareDemo() {
  const [mode, setMode] = useState<Mode>("share");
  const [sourceRate, setSourceRate] = useState(30);
  const rate = useRef(sourceRate);
  rate.current = sourceRate;
  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  const seq = useRef(0);
  const now = useFrame(run != null && run.stoppedAt == null);

  const update = (id: number, fn: (r: Run) => Run) => {
    if (runRef.current?.id !== id) return false;
    runRef.current = fn(runRef.current);
    setRun(runRef.current);
    return true;
  };
  const lane = (r: Run, name: string, fn: (l: Lane) => Lane) => ({ ...r, lanes: r.lanes.map((l) => (l.name === name ? fn(l) : l)) });

  function start(m: Mode = mode) {
    const id = ++seq.current;
    const source = new StreamBuffer<number>(0, "source");
    runRef.current = {
      id,
      mode: m,
      t0: performance.now(),
      produced: 0,
      stoppedAt: null,
      lanes: [
        { name: "slow", ms: 200, seen: [], count: 0, busy: null },
        { name: "fast", ms: 100, seen: [], count: 0, busy: null },
      ],
    };
    setRun(runRef.current);

    (async () => {
      for (let n = 0; runRef.current?.id === id; n++) {
        await sleep(1000 / rate.current);
        try {
          await source.in.yield(n);
        } catch {
          return;
        }
        update(id, (r) => ({ ...r, produced: r.produced + 1 }));
      }
      source.out.throw();
    })();

    const consume = async (reader: StreamBuffer<number>, l: Lane) => {
      while (runRef.current?.id === id) {
        const it = await reader.out.next();
        if (it.done) return;
        update(id, (r) => lane(r, l.name, (x) => ({ ...x, busy: it.value })));
        // map(n => Promise.return(n).delay(ms))
        await sleep(l.ms);
        update(id, (r) => lane(r, l.name, (x) => ({ ...x, busy: null, count: x.count + 1, seen: [...x.seen.slice(-23), it.value] })));
      }
    };

    const [slow, fast] = runRef.current.lanes;
    if (m === "share") {
      consume(source, slow);
      consume(source, fast);
    } else {
      const a = new StreamBuffer<number>(0, "fork:slow");
      const b = new StreamBuffer<number>(0, "fork:fast");
      (async () => {
        while (runRef.current?.id === id) {
          const it = await source.out.next();
          if (it.done) return;
          // Every value goes to each branch; wait for both acks before reading on.
          await Promise.all([a.in.yield(it.value), b.in.yield(it.value)]);
        }
      })();
      consume(a, slow);
      consume(b, fast);
    }
  }

  function stop() {
    if (!runRef.current) return;
    const r = { ...runRef.current, id: -1, stoppedAt: performance.now() };
    runRef.current = r;
    setRun(r);
  }

  useEffect(() => () => void (runRef.current = null), []);

  const clock = run?.stoppedAt ?? (now || performance.now());
  const secs = run ? Math.max((clock - run.t0) / 1000, 0.001) : 1;
  const total = run ? run.lanes.reduce((a, l) => a + l.count, 0) : 0;

  return (
    <Panel
      title="Fork vs share: one stream, a slow map and a fast map"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            {(["share", "fork"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  if (run && run.stoppedAt == null) start(m);
                }}
                className={clsx("rounded-md px-3 py-1", mode === m ? "bg-panel-2 text-ink" : "text-muted hover:text-ink")}
              >
                {m === "share" ? "shared reader" : "fork()"}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={() => start()}>{run && run.stoppedAt == null ? "restart" : "start"}</Button>
          <Button onClick={stop} disabled={!run || run.stoppedAt != null}>stop</Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-6">
        <Slider label="source can produce" value={sourceRate} min={2} max={40} unit="/s" onChange={setSourceRate} />
        <p className="text-xs text-faint">
          {mode === "share"
            ? "Both maps call next() on the same reader: each value goes to whichever consumer asks first."
            : "A fork reads once and writes to both branches, waiting for both acks."}
        </p>
      </div>

      <div className="space-y-3">
        {(run?.lanes ?? [
          { name: "slow" as const, ms: 200, seen: [], count: 0, busy: null },
          { name: "fast" as const, ms: 100, seen: [], count: 0, busy: null },
        ]).map((l) => (
          <div key={l.name} className="grid grid-cols-[120px_1fr_90px] items-center gap-3">
            <div className="font-mono text-xs">
              <div className="text-ink">{l.name} map</div>
              <div className="text-faint">delay({l.ms})</div>
            </div>
            <div className="flex h-9 items-center gap-1 overflow-hidden rounded-lg bg-panel-2/40 px-2">
              {l.seen.map((v) => (
                <span key={v} className={clsx("flex size-6 shrink-0 animate-pop items-center justify-center rounded-full border font-mono text-[10px]", COLOR[l.name])}>
                  {v}
                </span>
              ))}
              {l.busy != null && (
                <span className="flex size-6 shrink-0 animate-pulse items-center justify-center rounded-full border border-dashed border-ink/40 font-mono text-[10px]">{l.busy}</span>
              )}
            </div>
            <div className="text-right font-mono text-xs tabular-nums">
              <div className="text-ink">{l.count} seen</div>
              <div className="text-faint">{(l.count / secs).toFixed(1)}/s</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="source produced" value={run?.produced ?? 0} />
        <Stat label="total throughput" value={`${(total / secs).toFixed(1)}/s`} />
        <Stat
          label="fast : slow"
          value={run && run.lanes[0].count ? `${(run.lanes[1].count / run.lanes[0].count).toFixed(2)} : 1` : "—"}
        />
        <Stat label="expected" value={mode === "share" ? `≤ 15/s, 2 : 1` : "5/s each, 1 : 1"} />
      </div>
    </Panel>
  );
}
