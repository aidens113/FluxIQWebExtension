// Three questions about FluxIQ Core's build.
//
// `entries.mjs` and `unbuilt.mjs` ask whether Core has been built AT ALL:
// whether every compiled entry point its packages declare exists. Neither of
// the other two can answer that -- an absent `dist` is neither changing nor
// older than its source -- so a never-built Core used to pass both and die
// inside the run.
//
// `watch.mjs` asks whether Core is changing UNDER a run: a rebuild mid-run
// deletes modules the run is importing. `staleness.mjs` and `stale.mjs` ask
// whether Core's build is what its SOURCE says: the Lab executes Core's
// compiled output, so a run against an old build measures the wrong thing and
// reports it as the product's.
//
// A stale build is quieter than a fresh one, so the first can never catch what
// the second does.

export { coreOutputChange, coreRepositoryRoot, DEFAULT_QUIET_MS, DEFAULT_WAIT_TIMEOUT_MS, scanCoreOutput, waitForQuietCoreOutput } from "./watch.mjs";
export { scanCoreBuildEntries } from "./entries.mjs";
export { coreBuildStaleness } from "./stale.mjs";
export { coreBuildMissing } from "./unbuilt.mjs";
export { scanCoreSources, scanNewest } from "./staleness.mjs";
