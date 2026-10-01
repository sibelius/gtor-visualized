"use client";

import { useEffect, useRef, useState } from "react";
import { Behavior } from "@/gtor/primitives";
import { trace } from "@/gtor/trace";
import { Button, Panel, Slider, Stat } from "../ui";

/** A temperature that changes continuously, whether or not anyone looks. */
const temperature = (ms: number) => {
  const t = ms / 1000;
  return 20 + 1.8 * Math.sin(t / 1.6) + 0.7 * Math.sin(t * 1.9 + 1) + 0.25 * Math.sin(t * 7.3) + 0.12 * Math.sin(t * 23.1);
};

type Sample = { id: number; t: number; v: number };
type Read = { t: number; id: number; v: number };

const WINDOW = 6000;
const W = 720;
const H = 200;
const LO = 16.5;
const HI = 23.5;

/**
 * A thermocouple (the behavior) is polled by a sensor at one rate and the
 * sensor's latest reading is polled by a display at another. When the sensor
 * is slower, the display remembers and redraws the last value. When it is
 * faster, the transport forgets every value the display never got to see.
 */
export function ThermometerDemo() {
  const [behavior] = useState(() => new Behavior(temperature, "thermocouple", true));
  const [sensorHz, setSensorHz] = useState(2);
  const [displayHz, setDisplayHz] = useState(30);
  const [running, setRunning] = useState(true);
  const [, setFrame] = useState(0);

  const sim = useRef({
    samples: [] as Sample[],
    reads: [] as Read[],
    latest: null as Sample | null,
    lastFrame: 0,
    lastShown: 0,
    nextId: 1,
    forgotten: 0,
    repeated: 0,
    polls: 0,
    lastReport: 0,
  });
  const rates = useRef({ sensorHz, displayHz });
  rates.current = { sensorHz, displayHz };

  useEffect(() => {
    if (!running) return;
    const s = sim.current;
    s.lastFrame = performance.now();
    s.lastReport = s.lastFrame;
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const { sensorHz, displayHz } = rates.current;
      // Merge sensor and display ticks that fell since the last frame, in time order.
      const ticks: { t: number; who: "sensor" | "display" }[] = [];
      for (let k = Math.floor((s.lastFrame * sensorHz) / 1000) + 1; (k * 1000) / sensorHz <= now; k++) ticks.push({ t: (k * 1000) / sensorHz, who: "sensor" });
      for (let k = Math.floor((s.lastFrame * displayHz) / 1000) + 1; (k * 1000) / displayHz <= now; k++) ticks.push({ t: (k * 1000) / displayHz, who: "display" });
      ticks.sort((a, b) => a.t - b.t);
      for (const tick of ticks) {
        if (tick.who === "sensor") {
          const sample = { id: s.nextId++, t: tick.t, v: behavior.get(tick.t) };
          s.polls++;
          s.samples.push(sample);
          s.latest = sample;
        } else if (s.latest) {
          if (s.latest.id === s.lastShown) s.repeated++;
          else s.forgotten += Math.max(0, s.latest.id - s.lastShown - 1);
          s.lastShown = s.latest.id;
          s.reads.push({ t: tick.t, id: s.latest.id, v: s.latest.v });
        }
      }
      s.samples = s.samples.filter((x) => x.t > now - WINDOW - 2000);
      s.reads = s.reads.filter((x) => x.t > now - WINDOW - 2000);
      s.lastFrame = now;
      if (now - s.lastReport > 1000) {
        trace.emit("Behavior", "thermocouple", "poll", `sensor polled get(t) ${s.polls}× in the last second · latest ${s.latest?.v.toFixed(2)}°C`);
        s.polls = 0;
        s.lastReport = now;
      }
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, behavior]);

  const s = sim.current;
  const now = s.lastFrame;
  const x = (t: number) => W - ((now - t) / WINDOW) * W;
  const y = (v: number) => H - ((v - LO) / (HI - LO)) * H;

  const curve = Array.from({ length: 241 }, (_, i) => {
    const t = now - WINDOW + (i / 240) * WINDOW;
    return `${i === 0 ? "M" : "L"}${x(t).toFixed(1)},${y(temperature(t)).toFixed(1)}`;
  }).join(" ");

  const visibleReads = s.reads.filter((r) => r.t > now - WINDOW);
  let steps = "";
  visibleReads.forEach((r, i) => {
    steps += i === 0 ? `M${x(r.t).toFixed(1)},${y(r.v).toFixed(1)}` : ` H${x(r.t).toFixed(1)} V${y(r.v).toFixed(1)}`;
  });
  if (visibleReads.length) steps += ` H${W}`;

  const shown = s.reads.at(-1);
  const slower = sensorHz < displayHz;

  return (
    <Panel
      title="A thermocouple, a sensor, a display"
      right={
        <Button variant="ghost" onClick={() => setRunning((r) => !r)}>
          {running ? "pause" : "resume"}
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Slider label="sensor polls" value={sensorHz} min={1} max={120} unit="Hz" onChange={setSensorHz} />
        <Slider label="display polls" value={displayHz} min={1} max={60} unit="Hz" onChange={setDisplayHz} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H + 18}`} className="min-w-[560px]" role="img" aria-label="Continuous temperature curve, sensor samples and the displayed value">
            {[17, 18, 19, 20, 21, 22, 23].map((v) => (
              <g key={v}>
                <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray="2 5" />
                <text x={4} y={y(v) - 3} fill="var(--color-faint)" fontSize={9} fontFamily="var(--font-mono)">
                  {v}°
                </text>
              </g>
            ))}
            <path d={curve} fill="none" stroke="var(--color-faint)" strokeWidth={1.5} />
            <path d={steps} fill="none" stroke="var(--color-getter)" strokeWidth={2} />
            {s.samples
              .filter((p) => p.t > now - WINDOW)
              .map((p) => (
                <circle key={p.id} cx={x(p.t)} cy={y(p.v)} r={sensorHz > 40 ? 1.5 : 3} fill="var(--color-time)" />
              ))}
            <text x={W - 4} y={H + 14} textAnchor="end" fill="var(--color-faint)" fontSize={9} fontFamily="var(--font-mono)">
              now
            </text>
            <text x={4} y={H + 14} fill="var(--color-faint)" fontSize={9} fontFamily="var(--font-mono)">
              −{WINDOW / 1000}s
            </text>
          </svg>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
            <Legend color="var(--color-faint)" label="behavior: temperature(t), continuous" />
            <Legend color="var(--color-time)" label="sensor samples" dot />
            <Legend color="var(--color-getter)" label="what the display shows" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="rounded-lg border border-line bg-panel-2/60 px-3 py-3 text-center">
            <div className="text-[11px] tracking-wide text-faint uppercase">display</div>
            <div className="mt-1 font-mono text-3xl text-getter tabular-nums">{shown ? shown.v.toFixed(2) : "—"}°</div>
          </div>
          <Stat label="redrawn (remembered)" value={s.repeated} />
          <Stat label="forgotten (never shown)" value={s.forgotten} tone={s.forgotten ? "bad" : "neutral"} />
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-line bg-bg/40 px-3 py-2 text-sm leading-relaxed text-muted">
        {slower ? (
          <>
            The sensor is <b className="text-ink">slower</b> than the display. It is sufficient to <b className="text-getter">remember</b> the
            last sensed temperature and redisplay it: the green line holds flat between pink dots.
          </>
        ) : sensorHz === displayHz ? (
          <>Equal rates: every sample is shown exactly once — a coincidence, not a contract.</>
        ) : (
          <>
            The sensor is <b className="text-ink">faster</b> than the display. It is sufficient for the transport to{" "}
            <b className="text-bad">forget</b> old values each time it receives a new one: most pink dots never reach the screen, and
            that is fine.
          </>
        )}
      </p>
    </Panel>
  );
}

export function Legend({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {dot ? <span className="size-2 rounded-full" style={{ background: color }} /> : <span className="h-0.5 w-4 rounded" style={{ background: color }} />}
      {label}
    </span>
  );
}
