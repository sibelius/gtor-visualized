"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Signal, StreamBuffer } from "@/gtor/primitives";
import { Button, Panel, Stat, Tag } from "../ui";

type Point = { x: number; y: number };
type Pushed = { seq: number; point: Point; at: number };

const COLORS = ["var(--color-f1)", "var(--color-f2)", "var(--color-f3)", "var(--color-f4)", "var(--color-f5)", "var(--color-f6)"];
// Pointer events fire far faster than anyone wants to read the log. Push at most this often.
const MIN_GAP_MS = 80;

/**
 * A pointer pad is the setter side of a signal. Observers are added and
 * removed at will; each sees only what was pushed while it was subscribed.
 * Next to it, the same values are written into a stream with no reader yet,
 * which buffers every one of them.
 */
export function SignalDemo() {
  const [signal] = useState(() => new Signal<Pushed>("pointer"));
  const [stream, setStream] = useState(() => new StreamBuffer<Pushed>(0, "pointer-stream"));
  const [observers, setObservers] = useState<number[]>([1]);
  const [pushed, setPushed] = useState(0);
  const [lastReturn, setLastReturn] = useState<string>("—");
  const [polled, setPolled] = useState<Pushed | null | undefined>(undefined);
  const [buffered, setBuffered] = useState(0);
  const [drained, setDrained] = useState<number[] | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const seq = useRef(0);
  const lastPush = useRef(0);
  const nextId = useRef(2);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const point = { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) };
    setCursor(point);
    const now = performance.now();
    if (now - lastPush.current < MIN_GAP_MS) return;
    lastPush.current = now;
    const value = { seq: ++seq.current, point, at: now };
    // in.yield returns nothing: the producer never waits for anyone.
    const ret = signal.in.yield(value);
    setLastReturn(String(ret));
    setPushed(seq.current);
    // The stream writer, by contrast, gets back a promise for an ack that
    // won't come until a reader shows up. We don't wait for it.
    void stream.in.yield(value).catch(() => {});
    setBuffered(stream.pending);
  }

  async function drain() {
    const got: number[] = [];
    while (stream.pending > 0) {
      const it = await stream.out.next();
      got.push(it.value.seq);
    }
    setDrained(got);
    setBuffered(stream.pending);
  }

  function resetStream() {
    stream.out.throw();
    setStream(new StreamBuffer<Pushed>(0, "pointer-stream"));
    setBuffered(0);
    setDrained(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Panel
        title="Signal generator · move your pointer"
        right={
          <span className="font-mono text-[11px] text-faint">
            in.yield(…) returned <span className="text-setter">{lastReturn}</span>
          </span>
        }
      >
        <div
          onPointerMove={onMove}
          onPointerLeave={() => setCursor(null)}
          className="relative h-56 cursor-crosshair touch-none overflow-hidden rounded-lg border border-dashed border-line bg-bg/60"
        >
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-faint">
            {pushed === 0 ? "Move the pointer here to push values" : null}
          </div>
          {cursor && (
            <span
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-time shadow-[0_0_16px_var(--color-time)]"
              style={{ left: cursor.x, top: cursor.y }}
            />
          )}
          <span className="absolute right-2 bottom-2 font-mono text-[11px] text-faint">
            pushed {pushed} · ≤ {Math.round(1000 / MIN_GAP_MS)}/s
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              setObservers((o) => [...o, nextId.current++]);
            }}
            disabled={observers.length >= 6}
          >
            + subscribe observer
          </Button>
          <Button variant="ghost" onClick={() => setPolled(signal.out.next().value ?? null)}>
            out.next() — poll latest
          </Button>
          {polled !== undefined && (
            <span className="font-mono text-xs text-muted">
              → {polled ? `#${polled.seq} (${polled.point.x}, ${polled.point.y})` : "undefined"}
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {observers.map((id, i) => (
            <ObserverCard
              key={id}
              id={id}
              color={COLORS[i % COLORS.length]}
              signal={signal}
              joinedAt={pushed}
              onRemove={() => setObservers((o) => o.filter((x) => x !== id))}
            />
          ))}
          {observers.length === 0 && (
            <div className="rounded-lg border border-line p-3 text-sm text-faint sm:col-span-2">
              No observers. The signal keeps pushing to nobody — and nothing is kept.
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Same values, written into a stream" right={<Tag tone="muted">unicast · buffered · pressured</Tag>}>
        <p className="text-sm leading-relaxed text-muted">
          A stream would buffer all values produced until the consumer arrives. Each <code className="font-mono text-setter">in.yield</code>{" "}
          returns a promise for an acknowledgement that is still pending.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="pushed to signal" value={pushed} />
          <Stat label="buffered in stream" value={buffered} tone={buffered > 0 ? "bad" : "neutral"} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {Array.from({ length: Math.min(buffered, 60) }, (_, i) => (
            <span key={i} className="h-3 w-2 animate-pop rounded-sm bg-setter/70" />
          ))}
          {buffered > 60 && <span className="font-mono text-[11px] text-faint">+{buffered - 60}</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={drain} disabled={buffered === 0}>
            Late reader arrives: drain
          </Button>
          <Button variant="ghost" onClick={resetStream}>
            reset
          </Button>
        </div>
        {drained && (
          <p className="mt-3 text-sm text-muted">
            The late reader received <span className="font-mono text-ok">{drained.length}</span> values
            {drained.length > 0 && (
              <>
                , <span className="font-mono">#{drained[0]}</span> through <span className="font-mono">#{drained.at(-1)}</span>
              </>
            )}{" "}
            — every one, in order. A late signal observer only sees what comes next.
          </p>
        )}
      </Panel>
    </div>
  );
}

function ObserverCard({
  id,
  color,
  signal,
  joinedAt,
  onRemove,
}: {
  id: number;
  color: string;
  signal: Signal<Pushed>;
  joinedAt: number;
  onRemove: () => void;
}) {
  const [joined] = useState(joinedAt);
  const [received, setReceived] = useState(0);
  const [last, setLast] = useState<Pushed | null>(null);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return signal.out.forEach((value) => {
      setReceived((n) => n + 1);
      setLast(value);
      const node = el.current;
      if (!node) return;
      node.classList.remove("animate-flash");
      void node.offsetWidth;
      node.classList.add("animate-flash");
    });
  }, [signal]);

  return (
    <div ref={el} className="rounded-lg border border-line bg-panel-2/60 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2.5 rounded-full" style={{ background: color }} />
          observer {id}
        </span>
        <button type="button" onClick={onRemove} className="text-xs text-faint hover:text-bad">
          unsubscribe
        </button>
      </div>
      <div className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
        <div>
          received <span className="text-ink tabular-nums">{received}</span>
          {joined > 0 && <span className="text-faint"> · missed {joined} before joining</span>}
        </div>
        <div className="truncate">
          last {last ? <span style={{ color }}>#{last.seq} ({last.point.x}, {last.point.y})</span> : <span className="text-faint">—</span>}
        </div>
      </div>
    </div>
  );
}

/** Ticks and tocks drawn on a scrolling timeline, only while observed. */
export function ClockDemo() {
  const [clocks] = useState(() => ({
    tick: new Clock(1000, 0, "tick"),
    tock: new Clock(1000, 500, "tock"),
  }));
  const [watch, setWatch] = useState({ tick: false, tock: false });
  const [beats, setBeats] = useState<{ name: "tick" | "tock"; time: number }[]>([]);
  // Starts at 0 so the server render and hydration agree; set on mount.
  const [now, setNow] = useState(0);
  const active = watch.tick || watch.tock;

  useEffect(() => setNow(Date.now()), []);

  useEffect(() => {
    const offs: (() => void)[] = [];
    for (const name of ["tick", "tock"] as const) {
      if (!watch[name]) continue;
      offs.push(clocks[name].forEach((time) => setBeats((b) => [...b.filter((x) => x.time > time - 8000), { name, time }])));
    }
    return () => offs.forEach((off) => off());
  }, [watch, clocks]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const span = 6000;
  const W = 720;
  const x = (t: number) => W - ((now - t) / span) * W;

  return (
    <Panel
      title="Clock: an observable with no generator"
      right={
        <div className="flex gap-2">
          {(["tick", "tock"] as const).map((name) => (
            <Button key={name} variant={watch[name] ? "primary" : "default"} onClick={() => setWatch((w) => ({ ...w, [name]: !w[name] }))}>
              {watch[name] ? `stop observing ${name}` : `observe ${name}`}
            </Button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-4 font-mono text-[11px] text-muted">
        <span>
          tick: <code>{"new Clock({period: 1000})"}</code>{" "}
          <span className={watch.tick ? "text-ok" : "text-faint"}>{watch.tick ? "● running" : "○ idle — nobody is looking"}</span>
        </span>
        <span>
          tock: <code>{"new Clock({period: 1000, offset: 500})"}</code>{" "}
          <span className={watch.tock ? "text-ok" : "text-faint"}>{watch.tock ? "● running" : "○ idle — nobody is looking"}</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} 110`} className="min-w-[560px]" role="img" aria-label="Timeline of clock pulses">
          {now > 0 && Array.from({ length: 8 }, (_, i) => {
            const t = Math.floor(now / 1000) * 1000 - i * 1000;
            return (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={10} y2={96} stroke="var(--color-line)" />
                <text x={x(t) + 3} y={106} fill="var(--color-faint)" fontSize={9} fontFamily="var(--font-mono)">
                  {new Date(t).toISOString().slice(17, 19)}s
                </text>
              </g>
            );
          })}
          <line x1={0} x2={W} y1={32} y2={32} stroke="var(--color-line)" strokeDasharray="2 4" />
          <line x1={0} x2={W} y1={72} y2={72} stroke="var(--color-line)" strokeDasharray="2 4" />
          <text x={6} y={24} fill="var(--color-f1)" fontSize={10} fontFamily="var(--font-mono)">tick</text>
          <text x={6} y={64} fill="var(--color-time)" fontSize={10} fontFamily="var(--font-mono)">tock</text>
          {beats
            .filter((b) => now - b.time < span)
            .map((b) => (
              <circle
                key={`${b.name}${b.time}`}
                cx={x(b.time)}
                cy={b.name === "tick" ? 32 : 72}
                r={6}
                fill={b.name === "tick" ? "var(--color-f1)" : "var(--color-time)"}
              />
            ))}
          {!active && (
            <text x={W / 2} y={56} textAnchor="middle" fill="var(--color-faint)" fontSize={12}>
              No observers — the clocks have no timers scheduled.
            </text>
          )}
        </svg>
      </div>
    </Panel>
  );
}
