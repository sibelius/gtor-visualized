import { Fragment } from "react";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { Code } from "@/components/Code";
import { PressureDemo } from "@/components/streams/PressureDemo";
import { ForkShareDemo } from "@/components/streams/ForkShareDemo";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/streams");

const BUFFER = `
var outbound = new PromiseQueue();
var inbound = new PromiseQueue();
var buffer = {
  out: {                       // the reader: an async iterator
    next: function (value) {
      outbound.put({ value: value, done: false });
      return inbound.get();
    },
    // return, throw ...
  },
  in: {                        // the writer: an async generator
    yield: function (value) {
      inbound.put({ value: value, done: false });
      return outbound.get();   // a promise for the consumer's ack
    },
    // return, throw ...
  }
};`;

const FIB = `
var buffer = new Buffer(1024);   // prime 1024 acks
function fibStream(a, b) {
  return buffer.in.yield(a)
  .then(function () {             // wait: this is the pressure
    return fibStream(b, a + b);
  });
}
fibStream(1, 1).done();
return buffer.out;

// later, from the consumer side:
buffer.out.throw(new Error("That's enough, thanks"));`;

const FORK = `
var slow = stream.map(function (n) {
  return Promise.return(n).delay(200);
});
var fast = stream.map(function (n) {
  return Promise.return(n).delay(100);
});`;

const VOCAB: [string, string, "setter" | "getter"][] = [
  ["in.yield(value)", "write", "setter"],
  ["in.return()", "close", "setter"],
  ["in.throw(error)", "terminate prematurely with an error", "setter"],
  ["out.next()", "read", "getter"],
  ["out.throw(error)", "abort or cancel with an error", "getter"],
  ["out.return()", "abort or cancel prematurely, without an error", "getter"],
];

export default function StreamsPage() {
  return (
    <>
      <PageHeader
        n="07"
        title="Streams: an array rotated onto the time axis, with pressure"
        quote="On the producer side, a vacuum stalls the consumer and a pressure sends values forward. On the consumer side, a vacuum draws values forward and pressure, often called back pressure, stalls the producer."
      >
        A stream must deliver every value, in order, to one consumer. Producer and consumer rarely run at the same rate,
        so a buffer sits between them: two promise queues, one carrying values forward and one carrying
        acknowledgements back. Each <code className="font-mono text-setter">in.yield()</code> returns a promise for an
        ack; a producer that waits for it can never outrun the consumer by more than the buffer&apos;s length.
      </PageHeader>

      <div className="space-y-4">
        <PressureDemo />

        <div className="grid gap-4 lg:grid-cols-2">
          <Code code={BUFFER} title="a promise buffer: two queues, entangled" />
          <div className="space-y-4">
            <Code code={FIB} title="pressure: the producer idles until acked" />
            <Panel title="Iterator vocabulary → stream vocabulary">
              <table className="w-full font-mono text-xs">
                <tbody>
                  {VOCAB.map(([method, meaning, side]) => (
                    <tr key={method} className="border-b border-line last:border-0">
                      <td className={side === "setter" ? "py-1.5 text-setter" : "py-1.5 text-getter"}>{method}</td>
                      <td className="py-1.5 text-muted">means “{meaning}”</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        </div>

        <ForkShareDemo />
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Code code={FORK} title="two consumers of one stream" />
          <div className="rounded-xl border border-line bg-panel p-4 text-sm leading-relaxed text-muted">
            <p>
              Streams are <strong className="text-ink">unicast</strong>: the consumer expects every value, so information
              flows both ways and either side can end the flow. That&apos;s also what makes them cancelable.
            </p>
            <p className="mt-2">
              Handing one reader to two consumers gives <strong className="text-ink">round-robin load balancing</strong>: each
              sees an exclusive part of the stream, and pressure can only be lower than with one consumer — up to 15 values
              per second here. A <strong className="text-ink">fork</strong> sends every value to each branch; the slowest branch
              sets the pressure, so it can only be higher. Lower the source rate below 10/s and the shared reader distributes
              values fairly.
            </p>
          </div>
        </div>
      </div>

      <Takeaways
        items={[
          <Fragment key="1">Back pressure is just a promise the producer waits on. Make the producer faster than the consumer and watch it spend most of its time stalled, while the buffer stays bounded.</Fragment>,
          <Fragment key="2"><code className="font-mono">Buffer(length)</code> primes the ack queue: it trades memory for latency, letting the producer run ahead so the consumer rarely starves. Concurrency in <code className="font-mono">forEach</code> raises the consumer&apos;s rate instead.</Fragment>,
          <Fragment key="3">Because the consumer talks back, it can stop the producer: <code className="font-mono">out.throw()</code> rejects the producer&apos;s pending <code className="font-mono">yield</code>. A promise could never do that — it&apos;s broadcast.</Fragment>,
        ]}
      />
    </>
  );
}
