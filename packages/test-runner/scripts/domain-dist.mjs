// Builds the domain once when its `dist/` is absent, so this package can
// resolve `@fluxiq-web-extension/domain/node` declarations. An existing dist
// is never rebuilt here: that is the domain's own build's job, which the
// workspace build runs first, and rebuilding it from a dependant would rewrite
// files a running Lab may be loading.
//
// The build goes through the build cache in-process rather than a nested
// `pnpm --filter`, so it is stamped like any other domain build.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runStep } from "../../../scripts/build-cache/index.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

if (!existsSync(path.join(repositoryRoot, "domain", "dist", "index.d.ts"))) {
  console.log("[test-runner] domain/dist is absent: building @fluxiq-web-extension/domain once so this package can resolve its ./node declarations. An existing dist is never rebuilt here.");
  const outcome = await runStep("domain:build");
  console.log(JSON.stringify({ "build-cache": outcome.result, step: outcome.step, reason: outcome.reason, ms: outcome.ms }));
  process.exitCode = outcome.exitCode;
}
