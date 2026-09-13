// The request a node makes for a value the recorder withheld, tested against
// Core's own resolver rather than against a restatement of it.
//
// Two claims matter and neither can be shown by inspecting the request alone:
// that a value supplied to the run reaches the node's parameters, and that no
// value supplied means the node fails and names what was missing. Both are
// decided by `resolveAutomationNodeParameterValues`
// (`fluxiq/automation-studio/nodes`), which is what the tests below call. A
// domain-local copy of that logic would pass while the real path did anything
// at all.
//
// No credential appears here. The values supplied are sentinels, and they are
// two different ones, so a resolver that returned some constant -- or the
// recording's own value -- could not pass.

import assert from "node:assert/strict";
import test from "node:test";
import { resolveAutomationNodeParameterValues } from "fluxiq/automation-studio/nodes";
import type { JsonValue } from "fluxiq/core";
import { webAutomationOutputPayload } from "../payloads";
import {
  WEB_AUTOMATION_SECRET_STATE_PREFIX,
  webAutomationSecretBinding,
  webAutomationSecretBindingPath,
  webAutomationSecretKeyForRecordedElement,
  webAutomationSecretStatePath,
  webAutomationUnresolvedSecretParameters
} from "../secret-binding";

/** A password control as the recorder describes one, with its value withheld: no `inputValue` at all. */
const withheldPasswordEntry = {
  element: {
    selector: "[data-testid=\"password\"]",
    tagName: "input",
    inputType: "password",
    attributes: { "data-testid": "password", type: "password", autocomplete: "current-password" }
  },
  visualTarget: { namespace: "web", statePath: "web.elements.password", selector: "[data-testid=\"password\"]" }
};

function parametersOf(payload: Record<string, unknown>): Record<string, JsonValue> {
  return webAutomationOutputPayload("web.dom.type", payload as never) as Record<string, JsonValue>;
}

// -- What the recorded node asks for ------------------------------------------

test("a recorded entry whose value the recorder withheld asks for it, instead of replaying an empty string", () => {
  const parameters = parametersOf(withheldPasswordEntry);
  assert.notEqual(parameters.text, "", "an empty string is what typed nothing into a password field and reported success");
  assert.equal(
    webAutomationSecretBindingPath(parameters.text),
    webAutomationSecretStatePath("password"),
    "the request names the control, taken from the state path the node already carries"
  );
});

test("the request carries a path and nothing else -- no value, and no fallback to one", () => {
  const request = webAutomationSecretBinding("password") as { $state: Record<string, unknown> };
  assert.deepEqual(Object.keys(request), ["$state"]);
  assert.deepEqual(Object.keys(request.$state), ["path"]);
  // A fallback is exactly how an unsupplied secret would become an empty
  // string again: Core substitutes it instead of reporting the path missing.
  assert.equal("fallback" in request.$state, false);
});

test("a recorded value still replays as itself", () => {
  const parameters = parametersOf({ ...withheldPasswordEntry, inputValue: "typed-by-the-user" });
  assert.equal(parameters.text, "typed-by-the-user");
  assert.equal(webAutomationSecretBindingPath(parameters.text), undefined, "a literal is not a request");
});

test("only a request on the secret namespace is one", () => {
  assert.equal(webAutomationSecretStatePath("password").startsWith(WEB_AUTOMATION_SECRET_STATE_PREFIX), true);
  for (const value of ["password", "", 0, null, undefined, { $state: {} }, { $state: { path: "web.elements.password" } }]) {
    assert.equal(webAutomationSecretBindingPath(value), undefined, JSON.stringify(value) ?? "undefined");
  }
});

test("the key comes from identity the node already carries, richest first", () => {
  const key = (payload: Record<string, unknown>) => webAutomationSecretKeyForRecordedElement(payload as never);
  // The assigned state path wins: it is the only identity already made unique
  // across the page's controls, suffix included.
  assert.equal(key(withheldPasswordEntry), "password");
  assert.equal(key({ ...withheldPasswordEntry, visualTarget: { statePath: "web.elements.password.2" } }), "password-2");
  // Then the author-written identifier, then the selector.
  assert.equal(key({ element: withheldPasswordEntry.element }), "password");
  assert.equal(key({ element: { selector: "form > input:nth-child(2)" } }), "form-input-nth-child-2");
  // Nothing at all is no request; such a payload has no selector either, so it
  // never becomes an executable action.
  assert.equal(key({}), undefined);
});

// -- What Core does with the request ------------------------------------------
//
// A web output node's parameters are its top-level parameter values
// (`definitions.ts`), and every one of them declares `allowStateBinding: true`,
// so `text` is a position Core resolves. These two tests are the whole reason
// the request is shaped as Core's state binding rather than as anything of the
// domain's own.

test("a value supplied to the run reaches the dispatched parameters, and follows the run rather than any constant", () => {
  const parameters = parametersOf(withheldPasswordEntry);
  const path = webAutomationSecretStatePath("password");
  for (const supplied of ["run-one-sentinel", "run-two-sentinel"]) {
    const resolved = resolveAutomationNodeParameterValues(parameters, { [path]: supplied });
    assert.deepEqual(resolved.missingPaths, [], "a supplied secret leaves nothing missing");
    assert.equal(resolved.values.text, supplied);
    assert.equal(resolved.values.selector, parameters.selector, "the rest of the dispatch is untouched");
  }
});

test("with nothing supplied the node fails and names the path, rather than typing nothing", () => {
  const parameters = parametersOf(withheldPasswordEntry);
  const resolved = resolveAutomationNodeParameterValues(parameters, { "some.other.input": "unrelated" });
  // `missingPaths` is what Core turns into a failed attempt reading
  // "State-bound parameter path could not be resolved: <path>"
  // (`runtime/executor/node-execution.ts`). The alternative -- the behaviour
  // this whole change removes -- is a successful attempt that typed "".
  assert.deepEqual(resolved.missingPaths, [webAutomationSecretStatePath("password")]);
  assert.equal("text" in resolved.values, false, "an unresolved request never degrades into a value");
});

test("an unmet request is findable by name and path, with no value to leak", () => {
  const parameters = parametersOf(withheldPasswordEntry);
  assert.deepEqual(webAutomationUnresolvedSecretParameters(parameters), [
    { parameter: "text", path: webAutomationSecretStatePath("password") }
  ]);
  const supplied = resolveAutomationNodeParameterValues(parameters, { [webAutomationSecretStatePath("password")]: "run-one-sentinel" });
  assert.deepEqual(webAutomationUnresolvedSecretParameters(supplied.values), [], "a met request is gone once Core resolves it");
});

test("no part of the request, resolved or not, is a value", () => {
  // The request travels through a recording, a proposal, a stored Flow and an
  // evidence packet. Serializing it must never produce anything but a path.
  const serialized = JSON.stringify(parametersOf(withheldPasswordEntry));
  assert.equal(serialized.includes("run-one-sentinel"), false);
  assert.equal(serialized.includes(webAutomationSecretStatePath("password")), true);
});
