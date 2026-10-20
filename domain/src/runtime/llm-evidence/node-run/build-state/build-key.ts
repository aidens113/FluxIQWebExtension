// Which build a call belongs to, and how it stands to that build, as Core says
// (t728, audit finding 8).
//
// Until t728 this domain worked both out for itself from Core's call ids: a
// call whose id began `initial.` opened a build, `initial.<toolId>.<scope>`
// named a brief run beside others, and every memory was keyed by the session,
// project and Flow. That naming is Core's, and reading it here meant every
// change Core made to it was a silent change to when this domain forgot what a
// build had been shown. Core now frames every call a registry binding runs with
// the build it belongs to (`automationStudioEvidenceBuildScope()`): its
// `buildId`, the `callScope` of a brief run beside others, and, on Core's own
// opening call of a round only, whether that round starts the build `fresh` or
// continues it. A model-written call never carries `opening`. Since t743 the
// frame also says when a call is a move Core makes itself (`move: "core"`: its
// own looks before a trial and on a reset), which a model's call never is.
//
// A call made outside any registry binding -- a test driving the runtime
// directly, or a host that binds none -- has no build: it is keyed by its
// project and Flow alone, never opens anything, and keeps nothing durable.

import { automationStudioEvidenceBuildScope } from "fluxiq/automation-studio";

/** How Core's opening call of a round stands to its build: starting it, or continuing a Flow its draft already holds. */
export type WebNodeOpening = "fresh" | "continuing";

/** The build a call belongs to, as every build memory keys it. */
export type WebNodeBuildKey = {
  readonly projectId: string;
  readonly flowId: string;
  /** Core's build id; undefined for a call made outside every build. */
  readonly buildId: string | undefined;
  /** The brief this call runs under when briefs of one build run side by side. */
  readonly callScope: string | undefined;
};

/**
 * The build the current call belongs to, its opening when it is Core's opening
 * call of a round, and whether it is a move Core makes itself (`coreMove`,
 * t743). A frame for another project or Flow than the request names is not
 * this call's, and is read as no frame.
 */
export function webNodeBuildOf(request: { projectId: string; flowId: string }): { build: WebNodeBuildKey; opening: WebNodeOpening | undefined; coreMove: boolean } {
  const scope = automationStudioEvidenceBuildScope();
  if (scope === undefined || scope.projectId !== request.projectId || scope.flowId !== request.flowId) {
    return { build: { projectId: request.projectId, flowId: request.flowId, buildId: undefined, callScope: undefined }, opening: undefined, coreMove: false };
  }
  return { build: { projectId: request.projectId, flowId: request.flowId, buildId: scope.buildId, callScope: scope.callScope }, opening: scope.opening, coreMove: scope.move === "core" };
}

/** One string per build and brief, for an in-process map. */
export function webNodeBuildSlot(build: WebNodeBuildKey): string {
  return [build.projectId, build.flowId, build.buildId ?? "", build.callScope ?? ""].join("\u0000");
}
