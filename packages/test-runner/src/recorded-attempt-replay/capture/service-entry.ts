import { isDeepStrictEqual } from "node:util";
import type { AutomationStudioService } from "fluxiq/automation";
import type { CreatedFlowBuildRequest } from "../../flow-lane/index.js";

type ServiceRequest = Parameters<AutomationStudioService["generateFlowBootstrapAdaptation"]>[0];

/**
 * Where the route's session id stood. A session id validates a live sign-in
 * (`programs/identity-access`), so it never enters evidence a replay is bound
 * to; the fixture host binds its own provider, so no session's key pays.
 */
const NO_SESSION = "recorded-capture-no-session";

/**
 * The build entry a fresh capture binds: the request Core's public route
 * actually handed the service, every field kept as the route wrote it (its
 * caller, its permissions, its ask wait), except the caller's session id. The
 * declared request is what the runner posted; each of its fields must reach the
 * service unchanged, or the capture refuses rather than binding a different task.
 *
 * Until 2026-11-23 the receipt bound the posted request itself, while the host
 * compared it with this service request; the route always adds `caller` (which
 * the service requires), `permittedConsequences` and `permissionAskTimeoutMs`,
 * so no capture through the route could ever match, and none reached a model
 * request (`test-runs/t986-fresh-capture-company-v1`).
 */
export function recordedCaptureServiceEntry<Input extends ServiceRequest>(routed: Input, declared: CreatedFlowBuildRequest): { request: Input; chat: null } {
  for (const [key, value] of Object.entries(declared)) {
    if (!isDeepStrictEqual(Reflect.get(routed, key), value)) throw new Error("recorded_capture_actual_entry_changed");
  }
  const caller: unknown = routed.caller;
  if (!caller || typeof caller !== "object" || Array.isArray(caller) || Object.keys(caller).sort().join() !== "actorSessionId,actorUserId" || typeof routed.caller.actorUserId !== "string") throw new Error("recorded_capture_caller_unreadable");
  return { request: { ...structuredClone(routed), caller: { actorUserId: routed.caller.actorUserId, actorSessionId: NO_SESSION } }, chat: null };
}
