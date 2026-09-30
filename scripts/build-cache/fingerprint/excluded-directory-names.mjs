// Directory names never walked for a fingerprint, at any depth.
//
// Each is generated or disposable state that no registered build or check
// reads: installed packages (covered instead by the lockfiles every step
// hashes), per-instance Lab output, test bundles, run evidence, browser
// profiles and test-runner reports. Excluding one is a claim that no step reads
// it, and `prove-inputs.mjs` checks that claim against what `tsc` and esbuild
// actually load: a listed file under one of these names fails the proof.
//
// A step's own outputs are excluded separately, by path (`resolve-step.mjs`).

export const EXCLUDED_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".git",
  ".lab-instances",
  ".lab-locks",
  ".test-build",
  ".test-build-scratch",
  ".script-build",
  ".next",
  ".tmp",
  ".turbo",
  ".fluxiq",
  "test-runs",
  "test-results",
  "playwright-report",
  ".playwright",
  ".browser-profiles",
  ".harness-build",
  ".bundle-check"
]);
