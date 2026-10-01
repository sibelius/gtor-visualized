import { Fragment } from "react";
import { Code } from "@/components/Code";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { ArrayGenerator } from "@/components/generators/ArrayGenerator";
import { GeneratorStepper } from "@/components/generators/GeneratorStepper";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/generators");

const RANGE = `
function *range(start, stop, step) {
    while (start < stop) {
        yield start;
        start += step;
    }
}

var iterator = range(0, Infinity, 1);
expect(iterator.next().value).toBe(0);
expect(iterator.next().value).toBe(1);
expect(iterator.next().value).toBe(2);`;

const ARRAY_GEN = `
var array = [];
var generator = generate(array);
generator.yield(10);
generator.yield(20);
generator.yield(30);
expect(array).toEqual([10, 20, 30]);`;

export default function GeneratorsPage() {
  return (
    <>
      <PageHeader
        n="02 · plural · spatial · setter"
        title="Generator functions: a conversation in both directions"
        quote="Calling a generator function does not execute the function, but instead sets up a state machine to track where we are in the function and returns an iterator."
      >
        A generator function writes the lazy <code className="font-mono text-ink">range</code> as plain procedural code. Its iterator gets more than{" "}
        <code className="font-mono">next()</code>: the consumer can pass a value back in as the result of <code className="font-mono">yield</code>,
        throw an error in at the paused <code className="font-mono">yield</code>, or <code className="font-mono">return</code> early. Information flows
        forward as values and backward as requests.
      </PageHeader>

      <GeneratorStepper />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Clarity restored" bodyClassName="space-y-3">
          <p className="text-sm leading-relaxed text-muted">
            The generator version of <code className="font-mono">range</code> reads like the eager array maker but behaves like the lazy iterator. Each{" "}
            <code className="font-mono">next()</code> resumes the function until the next <code className="font-mono">yield</code>.
          </p>
          <Code code={RANGE} />
          <p className="text-sm leading-relaxed text-muted">
            Java iterators have <code className="font-mono">hasNext()</code>, but a generator can&apos;t: knowing whether more values exist would mean
            running arbitrary code ahead of time, which is the{" "}
            <a href="http://en.wikipedia.org/wiki/Halting_problem" className="text-ink underline decoration-line underline-offset-2">
              Halting Problem
            </a>
            . The iterator has to ask for a value before the generator can say it has none.
          </p>
        </Panel>
        <Panel title="The array generator: yield as a method" bodyClassName="space-y-3">
          <p className="text-sm leading-relaxed text-muted">
            If an array iterator consumes an array, an array generator would produce one. It&apos;s of dubious use on its own, but it sets up the
            interface asynchronous generators need: <code className="font-mono">yield</code>, <code className="font-mono">return</code> and{" "}
            <code className="font-mono">throw</code> as methods on the setter side.
          </p>
          <Code code={ARRAY_GEN} />
          <ArrayGenerator />
        </Panel>
      </div>

      <Takeaways
        items={[
          <Fragment key="1">
            The first <code className="font-mono">next()</code> only primes the generator: it runs to the first <code className="font-mono">yield</code>{" "}
            and nothing receives its argument. Watch <code className="font-mono">tick</code> print before any value goes in.
          </Fragment>,
          <Fragment key="2">
            <code className="font-mono">next(value)</code> sending data back to the producer is a preview of how a stream reader pushes back on its writer.
          </Fragment>,
          <Fragment key="3">
            <code className="font-mono">throw</code> and <code className="font-mono">return</code> unwind the stack and run{" "}
            <code className="font-mono">finally</code> blocks. That is how a consumer can stop a producer early, which streams build on for cancellation.
          </Fragment>,
        ]}
      />
    </>
  );
}
