// The web host's `returnToSourcePlace` (t786, D3): before Core re-runs a stale
// target's source step, the page must stand where that step ran.
//
// `same_place` unless the source's attempt in this run recorded a location
// (`./source-places.ts`) that differs from the page's current one; then the
// host goes back there with the domain's own navigate output -- a move, never
// a lasting act -- and answers `returned`, or `unavailable` when the move
// failed or the current page could not be read (a page that cannot be read
// cannot be re-read either). Locations compare as whole addresses.

import type { AutomationStudioSourcePlaceAnswer, AutomationStudioSourcePlaceRequest } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import type { WebSourcePlaces } from "./source-places";

const SNAPSHOT_OUTPUT_ID = "web.dom.capture_snapshot";
/** The move a replay's reset makes too (`llm-evidence/node-run/replay.ts`). */
const NAVIGATE_OUTPUT_ID = "web.browser.navigate";
const SOURCE = "web-automation-host-runtime";
const SNAPSHOT_TIMEOUT_MS = 5_000;
const NAVIGATE_TIMEOUT_MS = 15_000;

/** How the host reaches the paired browser: an output dispatched by id. */
export type WebSourcePlaceDispatch = (request: { outputId: string; payload: JsonObject; metadata: JsonObject; timeoutMs?: number }) => Promise<{ ok: boolean; payload?: JsonObject | undefined }>;

/** Whether the page is where the source ran, going back there when it moved (header). */
export async function webAutomationReturnToSourcePlace(request: Pick<AutomationStudioSourcePlaceRequest, "node" | "source" | "sourceAttempt">, places: WebSourcePlaces, dispatch: WebSourcePlaceDispatch): Promise<AutomationStudioSourcePlaceAnswer> {
  const recorded = request.sourceAttempt === undefined ? undefined : places.of(request.sourceAttempt.attemptId);
  if (recorded === undefined) return "same_place";
  const metadata = { source: SOURCE, domainId: WEB_AUTOMATION_DOMAIN_ID, nodeId: request.node.id, sourceNodeId: request.source.id };
  const looked = await dispatch({ outputId: SNAPSHOT_OUTPUT_ID, payload: {}, timeoutMs: SNAPSHOT_TIMEOUT_MS, metadata: { ...metadata, point: "reacquire" } });
  const current = looked.ok ? snapshotLocation(looked.payload) : undefined;
  if (current === undefined) return "unavailable";
  if (current === whole(recorded)) return "same_place";
  const moved = await dispatch({ outputId: NAVIGATE_OUTPUT_ID, payload: { url: recorded }, timeoutMs: NAVIGATE_TIMEOUT_MS, metadata });
  return moved.ok ? "returned" : "unavailable";
}

/** The captured page's address, whole, from a dispatched snapshot's wrapped result. */
function snapshotLocation(payload: JsonObject | undefined): string | undefined {
  const result = payload?.result;
  const snapshot = typeof result === "object" && result !== null && !Array.isArray(result) ? result.snapshot : undefined;
  const url = typeof snapshot === "object" && snapshot !== null && !Array.isArray(snapshot) ? snapshot.url : undefined;
  return typeof url === "string" ? whole(url) : undefined;
}

/** An address as one whole form, or nothing for one that does not parse. */
function whole(location: string): string | undefined {
  return URL.canParse(location) ? new URL(location).href : undefined;
}
