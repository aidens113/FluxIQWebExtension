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

// The key a request is made under is `recorded-element-key.ts`, the one rule a
// withheld value and a chosen file share.
