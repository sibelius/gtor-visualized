import { Fragment } from "react";
import { PageHeader, Takeaways } from "@/components/ui";
import { Code } from "@/components/Code";
import { ShapesDemo } from "@/components/async-generators/ShapesDemo";
import { ShakespeareDemo } from "@/components/async-generators/ShakespeareDemo";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/async-generators");

const SHAKESPEARE = `
async function *shakespeare(titles) {
  for (let title of titles) {
    var quotes = await getQuotes(title);
    for (let quote of quotes) {
      await yield quote;
    }
  }
}

var reader = shakespeare(["Hamlet", "Macbeth", "Othello"]);
reader.reduce(function (length, quote) {
  return length + quote.length;
}, 0, null, 100)
.then(function (totalLength) {
  console.log(totalLength);
});`;

const FOR_OF = `
for (let a of [1, 2, 3]) {
  console.log(a);
}

// is equivalent to:
var anIterator = anIterable[Symbol.iterator]();
while (true) {
  let anIteration = anIterator.next();
  if (anIteration.done) {
    break;
  } else {
    console.log(anIteration.value);
  }
}`;

const FOR_ON = `
for (let a on anAsyncIterable) {   // today: for await (... of ...)
  console.log(a);
}

// is equivalent to:
var anAsyncIterator = anAsyncIterable[Symbol.asyncIterator]();
while (true) {
  let anIteration = await anAsyncIterator.next();
  if (anIteration.done) {
    break;
  } else {
    console.log(anIteration.value);
  }
}`;

const COPY = `
Stream.prototype.copy = function (stream) {
  return this.forEach(stream.yield)
    .then(stream.return, stream.throw);
};

// iterator.copy(generator) — or stream.pipe(stream) —
// forwards every value; the promise yield returns
// pushes back on forEach, and so on the source.`;

export default function AsyncGeneratorsPage() {
  return (
    <>
      <PageHeader
        n="08"
        title="Async generators: await and yield, orthogonal"
        quote="An asynchronous generator function uses both await and yield. The await term allows the function to idle until some asynchronous work has settled, and the yield allows the function to produce a value. An asynchronous generator returns a promise iterator, the output side of a stream."
      >
        A generator function returns an iterator; an async function returns a promise. What should an async generator
        return — an iterator of promises, or a promise for iterations? The answer decides what{" "}
        <code className="font-mono">done</code> and errors mean, and it&apos;s the shape JavaScript eventually shipped as{" "}
        <code className="font-mono">Symbol.asyncIterator</code> and <code className="font-mono">for await</code>.
      </PageHeader>

      <div className="space-y-4">
        <ShapesDemo />
        <ShakespeareDemo />
        <Code code={SHAKESPEARE} title="from the essay (await yield = wait for the consumer's ack)" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Code code={FOR_OF} title="for … of: walk a synchronous iterator" />
          <Code code={FOR_ON} title="for … on: the same loop, one await added" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Code code={COPY} title="copy / pipe in terms of forEach" />
          <div className="rounded-xl border border-line bg-panel p-4 text-sm leading-relaxed text-muted">
            <p>
              Look for the single <code className="font-mono text-time">await</code> in the desugared <code className="font-mono">for … on</code>:
              that is the entire difference between consuming a collection in space and one in time. Because{" "}
              <code className="font-mono">await</code> accepts plain values too, the loop works on synchronous iterables as well.
            </p>
            <p className="mt-2">
              Jafar Husain&apos;s proposal had <code className="font-mono">asyncIterator.observe(asyncGenerator)</code>; in this framework that is
              just <code className="font-mono">copy</code>, built from <code className="font-mono">forEach</code>, which is built from{" "}
              <code className="font-mono">next</code> — the same layering as for a synchronous iterator.
            </p>
          </div>
        </div>
      </div>

      <Takeaways
        items={[
          <Fragment key="1"><code className="font-mono">Promise&lt;Iteration&lt;T&gt;&gt;</code> lets the source say “done” when it actually knows, and lets a rejection mean the sequence ended abnormally rather than one value went missing.</Fragment>,
          <Fragment key="2">A native async generator is pull-only: with a slow consumer it sits paused at every <code className="font-mono">yield</code>. Switch to the buffer to see the producer fetch ahead while the consumer works.</Fragment>,
          <Fragment key="3">Keeping <code className="font-mono">await</code> and <code className="font-mono">yield</code> separate lets you choose: await the ack to respect pressure, or yield without waiting and let the buffer grow.</Fragment>,
        ]}
      />
    </>
  );
}
