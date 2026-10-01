# GTOR, visualized

An interactive Next.js app for Kris Kowal's [A General Theory of Reactivity](https://github.com/kriskowal/gtor). It uses live demos, not slides.

The essay sorts reactive primitives by a few questions: one value or many (**singular / plural**), here now or arriving later (**spatial / temporal**), and which side you hold (**getter / setter**). Every page runs small, real implementations of these primitives in the browser (`src/gtor/primitives.ts`). Each get, set, acknowledgement, push and poll is reported to a trace store, and the **reactor log** drawer at the bottom of every page displays it.

## Pages

| # | Page | What you can see |
|---|------|------------------|
| 00 | **Overview** | The singular/plural × spatial/temporal grid with getter/setter duals, an array rotating onto the time axis into a stream, and the twelve interfaces. |
| 01 | **Iterators** | A lazy pipeline (`range → map → filter → reduce`) pulling one value at a time, next to the eager version building full arrays. |
| 02 | **Generator functions** | The `echo` generator stepped line by line: `next(value)`, `throw`, `return`, and `finally`. |
| 03 | **Promises & resolvers** | Observers subscribing before and after resolution, resolvers racing, `then` chains, and resolving with another promise. |
| 04 | **Tasks** | Unicast and cancelable: observing twice throws, `fork()`, and work that aborts only when every fork is cancelled. |
| 05 | **Async functions** | The promise trampoline (`Promise.async`) stepped line by line, next to `async`/`await`. |
| 06 | **Queues & semaphores** | A promise queue drawn as an async linked list (get before put), and a semaphore over a pool of connections. |
| 07 | **Streams & pressure** | Producer → buffer → consumer with rate, buffer length and concurrency controls; back pressure, cancellation, and fork vs shared consumers. |
| 08 | **Async generators** | `Iteration<Promise<T>>` vs `Promise<Iteration<T>>`, and an async generator whose `await yield` waits for a slow reader. |
| 09 | **Signals & observables** | Discrete, pushed, broadcast: several observers with no back pressure, late subscribers, and a clock that only runs while someone watches it. |
| 10 | **Behaviors** | Continuous values polled at a rate the consumer chooses. |
| 11 | **Progress & ETA** | Discrete progress pushed on each value, compared with a continuous behavior that animates smoothly toward the estimate. |
| 12 | **Choose a primitive** | A decision guide and a property matrix (cast, cancelation, flow control, lossless), plus how to convert one primitive into another. |

## Run it

```bash
pnpm install
pnpm dev
```

```bash
pnpm build && pnpm start
```

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · Shiki

The essay's text and code samples are by Kris Kowal (MIT). This is an independent visualization of it.
