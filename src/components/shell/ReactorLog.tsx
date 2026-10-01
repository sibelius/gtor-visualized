"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { KIND_COLOR, trace, useTrace } from "@/gtor/trace";

// The equivalent of devtools for this app: every get, set, ack, push and poll
// reported by the primitives in src/gtor, in order.
export function ReactorLog() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const events = useTrace((s) => s.events);
  const t0 = useTrace((s) => s.t0);
  const ref = useRef<HTMLDivElement>(null);
  const primitives = [...new Set(events.map((e) => e.primitive))];
  const shown = filter ? events.filter((e) => e.primitive === filter) : events;
  const last = events.at(-1);

  useEffect(() => {
    if (open) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [open, shown.length]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:left-64">
      <div className={clsx("border-t border-line bg-panel/95 backdrop-blur", open ? "h-[300px]" : "h-9")}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-full items-center gap-4 px-4 text-xs text-muted hover:text-ink"
        >
          <span className="font-semibold tracking-wide text-ink uppercase">Reactor log</span>
          <span className="flex items-center gap-1.5">
            <span key={last?.id} className={clsx("size-1.5 rounded-full", last ? "animate-pop bg-accent" : "bg-faint")} />
            {events.length} events
          </span>
          {last && (
            <span className="hidden truncate font-mono sm:inline">
              <span className="text-faint">{last.primitive}</span> {last.source} · <span className={KIND_COLOR[last.kind]}>{last.message}</span>
            </span>
          )}
          <span className="ml-auto shrink-0">{open ? "▾ hide" : "▴ show"}</span>
        </button>
        {open && (
          <div className="flex h-[calc(300px-36px)] flex-col border-t border-line">
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 text-[11px]">
              <FilterChip active={filter == null} onClick={() => setFilter(null)}>all</FilterChip>
              {primitives.map((p) => (
                <FilterChip key={p} active={filter === p} onClick={() => setFilter(p)}>
                  {p}
                </FilterChip>
              ))}
              <button type="button" className="ml-auto text-faint hover:text-ink" onClick={() => trace.clear()}>
                clear
              </button>
            </div>
            <div ref={ref} className="flex-1 overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed">
              {shown.length === 0 && <div className="py-4 text-faint">Run any demo to see its primitives at work.</div>}
              {shown.map((e) => (
                <div key={e.id} className="grid grid-cols-[64px_80px_140px_1fr] gap-2 border-b border-line/40 py-0.5">
                  <span className="text-right text-faint tabular-nums">+{Math.max(0, Math.round(e.at - t0))}ms</span>
                  <span className="text-muted">{e.primitive}</span>
                  <span className="truncate text-ink">{e.source}</span>
                  <span className={KIND_COLOR[e.kind]}>
                    <span className="text-faint">{e.kind.padEnd(6)} </span>
                    {e.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx("rounded-md border px-2 py-0.5", active ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:text-ink")}
    >
      {children}
    </button>
  );
}
