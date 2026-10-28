import type { JsonObject } from "fluxiq/core";
import type { AutomationStudioLlmProvider, AutomationStudioLlmTaskRequest } from "fluxiq/automation-studio";
import { expect, test } from "../../fixtures/extension-context";
import { bindInstrumentedRuntime, keepDiagnostic, startInstalledBuild } from "../index";

/** The request the playback is judged against: it defines its rows by membership, and names no group. */
const TASK = "List every post on my home feed that was written in one of the groups I belong to, with its author and group.";
/** The request's own words a no quotes. */
const ASKED = "written in one of the groups I belong to";
/** The groups the Flow's read keeps, written out as literal values: today's membership, which the request never names. */
const LISTED = ["Riverside Allotment Society", "Harbourside Runners", "Old Town Bakers' Circle"];
/** A post the feed suggests from a group Maya has not joined (`social-network-feed/content/units.ts`, `g_3a5e17`), in the feed's second batch. */
const SUGGESTED = { author: "Kim Tran", group: "Urban Growers Network" };
/** How Core's re-ask of a no it found no defect of opens (Core `result-verification/agreement/unsupported-no.ts`, `recheckWords`). */
const RECHECK = "but named no defect Core can find in this result";
/** Core's finding for a quote that only restates the tested value (Core `result-verification/located-defects/tested-value-only.ts`, t785). */
const FINDING = `holds "${SUGGESTED.group}" in "group", the value condition 1 (group equals ["${LISTED.join("\", \"")}"]) tested and left out as written; the request does not say "${SUGGESTED.group}"`;
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostUsd: 0 };
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/**
 * Run `run-mvskodlp-9966d618` (t785 F1), reproduced headed and provider-free on the realistic social feed. A Flow
 * whose read keeps the posts whose group is one of three literal values plays back through the real extension; its
 * read leaves the suggested Urban Growers post out by that condition alone. Core's result check of the playback gets a
 * scripted double no of the run's shape: the post is missing, quoting its group, the very value the condition tested
 * and rejected, which the request does not say. Core finds no defect in that (the cell says which group, not that the
 * person belongs to it), so it re-asks each no once with its finding instead of taking the double no as a refutation,
 * and two scripted yeses answer. The scripted judge text is test data, never product guidance.
 */
test("a playback's double no quoting only the value a condition rejected is re-asked, and two yeses answer", async ({ extensionSession }, testInfo) => {
  test.setTimeout(240_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page, service } = installed;
  const feed = new URL("/scenarios/social-network-feed/", installed.origin).href;
  const asked: Array<{ recheck: string; answered: string; shown: string }> = [];
  try {
    await page.goto(feed);
    await page.getByRole("button", { name: "Allow all cookies", exact: true }).click();
    await page.getByRole("dialog", { name: "Turn on notifications?" }).waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await page.getByRole("dialog", { name: "Chat with Elena Sokolova" }).waitFor({ timeout: 8000 });
    await page.getByRole("button", { name: "Close chat", exact: true }).click();
    // The suggested post is in the second batch: scroll until the feed has loaded it, as a person reading would.
    const suggested = page.locator("[role=\"feed\"] > [aria-posinset]").filter({ hasText: SUGGESTED.group });
    await expect.poll(async () => {
      if (await suggested.count() === 0) await page.mouse.wheel(0, 2000);
      return await suggested.count();
    }, { timeout: 20_000, intervals: [500] }).toBeGreaterThan(0);
    await installed.pair();
    // The real web-automation evidence runtime, for its denied keys: without them a summary carries no condition wording or authored step.
    bindInstrumentedRuntime(installed);

    // The judge: a no of the run's shape on every first ask, and a yes accounting for every condition and row shown
    // when Core asks again with its finding.
    const judge: AutomationStudioLlmProvider = {
      metadata: { provider: "scripted", model: "provider-free" },
      estimateCostUsd: () => 0,
      runTask: async (request: AutomationStudioLlmTaskRequest) => {
        const shown = JSON.stringify(request);
        const recheck = String(request.context.resultSummary?.recheck ?? "");
        if (request.taskKind !== "loop_verification") {
          asked.push({ recheck, answered: `unexpected ${request.taskKind}`, shown: "" });
          return { response: { kind: "diagnosis", summary: "Provider-free diagnostic." }, usage };
        }
        if (!recheck.includes(RECHECK)) {
          asked.push({ recheck, answered: "no", shown });
          return { response: { kind: "diagnosis", summary: "Judged.", diagnosis: {
            answersRequest: "no",
            expected: "Every post on the home feed written in a group the person belongs to.",
            observed: `The read keeps only three listed groups and left out ${SUGGESTED.author}'s ${SUGGESTED.group} post.`,
            changed: "Keep the posts of every group the person belongs to instead of a fixed list.",
            defects: [{ kind: "asked_missing", row: `${SUGGESTED.author} — ${SUGGESTED.group}`, column: "group", value: SUGGESTED.group, requestWords: ASKED }]
          } }, usage };
        }
        const conditions = [...new Set([...shown.matchAll(/condition ([0-9]+) \(/gu)].map(match => match[1]!))];
        const rows = [...new Set([...shown.matchAll(/(?<!as in )\[row ([A-Z2-9]{6})\]/gu)].map(match => match[1]!))];
        const words = [
          "The result holds the posts written in the groups the person belongs to.",
          ...conditions.map(number => `The read's condition ${number} leaves out posts from no group or from a group the feed only suggests, which the request's words "${ASKED}" do not ask for.`),
          ...(rows.length ? [`Rows ${rows.join(", ")} are left out: they are not "${ASKED}".`] : [])
        ].join(" ");
        asked.push({ recheck, answered: "yes", shown });
        return { response: { kind: "diagnosis", summary: words, diagnosis: { answersRequest: "yes", observed: words } }, usage };
      }
    };
    service.bindLlmExecutionProvider(() => ({ provider: judge, maxCallsPerRun: 12, maxEstimatedCostUsd: 0.1 }));

    // The Flow, as a build would leave it: one read of the loaded feed keeping three groups by name.
    const project = await service.createProject({ name: "Installed feed tested value", domainId: "web-automation" });
    const created = await service.createFlow({ projectId: project.id, flowId: "flow.feed.tested-value", name: "Group posts" });
    await service.saveFlowGenerationInstruction({ projectId: project.id, flowId: created.flowId, instruction: TASK });
    const subflow = await service.createFlowSubflow({ projectId: project.id, flowId: created.flowId, name: "Primary", role: "primary" });
    const graph = await service.getFlow(project.id, subflow.graphFlowId!);
    const extractList = {
      item: "[role=\"feed\"] > [aria-posinset]",
      fields: {
        author: { kind: "text", selector: "a[href*=\"/people/\"]:not([aria-hidden])", required: false },
        group: { kind: "text", selector: "h3 a[href*=\"/groups/\"]", required: false }
      },
      where: [{ field: "group", equals: LISTED }]
    };
    await service.saveFlow({ projectId: project.id, flow: { ...graph,
      nodes: [{ id: "start", definitionId: "builtin.control.start", parameterValues: {} },
        { id: "read", definitionId: "web.output.dom-extract_list", parameterValues: { extractList } },
        { id: "end", definitionId: "builtin.control.end", parameterValues: { status: "success" } }],
      edges: [{ id: "start.read", sourceNodeId: "start", sourcePortId: "success", targetNodeId: "read", targetPortId: "in" },
        { id: "read.end", sourceNodeId: "read", sourcePortId: "success", targetNodeId: "end", targetPortId: "in" }]
    } });
    await service.setFlowMapFallback({ projectId: project.id, flowId: created.flowId, kind: "subflow", targetSubflowId: subflow.subflowId });

    // The playback, judged as the Lab's is: the caller asked the model in only to verify the result.
    const run = await service.runRuntimeSession({ projectId: project.id, flowId: created.flowId, inputs: {}, authorizedExternalSideEffects: false,
      llmExecution: { actorUserId: "diagnostic", actorSessionId: "diagnostic", intent: "verify_result" } });
    const verification = record(record(run.metadata).resultVerification);
    const firstAsks = asked.filter(entry => entry.answered === "no");
    const reasks = asked.filter(entry => entry.recheck.includes(RECHECK));
    await keepDiagnostic(testInfo, "feed-tested-value-no.json", {
      status: run.status, verification, asked: asked.map(entry => ({ answered: entry.answered, recheck: entry.recheck })),
      firstShown: firstAsks[0]?.shown ?? null, gatewayErrors: installed.gatewayErrors
    });

    // The playback ran its read through the extension and stored the three groups' posts.
    expect(run.status).toBe("succeeded");
    expect(installed.siteCommands()).toContain("web.dom.extract_list");
    // The judges were shown the suggested post as left out by condition 1 alone, with its own group cell.
    expect(firstAsks).toHaveLength(2);
    expect(firstAsks[0]!.shown).toContain(SUGGESTED.group);
    expect(firstAsks[0]!.shown).toContain(`condition 1 (group equals [\\"${LISTED.join("\\\", \\\"")}\\"])`);
    // Core found no defect in either no: each was asked once more, with Core's finding naming condition 1.
    expect(reasks).toHaveLength(2);
    for (const reask of reasks) expect(reask.recheck).toContain(FINDING);
    expect(asked.map(entry => entry.answered)).toEqual(["no", "no", "yes", "yes"]);
    // Two yeses answer: the playback is confirmed, not refuted, and nothing of the nos stands.
    expect(verification).toMatchObject({ performed: true, verdict: "answers" });
    expect(verification.unsupportedNo).toBeUndefined();
  } finally {
    await installed.close();
  }
});
