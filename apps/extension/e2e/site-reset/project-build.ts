import type { JsonObject } from "fluxiq/core";
import type { InstalledBuild } from "./installed-build";

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/** A project build started through the public project service, as the extension chat starts one. */
export type ProjectBuild = {
  /** The instruction's source id, which the supervisor's plan quotes. */
  instructionSourceId: () => string;
  /** Creates the project, its flow and instruction, then runs the build to its end: `proposed`, or `failed` with Core's diagnostic. */
  run: () => Promise<{ ending: "proposed" | "failed"; failure: JsonObject }>;
  /** Cancels a build still running and waits for it; nothing when none started. */
  stop: () => Promise<void>;
};

export function projectBuild(build: Pick<InstalledBuild, "service">, name: string, task: string, startLocation?: string | (() => string)): ProjectBuild {
  const { service } = build;
  let projectId = "", flowId = "", instructionSourceId = "";
  let running: Promise<unknown> | undefined;
  const run = async () => {
    const project = await service.createProject({ name, domainId: "web-automation" });
    projectId = project.id;
    const flow = await service.createFlow({ projectId, flowId: "flow.installed.reset", name: "Transport proof" });
    flowId = flow.flowId;
    instructionSourceId = (await service.saveFlowGenerationInstruction({ projectId, flowId, instruction: task })).instructionId;
    let failure: JsonObject = {};
    const caller = { actorUserId: "diagnostic", actorSessionId: "diagnostic" };
    const started = service.generateFlowBootstrapAdaptation({ projectId, flowId, evidenceGuided: true, authoringMode: "project", caller, ...(startLocation !== undefined ? { startLocation: typeof startLocation === "function" ? startLocation() : startLocation } : {}) }).then(() => "proposed" as const, error => {
      const diagnostic = record(record(error).diagnostic);
      failure = { code: diagnostic.code ?? null, stage: diagnostic.stage ?? null, issueCodes: diagnostic.issueCodes ?? null };
      return "failed" as const;
    });
    running = started;
    const ending = await started;
    return { ending, failure };
  };
  const stop = async () => {
    if (!running) return;
    service.buildCancellation.cancel(projectId, flowId);
    await running;
  };
  return { instructionSourceId: () => instructionSourceId, run, stop };
}
