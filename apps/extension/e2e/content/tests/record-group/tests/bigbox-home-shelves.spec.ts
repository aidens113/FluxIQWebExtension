// Structure detection on the bigbox retailer's home page, whose two shelves --
// "Pickup today at <store>" and "Rollbacks" -- are sibling sections of one
// template, each a header (a heading and a "View all" link) over a list of
// product cards (t1022, `run-mwuxd2v9-33928ea3`).
//
// Aimed at a shelf's heading, the detection used to answer the pair of shelves:
// two items, each shelf's cards flattened into columns by their place in it, so
// a read kept one row per shelf, its first card. A live build read that list for
// 219 steps while the cheapest qualifying card was the seventh. A run of groups
// is now never the list: the answer is the cards of the shelf the heading heads
// (`src/content/extraction/record-group/`).
//
// The oracle is the page itself: the cards each shelf's own list holds.

import type {
  WebAutomationExtractField,
  WebAutomationExtractListRequest,
  WebAutomationStructureDetection
} from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

const HOME = "/scenarios/bigbox-retail/";

/** A selector naming the shelf heading whose words start with `words`, by its place from the body, and that shelf's cards' product links. */
async function shelf(harness: ContentHarness, words: string): Promise<{ heading: string; cards: number; links: string[] }> {
  return harness.page.evaluate((start) => {
    const heading = Array.from(document.querySelectorAll("main h2")).find((element) => (element.textContent ?? "").trim().startsWith(start));
    if (!heading) throw new Error(`no heading starts with ${start}`);
    const steps: string[] = [];
    for (let element: Element | null = heading; element && element !== document.body; element = element.parentElement) {
      const index = Array.from(element.parentElement?.children ?? []).filter((sibling) => sibling.tagName === element!.tagName).indexOf(element) + 1;
      steps.unshift(`${element.tagName.toLowerCase()}:nth-of-type(${index})`);
    }
    const cards = Array.from(heading.closest("section")?.querySelectorAll("ul > li") ?? []);
    return {
      heading: `body > ${steps.join(" > ")}`,
      cards: cards.length,
      links: cards.map((card) => card.querySelector("a[href*='/ip/']")?.getAttribute("href") ?? "")
    };
  }, words);
}

async function detect(harness: ContentHarness, selector: string): Promise<Detected> {
  const reply = await harness.runAction({ commandId: `detect-${selector}`, actionType: "web.dom.capture_snapshot", detectStructure: { selector } });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a list was detected from ${selector}: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

/** The detection as the request its handle stands for, every field it proposes: the minimal-parameter read. */
function requestFrom(structure: Detected): WebAutomationExtractListRequest {
  const fields = structure.proposal.fields.filter((field) => field.spec.handling !== "exclude");
  return { item: structure.proposal.item, fields: Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField])) };
}

/** Whether the proposal's item selector names exactly the cards under the heading. */
async function namesExactly(harness: ContentHarness, item: string, heading: string): Promise<boolean> {
  return harness.page.evaluate(([selector, head]) => {
    const detected = Array.from(document.querySelectorAll(selector));
    const wanted = Array.from(document.querySelector(head)?.closest("section")?.querySelectorAll("ul > li") ?? []);
    return detected.length === wanted.length && detected.every((element, index) => element === wanted[index]);
  }, [item, heading] as const);
}

test("aimed at a shelf's heading, the detection answers that shelf's cards, every column read per card", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("bigbox-retail");
  await harness.page.goto(new URL(HOME, harness.lab.origin).href, { waitUntil: "load" });
  await harness.page.waitForSelector("main h2");

  for (const [words, size] of [["Pickup today at", 8], ["Rollbacks", 4]] as const) {
    const { heading, cards, links } = await shelf(harness, words);
    expect(cards, `the ${words} shelf holds ${size} cards`).toBe(size);
    const structure = await detect(harness, heading);
    expect(structure.proposal.itemCount, `the ${words} shelf's cards, not the two shelves`).toBe(size);
    expect(await namesExactly(harness, structure.proposal.item, heading), `the detected items are exactly the ${words} shelf's cards`).toBe(true);
    const keys = structure.proposal.fields.map((field) => field.key);
    expect(keys.filter((key) => /_li_\d+_/u.test(key)), "no column is a card's place in its shelf").toEqual([]);
    expect(structure.continues, `the ${words} shelf's "View all" is the list's link to more`).toBeDefined();

    const read = await harness.runAction({ commandId: `extract-${words}`, actionType: "web.dom.extract_list", extractList: requestFrom(structure) });
    expect(read.status, JSON.stringify(read.validation)).toBe("succeeded");
    const records = (read.extracted ?? []) as ReadonlyArray<Record<string, unknown>>;
    expect(records, `one row per ${words} card`).toHaveLength(size);
    records.forEach((record, index) => {
      const values = Object.values(record).filter((value): value is string => typeof value === "string");
      expect(values.some((value) => value.includes(links[index]!)), `row ${index + 1} is card ${index + 1}: ${JSON.stringify(values)}`).toBe(true);
      expect(values.some((value) => /^\$\d+\.\d\d$/u.test(value.trim())), `row ${index + 1} carries its price: ${JSON.stringify(values)}`).toBe(true);
      expect(values.some((value) => /^[0-5]\.\d$/u.test(value.trim())), `row ${index + 1} carries its rating: ${JSON.stringify(values)}`).toBe(true);
    });
  }
});
