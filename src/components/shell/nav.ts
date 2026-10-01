export const NAV = [
  { href: "/", label: "Overview", blurb: "The theory in one table", n: "00", group: "Start" },
  { href: "/iterators", label: "Iterators", blurb: "Lazy, pulled one at a time", n: "01", group: "Spatial" },
  { href: "/generators", label: "Generator functions", blurb: "next, throw, return: two-way", n: "02", group: "Spatial" },
  { href: "/promises", label: "Promises & resolvers", blurb: "One value, later, broadcast", n: "03", group: "Singular · temporal" },
  { href: "/tasks", label: "Tasks", blurb: "Unicast, so cancelable", n: "04", group: "Singular · temporal" },
  { href: "/async-functions", label: "Async functions", blurb: "The promise trampoline", n: "05", group: "Singular · temporal" },
  { href: "/queues", label: "Queues & semaphores", blurb: "get() before put()", n: "06", group: "Plural · temporal" },
  { href: "/streams", label: "Streams & pressure", blurb: "Buffers, acks, back pressure", n: "07", group: "Plural · temporal" },
  { href: "/async-generators", label: "Async generators", blurb: "Promise<Iteration<T>>", n: "08", group: "Plural · temporal" },
  { href: "/signals", label: "Signals & observables", blurb: "Discrete, pushed, broadcast", n: "09", group: "Time series" },
  { href: "/behaviors", label: "Behaviors", blurb: "Continuous, polled", n: "10", group: "Time series" },
  { href: "/progress", label: "Progress & ETA", blurb: "Signals and behaviors together", n: "11", group: "Cases" },
  { href: "/choose", label: "Choose a primitive", blurb: "Which tool for the job", n: "12", group: "Cases" },
] as const;

export type NavHref = (typeof NAV)[number]["href"];

/** One-line pitch per page: used on the overview cards and in share metadata. */
export const DESCRIPTIONS: Record<string, string> = {
  "/": "Interactive visualizations of Kris Kowal's A General Theory of Reactivity: iterators, promises, tasks, streams, signals and behaviors, running live.",
  "/iterators": "Lazy beats eager. Pull one value at a time through map, filter and reduce, and watch no array ever get built.",
  "/generators": "Step through a generator paused at yield. next, throw and return send information back to the producer.",
  "/promises": "A getter for one value in the future. Subscribe before or after it resolves; race resolvers and only one wins.",
  "/tasks": "A promise that only one consumer may observe, so it can be cancelled. Fork it, cancel the forks, watch the work stop.",
  "/async-functions": "A generator plus promises becomes async/await. Step the trampoline that resumes your function.",
  "/queues": "A queue where you can get before you put. Then use one as a non-blocking semaphore over a connection pool.",
  "/streams": "Two promise queues make a buffer: values go forward, acks come back. Tune producer and consumer rates to see pressure.",
  "/async-generators": "Iteration<Promise<T>> or Promise<Iteration<T>>? Run an async generator and watch await yield wait for the reader.",
  "/signals": "Discrete values pushed to any number of observers, with no back pressure. Late subscribers miss what came before.",
  "/behaviors": "Continuous values with no resolution of their own. The consumer decides when to poll.",
  "/progress": "Progress and ETA: a discrete signal per value, and a continuous behavior for smooth animation.",
  "/choose": "Broadcast or unicast? Cancelable? Push, pull or pressure? Answer a few questions to find the right primitive.",
};
