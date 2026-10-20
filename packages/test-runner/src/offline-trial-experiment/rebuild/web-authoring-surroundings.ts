// What a web build's submissions are checked against, other than its handles:
// the node library (the web domain's output nodes beside Core's built-ins,
// as the recovery matrix and the web panel host bind it), its resolution under
// the web domain's scope, and the nodes the web domain declares it runs -- the
// arrival node assembly opens the Flow with among them. The domain's evidence
// runtime is created only to read that declaration: its gateway has no session
// and refuses every command, so nothing here can reach a browser.

import { createWebAutomationLlmEvidenceRuntime, WEB_AUTOMATION_DOMAIN_ID } from "@fluxiq-web-extension/domain/node";
import type { AutomationStudioNodeRegistry, AutomationStudioNodeRegistryResolution } from "fluxiq/automation-studio";
import { webNodeRuntime } from "../../recovery-matrix/index.js";

export type WebAuthoringSurroundings = Readonly<{
  registry: AutomationStudioNodeRegistry;
  resolution: AutomationStudioNodeRegistryResolution;
  runsNodes: unknown;
}>;

export function webAuthoringSurroundings(): WebAuthoringSurroundings {
  const native = webNodeRuntime();
  const offline = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => [],
    executeAction: async () => { throw new Error("The offline-trial experiment never sends a command to a browser"); },
  });
  return Object.freeze({
    registry: native.sdk.nodes,
    resolution: native.getRegistryResolution({ kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID }),
    runsNodes: offline.runsNodes,
  });
}
