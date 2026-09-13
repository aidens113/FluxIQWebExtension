// The request a recorded file choice makes for its files, tested against Core's
// own resolver, the way `secret-binding.test.ts` tests the secret request. The
// files supplied are a fixture, never a user's file.

import assert from "node:assert/strict";
import test from "node:test";
import { resolveAutomationNodeParameterValues } from "fluxiq/automation-studio/nodes";
import { webAutomationOutputPayload } from "../payloads";
import { webAutomationSecretBinding } from "../secret-binding";
import {
  WEB_AUTOMATION_UPLOAD_STATE_PREFIX,
  webAutomationUploadBinding,
  webAutomationUploadBindingPath,
  webAutomationUploadStatePath
} from "../upload-binding";

/** A file input as the recorder describes one after a choice. */
const fileChoice = {
  element: { selector: "#attachment", tagName: "input", inputType: "file", id: "attachment" },
  visualTarget: { namespace: "web", statePath: "web.elements.attachment", selector: "#attachment" }
};

test("the request is a path under its own namespace, with no fallback", () => {
  const request = webAutomationUploadBinding("attachment") as { $state: Record<string, unknown> };
  assert.deepEqual(request, { $state: { path: "web.upload.attachment" } });
  // A fallback is how an unsupplied upload would put nothing on the page and
  // let the step after it report success.
  assert.equal("fallback" in request.$state, false);
  assert.equal(webAutomationUploadStatePath("attachment").startsWith(WEB_AUTOMATION_UPLOAD_STATE_PREFIX), true);
  assert.equal(WEB_AUTOMATION_UPLOAD_STATE_PREFIX, "web.upload.");
});

test("only a request on the upload namespace is an upload request, and a secret request is not one", () => {
  assert.equal(webAutomationUploadBindingPath(webAutomationUploadBinding("attachment")), "web.upload.attachment");
  for (const value of [
    webAutomationSecretBinding("attachment"),
    "web.upload.attachment",
    { $state: {} },
    { $state: { path: "web.elements.attachment" } },
    { files: [{ name: "fixture.txt", mimeType: "text/plain", contentBase64: "aGk=" }] },
    null,
    undefined
  ]) {
    assert.equal(webAutomationUploadBindingPath(value), undefined, JSON.stringify(value) ?? "undefined");
  }
});

test("Core answers the request with the file list the run supplies", () => {
  const parameters = webAutomationOutputPayload("web.dom.upload", fileChoice);
  const files = { files: [{ name: "fixture.txt", mimeType: "text/plain", contentBase64: "aGk=" }] };
  const resolved = resolveAutomationNodeParameterValues(parameters, { [webAutomationUploadStatePath("attachment")]: files });
  assert.deepEqual(resolved.missingPaths, [], "a supplied upload leaves nothing missing");
  assert.deepEqual(resolved.values.upload, files, "the nested file records reach the dispatched parameters whole");
  assert.equal(resolved.values.selector, "#attachment", "the rest of the dispatch is untouched");
});

test("with nothing supplied Core names the path, rather than uploading nothing", () => {
  const resolved = resolveAutomationNodeParameterValues(webAutomationOutputPayload("web.dom.upload", fileChoice), { "web.secret.attachment": "unrelated" });
  assert.deepEqual(resolved.missingPaths, [webAutomationUploadStatePath("attachment")]);
  assert.equal("upload" in resolved.values, false, "an unresolved request never degrades into an empty file list");
});
