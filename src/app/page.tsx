import Link from "next/link";
import { pageMetadata } from "@/lib/meta";
import { DESCRIPTIONS, NAV } from "@/components/shell/nav";
import { InterfaceTable } from "@/components/overview/InterfaceTable";
import { RotateArray, TheoryGrid } from "@/components/overview/TheoryGrid";


export const metadata = pageMetadata("/");

export default function Home() {
  return (
    <div>
      <header className="max-w-3xl animate-rise">
        <div className="mb-3 font-mono text-xs text-accent">a general theory of reactivity, visualized</div>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Promises, streams, signals and behaviors, all on one map.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted text-pretty">
          Kris Kowal&apos;s{" "}
          <a href="https://github.com/kriskowal/gtor" className="text-ink underline decoration-line underline-offset-4 hover:decoration-accent">
            gtor
          </a>{" "}
          sorts reactive primitives by a few questions: one value or many, here now or arriving later, getter or setter. These pages
          run small, real implementations of each primitive in your browser. The reactor log at the bottom shows every get, set,
          acknowledgement, push and poll as it happens.
        </p>
      </header>

      <div className="mt-10 rounded-2xl border border-line bg-panel p-4 sm:p-6">
        <div className="mb-4 text-xs font-semibold tracking-wide text-muted uppercase">Two axes, two sides</div>
        <TheoryGrid />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-line bg-panel p-4 sm:p-6">
          <div className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Rotate an array onto the time axis</div>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            &ldquo;If you rotate an array from the space axis to the time axis, it would become a stream. The order is important,
            and every value is significant.&rdquo;
          </p>
          <RotateArray />
        </div>
        <div className="rounded-2xl border border-line bg-panel p-4 sm:p-6">
          <div className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">The twelve interfaces</div>
          <InterfaceTable />
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NAV.filter((n) => n.href !== "/").map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-xl border border-line bg-panel p-5 transition hover:-translate-y-0.5 hover:border-faint"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-accent">
                {item.n} <span className="text-faint">· {item.group}</span>
              </span>
              <span className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
            </div>
            <div className="mt-3 font-medium">{item.label}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{DESCRIPTIONS[item.href]}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
