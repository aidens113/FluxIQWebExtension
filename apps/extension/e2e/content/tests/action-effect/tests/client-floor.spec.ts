// Real Core/native SDK + Chromium content dispatch. The page's Save heart
// remains the same toggle after saving, so an unsafe retry would unsave it.
// This harness covers the DOM action boundary, not background transport.
import {
  AutomationStudioNativeNodeRuntime,
  runAutomationStudioGraph,
  type AutomationStudioGraphExecutionOptions,
  type AutomationStudioFlowDocument
} from "fluxiq/automation-studio";
import {
  createWebAutomationOutputNodeManifest,
  createWebAutomationOutputNodeImplementationBundle,
  WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  WEB_AUTOMATION_RUNTIME_PERMISSIONS,
  webAutomationOutputNodeId
} from "@fluxiq-web-extension/domain";
import { postingById } from "../../../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { boardClasses } from "../../../../../../scenario-lab/src/scenarios/job-board/board/index.js";
import { jobBoardScenario } from "../../../../../../scenario-lab/src/scenarios/job-board/index.js";
import { expect, test, type ContentHarness } from "../../../index.js";

const JOB = postingById("d1");
const CLASSES = boardClasses(jobBoardScenario.seed);
// The site owns this selector and its filled class; neither changes on save.
const HEART = `[data-jk="${JOB.key}"] .${CLASSES.heart}`;

async function mutate(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/job-board/${operation}`, {
    method: "POST", headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

async function savedJobs(harness: ContentHarness): Promise<string[]> {
  const state: unknown = (await harness.finalState()).state;
  if (!state || typeof state !== "object" || !("saved" in state) || !Array.isArray(state.saved)
    || !state.saved.every((entry): entry is string => typeof entry === "string")) throw new Error("The job-board oracle returned no saved-job list.");
  return state.saved;
}

test("a canonical committing Save is not toggled twice after its real acknowledgement is lost", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("job-board");
  await mutate(harness, "consent", { choice: "accepted" });
  await mutate(harness, "dismiss-wall");
  await mutate(harness, "dismiss-alert-offer");
  await page.goto(new URL(`/scenarios/job-board/viewjob?jk=${JOB.key}`, harness.lab.origin).href);
  const heart = page.locator(HEART);
  await expect(page.getByRole("heading", { name: JOB.title, exact: true })).toBeVisible();
  await expect(heart).toHaveCount(1);
  const before = await savedJobs(harness);
  expect(before).not.toContain(JOB.key);
  await expect(heart).not.toHaveClass(new RegExp(CLASSES.heartOn, "u"));

  // Job-board deliberately refuses its first Save per document. Exercise that
  // real refusal before the graph, and prove it has made no lasting change.
  // This is one separate preflight gesture, not a graph retry/recovery claim.
  await harness.runAction({ commandId: "save.preflight", actionType: "web.dom.click", selector: HEART, timeoutMs: 5_000 });
  await expect(page.getByText("Couldn't save this job. Try again.", { exact: true })).toBeVisible();
  expect(await savedJobs(harness)).toEqual(before);
  await expect(heart).not.toHaveClass(new RegExp(CLASSES.heartOn, "u"));

  const runtime = new AutomationStudioNativeNodeRuntime({
    permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES
  }).register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
  const definitionId = webAutomationOutputNodeId("web.dom.click");
  const graph: AutomationStudioFlowDocument = {
    schemaVersion: "0.1", flowId: "flow.save-ack", ownerKind: "routine", ownerId: "routine.save-ack",
    name: "Save acknowledgement", createdAt: 1, updatedAt: 1,
    nodes: [
      { id: "save", definitionId, parameterValues: { selector: HEART }, metadata: {
        effect: "observe", actionEffect: { effectClass: "observe", permissionConsequences: [] },
        idempotent: true, idempotentWith: [], declaredConsequences: [], actionability: { actionable: true }
      } },
      { id: "alternative", definitionId, parameterValues: { selector: HEART } }
    ],
    edges: [{ id: "unsafe-alternative", sourceNodeId: "save", sourcePortId: "failed", targetNodeId: "alternative", targetPortId: "in" }]
  };
  const options: AutomationStudioGraphExecutionOptions = {
    signal: new AbortController().signal,
    runtimeCapabilities: runtime.getRuntimeCapabilities(),
    nativeNodeExecutor: ({ node, inputs, signal, hostContext }) => runtime.execute(node, inputs, signal, hostContext),
    resolveActionEffect: (node, parameters) => runtime.resolveActionEffect(node, parameters)
  };
  // The actual registered canonical definition resolves the floor. No floor
  // is fabricated in the spec or copied from authored graph metadata.
  expect(options.resolveActionEffect?.(graph.nodes[0]!)).toEqual({ effectClass: "commit", permissionConsequences: [] });
  let graphDispatches = 0;
  const traffic: string[] = [];
  await page.route("**/api/job-board/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").pop();
    if (operation === "save" || operation === "unsave") traffic.push(operation);
    await route.continue();
  });
  options.delay = async () => undefined;
  options.effectDispatcher = async (effect) => {
    expect(effect.type).toBe("policy.output.dispatch");
    const payload = effect.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.outputId !== "web.dom.click") throw new Error("Expected the registered native click output.");
    const parameters = payload.parameters;
    if (!parameters || typeof parameters !== "object" || Array.isArray(parameters) || typeof parameters.selector !== "string") throw new Error("Native click output did not carry its target.");
    graphDispatches += 1;
    const reply = await harness.runAction({ commandId: `save.graph.${graphDispatches}`, actionType: "web.dom.click", selector: parameters.selector, timeoutMs: 5_000 });
    expect(reply.status).toBe("succeeded");
    expect(reply.actionability).toEqual({ actionable: true });
    await expect.poll(async () => (await savedJobs(harness)).includes(JOB.key)).toBe(true);
    await expect(heart).toHaveClass(new RegExp(CLASSES.heartOn, "u"));
    // The gesture really landed; Core receives no producer safety proof and
    // no successful acknowledgement. Repeating this selector would undo it.
    throw new Error("Acknowledgement lost after the browser action.");
  };
  const trace = await runAutomationStudioGraph(graph, options);
  expect(trace.status).toBe("failed");
  expect(trace.failure?.code).toBe("run.outcome_uncertain");
  expect(trace.attempts.map((attempt) => attempt.nodeId)).toEqual(["save"]);
  expect(trace.attempts[0]?.actionability, "a lost acknowledgement cannot borrow an authored target fact").toBeUndefined();
  expect(graphDispatches, "one Core graph dispatch, after one non-mutating preflight gesture").toBe(1);
  expect(traffic).toEqual(["save"]);
  expect(await savedJobs(harness)).toEqual([...before, JOB.key]);
  await expect(heart, "the exact same toggle target still exists").toHaveCount(1);
  await expect(heart).toHaveClass(new RegExp(CLASSES.heartOn, "u"));
  await expect(page.getByText("Job saved", { exact: true })).toBeVisible();
});
