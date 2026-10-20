// Core's own domain build state, as this domain reaches it on a host with no
// storage root: the real store and accessor, in memory, with its real bounds.
// One store stands for one host's storage, so a second runtime made over it is
// that host restarted.

import { automationStudioDomainBuildState, AutomationStudioDomainBuildStateStore, type AutomationStudioDomainBuildState } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../../../constants";

/** What a FluxIQ instance with the web domain registered carries for the store, and nothing else. */
export type CoreBuildStateOwner = {
  domains: { maybeGet(domainId: string): unknown };
  programs: { automationStudio: { domainBuildState: AutomationStudioDomainBuildStateStore } };
};

/** The project paths Core's store is built over, which Core does not export by name. */
type ProjectPaths = ReturnType<ConstructorParameters<typeof AutomationStudioDomainBuildStateStore>[0]>;

/** Paths with no storage root: Core's store then keeps its documents in memory and reads nothing else of them (`AS/runtime/domain-build-state/store.ts`). */
function memoryPaths(): ProjectPaths {
  const paths: Pick<ProjectPaths, "root"> = { root: undefined };
  return paths as ProjectPaths;
}

/** A fresh store, as a FluxIQ instance with the web domain registered carries it. Share it between owners to stand for one host's storage. */
export function coreBuildStateOwner(domainBuildState = new AutomationStudioDomainBuildStateStore(memoryPaths)): CoreBuildStateOwner {
  return {
    domains: { maybeGet: (domainId: string) => (domainId === WEB_AUTOMATION_DOMAIN_ID ? {} : undefined) },
    programs: { automationStudio: { domainBuildState } }
  };
}

/** The web domain's view of a store: a fresh one, or `owner`'s. */
export function coreBuildStateStore(owner: CoreBuildStateOwner = coreBuildStateOwner()): AutomationStudioDomainBuildState {
  return automationStudioDomainBuildState(owner, WEB_AUTOMATION_DOMAIN_ID);
}
