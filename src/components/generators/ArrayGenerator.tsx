"use client";

import { useState } from "react";
import { trace } from "@/gtor/trace";
import { Button } from "../ui";

/** The essay's hypothetical array generator: `yield` as a method that appends. */
export function ArrayGenerator() {
  const [array, setArray] = useState<number[]>([]);
  const next = (array.length + 1) * 10;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={() => {
            trace.emit("Generator", "generate(array)", "set", `yield(${next})`);
            setArray((a) => [...a, next]);
          }}
        >
          generator.yield({next})
        </Button>
        <Button variant="ghost" onClick={() => setArray([])}>
          Reset
        </Button>
      </div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-bg/60 p-2 font-mono text-sm">
        <span className="text-faint">array = [</span>
        {array.map((v, i) => (
          <span key={i} className="animate-pop rounded-md border border-setter/40 bg-setter/10 px-2 py-0.5 text-setter">
            {v}
          </span>
        ))}
        <span className="text-faint">]</span>
      </div>
    </div>
  );
}
