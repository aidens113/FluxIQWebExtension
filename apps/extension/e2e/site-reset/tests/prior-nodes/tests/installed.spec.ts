import type { JsonObject } from "fluxiq/core";
import { expect, test } from "../../../../fixtures/extension-context";
import { bindScriptedProvider, pageHandleWhere, projectBuild, startInstalledBuild } from "../../../index";

const TASK = "Set the email field on the Offers & reminders page to ada.synthetic@example.test without submitting the form.";
const VALUE = "ada.synthetic@example.test";

test("installed authoring reruns one proven state call through the actual permission and fresh-receipt path", async ({ extensionSession }) => {
  test.setTimeout(240_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page } = installed;
  const proof = projectBuild(installed, "Installed prior-call proof", TASK, () => page.url());
  let batchSent = false;
  let originalSent = false;
  let summary: JsonObject | undefined;
  let diagnostic: string | undefined;
  let verifications = 0;
  let providerTurns = 0;
  try {
    await page.goto(new URL("/scenarios/company-website/", installed.origin).href);
    await page.locator('div[title="Close"]').click();
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Newsletter", exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByText("No thanks, I will pay full price", { exact: true }).click();
    await page.locator("footer").getByRole("link", { name: "Offers & reminders", exact: true }).click();
    const input = page.locator('main input[name="email"]');
    await expect(input).toBeVisible();
    const beforeSubscriptions = await page.locator('section[aria-label="Your subscriptions"] tbody tr').count();
    const beforeUrl = page.url();
    await installed.pair();
    const beforeCommands = installed.siteCommands().length;
    const beforeResults = installed.actionResultSummaries().length;
    const beforeDistinct = installed.distinctActionCommands();
    bindScriptedProvider(installed, {
      task: TASK, permitted: [], instructionSourceId: proof.instructionSourceId, maxIterations: 10, maxCallsPerRun: 24,
      verify: () => {
        verifications += 1;
        throw new Error("This transport proof must never ask a whole-Flow judge.");
      },
      supervisor: (turn) => {
        if (turn.step === 1) return turn.call("plan", "project.write_plan", {
          taskSpec: { parts: [{
            id: "p1", quote: { sourceId: proof.instructionSourceId(), text: TASK },
            goalFacts: ["The newsletter email field contains the supplied test address"], lastingActs: []
          }], notAsked: [] },
          subflows: [{ key: "main", name: "Prepare the field", parts: ["p1"] }]
        });
        if (turn.step === 2) return turn.call("dispatch", "project.dispatch", {
          reason: "Exercise the actual installed authoring transport.",
          briefs: [{ kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: [], maxIterations: 10 }]
        });
        void proof.stop();
        return turn.complete({});
      },
      builder: (turn) => {
        providerTurns += 1;
        if (!originalSent) {
          const handle = pageHandleWhere(turn.shownPage(), /\b(?:field|textbox|input|email)\b.*\bemail\b/iu);
          if (!handle) return turn.node("look." + turn.step, "web.output.dom-capture_snapshot", {}, []);
          originalSent = true;
          return turn.node("batch.original", "web.output.dom-type", { target: { handle }, text: VALUE, submit: false }, []);
        }
        const original = turn.evidence.find((entry) => entry.callId.endsWith("batch.original"));
        if (!batchSent && original) {
          batchSent = true;
          return turn.call("batch.proof", "core.run_nodes", { calls: [original.callId] });
        }
        const batch = turn.evidence.find((entry) => entry.callId.endsWith("batch.proof"));
        if (batch) summary = batch.value;
        else diagnostic = "No batch result after the original call.";
        // Intentional cancellation after the transport property is measured.
        // No candidate, judged whole run or finished automation is claimed.
        void proof.stop();
        return turn.complete({});
      }
    });
    const ending = await proof.run();
    expect(ending.ending).toBe("failed");
    expect(diagnostic).toBeUndefined();
    expect(summary).toMatchObject({ status: "completed", requested: 1, executed: 1, skipped: 0 });
    expect(verifications).toBe(0);
    expect(providerTurns).toBeGreaterThanOrEqual(3);
    const sent = installed.siteCommands().slice(beforeCommands);
    const received = installed.actionResultSummaries().slice(beforeResults);
    expect(sent.filter((action) => action === "web.dom.type")).toHaveLength(2);
    expect(received.filter((entry) => entry.actionType === "web.dom.type")).toHaveLength(2);
    expect(received.every((entry) => entry.status === "succeeded")).toBe(true);
    expect(received).toHaveLength(sent.length);
    expect(installed.distinctActionCommands() - beforeDistinct).toBe(sent.length);
    expect(sent.every((action) => action === "web.dom.type" || action === "web.dom.capture_snapshot")).toBe(true);
    await expect(input).toHaveValue(VALUE);
    await expect(page.locator('section[aria-label="Your subscriptions"] tbody tr')).toHaveCount(beforeSubscriptions);
    expect(page.url()).toBe(beforeUrl);
    expect(installed.gatewayErrors).toHaveLength(0);
    console.log(JSON.stringify({
      installedBatchProof: "fresh-main-state-rerun", mainCommands: 2, received: received.length,
      freshCommands: sent.length, verifications, providerNetworkCalls: 0,
      ending: "intentionally_cancelled_after_transport_proof"
    }));
  } finally {
    await proof.stop();
    await installed.close();
  }
});
