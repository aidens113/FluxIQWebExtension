// A failed request reaches the chat as a failed result: the sentence, detail
// and code as the panel's request gave them, and for a background that did not
// answer, the cause the read notice names.

import assert from "node:assert/strict";
import test from "node:test";
import { EXTENSION_RESTARTED } from "../../../copy";
import { createExtensionChatTransport } from "../create-extension-chat-transport";
import { sendRecorder } from "./send-recorder";

const NO_PUSHES = () => () => undefined;

test("a background that did not answer carries its cause through every port", async () => {
  const recorder = sendRecorder({ ok: false, sentence: EXTENSION_RESTARTED, detail: "no answer" });
  const transport = createExtensionChatTransport(recorder.request, NO_PUSHES);
  const expected = { ok: false, sentence: EXTENSION_RESTARTED, detail: "no answer", cause: "the extension's background didn't answer" };
  assert.deepEqual(await transport.conversation.listThreads({ subjectKind: "project", status: "open", limit: 1 }), expected);
  assert.deepEqual(await transport.activity.read(), expected);
  assert.deepEqual(await transport.runs.stop({ projectId: "p1", runId: "r1" }), expected);
  assert.deepEqual(await transport.recordings?.list({ page: 1, pageSize: 5 }), expected);
  assert.deepEqual(await transport.models?.readKeys(), expected);
});

test("any other failure keeps its sentence, detail, code and unsupported flag, with no cause", async () => {
  const refused = sendRecorder({ ok: false, sentence: "FluxIQ refused this browser.", detail: "403", code: "refused" });
  const transport = createExtensionChatTransport(refused.request, NO_PUSHES);
  assert.deepEqual(await transport.conversation.send({ text: "hi", conversationId: undefined, projectId: undefined }), { ok: false, sentence: "FluxIQ refused this browser.", detail: "403", code: "refused" });
  const unsupported = sendRecorder({ ok: false, sentence: "This extension doesn't support that yet.", unsupported: true });
  assert.deepEqual(await createExtensionChatTransport(unsupported.request, NO_PUSHES).activity.read(), { ok: false, sentence: "This extension doesn't support that yet.", unsupported: true });
});
