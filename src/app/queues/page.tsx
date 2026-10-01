import { Fragment } from "react";
import { PageHeader, Takeaways } from "@/components/ui";
import { Code } from "@/components/Code";
import { QueueDemo } from "@/components/queues/QueueDemo";
import { SemaphoreDemo } from "@/components/queues/SemaphoreDemo";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/queues");

const QUEUE = `
function PromiseQueue() {
  var ends = Promise.defer();
  this.put = function (value) {
    var next = Promise.defer();
    ends.resolve({ head: value, tail: next.promise });
    ends.resolve = next.resolve;
  };
  this.get = function () {
    var result = ends.promise.get("head");
    ends.promise = ends.promise.get("tail");
    return result;
  };
}`;

const SEMAPHORE = `
var connections = new Queue();
connections.put(connectToDb());
connections.put(connectToDb());
connections.put(connectToDb());

function work() {
  return connections.get()
  .then(function (db) {
    return workWithDb(db)
    .finally(function () {
      connections.put(db);
    });
  });
}`;

export default function QueuesPage() {
  return (
    <>
      <PageHeader
        n="06"
        title="Promise queues: you can get() before anyone put()"
        quote="Just as you can attach an observer to a promise before it is resolved, with a promise queue, you can get a promise for the next value in order before that value has been given."
      >
        With a conventional queue you must put a value in before you can take it out. A promise queue removes that
        ordering: <code className="font-mono text-getter">get()</code> returns a promise right away, and the i-th get is
        paired with the i-th put whenever it arrives. Internally it is an asynchronous linked list of deferreds — a{" "}
        <code className="font-mono">head</code> promise and a <code className="font-mono">tail</code> resolver.
      </PageHeader>

      <div className="space-y-4">
        <QueueDemo />
        <div className="grid gap-4 lg:grid-cols-2">
          <Code code={QUEUE} title="q/queue — Mark Miller's concurrency strawman" />
          <div className="rounded-xl border border-line bg-panel p-4 text-sm leading-relaxed text-muted">
            <div className="mb-2 text-xs font-semibold tracking-wide uppercase">Plural · temporal · value</div>
            <table className="w-full font-mono text-xs">
              <tbody>
                <tr className="border-b border-line"><td className="py-1.5 text-ink">PromiseQueue</td><td>Value</td><td>Plural</td><td>Temporal</td></tr>
                <tr className="border-b border-line"><td className="py-1.5 text-getter">queue.get</td><td>Getter</td><td>Plural</td><td>Temporal</td></tr>
                <tr><td className="py-1.5 text-setter">queue.put</td><td>Setter</td><td>Plural</td><td>Temporal</td></tr>
              </tbody>
            </table>
            <p className="mt-3">
              Because <code className="font-mono">get</code> and <code className="font-mono">put</code> are free functions in a closure, you
              can hand <code className="font-mono text-getter">get</code> to a consumer and <code className="font-mono text-setter">put</code> to a
              producer: the principle of least authority, and data flows one way. A queue has no notion of termination — that comes
              later, when two queues become a <a className="text-accent underline-offset-2 hover:underline" href="/streams">stream</a>.
            </p>
          </div>
        </div>

        <SemaphoreDemo />
        <Code code={SEMAPHORE} title="a promise queue as a semaphore over a connection pool" />
      </div>

      <Takeaways
        items={[
          <Fragment key="1">Promises come out in the order puts go in, but a later get can settle sooner: put a promise, and its get waits for it while the next get resolves. Try the “resolves sooner” scenario.</Fragment>,
          <Fragment key="2">A reactive program doesn&apos;t block. Instead of a thread stopping at a semaphore, a worker holds a promise for a connection and continues when it resolves.</Fragment>,
          <Fragment key="3"><code className="font-mono">finally</code> returns the resource whether the work succeeded or failed, so the pool can&apos;t leak. A single promise is a mutex; a queue of N values is a counting semaphore.</Fragment>,
        ]}
      />
    </>
  );
}
