// Three questions about FluxIQ Core's build.
//
// `entries.mjs` and `unbuilt.mjs` ask whether Core has been built AT ALL:
// whether every compiled entry point its packages declare exists. Neither of
// the other two can answer that -- an absent `dist` is neither changing nor
// older than its source -- so a never-built Core used to pass both and die
// inside the run.
//
// `watch.mjs` asks whether Core is changing UNDER a run: a rebuild mid-run
// deletes modules the run is importing. `currency.mjs` asks whether Core's
// build is what its SOURCE says, through Core's own build cache: the Lab
// executes Core's compiled output, so a run against an old build measures the
// wrong thing and reports it as the product's. `staleness.mjs` keeps the
// modification-time walk this repository's own builds are still held to.
//
// A stale build is quieter than a fresh one, so the first can never catch what
// the second does.

export { coreOutputChange, coreRepositoryRoot, DEFAULT_QUIET_MS, DEFAULT_WAIT_TIMEOUT_MS, scanCoreOutput, waitForQuietCoreOutput } from "./watch.mjs";
export { scanCoreBuildEntries } from "./entries.mjs";
export { coreBuildCurrency } from "./currency.mjs";
export { coreBuildMissing } from "./unbuilt.mjs";
export { scanNewest } from "./staleness.mjs";
