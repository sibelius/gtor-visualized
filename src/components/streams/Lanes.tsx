"use client";

import clsx from "clsx";

export type Segment = { start: number; end: number | null; kind: string; label?: string };
export type Lane = { label: string; segments: Segment[] };

/**
 * A Gantt-style timeline of state segments per lane. In "window" mode it
 * scrolls, showing the last `windowMs`; in "fit" mode it spans t0 → now.
 */
export function Lanes({
  lanes,
  now,
  t0,
  colors,
  legend,
  windowMs = 8000,
  mode = "window",
}: {
  lanes: Lane[];
  now: number;
  t0: number;
  colors: Record<string, string>;
  legend: Record<string, string>;
  windowMs?: number;
  mode?: "window" | "fit";
}) {
  const span = mode === "fit" ? Math.max(now - t0, 1) : windowMs;
  const from = mode === "fit" ? t0 : now - windowMs;
  return (
    <div>
      <div className="space-y-1.5">
        {lanes.map((lane) => (
          <div key={lane.label} className="grid grid-cols-[96px_1fr] items-center gap-2">
            <span className="truncate font-mono text-[11px] text-muted">{lane.label}</span>
            <div className="relative h-5 overflow-hidden rounded bg-panel-2/60">
              {lane.segments.map((s, i) => {
                const end = s.end ?? now;
                if (end < from) return null;
                const left = Math.max(0, ((s.start - from) / span) * 100);
                const right = Math.min(100, ((end - from) / span) * 100);
                if (right <= left) return null;
                return (
                  <span
                    key={i}
                    title={s.label ?? s.kind}
                    className={clsx("absolute inset-y-0.5 overflow-hidden rounded-sm px-1 font-mono text-[9px] leading-4 whitespace-nowrap text-black/80", colors[s.kind])}
                    style={{ left: `${left}%`, width: `${right - left}%` }}
                  >
                    {s.label}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-[104px] text-[11px] text-faint">
        {Object.entries(legend).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={clsx("size-2 rounded-sm", colors[k])} />
            {v}
          </span>
        ))}
        <span className="ml-auto font-mono">{mode === "fit" ? `${Math.round(span)} ms` : `last ${windowMs / 1000}s`}</span>
      </div>
    </div>
  );
}

/** Close the open segment of a lane (if any) and open a new one. */
export function switchSegment(segments: Segment[], at: number, kind: string | null, label?: string): Segment[] {
  const next = segments.slice(-60);
  const last = next.at(-1);
  if (last && last.end == null) next[next.length - 1] = { ...last, end: at };
  if (kind) next.push({ start: at, end: null, kind, label });
  return next;
}
