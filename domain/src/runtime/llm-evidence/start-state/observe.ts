// Core's `startState` for the web domain (t462): where the page stands against
// where a build began. It only reads, through the same passive capture a
// result check takes (`../result-observation/observe.ts`): hidden elements
// included, no restamp, no retained packet, no handle or selector kept.

import type { AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceToolRequest } from "../capture";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { boundedIdentifier } from "../untrusted-json";
import { webStartStateDifferences } from "./differences";
import { webStartStateFromEvidence } from "./page-state";
import { webStartStateOf } from "./read-state";

type StartStateRequest = Pick<WebLlmEvidenceToolRequest, "projectId" | "flowId" | "callId" | "signal"> & { permission: AutomationStudioActionPermissionCheck };

/**
 * The page's state now and, given the `start` an earlier answer returned, what
 * differs from it. A `start` this module did not make answers `undefined`
 * without reading the page.
 */
export async function observeWebStartState(
  capture: (request: StartStateRequest) => Promise<WebLlmSnapshotBinding>,
  input: StartStateRequest & { start?: JsonObject }
): Promise<{ state: JsonObject; differs: string[] } | undefined> {
  input.signal?.throwIfAborted();
  boundedIdentifier(input.projectId, "projectId");
  boundedIdentifier(input.flowId, "flowId");
  boundedIdentifier(input.callId, "callId");
  const start = input.start === undefined ? undefined : webStartStateOf(input.start);
  if (input.start !== undefined && start === undefined) return undefined;
  // The capture is asked what a result check is asked; the start stays here.
  const { start: _start, ...request } = input;
  const captured = await capture(request);
  input.signal?.throwIfAborted();
  const now = webStartStateFromEvidence(captured.evidence);
  return { state: now as unknown as JsonObject, differs: start === undefined ? [] : webStartStateDifferences(start, now) };
}
