import { Fragment } from "react";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { Code } from "@/components/Code";
import { TaskDemo } from "@/components/tasks/TaskDemo";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/tasks");

const CODE = `
var task = new Task(function (resolver, signal) {
  doExpensiveWork({ signal }).then(resolver.return, resolver.throw);
});

var a = task.fork();
var b = task.fork();
a.done(render);
b.done(render);

a.throw(new Error("Never mind"));  // b still waiting, work continues
b.throw(new Error("Never mind"));  // no subscribers left → work aborts

var promise = Promise.resolve(task); // coerce to a shareable promise`;

export default function TasksPage() {
  return (
    <>
      <PageHeader
        n="04"
        title="Tasks: unicast, and therefore cancelable"
        quote="A task has mostly the same form and features as a promise, but is unicast by default and can be cancelled. … If all subscribers have unsubscribed and no further subscribers can be introduced, a task can abort its work."
      >
        Promises can&apos;t abort work in progress, because that would let one consumer interfere with another. A task
        trades broadcast for control: one subscriber at a time, explicit <code className="font-mono">fork()</code> for
        sharing, and information flowing upstream as a cancellation.
      </PageHeader>

      <div className="space-y-4">
        <TaskDemo />
        <Panel title="The shape of a task">
          <Code code={CODE} />
        </Panel>
      </div>

      <Takeaways
        items={[
          <Fragment key="1">
            Cancellation needs ownership. Because a task has one observer, that observer can safely say &ldquo;never
            mind&rdquo; — nobody else is relying on the result.
          </Fragment>,
          <Fragment key="2">
            <code className="font-mono">fork()</code> makes sharing explicit and reference-counts interest. The work stops
            only when the <em>last</em> fork is cancelled, never sooner.
          </Fragment>,
          <Fragment key="3">
            Cancelling a task is the singular dual of <code className="font-mono">iterator.throw()</code> on a generator,
            and foreshadows a stream reader telling its writer to stop.
          </Fragment>,
        ]}
      />
    </>
  );
}
