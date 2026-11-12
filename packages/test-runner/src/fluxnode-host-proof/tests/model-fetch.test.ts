import assert from "node:assert/strict";
import test from "node:test";
import { SCRIPTED_MODEL_CORRELATION_HEADER } from "../../attempt-lane/scripted-model/index.js";
import { hostProofModelFetch } from "../model-fetch.js";

const RUN = "fnr-11111111-1111-4111-8111-111111111111";
const INPUT = "https://model-provider.example.test/v1/messages";

test("the owning lease tags opaque provider bytes at the loopback transport only", async () => {
  let received: { url: string; run: string | null; body: string } | undefined;
  const real: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    received = { url: request.url, run: request.headers.get(SCRIPTED_MODEL_CORRELATION_HEADER), body: await request.text() };
    return new Response("reply");
  };
  const transport = hostProofModelFetch(real, "http://127.0.0.1:9", () => RUN);
  const request = new Request(INPUT, { method: "POST", headers: { "anthropic-version": "synthetic", [SCRIPTED_MODEL_CORRELATION_HEADER]: "forged" }, body: "opaque provider body" });
  assert.equal((await transport(request)).url, "");
  assert.deepEqual(received, { url: "http://127.0.0.1:9/v1/messages", run: RUN, body: "opaque provider body" });
});

test("an absent lease stays unattributed instead of trusting a caller's header", async () => {
  let received: string | null | undefined;
  const real: typeof fetch = async (_input, init) => {
    received = new Headers(init?.headers).get(SCRIPTED_MODEL_CORRELATION_HEADER);
    return new Response("reply");
  };
  await hostProofModelFetch(real, "http://127.0.0.1:9", () => undefined)(INPUT, { method: "POST", headers: { "anthropic-version": "synthetic", [SCRIPTED_MODEL_CORRELATION_HEADER]: RUN } });
  assert.equal(received, null);
});

test("the proof never routes a request or its scripted destination outside loopback", async () => {
  let sent = false;
  const real: typeof fetch = async () => {
    sent = true;
    return new Response("unexpected");
  };
  assert.throws(() => hostProofModelFetch(real, "https://example.test", () => RUN), /loopback/u);
  await assert.rejects(hostProofModelFetch(real, "http://127.0.0.1:9", () => RUN)("https://example.test/private"), /refuses a call leaving this machine/u);
  assert.equal(sent, false);
});
