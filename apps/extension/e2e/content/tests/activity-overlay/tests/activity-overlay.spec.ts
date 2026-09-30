// The activity overlay (`src/content/activity-overlay/`) on a real page: it
// draws the background's paced display, in place, and it is inert -- page CSS
// cannot reach it, hit tests and real clicks pass through it, the recorder
// does not see it, and a snapshot does not describe it (decision D5 of the
// live-activity plan).
//
// The page is company-website, one of the ten realistic scenarios, the only
// fixtures browser runs may use.
//
// The overlay's shadow root is closed, so the page cannot reach inside it and
// neither can a spec. To read what it renders, an init script added before the
// harness's own wraps `attachShadow` and keeps the root the overlay's host
// asks for. Only this spec's page carries the wrapper; the content script is
// the same bundle the extension ships.

import type { Page } from "@playwright/test";
import { expect, test, type ContentHarness } from "../../../index.js";

const SCENARIO = "company-website";
const HOST = "fluxiq-activity-overlay";
const ROOTS_GLOBAL = "__fluxiqE2eActivityRoots";
const HEADLINE = "Running your Flow";
const DETAIL = "Running step 2 of 5: Open the cart";

type Display = Record<string, unknown>;

function display(overrides: Display = {}): Display {
  return {
    activityId: "run:run-e2e",
    subjectKind: "run",
    phase: "running",
    headline: HEADLINE,
    detail: DETAIL,
    step: { index: 2, count: 5 },
    working: true,
    outcome: null,
    sequence: 1,
    ...overrides
  };
}

async function show(harness: ContentHarness, value: Display | null, overlay = "expanded"): Promise<void> {
  const delivery = await harness.deliver({ type: "fluxiq.activity.overlay", activity: null, display: value, overlay, topFrameOnly: true });
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

/** What the live overlay renders and how: its host box, its text, and the computed style of its pill. */
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
        width: style.width,
        height: style.height,
        borderRadius: style.borderTopLeftRadius
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

/** Tags every node of the live overlay, so a later read can tell the same nodes from new ones. */
function tagOverlayNodes(page: Page) {
  return page.evaluate(([name]) => {
    const roots = (window as unknown as Record<string, ShadowRoot[] | undefined>)[name] ?? [];
    const nodes = [...roots[roots.length - 1]!.querySelectorAll("*")];
    (window as unknown as Record<string, unknown>).__fluxiqE2eTagged = nodes;
    return nodes.length;
  }, [ROOTS_GLOBAL] as const);
}

function sameTaggedNodes(page: Page) {
  return page.evaluate(([name]) => {
    const roots = (window as unknown as Record<string, ShadowRoot[] | undefined>)[name] ?? [];
    const nodes = [...roots[roots.length - 1]!.querySelectorAll("*")];
    const tagged = (window as unknown as Record<string, Element[] | undefined>).__fluxiqE2eTagged ?? [];
    return { roots: roots.length, same: nodes.length === tagged.length && nodes.every((node, index) => node === tagged[index]) };
  }, [ROOTS_GLOBAL] as const);
}

/** A page button fixed under the overlay's corner, counting the clicks it receives. */
async function placeButtonUnderOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.id = "under-overlay";
    button.textContent = "Under the overlay";
    button.dataset.clicks = "0";
    Object.assign(button.style, { position: "fixed", left: "0", bottom: "0", width: "420px", height: "200px", zIndex: "10" });
    button.addEventListener("click", () => {
      button.dataset.clicks = String(Number(button.dataset.clicks) + 1);
    });
    document.body.append(button);
  });
}

test("the overlay draws the paced display: headline, Core's sentence and the step, bottom-left", async ({ openHarness, page }) => {
  await captureOverlayRoots(page);
  const harness = await openHarness(SCENARIO);
  await show(harness, display());
  const overlay = await readOverlay(page);
  expect(overlay).not.toBeNull();
  expect(overlay!.text).toContain(HEADLINE);
  expect(overlay!.text).toContain(DETAIL);
  expect(overlay!.text).toContain("Step 2 of 5");
  expect(overlay!.parent, "the host sits on <html>, so a swapped <body> does not take it").toBe(true);
  expect(overlay!.marked).toBe(true);
  expect(overlay!.ariaHidden).toBe("true");
  expect(overlay!.focusable, "nothing in the overlay can take focus").toBe(0);
  expect(overlay!.inertNodes, "every node, host included, is pointer-events: none").toBe(overlay!.nodes);
  // Bottom-left, inside the viewport.
  const viewport = page.viewportSize()!;
  expect(overlay!.rect.x).toBeCloseTo(16, 0);
  expect(overlay!.rect.y + overlay!.rect.height).toBeCloseTo(viewport.height - 16, 0);
  expect(overlay!.surface).toMatchObject({ display: "flex", width: "300px", height: "54px", borderRadius: "14px" });

  // Collapsed is the small pill with the headline only; hidden and null take it down.
  await show(harness, display({ sequence: 2, phase: "verifying", detail: "Checking the result", step: null }), "collapsed");
  const pill = await readOverlay(page);
  expect(pill!.hosts).toBe(1);
  expect(pill!.text).toContain(HEADLINE);
  expect(pill!.rect.width).toBeLessThan(overlay!.rect.width);
  await show(harness, display({ sequence: 3 }), "hidden");
  expect(await page.locator(HOST).count()).toBe(0);
  await show(harness, display({ sequence: 4 }));
  expect(await page.locator(HOST).count()).toBe(1);
  await show(harness, null);
  expect(await page.locator(HOST).count()).toBe(0);
});

test("updates happen in place: the same nodes and the same box after twenty new sentences", async ({ openHarness, page }) => {
  await captureOverlayRoots(page);
  const harness = await openHarness(SCENARIO);
  await show(harness, display());
  const before = await readOverlay(page);
  const count = await tagOverlayNodes(page);
  for (let index = 2; index <= 21; index += 1) {
    await show(harness, display({ sequence: index, detail: `Sentence ${index}: ${"long ".repeat(index)}`, step: { index: Math.min(index, 5), count: 5 } }));
  }
  const after = await readOverlay(page);
  expect(await sameTaggedNodes(page)).toEqual({ roots: 1, same: true });
  expect(after!.nodes).toBe(count + 1);
  expect(after!.rect).toEqual(before!.rect);
  expect(after!.text).toContain("Sentence 21");
});

test("page CSS does not change the overlay: `* { all: unset }` and `div { display: none }` leave it as it was", async ({ openHarness, page }) => {
  await captureOverlayRoots(page);
  const harness = await openHarness(SCENARIO);
  await show(harness, display());
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
  const harness = await openHarness(SCENARIO);
  await placeButtonUnderOverlay(page);
  await show(harness, display());
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
  const harness = await openHarness(SCENARIO);
  await harness.setRecording(true, { captureMutations: true, captureInputValues: false, captureSnapshots: false });
  await show(harness, display());
  await show(harness, display({ sequence: 2, phase: "extracting", detail: "Stored 12 rows" }), "collapsed");
  await show(harness, display({ sequence: 3 }), "hidden");
  await show(harness, display({ sequence: 4, phase: "done", headline: "Run finished", detail: "Run finished", working: false, outcome: "done", step: null }));
  // Past the recorder's 500 ms quiet period, so a counted batch would have flushed.
  await harness.page.waitForTimeout(700);
  await harness.setRecording(false);
  expect(await harness.recordedEvents("dom.mutation")).toEqual([]);
});

test("a snapshot does not include the overlay", async ({ openHarness }) => {
  const harness = await openHarness(SCENARIO);
  const without = await harness.capture();
  await show(harness, display());
  const withOverlay = await harness.capture();
  const wire = JSON.stringify(withOverlay);
  expect(wire.includes(HOST)).toBe(false);
  expect(wire.includes("data-fluxiq-activity")).toBe(false);
  expect(wire.includes(DETAIL)).toBe(false);
  expect(withOverlay.interactiveElements.length).toBe(without.interactiveElements.length);
});

test("a settled display fades after its display time; a later display is what changes the status", async ({ openHarness, page }) => {
  test.setTimeout(20_000);
  await captureOverlayRoots(page);
  const harness = await openHarness(SCENARIO);
  await show(harness, display({ phase: "done", headline: "Run finished", detail: "Run finished", working: false, outcome: "done", step: null }));
  expect((await readOverlay(page))!.text).toContain("Run finished");
  await page.waitForTimeout(3_000);
  expect(await page.locator(HOST).count(), "still up well inside the six seconds").toBe(1);
  await expect.poll(() => page.locator(HOST).count(), { timeout: 8_000 }).toBe(0);
  // A new unit of work shows again at once and, not being settled, stays.
  await show(harness, display({ activityId: "build:b-2", subjectKind: "build", sequence: 9, phase: "thinking", headline: "Building your Flow", detail: "Deciding the next step", step: null }));
  await page.waitForTimeout(6_800);
  expect((await readOverlay(page))!.text).toContain("Deciding the next step");
});
