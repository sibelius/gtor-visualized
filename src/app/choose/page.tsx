import { Fragment } from "react";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { Chooser } from "@/components/choose/Chooser";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/choose");

const CONVERSIONS = [
  ["Promise", "Task", "coerce either way; a task forks into a promise"],
  ["Signal", "Behavior", "an observable's next() polls the latest value"],
  ["Behavior", "Signal", "sample on a clock, push the samples"],
  ["Signal", "Stream", "buffer pushed values so none are lost"],
  ["Stream", "Signal", "drop pressure, broadcast each value"],
  ["Iterator", "Stream", "Stream.from(iterable) lifts it onto the time axis"],
  ["Stream", "Promise", "all(), join(), read(): collect into one value"],
];

export default function ChoosePage() {
  return (
    <>
      <PageHeader
        n="12"
        title="Choose a primitive"
        quote="Bringing all of these reactive concepts into a single framework gives us an opportunity to tell a coherent story about reactive programming, promotes a better understanding about what tool is right for the job, and obviates the debate over whether any single primitive is a silver bullet."
      >
        No primitive covers every case, and the essay argues none should. Answer a few questions about your data to find the
        primitive that fits. The matrix shows how they differ.
      </PageHeader>

      <Chooser />

      <Panel title="Passing one primitive to another" className="mt-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONVERSIONS.map(([from, to, how]) => (
            <div key={from + to} className="rounded-lg border border-line bg-panel-2/40 px-3 py-2">
              <div className="font-mono text-xs">
                <span className="text-ink">{from}</span> <span className="text-accent">→</span> <span className="text-ink">{to}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">{how}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Takeaways
        items={[
          <Fragment key="1">There is a tension between cancelability and robustness. Promises guarantee that consumers and producers can&apos;t interfere; tasks and streams cooperate, so they can cancel.</Fragment>,
          <Fragment key="2">Use pressure to handle resource contention when every value matters. Use push (signals) or poll (behaviors) to skip states that don&apos;t.</Fragment>,
          <Fragment key="3">The primitives are related, so converting between them is cheap. Promises and tasks make a good channel for plural signals and behaviors.</Fragment>,
        ]}
      />
    </>
  );
}
