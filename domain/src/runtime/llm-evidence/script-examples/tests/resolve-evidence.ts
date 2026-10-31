import assert from "node:assert/strict";
import { resolveAutomationStudioFlowBootstrapPlanParameters, type AutomationStudioFlowBootstrapPlan } from "fluxiq/automation-studio";
import type { WebAutomationExtractListRequest } from "../../../../actions/extraction";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters } from "../../plan-resolution";
import { createWebLlmExtractionHandles } from "../../structure";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { exampleEvidenceManifests } from "./evidence-manifests";
import { exampleSupport } from "./support";

export async function resolveExampleEvidence(plan: AutomationStudioFlowBootstrapPlan, name: string, omitSources = false) {
  const manifest = exampleEvidenceManifests.manifests[name];
  assert.ok(manifest, `No authored unit evidence manifest for ${name}`);
  const scope = { projectId: "project.examples", flowId: "flow.examples" };
  const targets = createWebLlmTargetPackets();
  const extractions = createWebLlmExtractionHandles();
  if (!omitSources) {
    // Real capture sanitization numbers every element in document order. Gaps
    // are explicit unrelated page text, so tN retains its captured position.
    const last = Math.max(0, ...Object.keys(manifest.targets).map(Number));
    const interactiveElements = Array.from({ length: last }, (_, index) => {
      const target = manifest.targets[index + 1];
      return target ? exampleEvidenceManifests.element(target) : {
        tagName: "span", selector: `#reference-${index + 1}`, visibleText: `Page reference ${index + 1}`
      };
    });
    const capture = sanitizeWebLlmSnapshotWithBindings({ url: manifest.url, title: "Authored example unit page", interactiveElements });
    for (const [number, target] of Object.entries(manifest.targets)) {
      assert.equal(capture.selectors.get(`t${number}`), `#${target.id}`, "capture, not the script, issues the target token");
    }
    targets.remember(scope, capture);
    for (const listing of manifest.listings ?? []) {
      let handle = "";
      for (let number = 1; number <= listing.number; number += 1) handle = extractions.reserve();
      assert.equal(handle, `extraction.${listing.number}`);
      const extractList: WebAutomationExtractListRequest = {
        item: `#${listing.id} .row`,
        fields: Object.fromEntries(listing.fields.map((field) => [field, { kind: "text" as const, selector: `.${field}`, required: false }]))
      };
      if (listing.next) extractList.paginate = { next: listing.next, maxPages: 3 };
      extractions.retain(scope, { handle, location: capture.evidence.location, itemCount: 2, extractList });
    }
  }
  // Core performs fact-target resolution before node resolution, just as on
  // actual candidate submission. The binding delegates every question to the
  // real domain resolver; it never invents resolved parameters.
  return await resolveAutomationStudioFlowBootstrapPlanParameters({
    plan, ...scope, registry: exampleSupport.registry,
    handlesIssued: true, handleReach: "view_history", writtenByModel: true,
    permissionFor: () => async () => ({ permitted: true as const }),
    binding: { resolvePlanNodeParameters: (input) => resolveWebPlanNodeParameters(input, { targets, extractions }) }
  });
}
