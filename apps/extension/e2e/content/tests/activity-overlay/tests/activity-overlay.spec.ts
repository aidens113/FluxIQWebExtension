// The activity overlay (`src/content/activity-overlay/`) on a real page: it
// shows what the event says, and it is inert -- page CSS cannot reach it, hit
// tests and real clicks pass through it, the recorder does not see it, and a
// snapshot does not describe it (decision D5 of the live-activity plan).
//
// The overlay's shadow root is closed, so the page cannot reach inside it and
// neither can a spec. To read what it renders, an init script added before the
// harness's own wraps `attachShadow` and keeps the root the overlay's host
// asks for. Only this spec's page carries the wrapper; the content script is
// the same bundle the extension ships.

import type { Page } from "@playwright/test";
import { expect, test, type ContentHarness } from "../../../index.js";

const HOST = "fluxiq-activity-overlay";
const ROOTS_GLOBAL = "__fluxiqE2eActivityRoots";
const LABEL = "Running step 2 of 5: Open the cart";

type Activity = Record<string, unknown>;

function activity(overrides: Activity = {}): Activity {
  return {
    activityId: "run-e2e",
    sequence: 1,
    subject: { kind: "run", id: "run-e2e", projectId: "project-e2e" },
    phase: "running",
    label: LABEL,
    step: { index: 2, count: 5, nodeId: "n2", label: "Open the cart" },
    detail: { kind: "step", title: "Open the cart", status: "started", ref: "n2" },
    at: "2026-09-29T10:00:00.000Z",
    ...overrides
  };
}

async function show(harness: ContentHarness, value: Activity | null, overlay = "expanded"): Promise<void> {
  const delivery = await harness.deliver({ type: "fluxiq.activity.overlay", activity: value, overlay, topFrameOnly: true });
  expect(delivery).toEqual({ responded: true, response: { ok: true } });
}

/** Keeps every shadow root the overlay host attaches, closed or not, on a page global. */
async function captureOverlayRoots(page: Page): Promise<void> {
  await page.addInitScript(([host, name]) => {
    const original = Element.prototype.attachShadow;
    const roots: ShadowRoot[] = [];
    Object.defineProperty(window, name, { value: roots, configurable: true });
    Element.prototype.attachShadow = function attachShadow(this: Element, init: ShadowRootInit): ShadowRoot {
      const root = original.call(this, init);
      if (this.localName === host) roots.push(root);
      return root;
    };
  }, [HOST, ROOTS_GLOBAL] as const);
}

/** What the live overlay renders and how: its host box, its text, and the computed style of its first card or pill. */
function readOverlay(page: Page) {
  return page.evaluate(([host, name]) => {
    const element = document.querySelector(host);
    const roots = (window as unknown as Record<string, ShadowRoot[] | undefined>)[name] ?? [];
    const root = roots[roots.length - 1];
    if (!element || !root) return null;
    const rect = element.getBoundingClientRect();
    const surface = root.firstElementChild as HTMLElement | null;
    const style = surface ? getComputedStyle(surface) : null;
    const nodes = [element, ...root.querySelectorAll("*")];
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      text: root.textContent ?? "",
      surface: style && {
        display: style.display,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        borderRadius: style.borderTopLeftRadius,
        color: style.color
      },
      inertNodes: nodes.filter((node) => getComputedStyle(node).pointerEvents === "none").length,
      nodes: nodes.length,
      focusable: root.querySelectorAll("a, button, input, select, textarea, [tabindex]").length,
      hosts: document.querySelectorAll(host).length,
      ariaHidden: element.getAttribute("aria-hidden"),
      marked: element.hasAttribute("data-fluxiq-activity"),
      parent: element.parentElement === document.documentElement
    };
  }, [HOST, ROOTS_GLOBAL] as const);
}

/** A page button fixed under the overlay's corner, counting the clicks it receives. */
async function placeButtonUnderOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.id = "under-overlay";
    button.textContent = "Under the overlay";
    button.dataset.clicks = "0";
    Object.assign(button.style, { position: "fixed", right: "0", bottom: "0", width: "420px", height: "200px", zIndex: "10" });
    button.addEventListener("click", () => {
      button.dataset.clicks = String(Number(button.dataset.clicks) + 1);
    });
    document.body.append(button);
  });
}

test("the overlay shows what the event says: phase, Core's sentence, the step and the latest detail", async ({ openHarness, page }) => {
  await captureOverlayRoots(page);
  const harness = await openHarness("basic-form");
  await show(harness, activity());
  const overlay = await readOverlay(page);
  expect(overlay).not.toBeNull();
  expect(overlay!.text).toContain("Running");
  expect(overlay!.text).toContain(LABEL);
  expect(overlay!.text).toContain("Step 2 of 5");
  expect(overlay!.text).toContain("Open the cart");
  expect(overlay!.parent, "the host sits on <html>, so a swapped <body> does not take it").toBe(true);
  expect(overlay!.marked).toBe(true);
  expect(overlay!.ariaHidden).toBe("true");
  expect(overlay!.focusable, "nothing in the overlay can take focus").toBe(0);
  expect(overlay!.inertNodes, "every node, host included, is pointer-events: none").toBe(overlay!.nodes);
  // Bottom-right, inside the viewport.
  const viewport = page.viewportSize()!;
  expect(overlay!.rect.x + overlay!.rect.width).toBeCloseTo(viewport.width - 16, 0);
  expect(overlay!.rect.y + overlay!.rect.height).toBeCloseTo(viewport.height - 16, 0);
  expect(overlay!.surface).toMatchObject({ display: "block", fontSize: "13px", borderRadius: "12px" });

  // A later event replaces it; collapsed is a pill; hidden and null take it down.
  await show(harness, activity({ sequence: 2, phase: "verifying", label: "Checking the result", step: undefined, detail: undefined }), "collapsed");
  const pill = await readOverlay(page);
  expect(pill!.hosts).toBe(1);
  expect(pill!.text).toContain("Verifying");
  expect(pill!.text).not.toContain(LABEL);
  expect(pill!.rect.width).toBeLessThan(overlay!.rect.width);
  await show(harness, activity({ sequence: 3 }), "hidden");
  expect(await page.locator(HOST).count()).toBe(0);
  await show(harness, activity({ sequence: 4 }));
  expect(await page.locator(HOST).count()).toBe(1);
  await show(harness, null);
  expect(await page.locator(HOST).count()).toBe(0);
});

test("page CSS does not change the overlay: `* { all: unset }` and `div { display: none }` leave it as it was", async ({ openHarness, page }) => {
  await captureOverlayRoots(page);
  const harness = await openHarness("basic-form");
  await show(harness, activity());
  const before = await readOverlay(page);
  expect(before!.rect.width).toBeGreaterThan(100);
  await page.addStyleTag({ content: "* { all: unset !important; } div { display: none !important; }" });
  await page.addStyleTag({ content: "* { all: unset; } div { display: none; }" });
  const after = await readOverlay(page);
  expect(after!.rect).toEqual(before!.rect);
  expect(after!.surface).toEqual(before!.surface);
  expect(after!.inertNodes).toBe(after!.nodes);
});

test("hit tests and a real click at the overlay's position reach the page element beneath it", async ({ openHarness, page }) => {
  await captureOverlayRoots(page);
  const harness = await openHarness("basic-form");
  await placeButtonUnderOverlay(page);
  await show(harness, activity());
  const overlay = await readOverlay(page);
  const x = overlay!.rect.x + overlay!.rect.width / 2;
  const y = overlay!.rect.y + overlay!.rect.height / 2;
  const hit = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.id ?? null, [x, y] as const);
  expect(hit, "elementFromPoint passes through the overlay").toBe("under-overlay");
  await page.mouse.click(x, y);
  await expect(page.locator("#under-overlay")).toHaveAttribute("data-clicks", "1");
  // The overlay is still up: the click went through it, not around it.
  expect(await page.locator(HOST).count()).toBe(1);
});

test("the recorder records no mutation for the overlay going up, changing and coming down", async ({ openHarness }) => {
  const harness = await openHarness("basic-form");
  await harness.setRecording(true, { captureMutations: true, captureInputValues: false, captureSnapshots: false });
  await show(harness, activity());
  await show(harness, activity({ sequence: 2, phase: "extracting", label: "Stored 12 rows" }), "collapsed");
  await show(harness, activity({ sequence: 3 }), "hidden");
  await show(harness, activity({ sequence: 4, phase: "done", label: "Done", final: true }));
  // Past the recorder's 500 ms quiet period, so a counted batch would have flushed.
  await harness.page.waitForTimeout(700);
  await harness.setRecording(false);
  expect(await harness.recordedEvents("dom.mutation")).toEqual([]);
});

test("a snapshot does not include the overlay", async ({ openHarness }) => {
  const harness = await openHarness("basic-form");
  const without = await harness.capture();
  await show(harness, activity());
  const withOverlay = await harness.capture();
  const wire = JSON.stringify(withOverlay);
  expect(wire.includes(HOST)).toBe(false);
  expect(wire.includes("data-fluxiq-activity")).toBe(false);
  expect(wire.includes(LABEL)).toBe(false);
  expect(withOverlay.interactiveElements.length).toBe(without.interactiveElements.length);
});

test("a final event fades after its display time; a later event is what changes the status", async ({ openHarness, page }) => {
  test.setTimeout(20_000);
  await captureOverlayRoots(page);
  const harness = await openHarness("basic-form");
  await show(harness, activity({ phase: "done", label: "Finished the run", final: true, step: undefined }));
  expect((await readOverlay(page))!.text).toContain("Finished the run");
  await page.waitForTimeout(3_000);
  expect(await page.locator(HOST).count(), "still up well inside the six seconds").toBe(1);
  await expect.poll(() => page.locator(HOST).count(), { timeout: 8_000 }).toBe(0);
  // A new unit of work shows again at once and, not being final, stays.
  await show(harness, activity({ activityId: "run-2", sequence: 9, phase: "thinking", label: "Deciding what to do next", step: undefined }));
  await page.waitForTimeout(6_800);
  expect((await readOverlay(page))!.text).toContain("Deciding what to do next");
});
