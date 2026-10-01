"use client";

import { useEffect, useRef, useState } from "react";
import { Behavior, Signal, StreamBuffer, sleep } from "@/gtor/primitives";
import { Button, Panel, Slider, Stat, useFrame } from "../ui";
import { Legend } from "../behaviors/ThermometerDemo";

type Update = { index: number; length: number; elapsed: number; estimate: number; at: number };
type Run = {
  start: number;
  length: number;
  updates: Update[];
  samples: { t: number; v: number }[];
  done: number | null;
};

const W = 720;
const H = 180;

/**
 * Copies a stream of N values into an array. Each arrival pushes a discrete
 * progress update on a signal; a behavior extrapolates continuous progress
 * from the latest estimate, sampled on every animation frame.
 */
export function ProgressDemo() {
  const [length, setLength] = useState(60);
  const [unevenness, setUnevenness] = useState(60);
  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  const abort = useRef<AbortController | null>(null);
  const running = run != null && run.done == null;
  const now = useFrame(running);

  // Continuous progress: a function of time, given the last known estimate.
  const [behavior] = useState(
    () =>
      new Behavior((t) => {
        const r = runRef.current;
        const last = r?.updates.at(-1);
        if (!r || !last) return 0;
        if (r.done != null) return 1;
        return Math.min(1, Math.max(0, (t - r.start) / (last.estimate - r.start)));
      }, "progress", true),
  );

  // Sample the behavior once per frame while running.
  useEffect(() => {
    const r = runRef.current;
    if (!r || !running || now === 0) return;
    r.samples.push({ t: now, v: behavior.get(now) });
  }, [now, running, behavior]);

  useEffect(() => () => abort.current?.abort(), []);

  async function start() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const signal = new Signal<Update>("progress");
    const stream = new StreamBuffer<number>(4, "download");
    const r: Run = { start: performance.now(), length, updates: [], samples: [], done: null };
    runRef.current = r;
    setRun({ ...r });

    signal.out.forEach((u) => {
      if (runRef.current !== r) return;
      r.updates.push(u);
      setRun({ ...r });
    });

    // Producer: uneven arrival. A slow patch in the middle, and jitter throughout.
    const base = 5000 / length;
    const u = unevenness / 100;
    void (async () => {
      try {
        for (let i = 0; i < length; i++) {
          const slowPatch = i > length * 0.45 && i < length * 0.65 ? 1 + 3 * u : 1;
          const jitter = 1 + u * (Math.random() * 1.6 - 0.8);
          await sleep(base * slowPatch * jitter * (1 - 0.5 * u), controller.signal);
          await stream.in.yield(i);
        }
        await stream.in.return();
      } catch (error) {
        // Restarted: terminate the old stream so its consumer stops too.
        void stream.in.throw(error).catch(() => {});
      }
    })();

    // Consumer: copy into an array, pushing a progress update per value.
    const array: number[] = [];
    try {
      await stream.forEach((value) => {
      array.push(value);
      const at = performance.now();
      const index = array.length;
      const elapsed = at - r.start;
      signal.in.yield({ index, length, elapsed, estimate: r.start + (elapsed * length) / index, at });
      });
    } catch {
      return;
    }
    if (runRef.current !== r) return;
    r.done = performance.now();
    setRun({ ...r });
  }

  const r = run;
  const last = r?.updates.at(-1);
  const clock = r ? (r.done ?? (now || r.start)) : 0;
  const elapsed = r ? clock - r.start : 0;
  const discrete = last ? last.index / last.length : 0;
  const continuous = r ? (r.done != null ? 1 : (r.samples.at(-1)?.v ?? 0)) : 0;
  const throughput = last ? (last.index / last.elapsed) * 1000 : 0;
  const remaining = last && r?.done == null ? Math.max(0, last.estimate - clock) : 0;

  // Chart scale: fit the elapsed time and the furthest estimate seen so far.
  const span = r ? Math.max(elapsed, ...r.updates.map((u) => u.estimate - r.start), 1000) * 1.05 : 1;
  const x = (t: number) => (t / span) * W;
  const y = (v: number) => H - v * (H - 10);

  let steps = "";
  if (r) {
    steps = `M0,${y(0)}`;
    for (const u of r.updates) steps += ` H${x(u.at - r.start).toFixed(1)} V${y(u.index / u.length).toFixed(1)}`;
    steps += ` H${x(elapsed).toFixed(1)}`;
  }
  const smooth = r ? r.samples.map((s, i) => `${i === 0 ? "M" : "L"}${x(s.t - r.start).toFixed(1)},${y(s.v).toFixed(1)}`).join(" ") : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-panel px-4 py-3">
        <Slider label="values" value={length} min={20} max={150} step={10} onChange={setLength} />
        <Slider label="unevenness" value={unevenness} min={0} max={100} step={5} unit="%" onChange={setUnevenness} />
        <Button variant="primary" onClick={start}>
          {r ? "Copy again" : "Copy stream → array"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Two progress bars, one stream">
          <Bar
            label="discrete · pushed by a signal on each value"
            value={discrete}
            color="var(--color-time)"
            note={last ? `${last.index} / ${last.length}` : "—"}
          />
          <Bar
            label="continuous · behavior polled every frame"
            value={continuous}
            color="var(--color-space)"
            note={`${(continuous * 100).toFixed(1)}%`}
            smooth
          />

          <div className="mt-5 overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H + 18}`} className="min-w-[520px]" role="img" aria-label="Progress over time, discrete steps versus continuous estimate">
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <g key={v}>
                  <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray="2 5" />
                  <text x={4} y={y(v) - 3} fill="var(--color-faint)" fontSize={9} fontFamily="var(--font-mono)">
                    {v * 100}%
                  </text>
                </g>
              ))}
              {r && last && r.done == null && (
                <g>
                  <line x1={x(last.estimate - r.start)} x2={x(last.estimate - r.start)} y1={6} y2={H} stroke="var(--color-accent)" strokeDasharray="4 4" />
                  <text x={x(last.estimate - r.start) - 4} y={H - 4} textAnchor="end" fill="var(--color-accent)" fontSize={10} fontFamily="var(--font-mono)">
                    estimate
                  </text>
                  <line x1={0} y1={y(0)} x2={x(last.estimate - r.start)} y2={y(1)} stroke="var(--color-accent)" strokeOpacity={0.35} />
                </g>
              )}
              {r?.done != null && (
                <line x1={x(r.done - r.start)} x2={x(r.done - r.start)} y1={6} y2={H} stroke="var(--color-ok)" strokeDasharray="4 4" />
              )}
              <path d={steps} fill="none" stroke="var(--color-time)" strokeWidth={1.5} />
              <path d={smooth} fill="none" stroke="var(--color-space)" strokeWidth={2} />
              <text x={W - 4} y={H + 14} textAnchor="end" fill="var(--color-faint)" fontSize={9} fontFamily="var(--font-mono)">
                {(span / 1000).toFixed(1)}s
              </text>
              <text x={0} y={H + 14} fill="var(--color-faint)" fontSize={9} fontFamily="var(--font-mono)">
                start
              </text>
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
            <Legend color="var(--color-time)" label="index / length" />
            <Legend color="var(--color-space)" label="(now − start) / (estimate − start)" />
            <Legend color="var(--color-accent)" label="latest estimated stop" />
          </div>
        </Panel>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="received" value={last ? `${last.index}/${last.length}` : "—"} />
            <Stat label="throughput" value={last ? `${throughput.toFixed(1)}/s` : "—"} />
            <Stat label="elapsed" value={r ? `${(elapsed / 1000).toFixed(2)}s` : "—"} />
            <Stat
              label={r?.done != null ? "finished in" : "eta"}
              value={r?.done != null ? `${((r.done - r.start) / 1000).toFixed(2)}s` : last ? `${(remaining / 1000).toFixed(2)}s` : "—"}
              tone={r?.done != null ? "good" : "neutral"}
            />
          </div>
          <Panel title="The arithmetic, live">
            <div className="space-y-2 font-mono text-[12px] leading-relaxed">
              <Formula code="progress = index / length" value={last ? `${last.index} / ${last.length} = ${discrete.toFixed(3)}` : null} />
              <Formula code="throughput = index / elapsed" value={last ? `${throughput.toFixed(2)} values/s` : null} />
              <Formula
                code="stop = start + elapsed * length / index"
                value={last && r ? `start + ${(last.elapsed / 1000).toFixed(2)}s × ${last.length} / ${last.index} = +${((last.estimate - r.start) / 1000).toFixed(2)}s` : null}
              />
              <Formula code="progress(now) = (now - start) / (stop - start)" value={r ? `${continuous.toFixed(3)} at this frame` : null} />
            </div>
          </Panel>
          <p className="text-sm leading-relaxed text-muted">
            Turn up the unevenness and watch the slow patch in the middle: the steps stall, the estimate line jumps right, and the smooth bar
            slows down to meet it. That is the behavior re-deriving itself from each new discrete estimate.
          </p>
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, color, note, smooth }: { label: string; value: number; color: string; note: string; smooth?: boolean }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-faint tabular-nums">{note}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full rounded-full"
          style={{ width: `${value * 100}%`, background: color, transition: smooth ? "none" : "width 0ms" }}
        />
      </div>
    </div>
  );
}

function Formula({ code, value }: { code: string; value: string | null }) {
  return (
    <div className="rounded-md border border-line bg-bg/50 px-2.5 py-1.5">
      <div className="text-ink">{code}</div>
      <div className="text-faint">{value ? <>→ <span className="text-muted">{value}</span></> : "→ run to see values"}</div>
    </div>
  );
}
