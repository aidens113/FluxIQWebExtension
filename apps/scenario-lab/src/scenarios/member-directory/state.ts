import { identifierPolicies, type IdentifierPolicy } from "../../identifier-policy/index.js";
import { applyChanges, rosterCounts, rosterFor } from "./filters.js";
import { directoryModes, memberRoles, type DirectoryMode, type MemberDirectoryState, type MemberRole } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 50;

/** The workspace as it stands: nobody promoted, nobody removed, the console unarmed. The lab seed reaches none of it. */
export function createDirectoryState(): MemberDirectoryState {
  return withOracle({ mode: "baseline", identifiers: "as-authored", roles: {}, removed: [], activity: [] });
}

/**
 * `update-role` records a role the edit dialog saved; `remove-members` records
 * a bulk removal; `set-mode` arms one of the renderings and, like every armed
 * fixture here, clears what an earlier run did, so an armed run's oracle is its
 * own and never a stale success from the recording. Anything else, or a payload
 * the page could not have sent, leaves the state alone.
 */
export function mutateDirectoryState(state: MemberDirectoryState, operation: string, payload: unknown): MemberDirectoryState {
  if (!isRecord(payload)) return state;
  if (operation === "set-mode") {
    const mode = directoryModes.find((candidate) => candidate === payload.mode);
    return mode === undefined ? state : withOracle({ mode, identifiers: state.identifiers, roles: {}, removed: [], activity: [] });
  }
  if (operation === "set-identifiers") {
    // Arming a policy clears the run's changes for the same reason `set-mode`
    // does, and leaves `mode` alone: the two axes compose.
    const policy = identifierPolicies.find((candidate) => candidate === payload.policy);
    return policy === undefined ? state : withOracle({ mode: state.mode, identifiers: policy, roles: {}, removed: [], activity: [] });
  }
  if (operation === "update-role") {
    const { id, role } = payload;
    if (typeof id !== "string" || !isMemberRole(role) || !inRoster(state, id)) return state;
    return withOracle({
      ...state,
      roles: { ...state.roles, [id]: role },
      activity: append(state.activity, `role ${id} ${role}`),
    });
  }
  if (operation === "remove-members") {
    const ids = readIds(payload.ids).filter((id) => inRoster(state, id) && !state.removed.includes(id));
    if (ids.length === 0) return state;
    return withOracle({
      ...state,
      removed: [...state.removed, ...ids],
      activity: append(state.activity, `removed ${ids.length}`),
    });
  }
  return state;
}

/** The roster a rendering would now show, given the run's own changes. */
function withOracle(state: Omit<MemberDirectoryState, "oracle">): MemberDirectoryState {
  return { ...state, oracle: rosterCounts(applyChanges(rosterFor(state.mode), state.roles, state.removed)) };
}

function inRoster(state: MemberDirectoryState, id: string): boolean {
  return rosterFor(state.mode).some((member) => member.id === id);
}

function readIds(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))] : [];
}

function append(activity: readonly string[], entry: string): string[] {
  return [...activity, entry].slice(-ACTIVITY_LIMIT);
}

function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (memberRoles as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
