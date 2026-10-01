import { Fragment } from "react";
import { Code } from "@/components/Code";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { NextPlayground } from "@/components/iterators/NextPlayground";
import { PipelineDemo } from "@/components/iterators/PipelineDemo";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/iterators");

const RANGE_LAZY = `
function range(start, stop, step) {
    return {next: function () {
        var iteration;
        if (start < stop) {
            iteration = {value: start};
            start += step;
        } else {
            iteration = {done: true};
        }
        return iteration;
    }};
}`;

const RANGE_EAGER = `
function range(start, stop, step) {
    var result = [];
    while (start < stop) {
        result.push(start);
        start += step;
    }
    return result;
}

expect(range(0, 6, 2)).toEqual([0, 2, 4]);`;

const PIPELINE = `
range(0, 1000, 1)
.map(function (n) {
    return n * 2;
})
.filter(function (n) {
    return n % 3 !== 0;
})
.reduce(function (a, b) {
    return a + b;
})`;

export default function IteratorsPage() {
  return (
    <>
      <PageHeader
        n="01 · plural · spatial · getter"
        title="Iterators: lazy, pulled one value at a time"
        quote="What distinguishes an iterator from an array is that it is lazy. An iterator does not necessarily end."
      >
        An iterator is the plural getter for values in space. It implements <code className="font-mono text-ink">next()</code>, which returns an{" "}
        <em>iteration</em>: an object with a <code className="font-mono">value</code>, a <code className="font-mono">done</code> flag, or both. The
        consumer pulls, and nothing is computed until it does.
      </PageHeader>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="An iteration at a time">
          <NextPlayground />
        </Panel>
        <Panel title="range(), lazy and eager" bodyClassName="space-y-3">
          <Code code={RANGE_LAZY} title="lazy: returns an iterator" />
          <Code code={RANGE_EAGER} title="eager: returns an array" />
        </Panel>
      </div>

      <div className="mt-8 mb-3 grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold">The same pipeline, read two ways</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            This chain is eager or lazy depending only on whether <code className="font-mono">range</code> returns an array or an iterator. With
            arrays, <code className="font-mono">map</code> and <code className="font-mono">filter</code> each build another large array. With
            iterators, a single value percolates through: the reducer pulls from the filter, the filter from the map, the map from the range.
          </p>
        </div>
        <Code code={PIPELINE} />
      </div>
      <PipelineDemo />

      <Takeaways
        items={[
          <Fragment key="1">
            Laziness saves time and space. A lazy pipeline never builds an array of any size, so the memory cost doesn&apos;t depend on how many values
            flow through it.
          </Fragment>,
          <Fragment key="2">
            An iterator can be infinite. <code className="font-mono">range(0, Infinity, 1)</code> is fine as an iterator and impossible as an array,
            which is why eager mode refuses to run it.
          </Fragment>,
          <Fragment key="3">
            The consumer sets the pace: values only move when someone calls <code className="font-mono">next()</code>. That pull is the spatial
            version of what <em>pressure</em> does for streams later on.
          </Fragment>,
        ]}
      />
    </>
  );
}
