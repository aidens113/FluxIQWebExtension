// Structure detection offers a per-row control that only some rows carry, on
// the realistic feed, with the real content script. No model, background
// worker or provider.
//
// Social rerun round 5: a request defined its set by the person's relation to
// each row, and each row outside the set carries its own control saying so. The
// feed draws five rows at its start state and none of them carries that
// control; the rows that do arrive with later batches. Detection then answered
// the five rows, and once more rows were drawn it either lost the control
// (sources were discovered on the first rows only, and the first rows' many
// partial columns filled the proposal) or answered a small nested run inside
// one row instead of the feed (no value is held by every row of a feed mixing
// templates, so the feed was ranked as holding no data). Since t752
// (`apps/extension/src/content/extraction/infer-fields.ts`,
// `detect-structure.ts`) every rendered row offers its sources, a partial
// control has places of its own, and a run is ranked by the values more than
// half its rows hold.
//
// Rows are named by feed position and controls by structure alone, so the spec
// names no post, author, group or text of the fixture.

import type { WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const ROW = '[role="article"][aria-posinset]';
const MESSAGE = '[data-ad-comet-preview="message"]';

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

/** A control by its classes, and the feed positions of the rows that carry it. */
type RowControl = { classes: string; positions: string[] };

async function prepare(harness: ContentHarness): Promise<void> {
  for (const [operation, payload] of [["consent", { choice: "all" }], ["notifications", { choice: "dismissed" }], ["chat", { state: "closed" }]] as const) {
    const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
      method: "POST", headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload)
    });
    expect(response.ok).toBe(true);
  }
  await harness.page.reload();
  await expect(harness.page.locator(MESSAGE).first()).toBeVisible();
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

async function detectLargest(harness: ContentHarness, commandId: string): Promise<Detected> {
  const reply = await harness.runAction({ commandId, actionType: "web.dom.capture_snapshot", detectStructure: {} });
  expect(reply.status).toBe("succeeded");
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, JSON.stringify(structure)).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

async function rowPositions(harness: ContentHarness): Promise<string[]> {
  return harness.page.evaluate((row) => [...document.querySelectorAll(row)].map((element) => element.getAttribute("aria-posinset") ?? ""), ROW);
}

/**
 * The per-row controls the drawn rows carry: a button with words of its own and
 * no elements inside, at most once in a row, carried by some rows and not
 * others -- grouped by its classes.
 */
async function rowControls(harness: ContentHarness): Promise<RowControl[]> {
  return harness.page.evaluate((row) => {
    const rows = [...document.querySelectorAll(row)];
    const carried = new Map<string, string[]>();
    const repeated = new Set<string>();
    for (const element of rows) {
      const inRow = new Map<string, number>();
      for (const button of element.querySelectorAll('[role="button"], button')) {
        if (button.children.length > 0 || (button.textContent ?? "").trim() === "" || button.className === "") continue;
        inRow.set(button.className, (inRow.get(button.className) ?? 0) + 1);
      }
      for (const [classes, count] of inRow) {
        if (count > 1) repeated.add(classes);
        carried.set(classes, [...(carried.get(classes) ?? []), element.getAttribute("aria-posinset") ?? ""]);
      }
    }
    return [...carried].filter(([classes, positions]) => !repeated.has(classes) && positions.length < rows.length).map(([classes, positions]) => ({ classes, positions }));
  }, ROW);
}

/** The feed positions of the rows each proposed field resolves in. */
async function fieldPresence(harness: ContentHarness, structure: Detected): Promise<string[][]> {
  return harness.page.evaluate(({ item, selectors }) => {
    const rows = [...document.querySelectorAll(item)];
    return selectors.map((selector) => rows.filter((element) => {
      if (selector === null) return false;
      try {
        return element.querySelector(selector) !== null;
      } catch {
        return false;
      }
    }).map((element) => element.getAttribute("aria-posinset") ?? ""));
  }, { item: structure.proposal.item, selectors: structure.proposal.fields.map((field) => field.spec.handling === "exclude" ? null : field.spec.selector ?? null) });
}

test("a per-row control only later rows carry is offered as a field once those rows are drawn, and detection answers the whole feed again", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("social-network-feed");
  await prepare(harness);

  // 1. The start state: the feed's first batch, and detection answers exactly those rows.
  const start = await rowPositions(harness);
  const first = await detectLargest(harness, "detect-start");
  expect(first.proposal.itemCount).toBe(start.length);
  const startControls = new Set((await rowControls(harness)).map((control) => control.classes));

  // 2. Scroll until rows carrying a control no start row carries are drawn.
  let later: RowControl[] = [];
  await expect.poll(async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const drawn = await rowControls(harness);
    const startRows = new Set(start);
    later = drawn.filter((control) => !startControls.has(control.classes) && control.positions.every((position) => !startRows.has(position)));
    return later.length;
  }, { timeout: 30_000, intervals: [700] }).toBeGreaterThan(0);
  const drawn = await rowPositions(harness);
  expect(drawn.length).toBeGreaterThan(start.length);

  // 3. Detection called again answers every drawn row, and offers each such
  // control as a field present in exactly the rows that carry it.
  const again = await detectLargest(harness, "detect-loaded");
  expect(again.proposal.itemCount, "detection answers the feed's drawn rows, not a run nested inside one").toBe(drawn.length);
  const presence = (await fieldPresence(harness, again)).map((positions) => positions.join(","));
  for (const control of later) {
    expect(presence, `a field is present exactly in the rows at ${control.positions.join(",")}`).toContain(control.positions.join(","));
  }

  // 4. The whole feed drawn, to its end: still every row, and every control
  // only some rows carry -- the start rows included -- is offered the same way.
  let rows = drawn.length;
  for (let settled = 0; settled < 3;) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    const now = (await rowPositions(harness)).length;
    settled = now === rows ? settled + 1 : 0;
    rows = now;
  }
  const began = Date.now();
  const whole = await detectLargest(harness, "detect-whole");
  const detectMs = Date.now() - began;
  expect(whole.proposal.itemCount).toBe(rows);
  const wholePresence = (await fieldPresence(harness, whole)).map((positions) => positions.join(","));
  const allControls = (await rowControls(harness)).filter((control) => !startControls.has(control.classes));
  expect(allControls.length).toBeGreaterThan(0);
  for (const control of allControls) {
    expect(wholePresence, `a field is present exactly in the rows at ${control.positions.join(",")}`).toContain(control.positions.join(","));
  }
  console.info("row-control", JSON.stringify({ startRows: start.length, drawnRows: drawn.length, wholeRows: rows, laterControls: later.length, wholeControls: allControls.length, fields: whole.proposal.fields.length, detectMs }));
});
