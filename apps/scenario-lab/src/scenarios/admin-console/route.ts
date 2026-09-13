import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { renderConsoleDocument } from "./markup.js";
import { findRecord } from "./records.js";
import { settingsTabs, type AdminConsoleState, type SettingsTab } from "./types.js";

const RECORD_SUBPATH = /^records\/(CUS-\d{4})$/;

/**
 * The history fallback every single-page app needs: a record deep link and the
 * settings screen are served the same shell the start page is, and the client
 * routes from `location`.
 *
 * That is what makes the two routes comparable. Reaching `records/CUS-0128` by
 * clicking a row is a `pushState` -- no request, no document swap; reaching it
 * by asking for the URL is a full load that throws away the list's scroll
 * position, its mounted rows and any unsaved draft. The page looks the same
 * either way, which is exactly why the difference is worth a fixture.
 *
 * A record the armed variant's book does not hold is a 404, so `short-book`
 * cannot be deep-linked into a customer it does not have.
 */
export function routeAdminConsole(
  state: AdminConsoleState,
  request: ScenarioRouteRequest,
  context: RenderContext,
): ScenarioRouteResponse | undefined {
  if (request.subpath === "settings") {
    const asked = request.query.get("tab");
    const tab: SettingsTab = isTab(asked) ? asked : "profile";
    return {
      status: 200,
      body: renderConsoleDocument(state, context.runToken),
      mutation: { operation: "deep-link", payload: { view: "settings", tab } },
    };
  }
  const recordId = RECORD_SUBPATH.exec(request.subpath)?.[1];
  if (!recordId || !findRecord(state.recordCount, recordId)) return undefined;
  return {
    status: 200,
    body: renderConsoleDocument(state, context.runToken),
    mutation: { operation: "deep-link", payload: { view: "records", recordId } },
  };
}

function isTab(value: string | null): value is SettingsTab {
  return value !== null && (settingsTabs as readonly string[]).includes(value);
}
