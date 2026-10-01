import { Fragment } from "react";
import { Code } from "@/components/Code";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { ClockDemo, SignalDemo } from "@/components/signals/SignalDemo";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/signals");

const SIGNAL = `
// The getter side is an observable: forEach subscribes to pushes.
signal.out.forEach(function (value, time, signal) {
    console.log(value);
});

// The setter side is a signal generator. Unlike a stream writer,
// yield does not return a promise. Nobody can push back.
signal.in.yield(10);

// Observables also implement next: poll the most recent value,
// as if the signal were a behavior.
signal.out.next(); // { value: 10, done: false }
`;

const CLOCK = `
var tick = new Clock({period: 1000});
var tock = new Clock({period: 1000, offset: 500});
tick.forEach(function (time) {
    console.log("tick", time);
});
tock.forEach(function (time) {
    console.log("tock", time);
});
`;

export default function SignalsPage() {
  return (
    <>
      <PageHeader
        n="09"
        title="Signals push discrete changes to anyone listening"
        quote="The discrete event pusher is a Signal. … Signals do not support pressure. Just as yield does not return a promise, the callback you give to forEach does not accept a promise. A signal can only push."
      >
        A scroll position or a pointer location changes only when an event happens. A signal carries those changes: it is
        plural and temporal like a stream, but it is broadcast, has any number of producers and consumers, and gives no
        guarantee of continuity. An observer sees whatever was pushed while it was subscribed, and nothing else.
      </PageHeader>

      <div className="space-y-4">
        <SignalDemo />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="The interface">
            <Code code={SIGNAL} />
          </Panel>
          <Panel title="A signal with no generator">
            <p className="mb-3 text-sm leading-relaxed text-muted">
              Not every observable is paired with a signal generator. A clock emits the current time at a period and
              offset. Ours is only active while someone observes it: the last unsubscribe clears its timer.
            </p>
            <Code code={CLOCK} />
          </Panel>
        </div>
        <ClockDemo />
      </div>

      <Takeaways
        items={[
          <Fragment key="1">
            <code className="font-mono">in.yield</code> returns <code className="font-mono">undefined</code>. With no
            acknowledgement there is no back pressure: the producer never waits, so it can never be slowed down by a slow
            observer. Slow observers simply miss or skip states.
          </Fragment>,
          <Fragment key="2">
            Signals are broadcast. Observers come and go without affecting the producer or each other. A late subscriber
            starts from now; a stream would have buffered every value until its single reader arrived.
          </Fragment>,
          <Fragment key="3">
            Because the meaning of the data is &ldquo;the latest state&rdquo;, dropping intermediate values is correct, not
            lossy. That is the contract that lets signals avoid over-commitment without pressure.
          </Fragment>,
        ]}
      />
    </>
  );
}
