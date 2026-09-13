import { identifierPolicies, type IdentifierPolicy } from "../../identifier-policy/index.js";
import { routePathFor } from "./format.js";
import { findRecord, FULL_BOOK_SIZE, SHORT_BOOK_SIZE } from "./records.js";
import {
  adminVariants, editableFields, settingsTabs,
  type AdminConsoleState, type AdminVariant, type ConsoleRoute, type EditableField, type SavedEdit, type SettingsTab,
} from "./types.js";

const HISTORY_LIMIT = 50;
const MAX_VALUE_LENGTH = 60;
/** Customers each variant's book holds. Only `short-book` shortens it. */
const bookSizes: Record<AdminVariant, number> = {
  baseline: FULL_BOOK_SIZE,
  "read-only": FULL_BOOK_SIZE,
  "short-book": SHORT_BOOK_SIZE,
  "light-dom-toggle": FULL_BOOK_SIZE,
};

/** The console as a run first meets it: the full book, nothing selected, nothing edited. */
export function createAdminConsoleState(): AdminConsoleState {
  return withOracle({
    variant: "baseline",
    identifiers: "as-authored",
    recordCount: FULL_BOOK_SIZE,
    savedEdits: {},
    openedRecordIds: [],
    route: { view: "records", recordId: null, tab: "profile" },
    preferences: { weeklyDigest: false, securityAlerts: true },
    lastOperation: "seeded",
  });
}

/**
 * What the page tells the server about itself.
 *
 * `open-record` and `navigate-route` record a route the client reached without
 * a request, which is the only way the server learns about a `pushState`;
 * `deep-link` records the one route a request did produce. `save-record`
 * commits a detail-pane edit -- drafts the page never saved deliberately do not
 * reach here, so the oracle says what was saved and not what was typed.
 * `set-variant` arms a corpus variant and resets the console to its start
 * state, which is where an armed run begins. Anything else, or an invalid
 * payload, leaves the state unchanged.
 */
export function mutateAdminConsoleState(state: AdminConsoleState, operation: string, payload: unknown): AdminConsoleState {
  if (!isRecord(payload)) return state;
  if (operation === "set-variant") return armVariant(state, payload.variant);
  if (operation === "set-identifiers") return armIdentifiers(state, payload.policy);
  if (operation === "open-record") return openRecord(state, payload.recordId);
  if (operation === "save-record") return saveRecord(state, payload.recordId, payload.fields);
  if (operation === "set-preference") return setPreference(state, payload.preference, payload.value);
  if (operation === "navigate-route" || operation === "deep-link") return changeRoute(state, operation, payload);
  return state;
}

function armVariant(state: AdminConsoleState, variant: unknown): AdminConsoleState {
  if (!isVariant(variant)) return state;
  return withOracle({
    ...state,
    variant,
    recordCount: bookSizes[variant],
    savedEdits: {},
    openedRecordIds: [],
    route: { view: "records", recordId: null, tab: "profile" },
    preferences: { weeklyDigest: false, securityAlerts: true },
    lastOperation: "variant-set",
  });
}

/**
 * Arms an identifier policy and resets the console, for the same reason
 * `set-variant` does: the policy changes what every control on the page
 * carries, so a run that met one rendering and then the other would have
 * recorded a page that never existed. The variant is left alone -- the two
 * axes compose.
 */
function armIdentifiers(state: AdminConsoleState, policy: unknown): AdminConsoleState {
  if (typeof policy !== "string" || !(identifierPolicies as readonly string[]).includes(policy)) return state;
  return withOracle({
    ...state,
    identifiers: policy as IdentifierPolicy,
    savedEdits: {},
    openedRecordIds: [],
    route: { view: "records", recordId: null, tab: "profile" },
    preferences: { weeklyDigest: false, securityAlerts: true },
    lastOperation: "variant-set",
  });
}

function openRecord(state: AdminConsoleState, recordId: unknown): AdminConsoleState {
  if (typeof recordId !== "string" || !findRecord(state.recordCount, recordId)) return state;
  return withOracle({
    ...state,
    openedRecordIds: [...state.openedRecordIds, recordId].slice(-HISTORY_LIMIT),
    route: { view: "records", recordId, tab: state.route.tab },
    lastOperation: "record-opened",
  });
}

function saveRecord(state: AdminConsoleState, recordId: unknown, fields: unknown): AdminConsoleState {
  if (typeof recordId !== "string" || !findRecord(state.recordCount, recordId)) return state;
  const edits = normalizeEdits(fields);
  if (edits.length === 0) return state;
  const merged = new Map((state.savedEdits[recordId] ?? []).map((edit) => [edit.field, edit] as const));
  for (const edit of edits) merged.set(edit.field, edit);
  return withOracle({
    ...state,
    savedEdits: { ...state.savedEdits, [recordId]: [...merged.values()] },
    lastOperation: "record-saved",
  });
}

function setPreference(state: AdminConsoleState, preference: unknown, value: unknown): AdminConsoleState {
  if (typeof value !== "boolean") return state;
  if (preference !== "weeklyDigest" && preference !== "securityAlerts") return state;
  return withOracle({ ...state, preferences: { ...state.preferences, [preference]: value }, lastOperation: "preference-set" });
}

function changeRoute(state: AdminConsoleState, operation: "navigate-route" | "deep-link", payload: Record<string, unknown>): AdminConsoleState {
  const view = payload.view === "settings" ? "settings" : "records";
  const tab = isTab(payload.tab) ? payload.tab : state.route.tab;
  const recordId = typeof payload.recordId === "string" && findRecord(state.recordCount, payload.recordId) ? payload.recordId : null;
  const route: ConsoleRoute = view === "settings" ? { view, recordId: null, tab } : { view, recordId, tab };
  const opened = operation === "deep-link" && recordId ? [...state.openedRecordIds, recordId].slice(-HISTORY_LIMIT) : state.openedRecordIds;
  return withOracle({ ...state, route, openedRecordIds: opened, lastOperation: "route-changed" });
}

/** Coerces untrusted edits: known fields only, bounded text, one entry per field, last write winning. */
function normalizeEdits(fields: unknown): SavedEdit[] {
  if (!Array.isArray(fields)) return [];
  const byField = new Map<EditableField, SavedEdit>();
  for (const entry of fields.slice(0, editableFields.length)) {
    if (!isRecord(entry) || !isEditableField(entry.field) || typeof entry.value !== "string") continue;
    const value = entry.value.replace(/\s+/g, " ").trim().slice(0, MAX_VALUE_LENGTH);
    if (value) byField.set(entry.field, { field: entry.field, value });
  }
  return [...byField.values()];
}

function withOracle(state: Omit<AdminConsoleState, "oracle">): AdminConsoleState {
  const savedCount = Object.values(state.savedEdits).reduce((total, edits) => total + edits.length, 0);
  return {
    ...state,
    oracle: {
      recordCount: state.recordCount,
      savedCount,
      weeklyDigest: state.preferences.weeklyDigest,
      routePath: routePathFor(state.route),
    },
  };
}

function isVariant(value: unknown): value is AdminVariant {
  return typeof value === "string" && (adminVariants as readonly string[]).includes(value);
}

function isTab(value: unknown): value is SettingsTab {
  return typeof value === "string" && (settingsTabs as readonly string[]).includes(value);
}

function isEditableField(value: unknown): value is EditableField {
  return typeof value === "string" && (editableFields as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
