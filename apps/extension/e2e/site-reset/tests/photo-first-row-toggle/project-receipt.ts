import type { JsonObject } from "fluxiq/core";
import type { InstalledBuild } from "../../index";

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/** The fixture's ordinary public project build with its final actual trial receipt retained for post-completion assertions. */
export function photoProjectBuild(installed: InstalledBuild, name: string, task: string) {
  const { service } = installed;
  let projectId = "", flowId = "", instructionSourceId = "";
  let generated: Awaited<ReturnType<typeof service.generateFlowBootstrapAdaptation>> | undefined;
  let running: Promise<"proposed" | "failed"> | undefined;
  const run = async () => {
    projectId = (await service.createProject({ name, domainId: "web-automation" })).id;
    flowId = (await service.createFlow({ projectId, flowId: "flow.installed.reset", name: "Transport proof" })).flowId;
    instructionSourceId = (await service.saveFlowGenerationInstruction({ projectId, flowId, instruction: task })).instructionId;
    let failure: JsonObject = {};
    running = service.generateFlowBootstrapAdaptation({ projectId, flowId, evidenceGuided: true, authoringMode: "project",
      caller: { actorUserId: "diagnostic", actorSessionId: "diagnostic" }, startLocation: installed.page.url() }).then(result => {
      generated = result;
      return result.status === "proposed" ? "proposed" as const : "failed" as const;
    }, error => {
      const diagnostic = record(record(error).diagnostic);
      failure = { code: diagnostic.code ?? null, stage: diagnostic.stage ?? null, issueCodes: diagnostic.issueCodes ?? null };
      return "failed" as const;
    });
    return { ending: await running, failure };
  };
  const finalTrial = () => {
    if (generated?.status !== "proposed" || !generated.candidate?.trial.runId) throw new Error("diagnostic.final_whole_trial_receipt_missing");
    return generated.candidate.trial;
  };
  return { run, finalTrial, instructionSourceId: () => instructionSourceId,
    finalSession: () => service.getRuntimeSession(projectId, finalTrial().runId),
    stop: async () => {
      if (!running) return;
      service.buildCancellation.cancel(projectId, flowId);
      await running;
    } };
}
