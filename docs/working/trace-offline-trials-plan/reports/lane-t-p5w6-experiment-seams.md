# Lane T P5 W6 (t749): the offline-trial experiment on Core's public seams

Worker report. Downstream tree `C:/Users/osrs_/FluxStuff/fxwork/t749/!FluxIQWebExtension`, branch
`task/t749-offline-reads-tier2`. Core tree (read only, already built) `.../t749/!FluxIQ`. Nothing committed.
No model call, no Lab run, no browser.

## Progress log

### 2026-10-20, unit 1: domain exports

- Before starting, `git -C .../t748/!FluxIQWebExtension status --short` showed that t748 changes
  `plan-resolution/{next-page-slot,resolve-plan-node,target-packets,view-history}.ts`, `tests/dialog-identity.test.ts` and
  `step-views/`. It touches no barrel. I checked again at the end and the result was the same.
- `domain/src/index.ts` now exports `registerFluxIQHost` from `./web-panel-host`, which itself is unchanged.
- `keptWebExtractionConditions` (with `WebExtractionConditionColumns` and `WebExtractionConditions`) is reachable from
  `@fluxiq-web-extension/domain/node` through these barrels:
  - `plan-resolution/extraction/index.ts`, the nearest barrel, adds the export;
  - `plan-resolution/index.ts` re-exports it from `./extraction/conditions`;
  - `llm-evidence/index.ts` adds the names to its plan-resolution block;
  - `runtime/index.ts` already exports `./llm-evidence` whole, so it needed no change. W7 is editing that file.
- `plan-resolution/index.ts` imports from `./extraction/conditions` rather than from `./extraction` because of the
  audit. Going through the barrel failed `[import-cycles]` on `plan-resolution/index.ts` with a second loop
  (baseline 1): the barrel's `slot.ts` leads to `handle-tokens.ts` -> `structure` -> `state-digest` -> `route-state` ->
  `llm-evidence/index.ts` -> back. Importing from the module that owns the reader closes no loop, and the imports rule
  exempts an import past a barrel whose own imports lead back to the importer.
- Check: `npx tsc --noEmit -p tsconfig.json` (in `domain`) printed nothing (exit 0), both before and after that change.

UNIT READY: domain/src/index.ts, domain/src/runtime/llm-evidence/index.ts, domain/src/runtime/llm-evidence/plan-resolution/index.ts, domain/src/runtime/llm-evidence/plan-resolution/extraction/index.ts

### 2026-10-20, unit 2: the experiment switched to the seams, with deep loads deleted

I wrote the tests first: `rebuild/tests/rebuild-candidate.test.ts` (plan stage, the Core seam by default),
`recorded-resolution-binding.test.ts` (the domain reader by default), `script-extract-nodes.test.ts` (moved), and the
ports and trace-store assertions in the wiring test. Then I changed the code:

- `rebuild/rebuild-candidate.ts`
  - It calls `automationStudioProjectSingleSubflowRebuild`. The `rebuild` field on `RebuildContext` is optional, so a
    test can stand one in; otherwise Core's export is used.
  - The type `SubflowRebuild = typeof automationStudioProjectSingleSubflowRebuild` is new.
  - The submission, record and original source are passed as the seam's input types.
  - On a refusal, the subflow digest is compared from `proposal` when Core made one.
  - The downstream brief check is gone. Core throws its record refusal (`project.brief_unknown at briefId`).
- `types.ts`: `CandidateRebuild.refusal.stage` gains `"plan"` (`project.whole_trial_not_this_plan`).
- `rebuild/recorded-resolution-binding.ts`
  - Its condition reader defaults to the domain's `keptWebExtractionConditions` and can be replaced in a test.
  - The new type `ExtractionConditionsReader` describes the narrow shape the binding reads.
- `run/offline-trial/ports.ts`: just a call to `automationStudioServiceWholeTrialPorts(service, {...})`. I deleted the
  mirrored construction and the private-field view of the service (`ServiceInternals`).
- `run/offline-trial/host.ts`: it uses the domain's `registerFluxIQHost` and Core's
  `automationStudioGatewayTraceServiceStore(service, projectId)`, and no longer takes a `seams` input.
- Callers no longer pass seams: `run/run-offline-experiment-trial.ts`, `run/experiment-trial.ts`, `cli.ts` and
  `experiment-session.ts`. The session no longer has an `authoring` field.
- Deleted:
  - `rebuild/core-authoring.ts` and `run/core-trial-seams.ts`;
  - `rebuild/tests/core-authoring.test.ts`. Its loader assertion became the rebuild and binding default tests, and its
    read-count test moved to `rebuild/tests/script-extract-nodes.test.ts`, beside its subject;
  - `rebuild/tests/authoring-fakes.ts`, replaced by `rebuild/tests/rebuild-fakes.ts`, which fakes the rebuild seam.
- Both deleted modules' exports are gone from the barrels `rebuild/index.ts` and `run/index.ts`.
- No `import.meta.resolve` and no `dist/` path is left under `offline-trial-experiment`.

UNIT READY: packages/test-runner/src/offline-trial-experiment/** (see Changed below)

### 2026-10-20, unit 3: proof on real data

Both runs used fresh copies under the ignored `test-runs/p5w6/`. The survey's copy was made with the experiment's own
`freshStoreCopy`, because `survey` opens `--store` directly; the trial's copy was made by the CLI's `--work`. The
source copy, `test-runs/p5/run-mvgw3ve5-294881b5`, was never opened. Results follow.

## Outcome

Done. The rebuild, ports, host and binding go through Core's and the domain's public exports. Both deep-load modules
are deleted. The survey and E1 reproduce P4d's results exactly.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner build` exited 0. Its last lines were
  `{"build-cache":"build","step":"domain:build",...}` and `{"build-cache":"build","step":"test-runner:build",...}`, with no
  tsc errors. The core-build check printed `is current with its source`.
- `node --test "dist/offline-trial-experiment/**/*.test.js"` (in `packages/test-runner`) printed `# tests 48`,
  `# pass 48`, `# fail 0`. That includes the new tests:
  - "a brief of a plan that is not one single subflow is refused at the plan stage, before any proposal"
  - "without a stand-in the rebuild is Core's exported seam, which refuses a brief the record does not hold"
  - "without a stand-in the where seam reads clauses with the domain's own condition reader"
  - "counts a script's reads as Core's acceptor reads it" (moved)
  - the wiring test, which now also checks the ports seam and the trace store on a real host.
- `npx tsc --noEmit -p tsconfig.json` (in `domain`) printed nothing (exit 0).
- `node scripts/structure-audit.mjs` (downstream root) exited 1, with the summary line
  `structure-audit: 36 violation(s) across 2 rule(s).` No line names `offline-trial-experiment` or any domain file I
  changed. The violations are 35 `[package-exports]` in other files (the rule is new and still in progress) and 1
  `[naming]` in `domain/src/runtime/offline-reads/` (W7's). Before my change, the same audit listed
  `[package-exports]` failures for `rebuild/core-authoring.ts` and `run/core-trial-seams.ts` (2 loads each).
- Survey: `cli.js survey --store test-runs/p5w6/survey/fluxiq-root/.fluxiq --project a846814f-becd-4569-934f-f3a10df1ce79 --steps C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgw3ve5-294881b5/steps --out test-runs/p5w6/out/survey.json`
  exited 0 in 15 s.
  - The harvest is `verified: true`, with 8 resolutions. Rebuilt subflow a6aaeb05c6a6… equals recorded rev 16; rebuilt
    whole cfa2549ce1e8… equals recorded 8.
  - brief-1 rev 10 (step 109): subflow b0222c6337bc = b0222c6337bc, whole 86d511cb0b83 = recorded 5/86d511cb0b83.
    Both match.
  - brief-1 rev 16 (step 141): subflow a6aaeb05c6a6 = a6aaeb05c6a6, whole cfa2549ce1e8 = 8/cfa2549ce1e8. Both match.
  - brief-2 rev 11 (step 191): subflow a6b51dc2fddd = a6b51dc2fddd, which matches. Its rebuilt whole is 86d511cb0b83,
    the same as whole 5; nothing recorded a whole for it.
  - brief-1 revs 3, 4, 7, 11 and 13 are refused at stage `subflow` with `web.handle.unknown`, and the differing paths
    are the same as in P4d-prep.
- E1: `cli.js trial --store test-runs/p5/run-mvgw3ve5-294881b5/fluxiq-root/.fluxiq --project a846814f-… --steps <same> --trace trace.f53b350b-3146-40b2-a44d-15ddbf0913a7 --revision 10 --work test-runs/p5w6/e1-rev10 --session-view declared --out test-runs/p5w6/out/e1-rev10.json`
  exited 0 in 47 s. The runner itself took 9,927 ms.
  - Request: `recorded_revision`, whole 86d511cb0b83…, subflow b0222c6337bc…, verified against recorded 10 and 5.
  - Matcher: 19 of 19 recorded operations matched, the last being capture_snapshot@85. No gaps, no refusal.
  - Session view: supplied `declared`, used `supplied`.
  - U5: `inconclusive`, scope `full_recorded_path`, with the only missing evidence being `judgement_unavailable`
    (`not_judged`). The trial code is `candidate.trial_not_judged`, and the judge was asked once.
  - Compared with source trial 9ddb30fe (live `no`): the judge's view is equal on stored rows, reads, steps, stoppedAt
    and both words digests. Stored rows: 1 and 1 datasets, 15 and 15 rows, 15 equal positions, `equal: true`.
  - Oracle: fail, 15 stored against 3 expected, 0 matched, fields 12/15.
  - Own trace: trace.883f055f…, `derived`/`replay` from f53b350b, 89 events, not live.

## Not verified

- E2 and E3 were not rerun; the brief asked only for the survey and E1. E1 needs `--session-view declared`, as P4d-run
  found. The default `none` is refused for a trace that recorded no view.
- I did not run the full suites, `pnpm check`, or the domain's own unit tests, per the brief and the narrow-check rule.
  The domain change adds exports only.
- I did not check whether the extension bundle grows now that the domain's root `src/index.ts` exports
  `registerFluxIQHost`. The extension imports `@fluxiq-web-extension/domain`, and its bundler should tree-shake an unused
  export, but I built no extension.
- Run output takes about 1.5 GB under `test-runs/p5w6/` (two copies of `.fluxiq`). It is ignored, and I left it in
  place.

## Open questions or contradictions found

- The brief says "prefer `plan-resolution/extraction/index.ts`". That barrel does export the reader. But
  `plan-resolution/index.ts` has to re-export from `./extraction/conditions`: going through the extraction barrel adds a
  module-cycle loop that the audit fails (details in unit 1).
- `survey` opens `--store` itself and does not copy it, so "the CLI makes fresh copies" holds only for `trial --work`.
  I copied the survey's store with the experiment's own `freshStoreCopy`. A later unit could give `survey` a `--work`
  as well.
- Core's rebuild seam takes no `summary`. The deleted path passed the single-subflow test's summary to the assembly.
  The digests still match for revisions 10 and 16, so Core's assembly evidently sets the same summary itself.
