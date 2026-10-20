// The pieces of Core and the web domain an offline trial is wired from that
// their packages do not export, loaded from the builds the packages resolve
// to, beside their public entries -- the same files the serving host runs,
// never a copy of them (as `../rebuild/core-authoring.ts` does for authoring):
//
// - `automationStudioRunGraphOptions` (`runtime/service/runtime-session/graph-options.ts`):
//   the executor options every trial's run gets (`service.ts`, the trial
//   environment of a candidate or project build);
// - `automationStudioProjectBuildTrialReads` (`runtime/service/project-build/trial-reads.ts`):
//   what a build's trials read from the bound domain beside the run -- the end
//   view, the ways out's handles, the denied evidence keys;
// - `runtimeSessionToFlowRunDetail` (`runtime/service/summaries/conversions.ts`):
//   the run detail a trial reads its action attempts from;
// - `AutomationStudioGatewayTraceServicePools` and
//   `AutomationStudioGatewayTraceProjectStore` (`runtime/gateway-trace/wiring/`):
//   the service's own per-project pool and the trace store the host's episodes
//   write through, so the source trace is read exactly as the host reads it;
// - the web domain's `registerFluxIQHost` (`domain/src/web-panel-host.ts`), the
//   entry the FluxIQ web process loads.
//
// A module loaded by file URL is the very module the public entry imports, so
// the trace installation and channel scope the runner uses are the host's.

import type { FluxIQ } from "fluxiq";
import type { AutomationStudioOfflineCandidateTrialInput, AutomationStudioRuntimeSession } from "fluxiq/automation-studio";
import type { ClientGatewayTraceStore } from "fluxiq/client-gateway";

/** The candidate trial's ports, which the package names only through the offline runner's input. */
type AutomationStudioCandidateTrialPorts = AutomationStudioOfflineCandidateTrialInput["ports"];

/** The run options' input, narrowed to what a trial passes (`graph-options.ts`). */
export type CoreRunGraphOptionsInput = {
  signal: AbortSignal;
  io?: unknown;
  runtimeService?: unknown;
  authorizedDomainIds: readonly string[];
  nativeNodeRuntime?: unknown;
  hostRuntime?: unknown;
  onRecordBatch?: unknown;
  parking?: unknown;
};

export type CoreTrialSeams = Readonly<{
  runGraphOptions(input: CoreRunGraphOptionsInput): ReturnType<AutomationStudioCandidateTrialPorts["graphOptions"]>;
  trialReads(binding: unknown, projectId: string, flowId: string): Pick<AutomationStudioCandidateTrialPorts, "readEndView" | "clearedControlHandles" | "deniedEvidenceKeys">;
  runDetail(session: AutomationStudioRuntimeSession, projectId: string): { actionAttempts?: ReturnType<NonNullable<AutomationStudioCandidateTrialPorts["actionAttempts"]>> };
  /** The trace store the host's episodes use for `projectId`, over `service`'s own pool; undefined for a service without project storage. */
  traceStore(service: object, projectId: string): ClientGatewayTraceStore | undefined;
  registerFluxIQHost(fluxiq: FluxIQ): FluxIQ;
}>;

type ServicePools = { of(owner: object): object | undefined; protectionOf(pool: object): unknown };
type ProjectStoreClass = new (input: { pool: object; projectId: string; protection: unknown }) => ClientGatewayTraceStore;

export async function loadCoreTrialSeams(): Promise<CoreTrialSeams> {
  const core = new URL("./", import.meta.resolve("fluxiq/automation-studio"));
  const domain = new URL("./", import.meta.resolve("@fluxiq-web-extension/domain/node"));
  const graph = await import(new URL("runtime/service/runtime-session/graph-options.js", core).href) as { automationStudioRunGraphOptions?: CoreTrialSeams["runGraphOptions"] };
  const reads = await import(new URL("runtime/service/project-build/trial-reads.js", core).href) as { automationStudioProjectBuildTrialReads?: CoreTrialSeams["trialReads"] };
  const conversions = await import(new URL("runtime/service/summaries/conversions.js", core).href) as { runtimeSessionToFlowRunDetail?: CoreTrialSeams["runDetail"] };
  const pools = await import(new URL("runtime/gateway-trace/wiring/service-pools.js", core).href) as { AutomationStudioGatewayTraceServicePools?: ServicePools };
  const store = await import(new URL("runtime/gateway-trace/wiring/project-store.js", core).href) as { AutomationStudioGatewayTraceProjectStore?: ProjectStoreClass };
  const host = await import(new URL("web-panel-host.js", domain).href) as { registerFluxIQHost?: CoreTrialSeams["registerFluxIQHost"] };
  const found = {
    automationStudioRunGraphOptions: graph.automationStudioRunGraphOptions,
    automationStudioProjectBuildTrialReads: reads.automationStudioProjectBuildTrialReads,
    runtimeSessionToFlowRunDetail: conversions.runtimeSessionToFlowRunDetail,
    AutomationStudioGatewayTraceServicePools: pools.AutomationStudioGatewayTraceServicePools,
    AutomationStudioGatewayTraceProjectStore: store.AutomationStudioGatewayTraceProjectStore,
    registerFluxIQHost: host.registerFluxIQHost,
  };
  for (const [name, value] of Object.entries(found)) {
    if (value === undefined || value === null) throw new Error(`The resolved Core or domain build no longer provides ${name}`);
  }
  const Pools = found.AutomationStudioGatewayTraceServicePools!;
  const Store = found.AutomationStudioGatewayTraceProjectStore!;
  return Object.freeze({
    runGraphOptions: found.automationStudioRunGraphOptions!,
    trialReads: found.automationStudioProjectBuildTrialReads!,
    runDetail: found.runtimeSessionToFlowRunDetail!,
    traceStore: (service, projectId) => {
      const pool = Pools.of(service);
      return pool === undefined ? undefined : new Store({ pool, projectId, protection: Pools.protectionOf(pool) });
    },
    registerFluxIQHost: found.registerFluxIQHost!,
  });
}
