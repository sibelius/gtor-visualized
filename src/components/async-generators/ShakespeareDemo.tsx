"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { StreamBuffer, sleep } from "@/gtor/primitives";
import { trace } from "@/gtor/trace";
import { Button, Console, Panel, Stat, useFrame } from "../ui";
import { Lanes, switchSegment, type Segment } from "../streams/Lanes";

const QUOTES: Record<string, string[]> = {
  Hamlet: ["To be, or not to be", "The rest is silence", "Brevity is the soul of wit"],
  Macbeth: ["Out, damned spot!", "Fair is foul, and foul is fair", "Something wicked this way comes"],
  Othello: ["O, beware, my lord, of jealousy", "I kissed thee ere I killed thee", "Put out the light"],
};
const TITLES = Object.keys(QUOTES);

type Mode = "native" | "buffer";
type State = { t0: number; producer: Segment[]; consumer: Segment[]; total: number; count: number; running: boolean; endedAt: number | null };

const COLORS = { fetching: "bg-info", suspended: "bg-bad/80", processing: "bg-getter", waiting: "bg-faint/60" };
const LEGEND = {
  fetching: "await getQuotes(title)",
  suspended: "paused at yield (waiting for the consumer)",
  processing: "consumer working on a quote",
  waiting: "consumer awaiting next()",
};

const short = (q: string) => (q.length > 14 ? `${q.slice(0, 13)}…` : q);

export function ShakespeareDemo() {
  const [mode, setMode] = useState<Mode>("native");
  const [slow, setSlow] = useState(true);
  const [state, setState] = useState<State | null>(null);
  const [log, setLog] = useState<React.ReactNode[]>([]);
  const ref = useRef<State | null>(null);
  const runId = useRef(0);
  const now = useFrame(state?.running ?? false);

  async function run() {
    const id = ++runId.current;
    const t0 = performance.now();
    ref.current = { t0, producer: [], consumer: [], total: 0, count: 0, running: true, endedAt: null };
    setState(ref.current);
    setLog([]);
    const set = (fn: (s: State) => State) => {
      if (runId.current !== id || !ref.current) return;
      ref.current = fn(ref.current);
      setState(ref.current);
    };
    const prod = (kind: string | null, label?: string) => set((s) => ({ ...s, producer: switchSegment(s.producer, performance.now(), kind, label) }));
    const cons = (kind: string | null, label?: string) => set((s) => ({ ...s, consumer: switchSegment(s.consumer, performance.now(), kind, label) }));
    const say = (node: React.ReactNode) => runId.current === id && setLog((l) => [...l, <span key={l.length}><span className="text-faint">+{Math.round(performance.now() - t0)}ms </span>{node}</span>]);

    const getQuotes = async (title: string) => {
      prod("fetching", title);
      say(<><span className="text-info">await</span> getQuotes(&quot;{title}&quot;)</>);
      await sleep(700);
      return QUOTES[title];
    };

    let reader: AsyncIterable<string>;
    if (mode === "native") {
      // A real async generator function: yield suspends until the consumer pulls.
      async function* shakespeare(titles: string[]) {
        for (const title of titles) {
          const quotes = await getQuotes(title);
          for (const quote of quotes) {
            prod("suspended", short(quote));
            trace.emit("AsyncGenerator", "shakespeare", "set", `yield ${JSON.stringify(quote)}`);
            say(<><span className="text-setter">yield</span> &quot;{quote}&quot;</>);
            yield quote;
          }
        }
        prod(null);
      }
      reader = shakespeare(TITLES);
    } else {
      // gtor style: the generator writes to a buffer of 3 and awaits each ack.
      const buffer = new StreamBuffer<string>(3, "shakespeare");
      (async () => {
        for (const title of TITLES) {
          const quotes = await getQuotes(title);
          for (const quote of quotes) {
            prod("suspended", short(quote));
            say(<><span className="text-setter">await yield</span> &quot;{quote}&quot; <span className="text-faint">· {buffer.pending + 1} buffered</span></>);
            await buffer.in.yield(quote);
          }
        }
        prod(null);
        await buffer.in.return();
      })();
      reader = { [Symbol.asyncIterator]: () => ({ next: () => buffer.out.next() as Promise<IteratorResult<string>> }) };
    }

    // for await (const quote of reader) — the "for ... on" of the essay.
    cons("waiting");
    for await (const quote of reader) {
      if (runId.current !== id) return;
      if (mode === "native") trace.emit("AsyncGenerator", "shakespeare", "ack", `← ${JSON.stringify(quote)}`);
      cons("processing", short(quote));
      say(<><span className="text-getter">consume</span> &quot;{quote}&quot;</>);
      await sleep(slow ? 900 : 120);
      set((s) => ({ ...s, total: s.total + quote.length, count: s.count + 1 }));
      cons("waiting");
    }
    cons(null);
    prod(null);
    set((s) => ({ ...s, running: false, endedAt: performance.now() }));
    say(<span className="text-accent">reduce → total length {ref.current?.total}</span>);
  }

  const clock = state?.running ? now || performance.now() : state?.endedAt ?? 0;
  const suspendedMs = state ? sum(state.producer, "suspended", clock) : 0;

  return (
    <Panel
      title="async function *shakespeare(titles)"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            value={mode}
            onChange={setMode}
            options={[
              ["native", "native (pull on demand)"],
              ["buffer", "gtor Buffer(3)"],
            ]}
          />
          <Toggle
            value={slow ? "slow" : "fast"}
            onChange={(v) => setSlow(v === "slow")}
            options={[
              ["fast", "fast consumer"],
              ["slow", "slow consumer"],
            ]}
          />
          <Button variant="primary" onClick={run}>{state?.running ? "restart" : "run"}</Button>
        </div>
      }
    >
      {state ? (
        <Lanes
          mode="fit"
          now={clock}
          t0={state.t0}
          colors={COLORS}
          legend={LEGEND}
          lanes={[
            { label: "producer", segments: state.producer },
            { label: "consumer", segments: state.consumer },
          ]}
        />
      ) : (
        <p className="py-6 text-sm text-faint">Run it: three plays, three quotes each. getQuotes takes 700ms.</p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_260px]">
        <Console lines={log} className="h-56" empty="Producer and consumer steps appear here." />
        <div className="grid content-start gap-2">
          <Stat label="quotes consumed" value={`${state?.count ?? 0} / 9`} />
          <Stat label="total length (reduce)" value={state?.total ?? 0} />
          <Stat label="producer paused at yield" value={state ? `${Math.round(suspendedMs)} ms` : "—"} />
          <Stat label="elapsed" value={state ? `${Math.round(clock - state.t0)} ms` : "—"} />
        </div>
      </div>
      <p className={clsx("mt-3 text-xs leading-relaxed text-muted")}>
        {mode === "native"
          ? "A native async generator never runs ahead: it only resumes when the consumer calls next(), so a slow consumer leaves it paused at every yield and the next getQuotes starts late."
          : "With a buffer, yield returns a promise for an ack and the producer may run up to 3 values ahead: getQuotes for the next play overlaps the consumer's work. await and yield are orthogonal."}
      </p>
    </Panel>
  );
}

function sum(segments: Segment[], kind: string, now: number) {
  return segments.filter((s) => s.kind === kind).reduce((a, s) => a + ((s.end ?? now) - s.start), 0);
}

function Toggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5 text-xs">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={clsx("rounded-md px-2.5 py-1", value === v ? "bg-panel-2 text-ink" : "text-muted hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
