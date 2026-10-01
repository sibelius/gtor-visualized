import { Fragment } from "react";
import { Code } from "@/components/Code";
import { PageHeader, Panel, Takeaways } from "@/components/ui";
import { ThermometerDemo } from "@/components/behaviors/ThermometerDemo";
import { ScrollDemo } from "@/components/behaviors/ScrollDemo";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata("/behaviors");

const BEHAVIOR = `
// A behavior has no setter: it produces a value for any time, on demand.
var temperature = new Behavior(function (time) {
    return readThermocouple(time);
});

// The consumer decides when to sample. Here: once per animation frame.
function frame(now) {
    display.textContent = temperature.next(now).value;
    requestAnimationFrame(frame);
}

// Operators lift into behaviors: polling the result polls the operands.
var fahrenheit = Behavior.lift(function (c) { return c * 9 / 5 + 32; })(temperature);
`;

const ROWS = [
  ["Signal Observable", "Get", "Push"],
  ["Signal Generator", "Set", "Push"],
  ["Signal", "Value", "Push"],
  ["Behavior Iterator", "Get", "Poll"],
  ["Behavior Generator", "Set", "Poll"],
  ["Behavior", "Value", "Poll"],
] as const;

export default function BehaviorsPage() {
  return (
    <>
      <PageHeader
        n="10"
        title="Behaviors are values you poll, not events you wait for"
        quote="A behavior represents a time series value. A behavior may produce a different value for every moment in time. As such, they must be polled at an interval meaningful to the consumer, since the behavior itself has no inherent resolution."
      >
        The current time and the current temperature change continuously. It would be neither meaningful nor possible to
        respond every moment they change, so nobody pushes them. Instead the consumer pulls a value when it needs one, at
        its own rate: a display at its frame rate, a logger once a minute.
      </PageHeader>

      <div className="space-y-4">
        <ThermometerDemo />
        <ScrollDemo />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title="The interface">
            <Code code={BEHAVIOR} />
          </Panel>
          <Panel title="Push vs poll, from the essay">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-wide text-faint uppercase">
                  <th className="pb-2 font-medium">Interface</th>
                  <th className="pb-2 font-medium">Side</th>
                  <th className="pb-2 font-medium">Flow</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([name, side, flow]) => (
                  <tr key={name} className="border-t border-line">
                    <td className="py-1.5 font-mono text-xs">{name}</td>
                    <td className={`py-1.5 font-mono text-xs ${side === "Get" ? "text-getter" : side === "Set" ? "text-setter" : "text-ink"}`}>{side}</td>
                    <td className={`py-1.5 font-mono text-xs ${flow === "Push" ? "text-time" : "text-space"}`}>{flow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Discrete values should be pushed; continuous values should be pulled or polled. Even behaviors come in
              variations: probes, gauges, counters, flow gauges, accumulators and rotating counters.
            </p>
          </Panel>
        </div>
      </div>

      <Takeaways
        items={[
          <Fragment key="1">
            The behavior has no resolution of its own. Move the sliders: the same thermocouple yields a jagged or a smooth
            picture depending only on how often the consumer chooses to look.
          </Fragment>,
          <Fragment key="2">
            Rate mismatches are resolved by meaning, not by pressure. Slower sensor: remember the last value. Faster
            sensor: forget the stale ones. Neither side ever waits for the other.
          </Fragment>,
          <Fragment key="3">
            Signals and behaviors convert into each other: discrete scroll events become a continuous function you can
            sample every frame, and polling a signal&apos;s <code className="font-mono">next()</code> treats it as a behavior.
          </Fragment>,
        ]}
      />
    </>
  );
}
