// An icon-only control inside a pressable card is in the page view, as a
// control a press can name (lane 4, `run-mvcwf9u2-28bb44fd`).
//
// The job board's result cards each have a pointer of their own, and each holds,
// after its title, an icon-only control: an element the page styles with a
// pointer too, holding an unlabelled `<svg>` and no words. A computed cursor
// cannot say where it came from, so the capture read the icon's pointer as the
// card's, and the view printed the card's title and words and nothing for the
// icon. The capture now asks the page's own style rules
// (`src/content/evidence/declared-cursor.ts`).
//
// The oracle is the browser: every visible element inside a result card that
// holds an `<svg>` as its child, says no words and computes a pointer -- found
// without reading any class name -- must have a line `tN clickable icon ...`
// in the view built from the real capture.

import { publishedWebLlmPage, sanitizeWebLlmSnapshotWithBindings } from "@fluxiq-web-extension/domain";
import type { JsonObject } from "fluxiq/core";
import { expect, test } from "../../../index.js";

/** The handles, by the selectors the capture gave them, of every wordless pointer element holding an svg inside an `article`. */
function wordlessSvgPointers(addresses: Array<[string, string]>): { icons: number; targets: string[] } {
  const icons = [...document.querySelectorAll("article *")].filter((element) => {
    if (!(element instanceof HTMLElement) || !element.querySelector(":scope > svg")) return false;
    if ((element.textContent ?? "").trim() !== "" || element.getBoundingClientRect().width === 0) return false;
    return getComputedStyle(element).cursor === "pointer";
  });
  const targets = addresses.filter(([, selector]) => {
    try {
      const found = document.querySelector(selector);
      return found !== null && icons.includes(found);
    } catch {
      return false;
    }
  }).map(([target]) => target);
  return { icons: icons.length, targets };
}

test("job board results: each card's icon-only control has a clickable icon line", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("job-board");
  await page.goto(new URL("/scenarios/job-board/jobs?q=engineer", harness.lab.origin).href);
  await page.waitForLoadState("networkidle");
  const snapshot = JSON.parse(JSON.stringify(await harness.capture())) as JsonObject;
  const binding = sanitizeWebLlmSnapshotWithBindings(snapshot);
  const lines = publishedWebLlmPage(binding.evidence).page.split("\n");
  const { icons, targets } = await page.evaluate(wordlessSvgPointers, [...binding.selectors]);
  expect(icons, "the results page shows icon-only controls").toBeGreaterThan(0);
  expect(targets, "every icon-only control is in the packet").toHaveLength(icons);
  for (const target of targets) {
    const line = lines.find((candidate) => candidate.startsWith(`${target} `));
    expect(line, `${target}\n${lines.join("\n")}`).toMatch(new RegExp(`^${target} clickable icon class="[^"]+"`, "u"));
  }
});
