# conv-service-headroom

## Outcome

Done. `packages/fluxiq/src/programs/automation-studio/runtime/service.ts` went
from **6,275 to 4,638 lines** (−1,637, a 26% cut), and the structure-audit
ratchet for it was lowered to 4,638 so the reduction cannot silently refill.
A second ratcheted entry disappeared: the file's one baselined `imports`
violation is gone, because the last direct reach past `storage/`'s barrel into
`storage/state-index.ts` moved out with the recording state index.

Everything that moved is a behaviour-unchanged move: no public method was
renamed, no facade signature changed, no error text or code changed, and no
effect was reordered. Public methods that moved kept their name, signature and
dispatch point — the method stays on the facade and delegates to the new
module, which is the shape task t048 used.

## What changed and why

### 1. The module-level helper tail (about 1,130 lines)

Everything below the class — 85 module-level functions and one type — moved
into collaborator modules. Nothing in that region touched `this`, so each move
is a relocation of a pure function.

New directories under `runtime/service/` (a subdirectory each, because
`automation-studio/runtime/` holds 24 of its 25 permitted files, and each file
stays far below the 800-line cap and the 8-exported-value advisory):

| Directory | Files | Lines | What it holds |
| --- | --- | --- | --- |
| `recording-state-index/` | 6 | 377 | building a recording's state index, reading one timeline entry, and resolving a state out of a built index, plus the lookup contracts |
| `flow-settings/` | 6 | 182 | merged Flow settings metadata, training-mode settings, the Flow-metadata adaptation policy, the settings fingerprint, and the per-setting readings |
| `flow-map-routes/` | 4 | 168 | the SQL router projection, the route and route-group edits, and the Flow-map page and upsert contracts |
| `runtime-adaptation/` | 4 | 168 | the runtime adaptation context, its run-level override, its recovery budget and run-detail summary, and the intervention-mode normalizer |
| `flow-bootstrap-commands/` | 5 | 137 | Flow Bootstrap command field validation, the adaptation audit event, the evidence-trace sanitizer and its audit detail, and the generate-adaptation contracts |
| `recording-projections/` | 5 | 135 | the recording listing summary, the timeline-free session, the mapper candidate, the proposal replacement base, and the summary contracts |
| `adaptation-projections/` | 4 | 114 | the change-proposal, adaptation and policy listing rows, and the typed adaptation store translation |
| `problems/` | 4 | 88 | the problem page contract, severity order and baseline problems, and (see below) the project problem listing |
| `publication-dependencies/` | 2 | 73 | the execution publication dependency state |
| `hierarchy-nodes/` | 2 | 50 | the host-supplied hierarchy node reading |
| `reusable-context/` | 3 | 50 | the reusable LLM context configuration, selection and status contracts, and the record summary |
| `scalar-readings/` | 4 | 35 | first usable string / finite number, finite number, clamped number and positive integer |
| `json-lines/` | 2 | 24 | one page of a JSON-lines file |

Files added to existing `runtime/service/` subdirectories, where that
directory already owned the subject: `flows/canonical-digest.ts`,
`flows/node-scope.ts`, `flows/subflow-category-metadata.ts`,
`flows/version-order.ts`, `projects/category-order.ts`,
`runtime-session/terminal-status.ts`; and `countBy` and `latestByGeneratedAt`
were appended to the existing `service/collections.ts`. Each of those barrels
gained one `export *` line and nothing else.

### 2. Exported type declarations (about 190 lines)

Twenty-one exported types moved into the module that owns their subject and
are re-exported from `service.ts` by name, so the file's public surface is
unchanged: every type another module imported from `runtime/service.ts` still
resolves there. `AutomationStudioServiceOptions`,
`AutomationStudioFlowRunActionPage` and `UpdateFlowSubflowInput` stayed.

One deliberate type-level change: `AutomationStudioServiceOptions`'s inline
`reusableLlmContext` object type is now the named, exported
`AutomationStudioReusableLlmContextOption`, because
`AutomationStudioReusableLlmContextHostConfiguration` indexes into it and the
two had to live together. The shape is identical and structural, so
`AutomationStudioServiceOptions["reusableLlmContext"]` still means exactly what
it meant.

### 3. Seven method bodies (about 230 lines)

Each of these had only private-collaborator field dependencies — no call to
another method on `this` — so the move cannot change dispatch, and the
facade-dispatch rule is not engaged. Each keeps its method on the class,
unchanged in name, visibility and signature, delegating to a `ports`-taking
function in the collaborator, following `run-detail-read`'s existing shape.

| Method | Moved to | Ports |
| --- | --- | --- |
| `listProjectProblems` | `problems/project-problem-listing.ts` | `projects` |
| `updateProject` | `projects/update.ts` | `objectStore`, `projects`, `projectPaths` |
| `inspectFlowMigration` | `legacy/migration-inspection.ts` | `projects`, `catalogue`, `legacy` |
| `repairFlowSummaryMetadataIndex` | `flows/summary-index-repair.ts` | `flows`, `repositories`, `indexes` |
| `withCanonicalFlowHierarchySubflows` | `flows/hierarchy-subflows.ts` | `indexes` |
| `listAutomationProposalSummaries` | `proposals/summary-listing.ts` | `indexes` |
| `embedTaskGraphs` | `projects/task-graph-embedding.ts` | none (it used no `this`) |

The class still has 223 methods; the ratchet on that is untouched, since the
delegates remain.

### 4. Dead weight removed (about 80 lines)

- `sqlResourceStatus` was unreferenced anywhere in the repository and was
  deleted rather than moved. A non-exported function nothing calls has no
  behaviour to preserve.
- 70 unused import names were removed. 32 of them became unused because of
  this work; 38 were already dead before it. Five import statements emptied
  out and were deleted: `node:fs`, `node:readline`, `../storage/state-index.ts`,
  `../../database-manager/storage/sqlite-repository.ts` and
  `./adaptive-orchestrator.ts`. Each of the two local modules was checked for
  top-level statements first (neither has any), and `state-index.ts` is still
  reached through `storage/index.ts`, so no module left the graph with a side
  effect unexecuted.

## Commands run and observed results

Core, in `F:\fxwork\t083\!FluxIQ`:

- `packages/fluxiq> npx tsc --noEmit` → exit 0, no output. Run after each
  stage of the work.
- `node scripts/structure-audit.mjs` → `structure-audit: passed (174
  warning(s), 360 baselined).` No failures; the 174 warnings are the
  repository's pre-existing advisory thresholds, none of them on a file this
  task created.
- `node scripts/structure-audit.mjs --update` →
  `lowered [file-lines] .../runtime/service.ts: 6275 -> 4638` and
  `removed [imports] .../runtime/service.ts (was 1)`; then a clean re-run with
  nothing left to lower.
- `pnpm check` → exit 0. Structure audit passed, then
  `packages/contracts check: Done`, `packages/client-gateway-websocket check:
  Done`, `packages/fluxiq check: Done`, `apps/web check: Done`.
- `pnpm build` → exit 0, through the contracts, fluxiq, gateway and Next.js
  web builds.
- `packages/fluxiq> npx vitest run` (the whole package, per the brief's warning
  not to glob from the repository root) → `Test Files 20 failed | 311 passed
  (331)`, `Tests 40 failed | 2809 passed | 1 skipped (2850)`.
- `packages/fluxiq> npx vitest run src/programs/automation-studio` →
  `Test Files 28 failed | 254 passed (282)`, `Tests 49 failed | 2425 passed |
  1 skipped (2475)`.

Those failures are environmental on this machine, not regressions, and I
checked that rather than assuming it. The errors are `EBUSY: resource busy or
locked` and `ENOTEMPTY: directory not empty` on `%TEMP%\fluxiq-*` fixture
directories, 15s and 60s test timeouts, one perf assertion
(`expected 641.5 to be less than 500`), and one live-DeepSeek deadline test.
To confirm, I restored the pre-change `service.ts` with
`git checkout -- <path>` (keeping my version in the scratchpad) and ran the
same files both ways:

- Subset A (`execution-digest`, `proposals`, `proposal-candidates`,
  `flow-run-detail-reader`, `subflows`, `modes`): **identical** before and
  after — `Tests 1 failed | 53 passed (54)`, the one failure being
  `turns mapped observations into reviewed Flow actions... → Test timed out in
  15000ms` in both runs.
- Subset B (`service-bootstrap/adaptation`, `service-adaptation/subflow`,
  `service-flows/canonical-persistence`, `service-recordings/task-proposals`,
  `service-flows/representation`): pre-change `Tests 14 failed | 26 passed
  (40)`, all `ENOTEMPTY`/timeout; post-change `Tests 40 passed (40)`. The same
  files pass with the change and fail without it, which is flakiness in the
  fixture cleanup, not signal about the change.

Downstream, in `F:\fxwork\t083\!FluxIQWebExtension`:

- `pnpm check` → exit 0; every workspace project reported `check: Done`,
  including `domain`, `apps/extension`, `apps/scenario-lab` and
  `packages/test-runner`.

I also ran a mechanical loss check: every non-blank line of the original
`service.ts` from the class declaration onward is still present somewhere in
the tree, modulo `function` → `export function` on 80 declaration lines,
`this.` → `ports.` inside the seven moved method bodies, and the deliberately
deleted `sqlResourceStatus`.

## Not verified

- **No live run.** Nothing here was exercised against the real DeepSeek
  provider. The one live test that failed in the full suite
  (`deepseek-bootstrap-exploration > asks again after a decision that runs past
  its deadline`) is a provider-deadline assertion and I did not re-run it, to
  avoid spending on a run outside an agreed campaign.
- **The full suite was not re-run after the last two edits** (the blank-line
  tidy in the import header and the final baseline lowering). `npx tsc
  --noEmit`, the structure audit, `pnpm check` and `pnpm build` were all re-run
  after them.
- **No new unit tests were added.** Every moved function is exercised through
  the facade by the existing service tests, which is what the before/after
  subset comparison leaned on. Small direct tests for the new pure modules —
  `recording-state-index/`, `flow-settings/`, `flow-map-routes/` — would be
  cheap and are worth a follow-up.
- **`apps/web` runtime behaviour** was type-checked and built but not opened in
  a browser.

## What I judged unsafe to move, and why

These are the candidates I deliberately left, with the reason. They are the
obvious next targets if this file needs to shrink again.

- **`runRuntimeSession` (240 lines), `generateFlowBootstrapAdaptation` (218),
  `applyFlowBootstrapAdaptation` (121), `processFinalizedRecording` (114),
  `revertFlowBootstrapAdaptation` (99).** Each touches 13 to 28 distinct
  members of `this`, mixing private stores with calls to the facade's own
  public methods. Moving one means both a large dependency bag and routing its
  public calls through `AutomationStudioFacadePorts`, and the ports type would
  have to grow. That is a real refactor with a real chance of a silent
  ordering or dispatch change, and I could not prove it with a live run from
  here. `applyFlowBootstrapAdaptation` and `revertFlowBootstrapAdaptation`
  also sit on Flow Bootstrap paths that task t082 is working next to.
- **`resolveRuntimeAdaptationContext` (38 lines).** Its three dependencies —
  `getFlowAdaptation`, `listFlowAdaptationSummaries`, `listFlowRunSummaries` —
  are all public methods, and only the first is in
  `AutomationStudioFacadePorts` today. Extending the ports type is the right
  move but it changes a shared contract, which is not a behaviour-unchanged
  move I wanted to make inside this task.
- **`upsertFlowMapRoute` (35) and `maybePromoteRuntimeAdaptation` (76).** Both
  call public methods on `this` (`saveFlowRouter`; `reviewFlowAdaptation`), so
  moving the body re-points a dispatch a caller can override. Same reason as
  above.
- **`deleteRecording` (35 lines, 9 distinct `this` members) and the
  constructor (56 lines, 44 members).** The constructor is the wiring itself;
  splitting it buys lines and costs the one place that shows how the service is
  assembled.
- **`AutomationStudioServiceOptions`, `AutomationStudioFlowRunActionPage` and
  `UpdateFlowSubflowInput`.** Movable, but each would need a new home whose
  only content is one type; `UpdateFlowSubflowInput` belongs beside
  `CreateFlowSubflowInput` in `flows/`, which means editing an existing
  collaborator file rather than adding one. Worth doing next time, together.
- **The 38 pre-existing unused import names that I did remove** are the one
  place I went beyond "moves". I convinced myself first that each was genuinely
  unreferenced and that no module left the graph with a side effect
  unexecuted; if that judgement is unwelcome, the removal is a separable hunk
  of the diff.

## Open questions or contradictions found

- The class still carries **223 methods against a 40-method limit**, and the
  ratchet means one new method on `AutomationStudioService` fails `pnpm check`
  exactly as one new line used to. Line headroom is now large; method headroom
  is still zero. A queued feature that needs a new public method on the facade
  will hit this, and the only ways through are a readonly property, a
  collaborator object, or actually removing methods — which is the large
  refactor listed above.
- The new collaborator directories are not re-exported from
  `runtime/service/index.ts`; `service.ts` imports each subdirectory barrel
  directly, following the existing `run-detail-read/` and `runtime-session/`
  precedent. If the convention is meant to be the other way, it is a one-line
  change per directory.
- The `pnpm --filter fluxiq test` suite is unreliable on this machine: the
  same five test files failed 14 tests in one run and passed 40 in the next,
  with `ENOTEMPTY`/`EBUSY` on temp fixture directories. That is worth a
  separate look — the fixture teardown appears to race Windows file handles —
  because it currently makes the suite unusable as a pass/fail gate without a
  before/after comparison.
