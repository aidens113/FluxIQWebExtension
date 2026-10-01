// `frame-geometry.ts` sits under the click, type and snapshot verbs. It once
// read `window` while it loaded, so `actions/tests/{click,execute,page-identity}`
// could not load on their own: they passed only when another test file had left
// a `window` on the global first. A test that cannot run alone is a defect, so
// this one loads the module with no `window` at all.
import assert from "node:assert/strict";
import test from "node:test";

type WindowLike = { innerWidth: number; innerHeight: number; top?: unknown };

test("loads with no window on the global, and reads the window only when it is asked", async () => {
  const scope = globalThis as { window?: unknown };
  const before = scope.window;
  delete scope.window;
  try {
    const geometry = await import("../frame-geometry");
    assert.equal(typeof geometry.currentFrameViewportOffset, "function");

    const top: WindowLike = { innerWidth: 1280, innerHeight: 720 };
    top.top = top;
    scope.window = top;
    assert.deepEqual(geometry.currentFrameViewportOffset(), { x: 0, y: 0, width: 1280, height: 720 });

    // A child frame has no offset until its parent has answered.
    const child: WindowLike = { innerWidth: 300, innerHeight: 200, top };
    scope.window = child;
    assert.equal(geometry.currentFrameViewportOffset(), undefined);
  } finally {
    if (before === undefined) delete scope.window;
    else scope.window = before;
  }
});
