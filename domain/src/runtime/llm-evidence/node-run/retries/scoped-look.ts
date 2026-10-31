import type { JsonObject } from "fluxiq/core";
import { webAutomationUrlPath } from "../../../../output-nodes";
import type { WebTargetScope } from "../../../target-reacquire/identity";
import { present } from "../../present";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebNodeRun } from "../context";
import { webNodeLookedUpReacquire } from "./looked-up-reacquire";

/** Prepare identity recovery from the actual prior target scope, using the caller's ordinary page reader. */
export async function webNodeScopedReacquire(
  run: Pick<WebNodeRun, "request" | "looked" | "sessionId">,
  input: Parameters<typeof webNodeLookedUpReacquire>[1]
): Promise<ReturnType<typeof webNodeLookedUpReacquire>> {
  const reacquire = webNodeLookedUpReacquire(run, input);
  if (reacquire === undefined) return undefined;
  const prior = await identityBeforePage(run, input.parameters, input.before, input.look);
  return webNodeLookedUpReacquire(run, { ...input, before: prior.kind === "captured" ? prior.page : undefined });
}

/** An acting child has its own actual prior document, independent of the ordinary merged top look. */
async function identityBeforePage(
  run: Pick<WebNodeRun, "request" | "looked" | "sessionId">,
  parameters: JsonObject,
  current: WebLlmSnapshotBinding | undefined,
  look: Parameters<typeof webNodeLookedUpReacquire>[1]["look"]
): Promise<{ kind: "captured"; page: WebLlmSnapshotBinding } | { kind: "absent" | "rejected" | "unreadable" }> {
  const prior = current?.captureProvenance?.scope;
  const tab = parameters.browserTabId ?? parameters.tabId;
  const frame = parameters.browserFrameId ?? parameters.frameId;
  const rawPath = parameters.browserFrameUrlPath;
  const path = webAutomationUrlPath(rawPath);
  if ((tab !== undefined && (typeof tab !== "number" || !Number.isSafeInteger(tab) || tab < 0)) || (frame !== undefined && (typeof frame !== "number" || !Number.isSafeInteger(frame) || frame < 0)) || (rawPath !== undefined && path === undefined)) return { kind: "rejected" };
  if (current === undefined || prior?.browserTabId === undefined || prior.sessionId !== run.sessionId) return { kind: "absent" };
  if ((frame === undefined || frame === 0) && path === undefined && (tab === undefined || tab === prior.browserTabId)) return { kind: "captured", page: current };
  const scope = present<WebTargetScope>({
    kind: "single-frame",
    sessionId: run.sessionId,
    browserTabId: tab ?? prior.browserTabId,
    browserFrameId: frame === undefined && path === undefined ? 0 : frame,
    browserFrameUrlPath: path,
    resetResource: undefined,
    location: undefined,
    timeOrigin: undefined
  });
  try {
    const page = await look({ includeHidden: true, scope });
    if (page === undefined) return { kind: "unreadable" };
    run.looked(page);
    return { kind: "captured", page };
  } catch (error) {
    if (run.request.signal?.aborted) throw error;
    return { kind: "unreadable" };
  }
}
