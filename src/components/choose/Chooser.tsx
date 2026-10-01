"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Button } from "../ui";

type Primitive = "Value" | "Iterator" | "Promise" | "Task" | "Stream" | "Signal" | "Behavior";

type Props = {
  number: "singular" | "plural";
  axis: "spatial" | "temporal";
  cast: "—" | "unicast" | "broadcast";
  cancelable: boolean;
  flow: "one way" | "two way";
  strategy: "—" | "pull" | "push" | "pressure" | "poll";
  everyValue: boolean;
  href: string;
};

export const PRIMITIVES: Record<Primitive, Props> = {
  Value: { number: "singular", axis: "spatial", cast: "—", cancelable: false, flow: "one way", strategy: "—", everyValue: true, href: "/" },
  Iterator: { number: "plural", axis: "spatial", cast: "unicast", cancelable: true, flow: "two way", strategy: "pull", everyValue: true, href: "/iterators" },
  Promise: { number: "singular", axis: "temporal", cast: "broadcast", cancelable: false, flow: "one way", strategy: "push", everyValue: true, href: "/promises" },
  Task: { number: "singular", axis: "temporal", cast: "unicast", cancelable: true, flow: "two way", strategy: "push", everyValue: true, href: "/tasks" },
  Stream: { number: "plural", axis: "temporal", cast: "unicast", cancelable: true, flow: "two way", strategy: "pressure", everyValue: true, href: "/streams" },
  Signal: { number: "plural", axis: "temporal", cast: "broadcast", cancelable: false, flow: "one way", strategy: "push", everyValue: false, href: "/signals" },
  Behavior: { number: "plural", axis: "temporal", cast: "broadcast", cancelable: false, flow: "one way", strategy: "poll", everyValue: false, href: "/behaviors" },
};

type Question = {
  id: string;
  text: string;
  options: { label: string; hint: string; next: string | Primitive }[];
};

const QUESTIONS: Record<string, Question> = {
  count: {
    id: "count",
    text: "How many values?",
    options: [
      { label: "One", hint: "a result: a response, a file, a computed answer", next: "whenOne" },
      { label: "Many", hint: "a sequence: lines, events, readings, frames", next: "whenMany" },
    ],
  },
  whenOne: {
    id: "whenOne",
    text: "Is it available now, or does it arrive later?",
    options: [
      { label: "Now", hint: "it's already in memory", next: "Value" },
      { label: "Later", hint: "it depends on I/O, a timer, another process", next: "cancel" },
    ],
  },
  cancel: {
    id: "cancel",
    text: "Should a consumer be able to stop the work?",
    options: [
      { label: "No — share it freely", hint: "many consumers depend on the same result and can't interfere", next: "Promise" },
      { label: "Yes — I own this result", hint: "one consumer, and losing interest should abort the work", next: "Task" },
    ],
  },
  whenMany: {
    id: "whenMany",
    text: "Are the values all here now, or do they arrive over time?",
    options: [
      { label: "Here now (or computed on demand)", hint: "a collection, a range, a lazy pipeline", next: "Iterator" },
      { label: "Over time", hint: "from a socket, a sensor, a user, a clock", next: "every" },
    ],
  },
  every: {
    id: "every",
    text: "Does every value matter, in order?",
    options: [
      { label: "Yes — none may be lost", hint: "bytes of a file, rows to insert, jobs to run", next: "Stream" },
      { label: "No — only the latest matters", hint: "time series data: positions, temperatures, progress", next: "series" },
    ],
  },
  series: {
    id: "series",
    text: "Does the value change at discrete moments, or continuously?",
    options: [
      { label: "Discrete events", hint: "a click, a scroll event, a keypress, SIGHUP", next: "Signal" },
      { label: "Continuously", hint: "the time, a temperature, an animated progress estimate", next: "Behavior" },
    ],
  },
};

const VERDICT: Record<Primitive, string> = {
  Value: "Just use the value. Getter and setter are the same moment.",
  Iterator: "An iterator pulls values lazily, one at a time, and can stop early. A generator function is the easiest way to write one.",
  Promise: "Promises are broadcast: any number of consumers can observe, before or after it resolves, and none can affect another.",
  Task: "A task is unicast, so it can be cancelled. Fork it explicitly if more than one consumer needs the result.",
  Stream: "A stream applies pressure: the producer waits for acknowledgements, so a slow consumer slows the producer and nothing is lost.",
  Signal: "Signals push discrete values to every observer, with no pressure. Observers only see values sent while they're subscribed.",
  Behavior: "A behavior is a function of time. It has no resolution of its own; the consumer polls it when it needs a value, say once per frame.",
};

export function Chooser() {
  const [path, setPath] = useState<{ q: string; choice: number }[]>([]);
  const current = path.length === 0 ? "count" : QUESTIONS[path.at(-1)!.q].options[path.at(-1)!.choice].next;
  const result = current in PRIMITIVES ? (current as Primitive) : null;
  const question = result ? null : QUESTIONS[current];

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.35fr]">
      <div className="flex flex-col gap-3">
        {path.map((step, i) => {
          const q = QUESTIONS[step.q];
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPath(path.slice(0, i))}
              className="flex items-center justify-between rounded-lg border border-line bg-panel-2/40 px-3 py-2 text-left text-sm hover:border-faint"
              title="Change this answer"
            >
              <span className="text-muted">{q.text}</span>
              <span className="font-medium text-ink">{q.options[step.choice].label}</span>
            </button>
          );
        })}
        {question && (
          <div key={question.id} className="animate-rise rounded-xl border border-accent/40 bg-accent/[0.04] p-4">
            <div className="mb-3 font-medium">{question.text}</div>
            <div className="grid gap-2">
              {question.options.map((o, i) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setPath([...path, { q: question.id, choice: i }])}
                  className="rounded-lg border border-line bg-panel px-3 py-2.5 text-left transition hover:-translate-y-px hover:border-accent/60"
                >
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-muted">{o.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {result && (
          <div className="animate-rise rounded-xl border border-ok/40 bg-ok/[0.05] p-4">
            <div className="text-xs tracking-wide text-ok uppercase">Use a</div>
            <div className="mt-1 text-2xl font-semibold">{result}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{VERDICT[result]}</p>
            <div className="mt-3 flex gap-2">
              {PRIMITIVES[result].href !== "/" && (
                <Link href={PRIMITIVES[result].href} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-black hover:brightness-110">
                  See it running →
                </Link>
              )}
              <Button variant="ghost" onClick={() => setPath([])}>
                Start over
              </Button>
            </div>
          </div>
        )}
      </div>
      <PropertyMatrix highlight={result} />
    </div>
  );
}

const COLUMNS: { key: keyof Props; label: string }[] = [
  { key: "number", label: "Number" },
  { key: "axis", label: "Axis" },
  { key: "cast", label: "Cast" },
  { key: "cancelable", label: "Cancel" },
  { key: "flow", label: "Info" },
  { key: "strategy", label: "Control" },
  { key: "everyValue", label: "Lossless" },
];

export function PropertyMatrix({ highlight }: { highlight?: Primitive | null }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-panel">
      <table className="w-full min-w-[520px] text-xs">
        <thead>
          <tr className="text-left text-[10px] tracking-wide text-faint uppercase">
            <th className="px-3 py-2 font-medium" />
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(Object.keys(PRIMITIVES) as Primitive[]).map((name) => {
            const p = PRIMITIVES[name];
            return (
              <tr
                key={name}
                className={clsx(
                  "border-t border-line/60 transition",
                  highlight && highlight !== name && "opacity-35",
                  highlight === name && "bg-ok/[0.06]",
                )}
              >
                <td className="px-3 py-2 text-sm font-medium">
                  <Link href={p.href} className="hover:text-accent">
                    {name}
                  </Link>
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-2 py-2 font-mono">
                    <Cell k={c.key} v={p[c.key]} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ k, v }: { k: keyof Props; v: Props[keyof Props] }) {
  if (typeof v === "boolean") return <span className={v ? "text-ok" : "text-faint"}>{v ? "yes" : "no"}</span>;
  const tone =
    k === "axis" ? (v === "spatial" ? "text-space" : "text-time") : k === "cast" ? (v === "unicast" ? "text-setter" : v === "broadcast" ? "text-getter" : "text-faint") : k === "strategy" && v === "pressure" ? "text-info" : "text-muted";
  return <span className={tone}>{v}</span>;
}
