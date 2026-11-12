// Part of the page the misclick tests build by hand (`../misclick.test.ts`,
// `actions/tests/click/tests/misclick.test.ts`). Node has no DOM, so only what
// the misclick and the click verb read is faked; see `index.ts`.

/** Installs the `MouseEvent` the gesture constructs and the `HTMLElement` the robot-check reader tests against, which Node lacks; removed after the test. */
export function installPageGlobals(after: (fn: () => void) => void): void {
  const global = globalThis as Record<string, unknown>;
  for (const [name, value] of [["MouseEvent", class { constructor(readonly type: string, readonly init: unknown) {} }], ["HTMLElement", class {}]] as const) {
    const had = Object.prototype.hasOwnProperty.call(global, name);
    const previous = global[name];
    global[name] = value;
    after(() => {
      if (had) global[name] = previous;
      else delete global[name];
    });
  }
}
