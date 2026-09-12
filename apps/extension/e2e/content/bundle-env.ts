// The environment variables that carry the harness bundles' paths from the
// global setup, which builds them once per run, to the workers that load them.
// Unset means the run did not go through e2e/playwright.content.config.ts.

export const CONTENT_HARNESS_BUNDLE_ENV = "FLUXIQ_CONTENT_HARNESS_BUNDLE";

/** The page-world bundle (`src/page-world/`), which the manifests inject as a `world: "MAIN"` content script. */
export const CONTENT_HARNESS_PAGE_WORLD_BUNDLE_ENV = "FLUXIQ_CONTENT_HARNESS_PAGE_WORLD_BUNDLE";
