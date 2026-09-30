// Coverage of status-pill.ts on a fake DOM: the overlay is built once and
// updated in place -- the same host and the same nodes after fifty updates,
// only text and attributes changing -- each mode has a fixed box, every node
// is inert, and it goes away when told to or when a settled status has had
// its time. How it looks on a real page is the content harness's.

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVITY_OVERLAY_HOST_ATTRIBUTE } from "../../picker-host";
import { StatusPill } from "../status-pill";
import type { ActivityOverlayView } from "../overlay-view";
import { withFakeDom, type FakeNode } from "./fake-dom";

function view(overrides: Partial<ActivityOverlayView> = {}): ActivityOverlayView {
  return {
    mode: "expanded",
    mark: "pulse",
    accent: "#f5b94a",
    headline: "Building your Flow",
    detail: "Deciding the next step",
    step: "",
    settled: false,
    ...overrides
  };
}

function hostOf(surface: StatusPill): FakeNode {
  const host = surface.host() as unknown as FakeNode | undefined;
  assert.ok(host, "the overlay is in the page");
  return host;
}

test("fifty updates leave the same host and the same nodes; only their text and attributes change", () => {
  withFakeDom((dom) => {
    const surface = new StatusPill();
    surface.update(view());
    const host = hostOf(surface);
    const nodes = host.descendants();
    const created = dom.created;
    for (let index = 1; index <= 50; index += 1) {
      surface.update(view({
        headline: index % 10 === 0 ? "Running your Flow" : "Building your Flow",
        detail: `Sentence ${index}`,
        step: index % 3 === 0 ? `Step ${index} of 50` : "",
        mark: index === 50 ? "check" : "pulse",
        accent: index === 50 ? "#5fdf8e" : "#f5b94a"
      }));
    }
    assert.equal(dom.created, created, "no node was created after the first render");
    assert.equal(hostOf(surface), host);
    const after = host.descendants();
    assert.equal(after.length, nodes.length);
    after.forEach((node, index) => assert.equal(node, nodes[index], `node ${index} is the same object`));
    assert.equal(dom.querySelectorAll(`[${ACTIVITY_OVERLAY_HOST_ATTRIBUTE}]`).length, 1, "one host");
    assert.ok(host.shadow!.textContent.includes("Sentence 50"));
  });
});

test("an unchanged update writes no text at all", () => {
  withFakeDom((dom) => {
    const surface = new StatusPill();
    surface.update(view());
    const writes = dom.textWrites;
    for (let index = 0; index < 10; index += 1) surface.update(view());
    assert.equal(dom.textWrites, writes);
  });
});

test("each mode has a fixed box, so no text can resize the pill", () => {
  withFakeDom(() => {
    const surface = new StatusPill();
    surface.update(view({ detail: "short" }));
    const surfaceNode = hostOf(surface).shadow!.children[0]!;
    const expanded = [surfaceNode.style.getPropertyValue("width"), surfaceNode.style.getPropertyValue("height")];
    surface.update(view({ detail: "a much longer sentence ".repeat(8) }));
    assert.deepEqual([surfaceNode.style.getPropertyValue("width"), surfaceNode.style.getPropertyValue("height")], expanded);
    assert.deepEqual(expanded, ["300px", "54px"]);
    surface.update(view({ mode: "collapsed" }));
    assert.deepEqual([surfaceNode.style.getPropertyValue("width"), surfaceNode.style.getPropertyValue("height")], ["196px", "32px"]);
    assert.equal(hostOf(surface).shadow!.children[0], surfaceNode, "switching mode reuses the pill");
  });
});

test("the host is inert, marked, hidden from assistive technology, bottom-left, and every node takes no pointer", () => {
  withFakeDom((dom) => {
    const surface = new StatusPill();
    surface.update(view({ step: "Step 2 of 5" }));
    const host = hostOf(surface);
    assert.equal(host.parent, dom.documentElement, "on <html>, so a swapped <body> does not take it");
    assert.equal(host.shadow?.tagName, "#shadow-root(closed)");
    assert.ok(host.hasAttribute(ACTIVITY_OVERLAY_HOST_ATTRIBUTE));
    assert.equal(host.getAttribute("aria-hidden"), "true");
    assert.ok(host.hasAttribute("inert"));
    assert.equal(host.style.getPropertyValue("left"), "16px");
    assert.equal(host.style.getPropertyValue("bottom"), "16px");
    for (const node of [host, ...host.descendants().filter((node) => !node.tagName.startsWith("#"))]) {
      assert.equal(node.style.getPropertyValue("pointer-events"), "none", node.tagName);
    }
  });
});

test("a changed detail fades in softly; an unchanged one does not animate", () => {
  withFakeDom(() => {
    const surface = new StatusPill();
    surface.update(view({ detail: "First" }));
    const detailNode = hostOf(surface).descendants().find((node) => node.textContent === "First" && node.children.length === 0)!;
    surface.update(view({ detail: "First" }));
    assert.equal(detailNode.animations.length, 0);
    surface.update(view({ detail: "Second" }));
    assert.equal(detailNode.animations.length, 1);
  });
});

test("null takes the overlay out of the page, and a stale host a superseded script left is replaced", () => {
  withFakeDom((dom) => {
    const stale = dom.createElement("fluxiq-activity-overlay");
    stale.setAttribute(ACTIVITY_OVERLAY_HOST_ATTRIBUTE, "");
    dom.documentElement.append(stale);
    const surface = new StatusPill();
    surface.update(view());
    assert.equal(stale.isConnected, false);
    assert.equal(dom.querySelectorAll(`[${ACTIVITY_OVERLAY_HOST_ATTRIBUTE}]`).length, 1);
    surface.update(null);
    assert.equal(surface.host(), undefined);
    assert.equal(dom.querySelectorAll(`[${ACTIVITY_OVERLAY_HOST_ATTRIBUTE}]`).length, 0);
  });
});

test("a settled status fades after its display time; a new status before then cancels the fade", () => {
  const globals = globalThis as unknown as { setTimeout: unknown; clearTimeout: unknown };
  const saved = { setTimeout: globals.setTimeout, clearTimeout: globals.clearTimeout };
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let next = 1;
  globals.setTimeout = (callback: () => void, delay: number) => {
    timers.set(next, { callback, delay });
    return next++;
  };
  globals.clearTimeout = (id: number) => timers.delete(id);
  try {
    withFakeDom(() => {
      const surface = new StatusPill();
      surface.update(view({ mark: "check", headline: "Flow ready", settled: true }));
      assert.equal(timers.size, 1);
      assert.equal([...timers.values()][0]!.delay, 6_000);
      surface.update(view());
      assert.equal(timers.size, 0, "working again: no fade");
      surface.update(view({ mark: "check", headline: "Flow ready", settled: true }));
      const host = hostOf(surface);
      [...timers.values()][0]!.callback();
      assert.equal(host.animations.length, 1, "the fade runs");
      host.animations[0]!.finish();
      assert.equal(surface.host(), undefined, "and takes the overlay down");
    });
  } finally {
    globals.setTimeout = saved.setTimeout;
    globals.clearTimeout = saved.clearTimeout;
  }
});

test("the mark shows one glyph at a time, recoloured in place, and pauses its pulse when settled", () => {
  withFakeDom(() => {
    const surface = new StatusPill();
    surface.update(view());
    const svg = hostOf(surface).descendants().find((node) => node.tagName === "svg")!;
    const groups = svg.children;
    const visible = () => groups.filter((group) => group.style.getPropertyValue("display") !== "none").length;
    assert.equal(visible(), 1);
    const ring = groups[0]!.children[0]!;
    assert.equal(ring.getAttribute("stroke"), "#f5b94a");
    assert.equal(ring.animations[0]?.playState, "running");
    surface.update(view({ mark: "cross", accent: "#fa8a8a" }));
    assert.equal(visible(), 1);
    assert.equal(ring.animations[0]?.playState, "paused");
    assert.equal(groups[2]!.children[0]!.getAttribute("stroke"), "#fa8a8a");
  });
});
