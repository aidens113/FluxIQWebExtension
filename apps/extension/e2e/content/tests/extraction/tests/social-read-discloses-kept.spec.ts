// A list read presses each kept row's own "See more" itself, with no parameter,
// and returns its whole text in one call; `discloseText: false` stops it. Proved
// with the real content script on the realistic feed. No model, background
// worker or provider.
//
// Social rerun round 5 (t752, 2026-10-20): a read whose kept rows carried
// collapsed text was refused `incomplete_text`, and the repair the domain named
// was a second Flow shape around the read -- a context read, a press repeated
// over its rows, then the full read. The builder's context read had no
// conditions, so the press walked every row of the feed, about 14 s a row, and
// the build ran out of time. The one read now presses only the rows it keeps
// (`apps/extension/src/content/extraction/text-disclosure/`): an opt-in
// `discloseText` in t752's unit C, the default since its unit C2, because such a
// kept row was always refused, so no read that passed before reads differently.
//
// Rows are chosen by feed position, so the spec names no post, author or text
// of the fixture (the pattern of `social-kept-row-disclosure.spec.ts`).

import { verifyAutomationStudioRunResult, type AutomationStudioLlmProvider, type AutomationStudioRunResultSummary } from "fluxiq/automation-studio";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const ITEM = '[role="article"]:has(a[href*="/posts/"])';
const MESSAGE = '[data-ad-comet-preview="message"]';
const POST_LINK = 'a[href*="/posts/"]';

type FeedRow = { position: string | null; hasBody: boolean; collapsed: boolean };

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

/** Every row the read will see: its feed position, and whether its text is there and cut. */
async function feedRows(harness: ContentHarness): Promise<FeedRow[]> {
  return harness.page.evaluate(({ item, message }) => [...document.querySelectorAll(item)].map((row) => {
    const body = row.querySelector(message);
    return { position: row.getAttribute("aria-posinset"), hasBody: body !== null, collapsed: body !== null && body.querySelector('[role="button"]') !== null };
  }), { item: ITEM, message: MESSAGE });
}

/** A read of each row's position, post link and text, keeping the rows at these feed positions; with no `discloseText` it presses each kept row's own disclosure. */
function read(positions: string[], extra: { discloseText?: boolean } = {}) {
  return {
    item: ITEM,
    fields: { position: { kind: "attribute" as const, attribute: "aria-posinset" }, post: { kind: "link" as const, selector: POST_LINK }, description: { kind: "text" as const, selector: MESSAGE } },
    where: [{ field: "position", equals: positions.map(Number) }],
    ...extra
  };
}

async function wholeText(harness: ContentHarness, position: string): Promise<string> {
  return (await harness.page.locator(`[role="article"][aria-posinset="${position}"] ${MESSAGE}`).innerText()).replace(/\s+/gu, " ").trim();
}

test("a read with no parameter leaves the collapsed post its condition drops untouched, and returns a kept collapsed post whole in one call; discloseText: false refuses it", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("social-network-feed");
  await prepare(harness);
  const rows = await feedRows(harness);
  const collapsed = rows.filter((row) => row.collapsed && row.position !== null);
  const short = rows.filter((row) => row.position !== null && row.hasBody && !row.collapsed).slice(0, 2);
  expect(collapsed.length, "the feed shows at least one long post cut behind See more").toBeGreaterThan(0);
  expect(short.length, "the feed shows short posts the condition can keep").toBe(2);
  const long = collapsed[0]!.position!;
  const shortKept = short.map((row) => row.position!);
  const cutLength = (await page.locator(`[role="article"][aria-posinset="${long}"] ${MESSAGE}`).innerText()).length;
  const isCollapsed = async (position: string) => await page.locator(`[role="article"][aria-posinset="${position}"] ${MESSAGE} [role="button"]`).count() > 0;

  // 1. The condition drops every collapsed post: the read succeeds and presses
  // none of them, since a row rejected on another field is never pressed.
  const dropping = await harness.runAction({ commandId: "read-disclosing-drops-long", actionType: "web.dom.extract_list", extractList: read(shortKept) });
  expect(dropping.status, JSON.stringify(dropping.failure)).toBe("succeeded");
  expect((dropping.extracted as Array<{ position: string }>).map((record) => record.position)).toEqual(shortKept);
  for (const row of collapsed) expect(await isCollapsed(row.position!), `dropped post ${row.position} stays collapsed`).toBe(true);

  // 2. The same keeping read with `discloseText: false` presses nothing, and is
  // refused for the kept post's cut text, as every read was before t752.
  const kept = [...shortKept, long];
  const optedOut = await harness.runAction({ commandId: "read-disclosing-off", actionType: "web.dom.extract_list", extractList: read(kept, { discloseText: false }) });
  expect(optedOut.status).toBe("failed");
  expect(JSON.stringify(optedOut.failure ?? {})).toContain("incomplete_text");
  for (const row of collapsed) expect(await isCollapsed(row.position!), `post ${row.position} stays collapsed when the read opts out`).toBe(true);

  // 3. With no parameter, the condition keeping a collapsed post: the one read
  // presses its own See more and returns it whole, with no incomplete_text,
  // while every other collapsed post stays as it was.
  const started = Date.now();
  const reply = await harness.runAction({ commandId: "read-disclosing-kept", actionType: "web.dom.extract_list", extractList: read(kept) });
  const tookMs = Date.now() - started;
  expect(reply.status, JSON.stringify(reply.failure)).toBe("succeeded");
  expect(reply.validation.status).toBe("passed");
  expect(JSON.stringify(reply.failure ?? {})).not.toContain("incomplete_text");
  const records = reply.extracted as Array<{ position: string; post: string; description: string }>;
  expect(records.map((record) => record.position).sort()).toEqual([...kept].sort());
  for (const record of records) expect(record.description).toBe(await wholeText(harness, record.position));
  const longRecord = records.find((record) => record.position === long)!;
  expect(longRecord.description.length, "the kept long post came back whole, not cut").toBeGreaterThan(cutLength);
  expect(await isCollapsed(long), "the kept long post's own See more was pressed").toBe(false);
  for (const row of collapsed.slice(1)) expect(await isCollapsed(row.position!), `post ${row.position} the read dropped stays collapsed`).toBe(true);
  expect((reply as { extraction?: { disclosedRows?: number } }).extraction?.disclosedRows, "the summary counts the one row the read opened").toBe(1);

  // The very rows proved whole above are the answer. A scripted judge objects
  // to a reading method an earlier judge advised, naming no output defect.
  // The real Core verifier must hold that unsupported no as unsure.
  const summary: AutomationStudioRunResultSummary = {
    schemaVersion: "automation-studio.run-result-summary.v1", totalRecordCount: records.length,
    totalRefusedCount: 0, totalRowsMissingRequired: 0, recordSetCount: 1, withheld: false,
    recordSets: [{ datasetId: "answer", recordCount: records.length, refusedCount: 0, truncated: false,
      columns: ["position", "post", "description"], columnsWithheld: false, rowsChecked: records.length,
      rowsMissingRequired: 0, missingRequiredColumns: [], sampleRows: records }],
    flowShape: [{ nodeId: "read", definitionId: "extract_list" }],
    earlierAdvice: [{ revision: 1, verdict: "no", advice: "Read each kept row's full text in the same read.",
      followed: "changed", said: "Revision 2 changed the read named by the earlier judge." }]
  };
  let calls = 0;
  const provider: AutomationStudioLlmProvider = {
    metadata: { provider: "mock", model: "provider-free" }, estimateCostUsd: () => 0,
    runTask: async (request) => {
      calls += 1;
      expect(request.context.resultSummary?.earlierAdvice).toBeDefined();
      return { response: { kind: "diagnosis", summary: "Scripted consistency check", diagnosis: {
        answersRequest: "no", observed: "The same read opens text, a method an earlier judge advised.",
        changed: "Use a separate pass instead.", defects: []
      } }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostUsd: 0 } };
    }
  };
  const judged = await verifyAutomationStudioRunResult({ projectId: "diagnostic", flowId: "feed-read", runId: "build-test.consistency",
    summary, instructions: [{ schemaVersion: "0.1", instructionId: "goal", title: "Goal",
      body: `Return the posts at feed positions ${kept.join(", ")}, with position, post link and whole description.`,
      scope: { kind: "flow", projectId: "diagnostic", flowId: "feed-read" }, priority: 1, status: "active",
      requirement: "required", createdAt: 1, updatedAt: 1 }], deniedEvidenceKeys: [], provider, confirmAnswer: true });
  expect(calls).toBe(4);
  expect(judged.outcome).toMatchObject({ verdict: "unsure", unsupportedNo: { reasked: true } });

  console.info("read-discloses-kept", JSON.stringify({ rows: rows.length, collapsedAtStart: collapsed.length, kept: records.length, tookMs, disclosedRows: (reply as { extraction?: { disclosedRows?: number } }).extraction?.disclosedRows ?? null }));
});
