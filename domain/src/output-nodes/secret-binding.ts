// What a node asks for when the value it needs was withheld from the
// recording, and how a supplier finds that request.
//
// The recorder withholds a sensitive control's value at the source
// (`readElementValue` in the extension's `content/describe-element.ts`, by the
// one rule in `domain/src/sensitivity`), so the recording of a typed password
// holds no password. Until this module existed, `payloads.ts` filled the
// resulting node's `text` with `""`: the node validated, survived, replayed,
// typed nothing, and reported success. A Flow that types an empty password and
// passes is worse than one that fails, because nothing in the run says the
// value was never there.
//
// A node therefore carries a *request* for the value rather than the value. The
// request is Core's own parameter state binding -- `{ $state: { path } }`,
// `nodes/parameter-bindings.ts` -- not a second mechanism invented here:
//
//   * Core resolves a binding against the run's inputs before the node executes
//     (`runtime/executor/node-execution.ts`), so a value supplied at run time
//     reaches the dispatched action and nothing else.
//   * A binding with no `fallback` that resolves to nothing is collected into
//     `missingPaths`, and Core fails that node with "State-bound parameter path
//     could not be resolved: <path>". **Every binding this module builds omits
//     `fallback` deliberately.** A fallback is what would turn an unsupplied
//     secret back into an empty string typed into a password field.
//   * Every web output node parameter declares `allowStateBinding: true`
//     (`definitions.ts`), so a binding at `text` is what the node definition
//     already sanctions.
//
// The path names the control, never the secret's content, and no value passes
// through this file. A binding is safe to write into a recording, a proposal, a
// stored Flow, a log, and an evidence packet, which is the point: the value
// enters at run time, in Core's memory, on the dispatch path only.

import type { JsonObject } from "fluxiq/core";
import { objectValue, stringValue } from "./targets";

/**
 * The state namespace a withheld value is requested from.
 *
 * Deliberately not `web.elements.`, which is the live recording state's own
 * namespace: a binding spelled `web.elements.<id>` would resolve against the
 * element's state snapshot -- Core's `readStateSnapshotPath` walks exactly that
 * -- and hand the action an element object where a string belongs, silently and
 * with no missing path to report. A separate segment cannot collide with it.
 */
export const WEB_AUTOMATION_SECRET_STATE_PREFIX = "web.secret.";

/** The run-input path a control's withheld value is supplied under. */
export function webAutomationSecretStatePath(key: string): string {
  return `${WEB_AUTOMATION_SECRET_STATE_PREFIX}${key}`;
}

/**
 * The request itself. No `fallback`: see the module note -- the absence of one
 * is what makes an unsupplied secret fail the node instead of typing nothing.
 */
export function webAutomationSecretBinding(key: string): JsonObject {
  return { $state: { path: webAutomationSecretStatePath(key) } };
}

/**
 * The path a value asks for, when the value is a secret request rather than a
 * literal. Anything else -- a string, a number, a state binding on some other
 * namespace -- is not one, so a caller scanning parameters cannot mistake an
 * ordinary binding for a secret.
 */
export function webAutomationSecretBindingPath(value: unknown): string | undefined {
  const path = stringValue(objectValue(objectValue(value)?.$state)?.path);
  return path?.startsWith(WEB_AUTOMATION_SECRET_STATE_PREFIX) ? path : undefined;
}

/**
 * The parameters of a dispatch that still carry an unmet secret request, by
 * parameter name and path.
 *
 * A resolved binding is gone by the time a node executes -- Core replaces the
 * whole value with the run input -- so anything this finds is a request nobody
 * answered. It returns names and paths, never values, so a caller may put the
 * whole result into a refusal message.
 */
export function webAutomationUnresolvedSecretParameters(parameters: JsonObject): { parameter: string; path: string }[] {
  return Object.entries(parameters).flatMap(([parameter, value]) => {
    const path = webAutomationSecretBindingPath(value);
    return path === undefined ? [] : [{ parameter, path }];
  });
}

/**
 * The key a recorded control's withheld value is requested under, from the
 * identity the node already carries. Nothing is invented: each source below is
 * already in the node's parameters, so a supplier reading the approved Flow can
 * see what the node is asking for without re-deriving anything.
 *
 * In order:
 *
 * 1. **The recorded visual target's state path.** `web-state/action-target.ts`
 *    builds it as `web.elements.<stateId>`, where `<stateId>` was assigned
 *    across the whole snapshot and carries the positional suffix that separates
 *    repeated controls (`element/identity.ts`, `elementStateIdAssigner`). It is
 *    the only identity here that is already unique among the page's controls,
 *    so it is preferred.
 * 2. **The author-written identifier** -- test id, `id`, `name` -- in the order
 *    `stableElementId` prefers them. Two password fields on one page with the
 *    same authored id would collide; they would also be indistinguishable to
 *    every other part of the system, and a collision here means one request,
 *    which is a wrong value rather than a silent empty one.
 * 3. **The selector**, which the node must have to be executable at all.
 *
 * Undefined only when the payload carries no identity whatever -- in which case
 * the node has no selector either and never becomes an executable action.
 */
export function webAutomationSecretKeyForRecordedElement(payload: JsonObject): string | undefined {
  const element = objectValue(payload.element);
  const attributes = objectValue(element?.attributes);
  const statePath = stringValue(objectValue(payload.visualTarget)?.statePath);
  const fromStatePath = statePath?.startsWith("web.elements.") ? statePath.slice("web.elements.".length) : undefined;
  const identity = fromStatePath
    ?? stringValue(element?.testId)
    ?? stringValue(attributes?.["data-testid"])
    ?? stringValue(attributes?.["data-test"])
    ?? stringValue(attributes?.["data-cy"])
    ?? stringValue(element?.id)
    ?? stringValue(attributes?.id)
    ?? stringValue(element?.name)
    ?? stringValue(attributes?.name)
    ?? stringValue(element?.selector)
    ?? stringValue(payload.selector);
  const key = sanitizeSecretKey(identity ?? "");
  return key.length ? key : undefined;
}

/**
 * A key that survives being written into a path and read back out. Dots are
 * folded away because Core splits an unmatched path on them
 * (`readAutomationStatePath`), so a dot in the key would make the path mean two
 * different lookups depending on whether the supplier keyed the input flat.
 */
function sanitizeSecretKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 120);
}
