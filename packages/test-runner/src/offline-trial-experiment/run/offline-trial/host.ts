// A FluxIQ host over a copied workspace, built the way the FluxIQ web process
// builds one for a Lab run (`!FluxIQ/apps/web/src/lib/fluxiq.ts`,
// `createFluxIQWebInstance`): `FluxIQ.create` on the workspace root with the
// web domain active, then the web domain's host entry (`registerFluxIQHost`,
// exported by the domain). Its traces are read through Core's exported trace
// store for the host's own service (`automationStudioGatewayTraceServiceStore`),
// over the same pool and content protection the host's episodes write through.
// Client gateway tracing is on, as for every Core the Lab starts
// (`FLUXIQ_CLIENT_GATEWAY_TRACE`), so the offline trial's own episode is
// captured into the copy.
//
// Provider-free and offline by construction: model providers are off (no key
// resolver, no chat model), no env file is loaded, no client gateway socket is
// opened (the WebSocket server is a separate package the web process starts),
// and no candidate start hook is configured. Point it only at a fresh copy
// under `test-runs/`: opening a store applies Core's migrations and the trial
// writes its session, rows and trace into it.

import { registerFluxIQHost, WEB_AUTOMATION_DOMAIN_ID } from "@fluxiq-web-extension/domain/node";
import { FluxIQ } from "fluxiq";
import { automationStudioGatewayTraceServiceStore, type AutomationStudioService } from "fluxiq/automation-studio";
import type { ClientGatewayService, ClientGatewayTraceStore } from "fluxiq/client-gateway";

const TRACE_ENV = "FLUXIQ_CLIENT_GATEWAY_TRACE";
/** Variables that would make the host reach outside the copy or past the experiment's limits; the host is built without them. */
const WITHHELD_ENV = ["FLUXIQ_CANDIDATE_START_URL", "FLUXIQ_CANDIDATE_START_TOKEN", "FLUXIQ_DIR", "FLUXIQ_DATA_DIR", "FLUXIQ_DATABASES_DIR", "FLUXIQ_RECORDINGS_DIR"] as const;

export type OfflineTrialHost = Readonly<{
  fluxiq: FluxIQ;
  service: AutomationStudioService;
  gateway: ClientGatewayService;
  /** The trace store the host's episodes write `projectId`'s traces through. */
  traceStore(projectId: string): ClientGatewayTraceStore;
  close(): Promise<void>;
}>;

export function openOfflineTrialHost(input: { rootDir: string }): OfflineTrialHost {
  const saved = new Map<string, string | undefined>([TRACE_ENV, ...WITHHELD_ENV].map((name) => [name, process.env[name]]));
  let fluxiq: FluxIQ;
  try {
    for (const name of WITHHELD_ENV) delete process.env[name];
    process.env[TRACE_ENV] = "1";
    fluxiq = FluxIQ.create({ rootDir: input.rootDir, domainId: WEB_AUTOMATION_DOMAIN_ID, modelProvidersEnabled: false, loadEnv: false });
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
  registerFluxIQHost(fluxiq);
  const service = fluxiq.programs.automationStudio;
  return Object.freeze({
    fluxiq,
    service,
    gateway: fluxiq.programs.clientGateway,
    traceStore: (projectId: string) => {
      const store = automationStudioGatewayTraceServiceStore(service, projectId);
      if (store === undefined) throw new Error("The host's Automation Studio service opened no project storage, so it holds no trace");
      return store;
    },
    close: () => fluxiq.close(),
  });
}
