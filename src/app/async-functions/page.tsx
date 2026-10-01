import { Fragment } from "react";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { Code } from "@/components/Code";
import { TrampolineDemo } from "@/components/async-functions/TrampolineDemo";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/async-functions");

const ASYNC = `
Promise.async = function async(generate) {
  return function () {
    function resume(verb, argument) {
      var result;
      try {
        result = generator[verb](argument);
      } catch (exception) {
        return Promise.throw(exception);
      }
      if (result.done) {
        return result.value;
      } else {
        return Promise.return(result.value).then(donext, dothrow);
      }
    }
    var generator = generate.apply(this, arguments);
    var donext = resume.bind(this, "next");
    var dothrow = resume.bind(this, "throw");
    return donext();
  };
};`;

const PRECEDENCE = `
async function addPromises(a, b) {
  return await a + await b;
}`;

export default function AsyncFunctionsPage() {
  return (
    <>
      <PageHeader
        n="05"
        title="Async functions: a generator driven by a promise trampoline"
        quote="The key insight is a single, concise method that decorates a generator, creating an internal “promise trampoline”."
      >
        A generator can pause at <code className="font-mono">yield</code> and be resumed with a value through{" "}
        <code className="font-mono">next(value)</code>, or with an error through <code className="font-mono">throw(error)</code>.
        Yield promises, and let a small loop resume the generator whenever each one settles: you get asynchronous code that
        reads top to bottom. <code className="font-mono">async</code>/<code className="font-mono">await</code> is that loop
        built into the language.
      </PageHeader>

      <TrampolineDemo />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Mark Miller's async decorator">
          <Code code={ASYNC} />
        </Panel>
        <Panel title="Why special syntax anyway?">
          <p className="mb-3 text-sm leading-relaxed text-muted">
            <code className="font-mono">await</code> binds tighter than <code className="font-mono">yield</code>, so it composes
            inside expressions. Decoupling async functions from generator functions also frees{" "}
            <code className="font-mono">yield</code> for something else: async <em>generator</em> functions, the plural and
            temporal getter.
          </p>
          <Code code={PRECEDENCE} />
        </Panel>
      </div>

      <Takeaways
        items={[
          <Fragment key="1">
            The trampoline has three outcomes per step: <span className="text-setter">yield</span> waits on the promise and
            resumes, <span className="text-getter">return</span> fulfills the outer promise, and{" "}
            <span className="text-bad">throw</span> rejects it.
          </Fragment>,
          <Fragment key="2">
            A rejected yielded promise doesn&apos;t crash the trampoline: it is thrown <em>into</em> the generator at the
            paused <code className="font-mono">yield</code>, where an ordinary <code className="font-mono">try/catch</code>{" "}
            could recover.
          </Fragment>,
          <Fragment key="3">
            Starting the database and password lookups before yielding on <code className="font-mono">Promise.all</code> runs
            them concurrently. Watch both bars fill at once.
          </Fragment>,
        ]}
      />
    </>
  );
}
