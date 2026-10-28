// Core's `startState` for the web domain (t462): where the page stands against
// where a build began. It only reads, through the same passive capture a
// result check takes (`../result-observation/observe.ts`): hidden elements
// included, no restamp, no retained packet, no handle or selector kept. It
// answers where it read (`location`), so Core can come back to an act's own
// page and look for what the act changed there (t471).

import type { AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceToolRequest } from "../capture";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { webResetCollections, webControlSpotToken, webControlStates, webValueStates } from "../control-spot";
import { present } from "../present";
import { boundedIdentifier } from "../untrusted-json";
import { webStartStateChangedLines } from "./changed-lines";
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
): Promise<WebStartStateAnswer | undefined> {
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
  const now = webStartStateFromEvidence(captured.evidence, captured.records);
  const controls = webControlStates(captured);
  const values = webValueStates(captured);
  // Where it was read, so Core can bring the target back to this page through the arrival's `url` (t471: an act is looked for on its own page).
  // `lines` are the same differences as the lines themselves, so Core can tell which act changed which line without reading words.
  return present<WebStartStateAnswer>({
    state: now as unknown as JsonObject,
    differs: start === undefined ? [] : webStartStateDifferences(start, now),
    location: now.location,
    lines: start === undefined ? { gone: [], added: [] } : webStartStateChangedLines(start, now),
    // The items on the page by the tokens a declaration names a control's record by (Core t475).
    items: now.items === undefined ? undefined : [...now.items],
    subjects: captured.subjects === undefined ? undefined : [...new Set([...captured.subjects.values()].map((value) => webControlSpotToken("subject", value)))],
    resource: captured.resetResource,
    scope: captured.resetResource ? webControlSpotToken("scope", `${captured.resetResource}\0${now.location}`) : undefined,
    collections: webResetCollections(captured).collections,
    // Every visible stateful control by its own place and state (L1): how Core sees a toggle the build pressed come back.
    controls: Object.keys(controls).length ? controls : undefined,
    // Every shown value by its own place (t772): how Core sees a value a press replaced set back.
    values: Object.keys(values).length ? values : undefined
  });
}

/** One answer to Core's `startState`; `items` absent when the read had no records. */
type WebStartStateAnswer = { state: JsonObject; differs: string[]; location: string; lines: { gone: string[]; added: string[] }; items?: string[]; subjects?: string[]; scope?: string; resource?: string; collections?: Array<{ scope: string; group: string; subjects: string[]; states: Record<string, string> }>; controls?: Record<string, Record<string, number>>; values?: Record<string, string> };
