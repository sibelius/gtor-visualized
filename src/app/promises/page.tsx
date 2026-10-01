import { Fragment } from "react";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { Code } from "@/components/Code";
import { DeferredDemo } from "@/components/promises/DeferredDemo";
import { ThenChain } from "@/components/promises/ThenChain";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/promises");

const THEN = `
Promise.prototype.then = function (onreturn, onthrow) {
  var deferred = Promise.defer();
  var resolver = deferred.resolver;
  this.done(function (value) {
    if (onreturn) {
      try { resolver.return(onreturn(value)); }
      catch (error) { resolver.throw(error); }
    } else {
      resolver.return(value);
    }
  }, function (error) {
    if (onthrow) {
      try { resolver.return(onthrow(error)); }
      catch (error) { resolver.throw(error); }
    } else {
      resolver.throw(error);
    }
  });
  return deferred.promise;
};`;

const VOCAB = `
// gtor's names                 // the standard's names
resolver.return(10);            resolve(10);
resolver.return(promise);       resolve(promise);
resolver.throw(error);          reject(error);

// The standard hides the deferred behind a "revealing constructor":
var promise = new Promise(function (resolve, reject) {
  // ...only the code in here holds the setter
});`;

export default function PromisesPage() {
  return (
    <>
      <PageHeader
        n="03"
        title="Promises: a getter for one value from the past or the future"
        quote="Promises are broadcast. … One consumer cannot prevent another consumer from making progress. Information flows in one direction."
      >
        A promise is the temporal analogue of a value. Its setter is the <strong className="text-setter">resolver</strong>,
        its getter is the <strong className="text-getter">promise</strong>, and together they form a{" "}
        <strong className="text-time">deferred</strong>. Hand the resolver to any number of producers and the promise to any
        number of consumers: nobody can tell whether they were first, last, early or late.
      </PageHeader>

      <div className="space-y-4">
        <DeferredDemo />
        <ThenChain />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="then, sketched: create a deferred, forward the observer's result">
            <Code code={THEN} />
          </Panel>
          <Panel title="Resolver vocabulary: return is resolve, throw is reject">
            <Code code={VOCAB} />
          </Panel>
        </div>
      </div>

      <Takeaways
        items={[
          <Fragment key="1">
            Subscribing before or after resolution makes no difference. A promise models <em>dependency</em>: the value is
            there whenever you ask for it, and every observer sees the same one.
          </Fragment>,
          <Fragment key="2">
            Racing producers have indistinguishable experiences — every <code className="font-mono">return()</code> returns{" "}
            <code className="font-mono">undefined</code>. That makes resolvers safe to hand out widely.
          </Fragment>,
          <Fragment key="3">
            The price of broadcast: a promise represents a <em>result</em>, not the work leading to it. No consumer may
            abort that work, because others may depend on it. For that you need a task.
          </Fragment>,
        ]}
      />
    </>
  );
}
