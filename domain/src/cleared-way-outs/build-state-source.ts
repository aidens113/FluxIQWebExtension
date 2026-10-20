// Where this domain's halves reach Core's durable domain build state on one
// FluxIQ instance (t728, audit finding 8).
//
// Both halves that keep state across a restart meet here: the cleared way-out
// registry (`./registry.ts`) and the evidence runtime's per-build memories
// (`../runtime/llm-evidence/node-run/build-state/`). Each asks for the store
// when it first needs it rather than when it is made, because a host builds
// both before or while it registers the domain, and Core refuses the store to
// a domain not yet registered. A refusal is asked again next time; an owner
// that is not a FluxIQ carrying the store -- a test double -- has none, and
// every memory then lives in this process alone, as before t728.

import { automationStudioDomainBuildState, AutomationStudioDomainBuildStateRefusal, type AutomationStudioDomainBuildState } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";

/** What the store is read off: a FluxIQ instance, by shape, so a double without it is simply not one. */
type BuildStateOwner = {
  domains?: { maybeGet?: unknown };
  programs?: { automationStudio?: { domainBuildState?: unknown } };
};

/** This domain's durable build state on `owner`, asked when first needed and then kept. */
export function webAutomationBuildStateSource(owner: object): () => AutomationStudioDomainBuildState | undefined {
  let store: AutomationStudioDomainBuildState | undefined;
  return () => {
    if (store !== undefined) return store;
    const candidate = owner as BuildStateOwner;
    if (typeof candidate.domains?.maybeGet !== "function" || candidate.programs?.automationStudio?.domainBuildState === undefined) return undefined;
    try {
      store = automationStudioDomainBuildState(owner as Parameters<typeof automationStudioDomainBuildState>[0], WEB_AUTOMATION_DOMAIN_ID);
    } catch (error) {
      // The domain is not registered yet: no store this time, and asked again on the next need.
      if (error instanceof AutomationStudioDomainBuildStateRefusal) return undefined;
      throw error;
    }
    return store;
  };
}
