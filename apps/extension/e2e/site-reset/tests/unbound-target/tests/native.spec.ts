// Provider-free installed-browser proof of the actual host identity seam.
// Real hidden-target failures exercise automatic negative recovery. The
// positive re-observation is explicitly requested after the site's Undo;
// no failure is manufactured to force a successful fourth-attempt path.
import type { Locator, Page } from "@playwright/test";
import {
  AutomationStudioNativeNodeRuntime,
  AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY,
  type AutomationStudioFlowDocument,
  type AutomationStudioFlowNode
} from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationHostRuntime,
  createWebAutomationOutputNodeManifest,
  createWebAutomationOutputNodeImplementationBundle,
  WEB_AUTOMATION_DOMAIN_ID,
  WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  WEB_AUTOMATION_RUNTIME_PERMISSIONS
} from "@fluxiq-web-extension/domain";
import { dispatchWebAutomationOutput } from "../../../../../../../domain/src/io/gateway-output-dispatcher";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../../../../../domain/src/runtime/llm-evidence";
import { webPacketElementFingerprint } from "../../../../../../../domain/src/runtime/llm-evidence/packet-fingerprint";
import { expect, test } from "../../../../fixtures/extension-context";
import { startInstalledBuild } from "../../../index";

function object(value: unknown): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a fixture result object.");
  return value as JsonObject;
}

async function postPath(article: Locator): Promise<string> {
  const href = await article.locator('a[href*="/posts/"]').first().getAttribute("href");
  if (href === null) throw new Error("The fixture post has no stable post link.");
  return new URL(href, "http://fixture.invalid").pathname;
}

async function likes(page: Page): Promise<Map<string, boolean>> {
  const entries = await page.locator('[role="feed"] > [aria-posinset]').evaluateAll((articles) => articles.flatMap((article) => {
    const link = article.querySelector<HTMLAnchorElement>('a[href*="/posts/"]');
    if (link === null) return [];
    return [[new URL(link.href).pathname, article.querySelector('[role="button"][aria-label="Remove Like"]') !== null] as const];
  }));
  return new Map(entries);
}

test("installed native identity hook refuses another record, then refreshes the restored same post without a provider", async ({ extensionSession }) => {
  test.setTimeout(180_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page, fluxiq, service } = installed;
  const dispatch = (request: Parameters<typeof dispatchWebAutomationOutput>[1]) => dispatchWebAutomationOutput(fluxiq, request);
  const host = createWebAutomationHostRuntime({ dispatch: (request) => dispatch({ domainId: WEB_AUTOMATION_DOMAIN_ID, ...request }) }, () => fluxiq.programs.clientGateway.snapshot().sessions);
  const native = new AutomationStudioNativeNodeRuntime({ permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES })
    .register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle());
  try {
    await page.goto(new URL("/scenarios/social-network-feed/", installed.origin).href);
    await page.getByRole("button", { name: "Allow all cookies", exact: true }).click();
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await page.getByRole("button", { name: "Close chat", exact: true }).click();
    const selected = page.locator('[role="feed"] > [aria-posinset]')
      .filter({ has: page.getByRole("button", { name: "Hide post", exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Like", exact: true }) }).first();
    const articleLabel = await selected.getAttribute("aria-labelledby");
    if (articleLabel === null || articleLabel.trim() === "") throw new Error("The fixture record has no persistent label reference.");
    // Fixture oracle only: Hide removes controls, so re-filtering by those
    // controls would select another record. The product still matches solely
    // from its captured fingerprint; this key is never given to the hook.
    const article = page.locator(`[role="feed"] > [aria-labelledby=${JSON.stringify(articleLabel)}]`);
    await article.scrollIntoViewIfNeeded();
    const targetPath = await postPath(article);
    await installed.pair();
    service.bindHostRuntime(host);
    const captured = await dispatch({ domainId: WEB_AUTOMATION_DOMAIN_ID, outputId: "web.dom.capture_snapshot", payload: {} });
    expect(captured.ok).toBe(true);
    const action = object(captured.payload?.result);
    const snapshot = object(action.snapshot);
    expect(object(object(snapshot.evidence).captureOptions).includeHidden).toBe(false);
    const binding = sanitizeWebLlmSnapshotWithBindings(snapshot);
    const source = typeof action.sourceId === "string" ? /^tab:(\d+):frame:0$/u.exec(action.sourceId) : null;
    if (source === null) throw new Error("The fixture capture did not identify its top-frame browser source.");
    let selector: string | undefined;
    let element: JsonObject | undefined;
    for (const candidate of binding.evidence.elements) {
      if (candidate.role !== "button" || candidate.name !== "Like") continue;
      const address = binding.selectors.get(candidate.target);
      if (address === undefined) continue;
      const matchedPath = await page.locator(address).evaluate((control) => {
        const link = control.closest('[role="article"]')?.querySelector<HTMLAnchorElement>('a[href*="/posts/"]');
        return link === null || link === undefined ? undefined : new URL(link.href).pathname;
      });
      if (matchedPath !== targetPath) continue;
      selector = address;
      element = object(JSON.parse(JSON.stringify(webPacketElementFingerprint(candidate, {
        selector: address,
        shadowHosts: binding.shadowHosts?.get(candidate.target),
        dialog: binding.dialogNames?.get(candidate.target),
        drawing: binding.drawings?.get(candidate.target),
        recordIdentity: binding.recordIdentities?.get(candidate.target)
      }))));
      break;
    }
    if (selector === undefined || element === undefined) throw new Error("The real capture did not identify the chosen post control.");
    const parameters: JsonObject = { selector, element, browserTabId: Number(source[1]), browserFrameId: 0 };
    const node: AutomationStudioFlowNode = {
      id: "like", definitionId: "builtin.policy.action",
      parameterValues: { outputId: "web.dom.click", parameters, timeoutMs: 10_000 },
      metadata: { [AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY]: ["modify_existing"] }
    };
    const declared = native.resolveTargetRefresh(node, node.parameterValues!);
    if (declared.kind !== "declared") throw new Error("The canonical definition did not declare its target fields.");
    const project = await service.createProject({ name: "Native target identity proof", domainId: WEB_AUTOMATION_DOMAIN_ID });
    const created = await service.createFlow({ projectId: project.id, flowId: "flow.identity.fixture", name: "Same post" });
    await service.saveFlowGenerationInstruction({ projectId: project.id, flowId: created.flowId, instruction: "Like the selected post once." });
    const flow = (target: JsonObject): AutomationStudioFlowDocument => ({
      schemaVersion: "0.1", flowId: created.flowId, ownerKind: "routine", ownerId: "routine.identity.fixture", name: "Same post",
      createdAt: 1, updatedAt: 1,
      nodes: [{ ...node, parameterValues: { ...node.parameterValues, parameters: target } }], edges: []
    });
    const run = (target: JsonObject) => service.runRuntimeSession({
      projectId: project.id, flow: flow(target), commandOutcomeMode: "required", adaptiveMode: "no_llm_intervention",
      permittedConsequences: ["modify_existing"], authorizedExternalSideEffects: true
    });
    const before = await likes(page);
    expect(before.get(targetPath)).toBe(false);
    const clickCount = () => installed.siteCommands().filter((type) => type === "web.dom.click").length;
    const initialClicks = clickCount();

    // Actual fixture UI removes the selected post's controls while identical
    // Like controls remain in other records. These are genuine failed browser
    // commands, not substituted responses or an injected retry precondition.
    await article.getByRole("button", { name: "Hide post", exact: true }).click();
    await expect(article.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    const hidden = await run(parameters);
    expect(hidden.status).toBe("failed");
    const attempts = hidden.trace?.attempts.filter((attempt) => attempt.nodeId === node.id) ?? [];
    console.log(JSON.stringify({
      identityBrowserStage: "hidden-execution",
      status: hidden.status,
      commands: installed.siteCommands(),
      received: installed.actionResultSummaries(),
      gatewayErrors: installed.gatewayErrors.length,
      gatewayOutcomes: await installed.gatewayOutcomeSummaries(project.id),
      attempts: attempts.map((attempt) => ({
        status: attempt.status,
        code: attempt.failure?.code,
        category: attempt.failure?.category,
        effect: attempt.failure?.effect,
        retryable: attempt.failure?.retryable,
        stage: attempt.failure?.stage,
        recovery: attempt.reacquire?.outcome
      }))
    }));
    expect(attempts.length).toBe(4);
    expect(attempts[3]?.reacquire?.kind).toBe("identity");
    expect(["unmatched", "unavailable"]).toContain(attempts[3]?.reacquire?.outcome);
    const failed = attempts.at(-1);
    if (failed?.failure === undefined || failed.stateRefs?.beforeAction === undefined) throw new Error("The real failed attempt has no prior failure or before-state reference.");
    expect(failed.failure.stage).toBe("target_resolution");
    expect(failed.failure.effect).toBe("unacted");
    const hiddenLikes = await likes(page);
    expect([...hiddenLikes].every(([path, liked]) => before.get(path) === liked)).toBe(true);

    await article.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(article.getByRole("button", { name: "Like", exact: true })).toBeVisible();
    const clicksAfterFailure = clickCount();
    expect(clicksAfterFailure - initialClicks).toBe(4);
    const refreshed = await host.reacquireUnboundTarget!({
      node, parameters: node.parameterValues!, refresh: declared.refresh,
      previousAttempt: { attemptId: failed.attemptId, beforeAction: failed.stateRefs.beforeAction },
      failure: failed.failure
    });
    expect(object(object(installed.latestRawSnapshot()?.evidence).captureOptions).includeHidden).toBe(true);
    if (refreshed.outcome !== "found") throw new Error(`The restored same-post observation was ${refreshed.outcome}.`);
    expect(refreshed.patches.map((patch) => patch.parameterId).sort()).toEqual(["element", "selector"]);
    const next: JsonObject = { ...parameters };
    for (const patch of refreshed.patches) {
      if (patch.operation !== "set") throw new Error("The web host returned a non-set target patch.");
      next[patch.parameterId] = patch.value;
    }
    expect(clickCount()).toBe(clicksAfterFailure);
    const result = await run(next);
    expect(result.status).toBe("succeeded");
    await expect(article.getByRole("button", { name: "Remove Like", exact: true })).toBeVisible();
    expect(clickCount() - clicksAfterFailure).toBe(1);
    const after = await likes(page);
    expect(after.size).toBe(before.size);
    expect([...after].every(([path, liked]) => liked === (path === targetPath ? true : before.get(path)))).toBe(true);
    expect(installed.gatewayErrors.length).toBe(0);
  } finally {
    await installed.close();
  }
});
