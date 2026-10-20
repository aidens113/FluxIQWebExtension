import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { AUGUST_OVER_1300_CELLS } from "../breadth/index.js";
import { photoSocialScenario as scenario } from "../scenario.js";
import { openPhotoSession, type PhotoSession } from "./photo-session.js";
import { factValue, locate, runScript } from "./recording-driver.js";

/**
 * The four breadth tasks (t702) against a real browser. Each honest path is
 * the workflow's own recording script, run the way the Lab runs one, and must
 * meet the dataset and every final-state fact; each wrong path is a plausible
 * mistake (an unfiltered or partial read, the wrong rows, an extra act) and
 * must fail one of those oracles, not merely differ.
 */
const manifest = scenario.manifest;
const ROOT = "/scenarios/photo-social/";
let browser: Browser;

const session = (): Promise<PhotoSession> => openPhotoSession(browser);
const workflow = (workflowId: string) => resolveScenarioWorkflow(manifest, { workflowId });
const dataset = (workflowId: string) => workflow(workflowId).expected.extracted![0]!;

/** Whether every fact holds; a fact the page reads another way is a failed oracle. */
async function factsHold(page: Page, facts: readonly ExpectedFact[]): Promise<boolean> {
  for (const fact of facts) if (JSON.stringify(await factValue(page, fact)) !== JSON.stringify(fact.value)) return false;
  return true;
}
/** The facts hold once the page's last change has come back from the server; the oracle script is rewritten only then. */
async function assertFactsSettle(page: Page, facts: readonly ExpectedFact[], label: string): Promise<void> {
  const deadline = Date.now() + 4000;
  while (!(await factsHold(page, facts)) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  for (const fact of facts) assert.deepEqual(await factValue(page, fact), fact.value, `${label}: ${fact.id}`);
}
const without = (script: readonly ScenarioStep[], ids: readonly string[]) => script.filter(({ id }) => !ids.includes(id));
const retargeted = (script: readonly ScenarioStep[], id: string, target: string) => script.map((step) => (step.id === id ? { ...step, target } : step));
const declined = async (page: Page) => { await page.getByText("Decline optional cookies", { exact: true }).click(); };

before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser?.close(); });

describe("breadth honest paths: each recording meets its dataset and its final state", { concurrency: true, timeout: 600_000 }, () => {
  for (const workflowId of ["priya-tags", "newest-likes", "august-over-1300", "kiln-notes"]) {
    it(workflowId, async () => {
      const s = await session();
      try {
        const { expected, recordingScript } = workflow(workflowId);
        await assertFactsSettle(s.page, expected.pageFacts!, "first load");
        const extracted = await runScript(s.page, s.lab.origin, recordingScript);
        const entry = expected.extracted![0]!;
        assert.deepEqual(extracted.get(entry.step), entry.records);
        await assertFactsSettle(s.page, expected.finalState!, "final state");
        const allowed = expected.allowedConsoleErrors ?? [];
        assert.deepEqual(s.problems.filter((problem) => !allowed.some((text) => problem.includes(text))), []);
      } finally { await s.close(); }
    });
  }
});

describe("breadth honest paths on a slow server: what the page shows done, the server holds", { timeout: 600_000 }, () => {
  // Under load the server answers late. The heart turns only on its answer, so the recording, which waits for the
  // turned heart before it opens the next page, never leaves a like behind in a request the navigation drops.
  it("newest-likes: every like the hearts show reaches the account although each answer takes a while", async () => {
    const s = await session();
    try {
      await s.context.route("**/api/photo-social/**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.continue().catch(() => undefined);
      });
      const { expected, recordingScript } = workflow("newest-likes");
      const extracted = await runScript(s.page, s.lab.origin, recordingScript);
      assert.deepEqual(extracted.get("extract-newest-likes"), dataset("newest-likes").records);
      await assertFactsSettle(s.page, expected.finalState!, "slow server");
    } finally { await s.close(); }
  });
});

describe("breadth wrong paths: each plausible mistake fails an oracle", { concurrency: true, timeout: 600_000 }, () => {
  it("priya-tags: reading without the replies, without loading more, or every comment naming her each gives the wrong rows", async () => {
    const { recordingScript } = workflow("priya-tags");
    const expected = dataset("priya-tags").records;
    const cases: Array<[string, ScenarioStep[], number]> = [
      ["no replies opened", without(recordingScript, ["priya-tags-open-replies", "priya-tags-replies-open"]), 3],
      ["first screen only", without(recordingScript, ["priya-tags-comments-hydrate", "priya-tags-more-1", "priya-tags-batch-2", "priya-tags-more-2", "priya-tags-batch-3", "priya-tags-more-3", "priya-tags-batch-4", "priya-tags-open-replies", "priya-tags-replies-open"]), 0],
      ["any comment linking to her, author included", retargeted(recordingScript, "extract-priya-tags", `li:has(> div a[href$="/priya.nair/"])`), 6],
    ];
    for (const [label, script, rows] of cases) {
      const s = await session();
      try {
        const read = (await runScript(s.page, s.lab.origin, script)).get("extract-priya-tags")!;
        assert.equal(read.length, rows, label);
        assert.notDeepEqual(read, expected, label);
      } finally { await s.close(); }
    }
  });

  it("newest-likes: liking the first three cells, which are pinned, fails the account and the table; one extra act fails the account", async () => {
    const { expected, recordingScript } = workflow("newest-likes");
    const pinned = await (async () => {
      const s = await session();
      try {
        await declined(s.page);
        await s.page.goto(`${s.lab.origin}${ROOT}harbourlight.studio/`);
        return (await s.page.locator(`main a[role="link"][href*="/p/"]`).evaluateAll((cells) => cells.slice(0, 3).map((cell) => cell.getAttribute("href")!.match(/\/p\/([^/]+)\//u)![1]!)));
      } finally { await s.close(); }
    })();
    const newest = ["D1OKDvAEHfa", "DgYZxS8LJOe", "DPIEH3I491a"];
    const firstCells = recordingScript.map((step) => {
      const at = newest.findIndex((code) => step.path === `${ROOT}p/${code}/`);
      const moved = at < 0 ? step : { ...step, path: `${ROOT}p/${pinned[at]}/` };
      return moved.id === "extract-newest-likes" ? { ...moved, target: `main a[role="link"][href*="/p/"]:nth-child(-n+3)` } : moved;
    });
    const wrong = await session();
    try {
      const read = (await runScript(wrong.page, wrong.lab.origin, firstCells)).get("extract-newest-likes")!;
      assert.equal(read.length, 3);
      assert.notDeepEqual(read, dataset("newest-likes").records);
      await assert.rejects(assertFactsSettle(wrong.page, expected.finalState!, "pinned liked"), /newest-likes-account/u);
    } finally { await wrong.close(); }
    const extra = await session();
    try {
      const read = (await runScript(extra.page, extra.lab.origin, recordingScript)).get("extract-newest-likes")!;
      assert.deepEqual(read, dataset("newest-likes").records, "the table alone cannot tell");
      await extra.page.goto(`${extra.lab.origin}${ROOT}p/D1OKDvAEHfa/`);
      await locate(extra.page, `article section > [role="button"]:has(> svg[aria-label="Save"])`).click();
      await extra.page.getByText("Save to collection", { exact: true }).waitFor({ state: "visible" });
      await assert.rejects(assertFactsSettle(extra.page, expected.finalState!, "liked and saved"), /newest-likes-account/u);
    } finally { await extra.close(); }
  });

  it("august-over-1300: reel plays, the pinned2025 post and other accounts cannot replace the qualifying studio post", async () => {
    const { recordingScript } = workflow("august-over-1300");
    const anyKind = AUGUST_OVER_1300_CELLS.replace(`:not(:has(svg[aria-label="Clip"]))`, "");
    const anyYear = AUGUST_OVER_1300_CELLS.replace(`[alt*=", 2026."]`, "");
    assert.notEqual(anyKind, AUGUST_OVER_1300_CELLS);
    assert.notEqual(anyYear, AUGUST_OVER_1300_CELLS);
    for (const [label, target] of [["reel counted by its plays", anyKind], ["August of any year", anyYear]] as const) {
      const s = await session();
      try {
        const prefix = without(recordingScript, ["august-over-1300-open-post", "august-over-1300-post-ready", "extract-august-over-1300", "august-over-1300-read"]);
        await runScript(s.page, s.lab.origin, prefix);
        const wrongCells = s.page.locator(target).filter({ hasNot: s.page.locator('img[alt*="August 21, 2026."]') });
        assert.equal(await wrongCells.count(), 1, label);
        await wrongCells.click();
        const suffix = recordingScript.slice(recordingScript.findIndex(({ id }) => id === "august-over-1300-post-ready"));
        const read = (await runScript(s.page, s.lab.origin, suffix)).get("extract-august-over-1300")!;
        assert.equal(read.length, 1, label);
        assert.notDeepEqual(read, dataset("august-over-1300").records, label);
      } finally { await s.close(); }
    }
    for (const handle of ["harbourlight.studios", "kiln.theory"]) {
      const s = await session();
      try {
        await declined(s.page);
        await s.page.goto(`${s.lab.origin}${ROOT}${handle}/`);
        await s.page.locator(`main a[role="link"][href*="/p/"]`).first().waitFor({ state: "visible" });
        assert.equal(await locate(s.page, AUGUST_OVER_1300_CELLS).count(), 1, `${handle}'s August post`);
        await locate(s.page, AUGUST_OVER_1300_CELLS).click();
        const suffix = recordingScript.slice(recordingScript.findIndex(({ id }) => id === "august-over-1300-post-ready"));
        const read = (await runScript(s.page, s.lab.origin, suffix)).get("extract-august-over-1300")!;
        assert.notDeepEqual(read, dataset("august-over-1300").records, handle);
      } finally { await s.close(); }
    }
  });

  it("kiln-notes: picking the studio's kiln photo too, or reaching the posts through their filled bookmarks, fails the account", async () => {
    const { expected, recordingScript } = workflow("kiln-notes");
    const overPicked = await session();
    try {
      const at = recordingScript.findIndex(({ id }) => id === "kiln-notes-done");
      const script = [...recordingScript.slice(0, at), { id: "kiln-notes-pick-kiln-photo", operation: "click", target: `[role="dialog"] [role="checkbox"]:has(img[alt$="May be an image of kiln."])` } as ScenarioStep, ...recordingScript.slice(at)];
      const read = (await runScript(overPicked.page, overPicked.lab.origin, script)).get("extract-kiln-notes")!;
      assert.notDeepEqual(read, dataset("kiln-notes").records);
      await assert.rejects(assertFactsSettle(overPicked.page, expected.finalState!, "kiln photo picked"), /kiln-notes-account/u);
    } finally { await overPicked.close(); }
    const bookmarked = await session();
    try {
      await runScript(bookmarked.page, bookmarked.lab.origin, recordingScript);
      // A post's filled bookmark unsaves it: out of saved and out of Studio inspo, which no later step puts back.
      await bookmarked.page.goto(`${bookmarked.lab.origin}${ROOT}p/Dn6ixXoKbtq/`);
      await locate(bookmarked.page, `article section > [role="button"]:has(> svg[aria-label="Remove"])`).click();
      await bookmarked.page.getByText("Removed from saved", { exact: true }).waitFor({ state: "visible" });
      await assert.rejects(assertFactsSettle(bookmarked.page, expected.finalState!, "bookmark pressed"), /kiln-notes-account/u);
    } finally { await bookmarked.close(); }
  });
});
