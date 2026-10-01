"use client";

import { useState } from "react";
import clsx from "clsx";

const ROWS = [
  ["Value", "Value", "Singular", "Spatial"],
  ["Getter", "Getter", "Singular", "Spatial"],
  ["Setter", "Setter", "Singular", "Spatial"],
  ["Array", "Value", "Plural", "Spatial"],
  ["Iterator", "Getter", "Plural", "Spatial"],
  ["Generator", "Setter", "Plural", "Spatial"],
  ["Deferred", "Value", "Singular", "Temporal"],
  ["Promise", "Getter", "Singular", "Temporal"],
  ["Resolver", "Setter", "Singular", "Temporal"],
  ["Stream", "Value", "Plural", "Temporal"],
  ["Reader", "Getter", "Plural", "Temporal"],
  ["Writer", "Setter", "Plural", "Temporal"],
] as const;

const FILTERS = [
  ["Value", "Getter", "Setter"],
  ["Singular", "Plural"],
  ["Spatial", "Temporal"],
] as const;

const TONE: Record<string, string> = {
  Getter: "text-getter",
  Setter: "text-setter",
  Value: "text-ink",
  Spatial: "text-space",
  Temporal: "text-time",
  Singular: "text-muted",
  Plural: "text-muted",
};

/** The essay's twelve interfaces. Pick any combination of facets to highlight. */
export function InterfaceTable() {
  const [picked, setPicked] = useState<(string | null)[]>([null, null, null]);
  const toggle = (col: number, v: string) => setPicked((p) => p.map((x, i) => (i === col ? (x === v ? null : v) : x)));
  const matches = (row: readonly string[]) => picked.every((p, i) => p == null || row[i + 1] === p);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
        {FILTERS.map((group, col) => (
          <div key={col} className="flex gap-1">
            {group.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggle(col, v)}
                className={clsx(
                  "rounded-md border px-2 py-0.5 font-mono text-[11px] transition",
                  picked[col] === v ? "border-accent/60 bg-accent/10 text-accent" : "border-line text-muted hover:text-ink",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-faint uppercase">
              <th className="py-1.5 pr-4 font-medium">Interface</th>
              <th className="py-1.5 pr-4 font-medium">Role</th>
              <th className="py-1.5 pr-4 font-medium">Number</th>
              <th className="py-1.5 font-medium">Axis</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row[0]} className={clsx("border-t border-line/60 transition-opacity", !matches(row) && "opacity-25")}>
                <td className="py-1.5 pr-4 font-medium">{row[0]}</td>
                {row.slice(1).map((c, i) => (
                  <td key={i} className={clsx("py-1.5 pr-4 font-mono text-xs", TONE[c])}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
