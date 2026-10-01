import { Fragment } from "react";
import { Code } from "@/components/Code";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { ProgressDemo } from "@/components/progress/ProgressDemo";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/progress");

const DISCRETE = `
// Discrete: pushed each time another value arrives.
var progress = index / length;

var elapsed = now - start;
var throughput = index / elapsed;

// Estimated time of completion.
var stop = start + elapsed / progress;
var stop = start + elapsed / (index / length);
var stop = start + elapsed * length / index;
`;

const CONTINUOUS = `
// Continuous: derived from the last known estimate,
// sampled whenever the consumer wants — here, every frame.
var progress = (now - start) / (estimate - start);
`;

export default function ProgressPage() {
  return (
    <>
      <PageHeader
        n="11"
        title="Progress and estimated time to completion"
        quote="We could update a progress bar whenever we receive a new value, but frequently we would want to display a smooth animation continuously changing. … Values that lack an inherent resolution are continuous. It becomes the responsibility of the consumer to determine when to sample, pull or poll the value."
      >
        The essay&apos;s case study ties the primitives together. A <b className="text-ink">stream</b> is copied into an
        array. Each arrival pushes discrete <b className="text-ink">signals</b>: progress and throughput. From those we
        derive an estimated stop time, and from that a continuous <b className="text-ink">behavior</b> that a progress bar
        polls on every animation frame.
      </PageHeader>

      <ProgressDemo />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Discrete time series · push">
          <Code code={DISCRETE} />
        </Panel>
        <Panel title="Continuous time series · poll">
          <Code code={CONTINUOUS} />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            For a smooth animation of a continuous behavior, the frame rate is a sensible polling frequency. Ideally
            progress proceeds linearly from 0 at the start time to 1 at the stop time.
          </p>
        </Panel>
      </div>

      <Takeaways
        items={[
          <Fragment key="1">
            Progress measured on arrival is discrete: it does not change between events, so it is pushed. The stepped bar
            is honest but jerky, and it freezes whenever the stream stalls.
          </Fragment>,
          <Fragment key="2">
            The estimate turns those discrete measurements into a continuous function of time. The display picks its own
            sampling rate; the stream never needs to know there is an animation.
          </Fragment>,
          <Fragment key="3">
            One task, three primitives: a stream with back pressure moves the data, signals report on it, a behavior is
            sampled for display. Choosing the right one for each role is the point of the theory.
          </Fragment>,
        ]}
      />
    </>
  );
}
