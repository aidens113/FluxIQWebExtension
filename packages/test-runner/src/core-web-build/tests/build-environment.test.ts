// The base environment the Lab gives Core's keyed web build: nothing from the
// invoking shell or a run, and no provider credential. Core adds the build's
// own FluxIQ root inside the attempt.
import assert from "node:assert/strict";
import test from "node:test";
import { coreWebBuildEnvironment } from "../build-environment.js";

test("the build sees no FluxIQ setting, no inlined public value, no NODE_ENV or PORT, and no provider credential", () => {
  const env = coreWebBuildEnvironment({
    PATH: "bin",
    NEXT_TELEMETRY_DISABLED: "1",
    FLUXIQ_HOST_MODULE: "host.mjs",
    FLUXIQ_ROOT: "a-run-root",
    fluxiq_client_gateway_port: "4777",
    NEXT_PUBLIC_BANNER: "would-be-inlined",
    NODE_ENV: "development",
    PORT: "3000",
    OPENAI_API_KEY: "synthetic-provider-value",
  });
  assert.deepEqual(env, { PATH: "bin", NEXT_TELEMETRY_DISABLED: "1" });
});
