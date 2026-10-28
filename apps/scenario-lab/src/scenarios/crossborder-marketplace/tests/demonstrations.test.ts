import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import type { ScenarioDemonstration } from "@fluxiq-web-extension/test-contracts";
import { CROSSBORDER_MARKETPLACE_DEMONSTRATIONS as DEMONSTRATIONS } from "../demonstrations.js";
import { crossborderMarketplaceManifest as manifest, MARKET_SEED } from "../manifest/index.js";
import { marketClasses } from "../styles/index.js";
import { closeBrowser, locate, normalize, openSession, type Session } from "./browser-harness.js";

/**
 * The free-hubs demonstrations in a browser, provider-free. The positive one shows the honest path with two detours
 * (an extra Ships from filter, a wrong sort), each undone before the read; it must change the page when applied,
 * restore it when undone, and read exactly the expected records. The conflicting one filters at a higher price than
 * the written task and must not. The harness drives headless Chromium only; it has no headed switch.
 */
const c = marketClasses(MARKET_SEED, "baseline");
const TASK_DATASET = "extract-free-hubs-under-ten";
const EXPECTED = manifest.expected.allowedConsoleErrors === undefined ? [] : manifest.expected.allowedConsoleErrors;
const positive = DEMONSTRATIONS.find((demonstration) => !demonstration.conflictsWithInstruction)!;
const conflicting = DEMONSTRATIONS.find((demonstration) => demonstration.conflictsWithInstruction)!;
/** The step of each detour at which the page shows the detour applied. */
const SHOWN_AT = ["demo-spain-chip", "demo-orders-on"];

const expectedRecords = () => {
  const records = manifest.workflows?.map((workflow) => workflow).find((workflow) => workflow.id === "free-hubs-under-ten")?.expected.extracted?.[0]?.records;
  assert.ok(records && records.length > 0, "the free hubs workflow declares records");
  return records;
};
/** What a person sees of the results: the active sort tab, the filter chips, and the first cards in order. */
async function snapshot(session: Session) {
  await locate(session.page, `.${c.grid} > .${c.card} >> nth=0`).waitFor({ state: "visible", timeout: 6000 });
  const text = async (selector: string) => (await session.page.locator(selector).allTextContents()).map(normalize);
  return {
    sort: await text(`.${c.sortTab}.${c.sortTabOn}`),
    chips: await text(`.${c.chip}`),
    titles: (await text(`.${c.grid} > .${c.card} .${c.cardTitle}`)).slice(0, 8),
  };
}

async function withSession<T>(work: (session: Session) => Promise<T>): Promise<T> {
  const session = await openSession();
  try { return await work(session); } finally { await session.close(); }
}

after(() => closeBrowser());

describe("the free-hubs demonstrations in a browser", { concurrency: true }, () => {
  test("each detour visibly changes the results and its undo restores them", () => withSession(async (session) => {
    assert.equal(positive.detours.length, SHOWN_AT.length);
    let done = 0;
    /** Runs the steps after the ones already run, through the named step. */
    const advanceTo = async (id: string) => {
      const end = positive.steps.findIndex((step) => step.id === id) + 1;
      assert.ok(end >= done, `${id} is not before the steps already run`);
      await session.run(positive.steps.slice(done, end));
      done = end;
    };
    for (const [index, detour] of positive.detours.entries()) {
      const first = positive.steps.findIndex((step) => step.id === detour.stepIds[0]);
      await advanceTo(positive.steps[first - 1]!.id);
      const resting = await snapshot(session);
      await advanceTo(SHOWN_AT[index]!);
      assert.notDeepEqual(await snapshot(session), resting, `${detour.stepIds[0]} changed what the page shows`);
      await advanceTo(detour.stepIds[detour.stepIds.length - 1]!);
      assert.deepEqual(await snapshot(session), resting, `${detour.stepIds.at(-1)} restored what the page showed before the detour`);
    }
    assert.deepEqual(session.errors.filter((error) => !error.startsWith("http ") && !EXPECTED.some((allowed) => error.includes(allowed))), []);
  }));

  test("the positive demonstration reads exactly the expected records, record by record", () => withSession(async (session) => {
    const read = await session.run(positive.steps);
    const expected = expectedRecords();
    assert.equal(read[TASK_DATASET]?.length, expected.length);
    expected.forEach((record, index) => assert.deepEqual(read[TASK_DATASET]![index], record, `record ${index + 1}`));
    assert.deepEqual(read[TASK_DATASET], expected);
  }));

  test("the conflicting demonstration (a higher price limit) does not read the expected records", () => withSession(async (session) => {
    const read = await session.run(conflicting.steps);
    assert.notDeepEqual(read[TASK_DATASET], expectedRecords());
    assert.ok((read[TASK_DATASET]?.length ?? 0) > 0, "it still reads a list");
  }));
});
