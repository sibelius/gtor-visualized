"use client";

import { trace } from "./trace";

/**
 * Small, traced sketches of the gtor primitives. They follow the essay's
 * vocabulary (resolver.return / resolver.throw, in.yield / out.next, ...)
 * rather than any library, and report every get/set to the trace store.
 */

export type Iteration<T> = { value: T; done: boolean };

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason ?? new Error("aborted"));
    });
  });

const fmt = (v: unknown) => {
  if (v instanceof Error) return `Error(${JSON.stringify(v.message)})`;
  if (typeof v === "string") return JSON.stringify(v);
  if (v === undefined) return "undefined";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

// ---------------------------------------------------------------------------
// Deferred: a promise (getter) and its resolver (setter)

export type Resolver<T> = { return(value: T | PromiseLike<T>): void; throw(error: unknown): void };
export type Deferred<T> = { promise: Promise<T>; resolver: Resolver<T> };

export function defer<T>(source = "deferred", silent = false): Deferred<T> {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e: unknown) => void;
  let settled = false;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolver: {
      return(value) {
        if (!silent) trace.emit("Resolver", source, settled ? "error" : "set", settled ? `return(${fmt(value)}) ignored — already resolved` : `return(${fmt(value)})`);
        if (settled) return;
        settled = true;
        resolve(value);
      },
      throw(error) {
        if (!silent) trace.emit("Resolver", source, "error", settled ? `throw(${fmt(error)}) ignored — already resolved` : `throw(${fmt(error)})`);
        if (settled) return;
        settled = true;
        reject(error);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Task: like a promise, but unicast and therefore cancelable.

export class CancelError extends Error {
  constructor(message = "cancelled") {
    super(message);
    this.name = "CancelError";
  }
}

type TaskState<T> = { status: "pending" } | { status: "returned"; value: T } | { status: "thrown"; error: unknown };

export class Task<T> {
  private observers = 0;
  private forks = 0;
  private state: TaskState<T> = { status: "pending" };
  private listeners: ((s: TaskState<T>) => void)[] = [];
  private cancelHandler: ((e: unknown) => void) | null = null;
  readonly controller = new AbortController();

  /** `setup` receives the resolver plus an AbortSignal to stop work early. */
  constructor(
    setup: (resolver: Resolver<T>, signal: AbortSignal) => void,
    readonly source = "task",
  ) {
    this.cancelHandler = (e) => this.controller.abort(e);
    setup(
      {
        return: (v) => {
          Promise.resolve(v).then((value) => this.settle({ status: "returned", value }), (error) => this.settle({ status: "thrown", error }));
        },
        throw: (error) => this.settle({ status: "thrown", error }),
      },
      this.controller.signal,
    );
  }

  get status() {
    return this.state.status;
  }

  private settle(s: TaskState<T>) {
    if (this.state.status !== "pending") return;
    this.state = s;
    if (s.status === "returned") trace.emit("Task", this.source, "settle", `returned ${fmt(s.value)}`);
    else if (s.status === "thrown") trace.emit("Task", this.source, "error", `threw ${fmt(s.error)}`);
    for (const l of this.listeners.splice(0)) l(s);
  }

  /** Unicast: only one observer. A second `done` on the same task throws. */
  done(onreturn?: (v: T) => void, onthrow?: (e: unknown) => void) {
    if (this.observers > 0) {
      trace.emit("Task", this.source, "error", "second observer rejected — tasks are unicast, fork() first");
      throw new Error("Can't observe a task twice. Use fork().");
    }
    this.observers++;
    trace.emit("Task", this.source, "get", "observed (done)");
    const run = (s: TaskState<T>) => (s.status === "returned" ? onreturn?.(s.value) : s.status === "thrown" ? onthrow?.(s.error) : undefined);
    if (this.state.status === "pending") this.listeners.push(run);
    else run(this.state);
  }

  /** A new task for the same result. Cancelling all forks cancels the work. */
  fork(source = `${this.source}.fork`): Task<T> {
    this.forks++;
    trace.emit("Task", this.source, "get", `fork() → ${source}`);
    const child = new Task<T>((r, signal) => {
      const s = this.state;
      if (s.status === "returned") return r.return(s.value);
      if (s.status === "thrown") return r.throw(s.error);
      this.listeners.push((s2) => (s2.status === "returned" ? r.return(s2.value) : s2.status === "thrown" ? r.throw(s2.error) : undefined));
      signal.addEventListener("abort", () => {
        r.throw(signal.reason);
        this.forks--;
        if (this.forks === 0) this.cancel(new CancelError("all forks cancelled"));
      });
    }, source);
    return child;
  }

  /** The observer unsubscribes with an error; upstream work is aborted. */
  cancel(error: unknown = new CancelError()) {
    if (this.state.status !== "pending") return;
    trace.emit("Task", this.source, "cancel", `throw(${fmt(error)}) — upstream aborts`);
    this.cancelHandler?.(error);
    this.settle({ status: "thrown", error });
  }
}

// ---------------------------------------------------------------------------
// Promise queue: get() may come before put(). An async linked list.

export class PromiseQueue<T> {
  private ends: Deferred<{ head: T; tail: Promise<unknown> }>;
  private headPromise: Promise<{ head: T; tail: Promise<unknown> }>;
  /** For visualization: values put but not yet taken, and gets waiting. */
  puts = 0;
  gets = 0;

  constructor(readonly source = "queue", private silent = false) {
    this.ends = defer(source, true);
    this.headPromise = this.ends.promise;
  }

  private emit(kind: "get" | "set", message: string) {
    if (!this.silent) trace.emit("Queue", this.source, kind, message);
  }

  /** How many values are waiting (positive) or how many gets wait (negative). */
  get balance() {
    return this.puts - this.gets;
  }

  put = (value: T) => {
    this.puts++;
    // Resolve the current tail cell with this value and a promise for the next cell.
    const next = defer<{ head: T; tail: Promise<unknown> }>(this.source, true);
    const r = this.ends.resolver;
    this.ends = next;
    this.emit("set", `put(${fmt(value)})`);
    r.return({ head: value, tail: next.promise });
  };

  get = (): Promise<T> => {
    this.gets++;
    this.emit("get", "get()");
    const cell = this.headPromise;
    this.headPromise = cell.then((c) => c.tail as Promise<{ head: T; tail: Promise<unknown> }>);
    return cell.then((c) => c.head);
  };
}

// ---------------------------------------------------------------------------
// Buffer / Stream: two promise queues, values forward, acks backward.

export type BufferEvents = {
  onWrite?: (value: unknown, pending: number) => void;
  onRead?: (value: unknown, pending: number) => void;
};

export class StreamBuffer<T> {
  private outbound = new PromiseQueue<Iteration<T>>("outbound", true);
  private inbound = new PromiseQueue<Iteration<undefined>>("inbound", true);
  /** Values written but not yet read. */
  pending = 0;
  closed = false;
  cancelled: unknown = null;

  constructor(
    readonly length = 0,
    readonly source = "stream",
  ) {
    // Prime the acknowledgement queue: `length` writes may proceed unacked.
    for (let i = 0; i < length; i++) this.inbound.put({ value: undefined, done: false });
  }

  /** The writer: an asynchronous generator. Each call returns a promise for the consumer's ack. */
  readonly in = {
    yield: (value: T): Promise<Iteration<undefined>> => {
      if (this.cancelled) return Promise.reject(this.cancelled);
      this.pending++;
      trace.emit("Stream", this.source, "set", `in.yield(${fmt(value)}) · ${this.pending} buffered`);
      this.outbound.put({ value, done: false });
      return this.inbound.get().then((ack) => {
        if (this.cancelled) throw this.cancelled;
        return ack;
      });
    },
    return: (value?: T): Promise<Iteration<undefined>> => {
      this.closed = true;
      trace.emit("Stream", this.source, "set", "in.return() — close");
      this.outbound.put({ value: value as T, done: true });
      return this.inbound.get();
    },
    throw: (error: unknown): Promise<Iteration<undefined>> => {
      this.closed = true;
      trace.emit("Stream", this.source, "error", `in.throw(${fmt(error)})`);
      const p = Promise.reject(error);
      p.catch(() => {});
      // A promise put in the queue is flattened by get(): the reader's next() rejects.
      this.outbound.put(p as unknown as Iteration<T>);
      return this.inbound.get();
    },
  };

  /** The reader: an asynchronous iterator. next() returns Promise<Iteration<T>>. */
  readonly out = {
    next: (): Promise<Iteration<T>> => {
      trace.emit("Stream", this.source, "get", "out.next()");
      return this.outbound.get().then((it) => {
        if (!it.done) this.pending--;
        trace.emit("Stream", this.source, "ack", it.done ? "← {done: true}" : `← ${fmt(it.value)} · ack sent upstream`);
        this.inbound.put({ value: undefined, done: false });
        return it;
      });
    },
    /** Cancel: the consumer stops the producer, with or without an error. */
    throw: (error: unknown = new CancelError("That's enough, thanks")) => {
      this.cancelled = error;
      trace.emit("Stream", this.source, "cancel", `out.throw(${fmt(error)}) — producer stopped`);
      this.inbound.put({ value: undefined, done: true });
      // Readers already waiting in next() see the end of the stream.
      this.outbound.put({ value: undefined as T, done: true });
    },
    return: () => this.out.throw(new CancelError("returned early")),
  };

  /**
   * Consume with up to `concurrency` jobs in flight. The promise each job
   * returns is back pressure: the next read waits for a free slot.
   */
  forEach(job: (value: T, index: number) => unknown, concurrency = 1): Promise<void> {
    let index = 0;
    let done = false;
    const worker = async () => {
      while (!done) {
        const it = await this.out.next();
        if (it.done) {
          done = true;
          return;
        }
        await job(it.value, index++);
      }
    };
    return Promise.all(Array.from({ length: concurrency }, worker)).then(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Signal: discrete, push, broadcast. No pressure: yield returns nothing.

export class Signal<T> {
  private observers = new Set<(value: T, time: number) => void>();
  private last: Iteration<T | undefined> = { value: undefined, done: false };

  constructor(readonly source = "signal") {}

  readonly in = {
    yield: (value: T) => {
      this.last = { value, done: false };
      trace.emit("Signal", this.source, "push", `in.yield(${fmt(value)}) → ${this.observers.size} observer${this.observers.size === 1 ? "" : "s"}`);
      const now = performance.now();
      for (const o of this.observers) o(value, now);
    },
  };

  readonly out = {
    /** Subscribe to push notifications. Returns an unsubscribe function. */
    forEach: (observer: (value: T, time: number) => void) => {
      this.observers.add(observer);
      trace.emit("Signal", this.source, "get", `out.forEach() · ${this.observers.size} observers`);
      return () => {
        this.observers.delete(observer);
      };
    },
    /** Observables also implement next: poll the most recent value. */
    next: () => this.last,
  };
}

// ---------------------------------------------------------------------------
// Behavior: continuous, pull. A function of time, sampled by the consumer.

export class Behavior<T> {
  constructor(
    private fn: (time: number) => T,
    readonly source = "behavior",
    private silent = false,
  ) {}

  get(time = performance.now()): T {
    const v = this.fn(time);
    if (!this.silent) trace.emit("Behavior", this.source, "poll", `get(t=${Math.round(time)}) → ${typeof v === "number" ? v.toFixed(2) : fmt(v)}`);
    return v;
  }

  map<U>(f: (v: T) => U, source = `${this.source}.map`) {
    return new Behavior((t) => f(this.fn(t)), source, this.silent);
  }
}

// ---------------------------------------------------------------------------
// Clock: an observable that emits the time at a period and offset, and is
// only active while someone is observing (a "hot when watched" signal).

export class Clock {
  private signal: Signal<number>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private count = 0;

  constructor(
    readonly period = 1000,
    readonly offset = 0,
    readonly source = "clock",
  ) {
    this.signal = new Signal<number>(source);
  }

  private schedule() {
    const now = Date.now();
    const next = Math.ceil((now - this.offset) / this.period) * this.period + this.offset;
    this.timer = setTimeout(() => {
      this.signal.in.yield(next);
      this.schedule();
    }, Math.max(0, next - now));
  }

  forEach(observer: (time: number) => void) {
    const off = this.signal.out.forEach(observer);
    if (++this.count === 1) this.schedule();
    return () => {
      off();
      if (--this.count === 0 && this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
        trace.emit("Signal", this.source, "cancel", "no observers left — clock stops");
      }
    };
  }
}
