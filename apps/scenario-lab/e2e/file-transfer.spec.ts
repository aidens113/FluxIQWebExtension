import { readFile } from "node:fs/promises";
import { expect, type Download, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { fileTransferReport, fileTransferScenario, type FileTransferState } from "../src/scenarios/file-transfer/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { readFinalState, test } from "./lab-fixture.js";

/** Deterministic bytes this spec uploads under the `upload` step's file name. */
const UPLOAD_BYTES = Buffer.from("date,amount\r\n2026-09-01,12.50\r\n");

// The fixture's own seed, as the runner uses by default, so the manifest's
// `report-119.csv` applies; console errors are held to the manifest, as the runner does.
test.use({
  labSeed: fileTransferScenario.seed,
  allowedConsoleErrors: fileTransferScenario.manifest.expected.allowedConsoleErrors ?? [],
});

const finalState = (lab: RunningScenarioLab) => readFinalState<FileTransferState>(lab, "file-transfer");

function byTarget(page: Page, step: ScenarioStep) {
  const testId = /^testid:(.+)$/.exec(step.target ?? "")?.[1];
  if (!testId) throw new Error(`Step ${step.id} needs a testid: target`);
  return page.getByTestId(testId);
}

/** Drives the step operations this fixture's workflows use, as the recording lane does, and returns the completed downloads. */
async function runScript(page: Page, script: readonly ScenarioStep[]): Promise<Download[]> {
  const started: Download[] = [];
  page.on("download", (download) => started.push(download));
  const completed: Download[] = [];
  for (const step of script) {
    const timeout = step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs };
    if (step.operation === "click") await byTarget(page, step).click();
    else if (step.operation === "upload") await byTarget(page, step).setInputFiles({ name: String(step.value), mimeType: "text/csv", buffer: UPLOAD_BYTES });
    else if (step.operation === "waitForState") await byTarget(page, step).waitFor({ state: "visible", ...timeout });
    else if (step.operation === "waitForDownload") {
      await expect.poll(() => started.map((download) => download.suggestedFilename()), timeout).toContain(String(step.value));
      const download = started.find((candidate) => candidate.suggestedFilename() === step.value);
      if (!download) throw new Error(`No download named ${String(step.value)}`);
      expect(await download.failure()).toBeNull();
      completed.push(download);
    } else throw new Error(`The file-transfer spec does not drive ${step.operation}`);
  }
  return completed;
}

/** Reads each fact once, without waiting, as the runner's fact probe does. */
async function expectFacts(page: Page, facts: readonly ExpectedFact[] = []): Promise<void> {
  for (const fact of facts) {
    const locator = page.getByTestId(fact.subject);
    const present = await locator.count() > 0;
    let actual: unknown;
    if (fact.predicate === "exists") actual = present;
    else if (fact.predicate === "visible") actual = present && await locator.first().isVisible();
    else if (fact.predicate === "text") actual = present ? (await locator.first().textContent())?.trim() ?? null : null;
    else throw new Error(`The file-transfer spec does not evaluate ${fact.predicate}`);
    expect(actual, fact.id).toBe(fact.value);
  }
}

test("W16 primary: the download link yields the seeded report CSV and the download is recorded", async ({ page, lab, networkGuard: _guard, consoleErrors: _errors }) => {
  const workflow = resolveScenarioWorkflow(fileTransferScenario.manifest);
  await page.goto(`${lab.origin}${fileTransferScenario.startPath}`);
  await expectFacts(page, workflow.expected.pageFacts);
  const downloads = await runScript(page, workflow.recordingScript);
  await expectFacts(page, workflow.expected.finalState);
  expect(downloads.map((download) => download.suggestedFilename())).toEqual(["report-119.csv"]);
  expect(await readFile(await downloads[0]!.path(), "utf8")).toBe(fileTransferReport(fileTransferScenario.seed).csv);
  await expect(page).toHaveURL(`${lab.origin}${fileTransferScenario.startPath}`);
  expect(await finalState(lab)).toEqual({ seed: 119, reportFilename: "report-119.csv", downloadCount: 1, uploadCount: 0, lastUpload: null });
});

test("W17 upload: the chosen file's name and size are recorded and the name is echoed", async ({ page, lab, networkGuard: _guard, consoleErrors: _errors }) => {
  const workflow = resolveScenarioWorkflow(fileTransferScenario.manifest, { workflowId: "upload" });
  await page.goto(`${lab.origin}${fileTransferScenario.startPath}`);
  await expectFacts(page, workflow.expected.pageFacts);
  expect(await runScript(page, workflow.recordingScript)).toEqual([]);
  await expectFacts(page, workflow.expected.finalState);
  await expect(page.getByTestId("upload-size")).toHaveText(`${UPLOAD_BYTES.length} bytes`);
  expect(await finalState(lab)).toEqual({ seed: 119, reportFilename: "report-119.csv", downloadCount: 0, uploadCount: 1, lastUpload: { name: "expense-receipts.csv", size: UPLOAD_BYTES.length } });
  await page.reload();
  await expect(page.getByTestId("upload-result")).toHaveText("Uploaded expense-receipts.csv");
});

test("submitting the upload form without a file explains the problem and records nothing", async ({ page, lab, networkGuard: _guard, consoleErrors: _errors }) => {
  await page.goto(`${lab.origin}${fileTransferScenario.startPath}`);
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByTestId("upload-error")).toHaveText("Choose a file to upload.");
  await expect(page.getByTestId("upload-result")).toHaveCount(0);
  expect(await finalState(lab)).toMatchObject({ uploadCount: 0, lastUpload: null });
});

test("the fixture declares no variants, so no variant is armed", () => {
  const { manifest } = fileTransferScenario;
  expect([manifest.variants, ...(manifest.workflows ?? []).map((workflow) => workflow.variants)]).toEqual([undefined, undefined]);
});
