import type { ClonePackage } from "@fluxiq-web-extension/test-contracts";
import { classifyCloneDependencies, type CloneDependencyAssessment } from "../../clone-policy.js";
import type { ExistingNodeDefinition } from "../../existing-fluxiq-control.js";

/**
 * Whether the isolated Core that will host a cloned Flow provides every node
 * definition that Flow depends on, and provides them safely.
 *
 * The source's own compatibility verdict is not enough: it was computed against
 * the *source* Core's definitions, and the isolated destination is a different
 * Core with a different set. A Flow that was safe to clone can still be
 * unrunnable here, and -- worse -- a definition that exists in both but carries
 * an external side effect in the destination would let an isolated replay reach
 * the outside world.
 *
 * So the destination's definitions are sorted into the three sets the clone
 * policy judges by, and the sorting rule is the safety rule. A definition counts
 * as a domain node only when it is an importer for `web-automation` *and* has no
 * external side effect; as a native node only when it is a Core builtin with no
 * external side effect; and anything that declares a side effect or is
 * `code`-sourced is put in the external set, which the policy refuses to run.
 * The test doubles are the replacements the source export already chose, passed
 * through by reference id.
 */
export function cloneDestinationAssessment(clonePackage: ClonePackage, destinationDefinitions: readonly ExistingNodeDefinition[]): CloneDependencyAssessment {
  return classifyCloneDependencies(clonePackage.flowDocument, {
    domainNodeDefinitionIds: destinationDefinitions
      .filter(item => item.sourceKind === "importer" && item.sourceDomainId === "web-automation" && !item.externalSideEffect)
      .map(item => item.id),
    nativeNodeDefinitionIds: destinationDefinitions
      .filter(item => item.sourceKind === "builtin" && !item.externalSideEffect)
      .map(item => item.id),
    externalSideEffectNodeDefinitionIds: destinationDefinitions
      .filter(item => item.externalSideEffect || item.sourceKind === "code")
      .map(item => item.id),
    testDoubles: Object.fromEntries(
      clonePackage.dependencies
        .filter(item => item.decision === "test-double" && item.replacementId)
        .map(item => [item.referenceId, item.replacementId!]),
    ),
  });
}
