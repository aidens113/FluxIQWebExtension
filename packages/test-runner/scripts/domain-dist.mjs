// Brings `domain/dist` up to date before this package compiles, so it resolves
// `@fluxiq-web-extension/domain/node` declarations that match the domain's
// source. Every run goes through the build cache's `domain:build` step, which
// reuses the dist when the domain's inputs match its stamp (a stat-cached
// fingerprint, well under a second) and rebuilds it when they changed.
//
// This used to build only when `dist/index.d.ts` was absent and never rebuild
// an existing dist. A dist left from an older domain then compiled this package
// against stale declarations, and a newly exported domain function failed here
// with TS2305 although the domain itself was correct.
//
// A rebuild here is the same stamped, locked step the domain's own build runs,
// so it rewrites `dist` only when the domain's own build would have, and two
// concurrent callers do not build it twice.
//
// The build goes through the build cache in-process rather than a nested
// `pnpm --filter`, so it is stamped like any other domain build.

import { runStep } from "../../../scripts/build-cache/index.mjs";

const outcome = await runStep("domain:build");
console.log(JSON.stringify({ "build-cache": outcome.result, step: outcome.step, reason: outcome.reason, ms: outcome.ms }));
process.exitCode = outcome.exitCode;
