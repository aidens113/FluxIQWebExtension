// The environment variable that carries the content-script bundle's path from
// the global setup, which builds it once per run, to the workers that load it.
// Unset means the run did not go through e2e/playwright.content.config.ts.

export const CONTENT_HARNESS_BUNDLE_ENV = "FLUXIQ_CONTENT_HARNESS_BUNDLE";
