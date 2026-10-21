// Offline reads (traces and offline trials, P5 tier 2): the web domain's
// offline reevaluator (`createWebOfflineReadReevaluator`), asked exactly as
// Core's trace matcher asks it (reevaluation-request.ts), answers a changed
// read from the production page capture through the sandboxed snapshot page
// (`packages/test-runner/src/offline-snapshot-page/`) running the extension's
// own content code -- and says so when it cannot.
//
// On each site's list page, as the snapshot spike reaches it (list-pages.ts):
// the read is planned and run once whole (the spike's warm-up, decision 3);
// live read A runs (the read a trace records); the page is captured by the
// background's own capturer (capture-snapshot.ts) as the trace would hold it
// beside A's result; changed read B (the other fields) runs live; the Lab is
// closed; then the reevaluator is asked for B where the trace recorded A. It
// replays A over the snapshot as its control (D37) and runs B. Asserted: the
// answer is `answered`, and its rows equal B's live rows cell for cell.
//
// The dynamic case captures a growing feed before it grows, then lets A read
// past it live: the control cannot reproduce live A over the smaller
// snapshot, so the answer must be a `dynamic_content` gap, never `answered`.
// In every case the same request with the primary's bytes missing from the
// store must be a `snapshot_unavailable` gap.
//
// One OFFLINE_READS line per test: counts only, never page content.

import { existsSync } from "node:fs";
import { createWebOfflineReadReevaluator } from "@fluxiq-web-extension/domain/node";
import { gatewayActionResultFromBrowserResult } from "@fluxiq-web-extension/domain/client";
import type { ClientGatewayTraceReevaluation, ClientGatewayTraceReevaluationRequest } from "fluxiq/client-gateway";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { openWebSnapshotPage, type SnapshotBrowserChannel } from "../../../../../../../packages/test-runner/src/offline-snapshot-page/index.js";
import { LIST_PAGES, type ListPage } from "../../snapshot-fidelity/tests/list-pages.js";
import { captureSnapshot, type PageCapture } from "./capture-snapshot.js";
import { harnessContentCode } from "./harness-content-code.js";
import { listRead, type ListReadPlan } from "./list-read.js";
import { reevaluationRequest } from "./reevaluation-request.js";
import { watchedSnapshotPage } from "./watched-snapshot-page.js";

const SITES = ["job-board", "photo-social", "social-network-feed"];
const EDGE_SITE = "job-board";
const GROWING_FEED = "photo-social";
const EDGE_INSTALLED = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].some((path) => existsSync(path));

function listPage(scenarioId: string): ListPage {
  const found = LIST_PAGES.find((candidate) => candidate.scenarioId === scenarioId);
  if (!found) throw new Error(`no list page is planned for ${scenarioId}`);
  return found;
}

async function settledListPage(openHarness: (scenarioId: string) => Promise<ContentHarness>, scenarioId: string): Promise<ContentHarness> {
  const harness = await openHarness(scenarioId);
  await listPage(scenarioId).open(harness);
  await harness.page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await harness.page.waitForTimeout(1_000);
  return harness;
}

/** A reads the first half of the detected fields, B the rest; a list of one field is read again by B with a narrower scope. */
function readPair(plan: ListReadPlan) {
  const keys = Object.keys(plan.fields);
  expect(keys.length, "the detected list has fields to read").toBeGreaterThan(0);
  const half = Math.max(1, Math.ceil(keys.length / 2));
  const fieldsOf = (chosen: string[]) => Object.fromEntries(chosen.map((key) => [key, plan.fields[key]!]));
  const commandA = listRead.command("offline-reads-a", plan.item, fieldsOf(keys.slice(0, half)));
  const commandB = keys.length > 1
    ? listRead.command("offline-reads-b", plan.item, fieldsOf(keys.slice(half)))
    : { ...listRead.command("offline-reads-b", plan.item, fieldsOf(keys)), extractList: { item: plan.item, fields: fieldsOf(keys), minItems: 0, maxItems: 3 } };
  return { commandA, commandB, fieldsA: half, fieldsB: Object.keys(commandB.extractList?.fields ?? {}).length };
}

/** The same request with the store holding nothing for the captured document. */
function withoutPrimary(request: ClientGatewayTraceReevaluationRequest, capture: PageCapture): ClientGatewayTraceReevaluationRequest {
  const primary = capture.snapshot.primary.sha256;
  return { ...request, readArtifact: async (sha256) => sha256 === primary ? undefined : await request.readArtifact(sha256) };
}

function summary(answer: ClientGatewayTraceReevaluation) {
  return answer.status === "gap" ? { status: answer.status, reason: answer.reason, fields: answer.fields.length } : { status: answer.status };
}

function answeredRows(answer: ClientGatewayTraceReevaluation): Array<Record<string, unknown>> {
  if (answer.status !== "answered") return [];
  const payload = answer.result.payload as { extracted?: unknown } | undefined;
  return Array.isArray(payload?.extracted) ? payload.extracted as Array<Record<string, unknown>> : [];
}

function cellsEqual(live: Array<Record<string, unknown>>, offline: Array<Record<string, unknown>>): { compared: number; equal: number } {
  let compared = 0;
  let equal = 0;
  live.forEach((row, index) => {
    for (const [key, value] of Object.entries(row)) {
      compared += 1;
      if (JSON.stringify(offline[index]?.[key]) === JSON.stringify(value)) equal += 1;
    }
  });
  return { compared, equal };
}

async function openReevaluator(channel: SnapshotBrowserChannel, headless: boolean) {
  const page = openWebSnapshotPage({ content: await harnessContentCode(), channel, headless });
  const watched = watchedSnapshotPage(page);
  return { reevaluator: createWebOfflineReadReevaluator(watched.page), evaluations: watched.evaluations, close: () => page.close() };
}

for (const [scenarioId, channel] of [...SITES.map((site) => [site, "chrome"] as const), [EDGE_SITE, "msedge"] as const]) {
  test(`${scenarioId} (${channel}): the reevaluator answers a changed read over the production capture with the live rows`, async ({ openHarness, headless }) => {
    test.skip(channel === "msedge" && !EDGE_INSTALLED, "Edge is not installed");
    test.setTimeout(480_000);
    const harness = await settledListPage(openHarness, scenarioId);
    const plan = await listRead.plan(harness, true);
    const { commandA, commandB, fieldsA, fieldsB } = readPair(plan);

    const liveA = await listRead.live(harness, commandA);
    expect(listRead.rows(liveA).length, "live read A returned rows").toBeGreaterThan(0);
    await harness.page.waitForTimeout(1_000);
    const capture = await captureSnapshot(harness);
    const liveB = await listRead.live(harness, commandB);
    const liveRows = listRead.rows(liveB);
    expect(liveRows.length, "live read B returned rows").toBeGreaterThan(0);
    await harness.close();

    const { reevaluator, evaluations, close } = await openReevaluator(channel, headless);
    try {
      const request = reevaluationRequest({ commandB, commandA, liveA, capture });
      const started = Date.now();
      const answer = await reevaluator.reevaluate(request);
      const offlineMs = Date.now() - started;
      const evaluated = evaluations.length;
      const missing = await reevaluator.reevaluate(withoutPrimary(request, capture));
      const offlineRows = answeredRows(answer);
      const cells = cellsEqual(liveRows, offlineRows);
      console.log(`OFFLINE_READS ${JSON.stringify({
        site: scenarioId, channel, fieldsA, fieldsB, droppedInPlan: plan.dropped, differingFields: request.fields.length,
        liveA: { rows: listRead.rows(liveA).length, status: liveA.status, failure: liveA.failure?.code ?? null },
        liveB: { rows: liveRows.length, status: liveB.status, failure: liveB.failure?.code ?? null },
        answer: { ...summary(answer), rows: offlineRows.length, cellsCompared: cells.compared, cellsEqual: cells.equal, ms: offlineMs },
        missingPrimary: summary(missing),
        snapshot: { resources: capture.snapshot.resources.length, unavailable: capture.snapshot.unavailable },
        evaluations
      })}`);
      expect(answer.status, "the reevaluator answers the changed read").toBe("answered");
      expect(answer.status === "answered" ? answer.result.status : null, "B ends offline as it did live").toBe(gatewayActionResultFromBrowserResult(liveB).status);
      expect(offlineRows.length, "B reads as many rows offline as live").toBe(liveRows.length);
      expect(cells.equal, "every cell of B offline equals B live").toBe(cells.compared);
      expect(offlineRows, "B's rows offline equal B's live").toEqual(liveRows);
      expect(missing, "with the document missing from the store, the answer is a snapshot gap").toEqual({ status: "gap", reason: "snapshot_unavailable", fields: request.fields });
      expect(evaluations.length, "a missing snapshot runs nothing in the page").toBe(evaluated);
    } finally {
      await close();
    }
  });
}

test(`${GROWING_FEED} (chrome): a read past a feed captured before it grew is a dynamic-content gap, never an answer`, async ({ openHarness, headless }) => {
  test.setTimeout(480_000);
  const harness = await settledListPage(openHarness, GROWING_FEED);
  const plan = await listRead.plan(harness, false);
  const { commandA, commandB, fieldsA, fieldsB } = readPair(plan);
  const capture = await captureSnapshot(harness);
  const liveA = await listRead.live(harness, commandA);
  await harness.close();

  const { reevaluator, evaluations, close } = await openReevaluator("chrome", headless);
  try {
    const request = reevaluationRequest({ commandB, commandA, liveA, capture });
    const answer = await reevaluator.reevaluate(request);
    const evaluated = evaluations.length;
    const missing = await reevaluator.reevaluate(withoutPrimary(request, capture));
    const control = evaluations.find((evaluation) => evaluation.commandId === commandA.commandId);
    console.log(`OFFLINE_READS ${JSON.stringify({
      site: GROWING_FEED, channel: "chrome", dynamic: true, fieldsA, fieldsB, differingFields: request.fields.length,
      liveA: { rows: listRead.rows(liveA).length, status: liveA.status, failure: liveA.failure?.code ?? null },
      answer: summary(answer),
      missingPrimary: summary(missing),
      snapshot: { resources: capture.snapshot.resources.length, unavailable: capture.snapshot.unavailable },
      evaluations
    })}`);
    expect(control?.status, "the control ran over the snapshot").toBe("evaluated");
    expect(listRead.rows(liveA).length, "live, A read past what the capture held").toBeGreaterThan(control?.rows ?? Number.POSITIVE_INFINITY);
    expect(control?.observations?.scriptsRan, "no page script ran in the control").toBe(0);
    expect(control?.observations?.requestsLeaked, "no request left the snapshot page in the control").toBe(0);
    expect(answer.status, "a snapshot that cannot reproduce the recorded read never answers").not.toBe("answered");
    expect(answer, "the answer is a dynamic-content gap").toEqual({ status: "gap", reason: "dynamic_content", fields: request.fields });
    expect(missing, "with the document missing from the store, the answer is a snapshot gap").toEqual({ status: "gap", reason: "snapshot_unavailable", fields: request.fields });
    expect(evaluations.length, "a missing snapshot runs nothing in the page").toBe(evaluated);
  } finally {
    await close();
  }
});

test("social-network-feed (chrome): unsupported automatic text disclosure is an explicit offline gap", async ({ openHarness, headless }) => {
  test.setTimeout(480_000);
  // The shared fidelity opener deliberately expands every post. This case
  // must capture the actual collapsed state before any text read opens it.
  const harness = await openHarness("social-network-feed");
  for (const [operation, payload] of [["consent", { choice: "all" }], ["notifications", { choice: "dismissed" }], ["chat", { state: "closed" }]] as const) {
    const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
      method: "POST", headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload)
    });
    expect(response.ok).toBe(true);
  }
  await harness.page.reload();
  const message = '[data-ad-comet-preview="message"]';
  await expect(harness.page.locator(message).first()).toBeVisible();
  await expect.poll(async () => (await harness.messages()).some((entry) => entry.type === "fluxiq.contentReady")).toBe(true);
  const position = await harness.page.locator('[role="article"]:has(a[href*="/posts/"])').evaluateAll((rows, selector) => {
    const row = rows.find((item) => item.querySelector(`${selector} [role="button"]`));
    return row?.getAttribute("aria-posinset") ?? null;
  }, message);
  expect(position, "a realistic collapsed post is available").not.toBeNull();
  const item = `[role="article"][aria-posinset="${position}"]`;
  const commandA = listRead.command("offline-disclosure-a", item, { position: { kind: "attribute", attribute: "aria-posinset" } });
  const commandB = listRead.command("offline-disclosure-b", item, {
    position: { kind: "attribute", attribute: "aria-posinset" }, description: { kind: "text", selector: message }
  });
  const liveA = await listRead.live(harness, commandA);
  expect(liveA.status).toBe("succeeded");
  expect(listRead.rows(liveA)).toHaveLength(1);
  const capture = await captureSnapshot(harness);
  expect(await harness.page.locator(`${item} ${message} [role="button"]`).count()).toBeGreaterThan(0);
  const liveB = await listRead.live(harness, commandB);
  expect(liveB.status, "the live page can disclose the requested text").toBe("succeeded");
  expect(listRead.rows(liveB)).toHaveLength(1);
  await harness.close(); // Offline evaluation has no live tab to fall back to.

  const snapshotPage = openWebSnapshotPage({ content: await harnessContentCode(), channel: "chrome", headless });
  const evaluations: Awaited<ReturnType<typeof snapshotPage.evaluate>>[] = [];
  const reevaluator = createWebOfflineReadReevaluator({ evaluate: async (snapshot, action) => {
    const evaluated = await snapshotPage.evaluate(snapshot, action);
    evaluations.push(evaluated);
    return evaluated;
  } });
  try {
    const request = reevaluationRequest({ commandB, commandA, liveA, capture });
    const answer = await reevaluator.reevaluate(request);
    expect(evaluations).toHaveLength(2);
    const [control, changed] = evaluations;
    expect(control?.status).toBe("evaluated");
    expect(changed?.status).toBe("evaluated");
    if (control?.status !== "evaluated" || changed?.status !== "evaluated") throw new Error("both isolated reads must run");
    expect(control.result.status).toBe("succeeded");
    expect(control.result.extracted).toEqual(liveA.extracted);
    expect(changed.result.failure?.actual).toMatch(/^incomplete_text:/u);
    expect(changed.observations.scriptsRan).toBe(0);
    expect(changed.observations.requestsLeaked).toBe(0);
    expect(answer).toEqual({ status: "gap", reason: "dynamic_content", fields: request.fields });
    console.info("OFFLINE_DISCLOSURE", JSON.stringify({ evaluations: evaluations.length, status: answer.status, failure: changed.result.failure?.code }));
  } finally {
    await snapshotPage.close();
  }
});
