"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { StreamBuffer, sleep } from "@/gtor/primitives";
import { Button, Panel, Slider, Stat, useFrame } from "../ui";
import { Lanes, switchSegment, type Segment } from "./Lanes";

type Job = { value: number; startedAt: number; duration: number };
type Run = {
  id: number;
  t0: number;
  buffered: number[];
  jobs: (Job | null)[];
  produced: number;
  consumed: number;
  status: "running" | "cancelled";
  producerState: "producing" | "stalled" | "stopped";
  producer: Segment[];
  workers: Segment[][];
  stallMs: number;
  starveMs: number[];
};

const COLORS = { producing: "bg-setter", stalled: "bg-bad/80", busy: "bg-getter", starving: "bg-faint/60", stopped: "bg-line" };
const LEGEND = { producing: "producing", stalled: "stalled: awaiting ack (back pressure)", busy: "consumer job", starving: "starving: awaiting next()" };

/**
 * A producer writing to a StreamBuffer and a forEach consumer reading from it.
 * The producer awaits each in.yield() acknowledgement; that wait is the
 * back pressure. Rates are live; length and concurrency need a restart.
 */
export function PressureDemo() {
  const [producerRate, setProducerRate] = useState(8);
  const [consumerRate, setConsumerRate] = useState(3);
  const [length, setLength] = useState(2);
  const [concurrency, setConcurrency] = useState(1);
  const rates = useRef({ producerRate, consumerRate });
  rates.current = { producerRate, consumerRate };

  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  const bufRef = useRef<StreamBuffer<number> | null>(null);
  const seq = useRef(0);
  const now = useFrame(run?.status === "running");

  const update = (id: number, fn: (r: Run) => Run) => {
    if (!runRef.current || runRef.current.id !== id) return false;
    runRef.current = fn(runRef.current);
    setRun(runRef.current);
    return true;
  };

  function start() {
    stop(false);
    const id = ++seq.current;
    const t = performance.now();
    const buf = new StreamBuffer<number>(length, "pipe");
    bufRef.current = buf;
    runRef.current = {
      id,
      t0: t,
      buffered: [],
      jobs: Array(concurrency).fill(null),
      produced: 0,
      consumed: 0,
      status: "running",
      producerState: "producing",
      producer: [{ start: t, end: null, kind: "producing" }],
      workers: Array.from({ length: concurrency }, () => [{ start: t, end: null, kind: "starving" }]),
      stallMs: 0,
      starveMs: Array(concurrency).fill(0),
    };
    setRun(runRef.current);

    // Producer: an async loop that respects pressure by awaiting each yield.
    (async () => {
      for (let n = 0; ; n++) {
        await sleep(1000 / rates.current.producerRate);
        if (runRef.current?.id !== id) return;
        const s = performance.now();
        update(id, (r) => ({ ...r, buffered: [...r.buffered, n], produced: r.produced + 1, producerState: "stalled", producer: switchSegment(r.producer, s, "stalled") }));
        try {
          await buf.in.yield(n);
        } catch {
          update(id, (r) => ({ ...r, producerState: "stopped", producer: switchSegment(r.producer, performance.now(), "stopped", "cancelled") }));
          return;
        }
        const e = performance.now();
        if (!update(id, (r) => ({ ...r, producerState: "producing", stallMs: r.stallMs + (e - s), producer: switchSegment(r.producer, e, "producing") }))) return;
      }
    })();

    // Consumer: N workers, each reading next() and running a job.
    for (let w = 0; w < concurrency; w++) {
      (async () => {
        let idleSince = performance.now();
        while (runRef.current?.id === id) {
          const it = await buf.out.next();
          if (it.done || runRef.current?.id !== id) return;
          const startedAt = performance.now();
          const duration = 1000 / rates.current.consumerRate;
          update(id, (r) => ({
            ...r,
            buffered: r.buffered.filter((v) => v !== it.value),
            jobs: r.jobs.map((j, i) => (i === w ? { value: it.value, startedAt, duration } : j)),
            starveMs: r.starveMs.map((m, i) => (i === w ? m + (startedAt - idleSince) : m)),
            workers: r.workers.map((seg, i) => (i === w ? switchSegment(seg, startedAt, "busy", String(it.value)) : seg)),
          }));
          await sleep(duration);
          idleSince = performance.now();
          if (!update(id, (r) => ({
            ...r,
            consumed: r.consumed + 1,
            jobs: r.jobs.map((j, i) => (i === w ? null : j)),
            workers: r.workers.map((seg, i) => (i === w ? switchSegment(seg, idleSince, "starving") : seg)),
          }))) return;
        }
      })();
    }
  }

  function stop(cancel = true) {
    if (cancel && bufRef.current && runRef.current?.status === "running") {
      bufRef.current.out.throw();
      const t = performance.now();
      update(runRef.current.id, (r) => ({
        ...r,
        status: "cancelled",
        workers: r.workers.map((seg) => switchSegment(seg, t, null)),
        producer: r.producerState === "stopped" ? r.producer : switchSegment(r.producer, t, "stopped", "cancelled"),
      }));
      // Freeze the run: workers waiting in next() will never resolve; that's fine.
      const frozen = runRef.current;
      runRef.current = frozen ? { ...frozen, id: -1 } : null;
      return;
    }
    runRef.current = null;
  }

  useEffect(() => () => {
    bufRef.current?.out.throw();
    runRef.current = null;
  }, []);

  const clock = run?.status === "running" ? now || performance.now() : Math.max(...(run?.producer.map((s) => s.end ?? s.start) ?? [0]));
  const elapsed = run ? Math.max(clock - run.t0, 1) : 1;
  const throughput = run ? (run.consumed / elapsed) * 1000 : 0;
  const bottleneck = producerRate > consumerRate * concurrency ? "consumer" : "producer";

  return (
    <Panel
      title="Producer → buffer → consumer"
      right={
        <div className="flex gap-2">
          <Button variant="primary" onClick={start}>{run ? "restart" : "start"}</Button>
          <Button variant="danger" onClick={() => stop(true)} disabled={run?.status !== "running"}>
            out.throw() — cancel
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
        <Slider label="producer" value={producerRate} min={1} max={20} unit="/s" onChange={setProducerRate} />
        <Slider label="consumer job" value={consumerRate} min={1} max={20} unit="/s" onChange={setConsumerRate} />
        <Slider label="Buffer(length)" value={length} min={0} max={8} onChange={setLength} />
        <Slider label="forEach concurrency" value={concurrency} min={1} max={4} onChange={setConcurrency} />
      </div>

      <div className="grid items-stretch gap-3 md:grid-cols-[180px_1fr_220px]">
        <Box
          title="producer · in.yield(n)"
          tone={run?.producerState === "stalled" ? "bad" : run?.producerState === "producing" ? "setter" : "muted"}
        >
          <div className="font-mono text-2xl tabular-nums">{run?.produced ?? 0}</div>
          <div className="mt-1 text-xs text-muted">
            {!run ? "idle" : run.producerState === "stalled" ? "⏸ awaiting ack — pressure" : run.producerState === "producing" ? "▶ producing" : "■ stopped by consumer"}
          </div>
        </Box>

        <div className="flex min-w-0 flex-col rounded-xl border border-line bg-panel-2/40 p-3">
          <div className="mb-2 flex justify-between text-[11px] tracking-wide text-faint uppercase">
            <span>buffer · outbound queue</span>
            <span className="normal-case">{length} unacked writes allowed</span>
          </div>
          <div className="flex min-h-12 flex-1 flex-wrap content-start items-center gap-1.5">
            {Array.from({ length: Math.max(length, run?.buffered.length ?? 0) }, (_, i) => {
              const v = run?.buffered[i];
              return (
                <span
                  key={v ?? `slot${i}`}
                  className={clsx(
                    "flex size-9 items-center justify-center rounded-full border font-mono text-xs",
                    v != null ? "animate-pop border-setter/60 bg-setter/20 text-ink" : "border-dashed border-line text-faint",
                    v != null && i >= length && "border-bad/70 bg-bad/20",
                  )}
                >
                  {v ?? ""}
                </span>
              );
            })}
            {length === 0 && !run?.buffered.length && <span className="text-xs text-faint">length 0: every write waits for a read (a rendezvous)</span>}
          </div>
          <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-faint">
            <span className="text-setter">values →</span>
            <span className="h-px flex-1 bg-line" />
            <span className="text-info">← acks</span>
          </div>
        </div>

        <Box title={`consumer · forEach(job, null, ${concurrency})`} tone={run?.jobs.some(Boolean) ? "getter" : "muted"}>
          <div className="font-mono text-2xl tabular-nums">{run?.consumed ?? 0}</div>
          <div className="mt-2 space-y-1">
            {(run?.jobs ?? Array(concurrency).fill(null)).map((j, i) => {
              const p = j ? Math.min(1, ((now || performance.now()) - j.startedAt) / j.duration) : 0;
              return (
                <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="w-4 text-faint">#{i}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-line">
                    {j && <div className="h-full bg-getter" style={{ width: `${p * 100}%` }} />}
                  </div>
                  <span className={clsx("w-14 text-right", j ? "text-ink" : "text-faint")}>{j ? `job ${j.value}` : "starving"}</span>
                </div>
              );
            })}
          </div>
        </Box>
      </div>

      {run && (
        <div className="mt-4">
          <Lanes
            now={clock}
            t0={run.t0}
            colors={COLORS}
            legend={LEGEND}
            lanes={[{ label: "producer", segments: run.producer }, ...run.workers.map((segments, i) => ({ label: `consumer #${i}`, segments }))]}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="throughput" value={`${throughput.toFixed(1)}/s`} />
        <Stat label="max possible" value={`${Math.min(producerRate, consumerRate * concurrency)}/s`} />
        <Stat label="producer stalled" value={run ? `${Math.round((run.stallMs / elapsed) * 100)}%` : "—"} tone={run && run.stallMs / elapsed > 0.3 ? "bad" : "neutral"} />
        <Stat label="bottleneck" value={bottleneck} />
      </div>
    </Panel>
  );
}

function Box({ title, tone, children }: { title: string; tone: "setter" | "getter" | "bad" | "muted"; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-3 transition-colors",
        tone === "setter" && "border-setter/50 bg-setter/5",
        tone === "getter" && "border-getter/50 bg-getter/5",
        tone === "bad" && "border-bad/50 bg-bad/5",
        tone === "muted" && "border-line bg-panel-2/40",
      )}
    >
      <div className="mb-1 font-mono text-[11px] text-faint">{title}</div>
      {children}
    </div>
  );
}
