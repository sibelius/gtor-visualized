"use client";

import { useEffect, useRef, useState } from "react";
import { Behavior } from "@/gtor/primitives";
import { trace } from "@/gtor/trace";
import { Panel } from "../ui";
import { Legend } from "./ThermometerDemo";

type Event = { t: number; pos: number; hold?: boolean };

const WINDOW = 4000;
const W = 720;
const H = 140;
// Render slightly in the past so there is always a next event to interpolate toward.
const LAG = 90;

/**
 * Scroll events are a discrete signal: they arrive irregularly. From the
 * positions and their times we infer a continuous function, a behavior, and
 * sample it on every animation frame.
 */
export function ScrollDemo() {
  const events = useRef<Event[]>([{ t: 0, pos: 0 }]);
  const lastTrace = useRef(0);
  const [behavior] = useState(
    () =>
      new Behavior((time) => {
        const list = events.current;
        const t = time - LAG;
        // Find the pair of events around t and interpolate between them.
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].t <= t) {
            const a = list[i];
            const b = list[i + 1];
            if (!b) return a.pos;
            const k = (t - a.t) / (b.t - a.t);
            const eased = k * k * (3 - 2 * k);
            return a.pos + (b.pos - a.pos) * eased;
          }
        }
        return list[0]?.pos ?? 0;
      }, "scroll-position", true),
  );
  const [now, setNow] = useState(0);
  const samples = useRef<{ t: number; v: number }[]>([]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = performance.now();
      samples.current.push({ t, v: behavior.get(t) });
      samples.current = samples.current.filter((s) => s.t > t - WINDOW);
      setNow(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [behavior]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const pos = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    const t = performance.now();
    const kept = events.current.filter((x) => x.t > t - WINDOW - 2000);
    const prev = events.current.at(-1);
    // After a pause, the position held still: add a hold point so we don't glide across the gap.
    if (prev && t - prev.t > 200) kept.push({ t: t - 50, pos: prev.pos, hold: true });
    events.current = [...kept, { t, pos }];
    if (t - lastTrace.current > 150) {
      lastTrace.current = t;
      trace.emit("Signal", "scroll", "push", `scroll event → position ${(pos * 100).toFixed(0)}%`);
    }
  }

  const x = (t: number) => W - ((now - t) / WINDOW) * W;
  const y = (v: number) => 10 + (1 - v) * (H - 20);
  const raw = events.current.at(-1)?.pos ?? 0;
  const smooth = samples.current.at(-1)?.v ?? 0;
  const path = samples.current.map((s, i) => `${i === 0 ? "M" : "L"}${x(s.t).toFixed(1)},${y(s.v).toFixed(1)}`).join(" ");

  return (
    <Panel title="Scroll position: a discrete signal, sampled as a behavior">
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="flex gap-3">
          <div onScroll={onScroll} className="h-52 flex-1 overflow-y-scroll rounded-lg border border-line bg-bg/60 p-3 text-xs leading-6 text-faint">
            {Array.from({ length: 60 }, (_, i) => (
              <div key={i}>
                line {i + 1} {i % 7 === 0 ? "— scroll me" : ""}
              </div>
            ))}
          </div>
          <div className="relative h-52 w-8 rounded-lg border border-line bg-panel-2/60" aria-label="Raw and smoothed position">
            <span className="absolute left-1 size-2.5 -translate-y-1/2 rounded-full bg-time" style={{ top: `${raw * 100}%` }} title="last event" />
            <span className="absolute right-1 size-2.5 -translate-y-1/2 rounded-full bg-space" style={{ top: `${smooth * 100}%` }} title="sampled behavior" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[480px]" role="img" aria-label="Scroll events and the smooth sampled position">
              <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-line)" strokeDasharray="2 5" />
              <line x1={0} x2={W} y1={y(1)} y2={y(1)} stroke="var(--color-line)" strokeDasharray="2 5" />
              <path d={path} fill="none" stroke="var(--color-space)" strokeWidth={2} />
              {events.current
                .filter((e) => e.t > now - WINDOW && e.t > 0 && !e.hold)
                .map((e) => (
                  <circle key={e.t} cx={x(e.t)} cy={y(e.pos)} r={2.5} fill="var(--color-time)" />
                ))}
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
            <Legend color="var(--color-time)" label="scroll events (discrete, pushed)" dot />
            <Legend color="var(--color-space)" label="inferred position(t), polled every frame" />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Scroll quickly and the pink dots bunch up or leave gaps; the blue curve stays smooth. The display polls the behavior at its own
            rate, the frame rate, so it never cares how often events arrived.
          </p>
        </div>
      </div>
    </Panel>
  );
}
