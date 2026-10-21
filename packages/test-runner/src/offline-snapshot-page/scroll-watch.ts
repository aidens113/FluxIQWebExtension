// Counts the content code's scroll requests at the end of a list, a scroll
// container or the page, where a feed or lazy list would load more live (lane
// T U3, decision 3) and a snapshot brings nothing: a scroll that asks for the
// end or beyond it (a read's scroll-for-more sets `scrollTop` to
// `scrollHeight`), and a reveal -- an element scrolled into view at the bottom
// (`block: "end"`), which is how a read brings its list's end and loader into
// view and how a target's lazy sentinel is woken -- that moved anything or left
// its scroller at its end. That is what `scrollsPastEnd` reports. Whether the
// answer may still stand is the domain's to judge
// (`domain/src/runtime/offline-reads/dynamic-content.ts`): a recorded read whose
// list ended there proves it does.
//
// A reveal that moved counts though its scroller is not at its end. The first
// headed runs (t749 P5d) showed why: over a feed captured before it grew, the
// read's one reveal moved the page to 139 px short of the snapshot's end (the
// list's loader sits under it), nothing came, and the read answered the four
// posts the snapshot held. A static list's read reveals the same way (the job
// board's moved to 268 px short), and the content code reads both alike: a
// reveal that moved may have woken a loader and is waited on; one that moved
// nothing woke nothing and is not (`content/extraction/list-wait.ts`,
// `content/action-runtime/reveal/reveal-by-scroll.ts`).
//
// It runs in the content code's isolated world, before the content script, and
// wraps that world's own `scrollTop` setter, `scrollTo`/`scroll`/`scrollBy`
// (window and element) and `scrollIntoView`: each world has its own DOM
// wrappers, so the page's world (and the page-world bundle) is untouched, and
// only the content code's requests are counted. It is serialized into the page,
// so it imports nothing and refers to nothing outside its own body; `scope` is
// `globalThis` there and a fake page in its unit test.

export type ScrollWatchScope = {
  window: object;
  document: { documentElement: unknown; body: unknown; scrollingElement: unknown };
  Element: { prototype: object };
  getComputedStyle?: ((element: object) => { overflowY: string }) | undefined;
};

type Box = { scrollTop: number; scrollHeight: number; clientHeight: number; parentElement: Box | null };
type PageWindow = { scrollY: number; innerHeight: number } & Record<string, unknown>;
type ScrollCall = (this: unknown, ...args: unknown[]) => unknown;

export function installScrollWatch(globalName: string, scope: ScrollWatchScope): void {
  const tolerance = 2;
  const state = { pastEnd: 0 };
  const win = scope.window as PageWindow;
  const doc = scope.document as { documentElement: Box | null; body: Box | null; scrollingElement: Box | null };
  const proto = scope.Element.prototype as Record<string, unknown>;
  const topSetter = Object.getOwnPropertyDescriptor(proto, "scrollTop");
  const readTop = (box: Box): number => (topSetter?.get ? topSetter.get.call(box) as number : box.scrollTop);
  const isPage = (box: unknown): boolean => box === doc.scrollingElement || box === doc.documentElement || box === doc.body;
  const pageEnd = (): number => Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0) - win.innerHeight;
  const endOf = (box: Box): number => (isPage(box) ? pageEnd() : box.scrollHeight - box.clientHeight);
  const topOf = (box: Box): number => (isPage(box) ? win.scrollY : readTop(box));
  const atEnd = (box: Box | null): boolean => (box === null ? win.scrollY >= pageEnd() - tolerance : topOf(box) >= endOf(box) - tolerance);
  const askedTop = (args: unknown[], from: number, relative: boolean): number | undefined => {
    const [first, second] = args;
    const top = typeof first === "object" && first !== null ? (first as { top?: unknown }).top : second;
    if (typeof top !== "number" || !Number.isFinite(top)) return undefined;
    return relative ? from + top : top;
  };
  const note = (asked: number | undefined, end: number): void => {
    if (asked !== undefined && asked >= end - tolerance) state.pastEnd += 1;
  };
  if (topSetter?.set) {
    const set = topSetter.set;
    Object.defineProperty(proto, "scrollTop", {
      ...topSetter,
      set(this: Box, value: unknown) {
        note(Number(value), endOf(this));
        set.call(this, value);
      }
    });
  }
  for (const [name, relative] of [["scrollTo", false], ["scroll", false], ["scrollBy", true]] as const) {
    const onWindow = win[name] as ScrollCall | undefined;
    if (typeof onWindow === "function") {
      win[name] = function (this: unknown, ...args: unknown[]) {
        note(askedTop(args, win.scrollY, relative), pageEnd());
        return onWindow.apply(this, args);
      };
    }
    const onElement = proto[name] as ScrollCall | undefined;
    if (typeof onElement === "function") {
      proto[name] = function (this: Box, ...args: unknown[]) {
        note(askedTop(args, topOf(this), relative), endOf(this));
        return onElement.apply(this, args);
      };
    }
  }
  const scrollIntoView = proto["scrollIntoView"] as ScrollCall | undefined;
  if (typeof scrollIntoView === "function") {
    const scrollable = (box: Box): boolean => {
      if (box.scrollHeight <= box.clientHeight + tolerance) return false;
      const overflow = scope.getComputedStyle ? scope.getComputedStyle(box).overflowY : "auto";
      return overflow === "auto" || overflow === "scroll" || overflow === "overlay";
    };
    proto["scrollIntoView"] = function (this: Box, ...args: unknown[]) {
      const [arg] = args;
      const block = typeof arg === "object" && arg !== null ? (arg as { block?: unknown }).block ?? "start" : arg === false ? "end" : "start";
      if (block !== "end") return scrollIntoView.apply(this, args);
      const scrollers: Box[] = [];
      for (let box = this.parentElement; box && !isPage(box); box = box.parentElement) if (scrollable(box)) scrollers.push(box);
      const before = [win.scrollY, ...scrollers.map(readTop)];
      const answer = scrollIntoView.apply(this, args);
      const moved = [win.scrollY, ...scrollers.map(readTop)].some((top, index) => Math.abs(top - (before[index] ?? top)) > 1);
      if (moved || atEnd(scrollers[0] ?? null)) state.pastEnd += 1;
      return answer;
    };
  }
  Object.defineProperty(win, globalName, { value: state, configurable: true });
}
