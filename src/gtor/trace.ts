"use client";

import { useSyncExternalStore } from "react";

/**
 * Every primitive in src/gtor reports what it does here: a get, a set, a
 * resolution, an acknowledgement. The demos and the bottom "reactor log"
 * drawer read from this one store, so what you see is what actually ran.
 */

export type TraceKind =
  | "get" // a getter asked for something (next, then, get, forEach)
  | "set" // a setter provided something (yield, put, resolve)
  | "settle" // a promise or task settled
  | "error" // a thrown or rejected path
  | "cancel" // a consumer cancelled / aborted upstream
  | "ack" // back pressure: the consumer acknowledged a value
  | "push" // a signal pushed to observers
  | "poll"; // a behavior was sampled

export type TraceEvent = {
  id: number;
  at: number;
  /** Which primitive: "Promise", "Task", "Queue", "Stream", "Signal", ... */
  primitive: string;
  /** Instance label chosen by the demo, e.g. "connections". */
  source: string;
  kind: TraceKind;
  message: string;
};

type State = { events: TraceEvent[]; t0: number };

const MAX = 400;
let state: State = { events: [], t0: typeof performance === "undefined" ? 0 : performance.now() };
let seq = 0;
const listeners = new Set<() => void>();
let scheduled = false;

function notify() {
  // Coalesce bursts (a stream can emit hundreds of events per second).
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    for (const l of listeners) l();
  });
}

export const trace = {
  emit(primitive: string, source: string, kind: TraceKind, message: string) {
    const event: TraceEvent = { id: ++seq, at: performance.now(), primitive, source, kind, message };
    const events = state.events.length >= MAX ? state.events.slice(-MAX + 1) : state.events.slice();
    events.push(event);
    state = { ...state, events };
    notify();
  },
  clear() {
    state = { events: [], t0: performance.now() };
    notify();
  },
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const serverState: State = { events: [], t0: 0 };

export function useTrace<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    trace.subscribe,
    () => select(trace.get()),
    () => select(serverState),
  );
}

export const KIND_COLOR: Record<TraceKind, string> = {
  get: "text-getter",
  set: "text-setter",
  settle: "text-accent",
  error: "text-bad",
  cancel: "text-bad",
  ack: "text-info",
  push: "text-time",
  poll: "text-space",
};
