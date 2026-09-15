// The build's environment: a build-only FluxIQ root with its gateway disabled,
// and nothing inherited that its key does not cover.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { coreWebBuildEnvironment } from "../build-environment.js";

test("the build sees only a build-only FluxIQ root with its gateway disabled", () => {
  const root = path.join("runs", ".core-web-build", "0".repeat(24), "b-0123456789ab", "fluxiq-root");
  const env = coreWebBuildEnvironment(root, {
    PATH: "bin",
    FLUXIQ_HOST_MODULE: "host.mjs",
    FLUXIQ_ROOT: "a-run-root",
    fluxiq_client_gateway_port: "4777",
    NEXT_PUBLIC_BANNER: "would-be-inlined",
    NODE_ENV: "development",
    PORT: "3000",
    OPENAI_API_KEY: "synthetic-provider-value",
  });
  assert.deepEqual(env, {
    PATH: "bin",
    FLUXIQ_ROOT: root,
    FLUXIQ_IMPORTER_ROOT: root,
    FLUXIQ_HOST_ROOT: root,
    FLUXIQ_DATA_DIR: path.join(root, ".fluxiq"),
    FLUXIQ_DATABASES_DIR: path.join(root, ".fluxiq"),
    FLUXIQ_CLIENT_GATEWAY_ENABLED: "false",
  });
});
