# t194-w64: re-author rerun start page, wired (cause C-D, run-murwcmx2)

## Outcome

Done. A re-author now hands its loop the page each node started on in the refuted run. When the model reruns a step carried from the Flow, the loop puts the page back there first; a step that took a carried step's place (`standsFor`) gets the same. When no start page is known, the rerun still runs in place and its result carries the `rerunPlace: start_page_unknown` note. This implements steps 1-7 of the t194-w57 "Wiring proposal", adapted to the current code. Since t193, `step-place` takes `steps` and does again the steps before the rerun that started on the same page. For a seeded step that list is empty, because a seeded step has no `replay.from`.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`):

- `host-runtime.ts`: `AutomationStudioHostStateSnapshotRef.from?: JsonObject`. This is the host's own reset token, the same thing a step states as `replay.from`. Core carries it without reading it. The executor already keeps the whole ref on `attempt.metadata.stateRefs.beforeAction` (`executor/host-state.ts`, `service/summaries/conversions.ts:204`).
- `service/runtime-adaptation/reauthor-build.ts`: reads `automationStudioRunNodeStartPages(input.detail)` once per re-author and passes it as a 4th `startPages` argument to `deps.generate`. Both ports (`refuted-result-port.ts`, `step-failure-port.ts`) hand their `deps` and `detail` through unchanged, so both routes get the start pages and neither port's source changed. Only their tests did.
- `service.ts` (line count unchanged at the 4419 ratchet): `generateFlowBootstrapAdaptationInternal(..., repairStartPages?)` passes `startPages` into the extend subject. The build loop's `draft` gains `seedStartedOn: extend.seed.startedOnByStepId` whenever the build is an extend. It is spread over a repair round's seed too: a carried step that a repair round reruns without a start page of its own still goes back to its node's start. The repair-port `generate` lambda forwards the 4th argument.
- `service/flow-bootstrap-commands/extend-subject.ts`: takes `startPages?` and calls `automationStudioFlowDraftSeedFromFlow({ nodes, edges, startPages })`.
- `llm/loop-configuration.ts`: `draft.seedStartedOn?: Readonly<Record<string, JsonObject>>`.
- `llm/evidence-loop.ts` (rerun place only): `startedOn = draft.seedStartedOn?.[replaces.standsFor ?? stepId(replaces)]` is passed to `automationStudioNodeRerunFromItsPlace`. The step's own `replay.from` still wins inside `step-place`.
- No change to `llm/node-tools/**`. `run-start-pages.ts`, `step-place.ts` (`startedOn`, `seeded_run`, `automationStudioNodeRerunPlaceNoted`) and `draft-from-flow.ts` (`startedOnByStepId`) already did what the wiring needs.

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension/domain/src/runtime/host-runtime.ts`):

- `captureStateSnapshot` returns `from: { location }`, using the page's real address (`new URL(snapshot.url).href`). It writes `from` only when that address equals what the packet already publishes (`screenedEvidenceUrl(raw) === raw`).
  - So the token never carries "(withheld)", which a reset could not navigate to, and it never carries a secret.
  - A secret-named query value, a credential-shaped fragment, an embedded user:pass, or a non-HTTP(S) address all mean no `from`. The rerun then runs in place and says so.
  - Finding: the existing step token `node-run/replay.ts` (`from: { location: current.evidence.location }`) is the **screened** location. So a draft step's own `replay.from` on a page with a withheld part resets to a "(withheld)" URL. I left it alone because it is outside my ownership. See Open questions.

Tests (failing first):

- `llm/evidence-loop/tests/rerun-place.test.ts`: a new describe block, "a re-author's rerun of the Flow's read, carried from the Flow". It is proposal step 7. The loop is driven with `draft.seed` (a carried `f1` read with no replay) plus `seedStartedOn`, starting on page 5. Three cases:
  - With a start page: the calls are `rerun.1.place {replay:"reset", from:{location:"p1"}}` then `rerun.1`. The read returns 13 rows over 5 pages, and the result shows `rerunPlace: put_back / seeded_run`.
  - With no start page: in place, 11 rows unfiltered, and the result shows `start_page_unknown`.
  - A second rerun of the step that took f1's place, with no `from` of its own, is also put back (`rerun.1.2.place`).
- `service/runtime-adaptation/tests/refuted-result-port.test.ts` (+2): generate receives the start page of each node's first attempt (ordered by `order`, not by array position), and `{}` when the run's host recorded none. `step-failure-port.test.ts` (+1): the same for the failed-step route.
- `service/flow-bootstrap-commands/tests/extend-subject.test.ts` (new, 2): the seed carries `startedOnByStepId` keyed by `f<n>`, and is empty without start pages.
- Downstream `domain/src/runtime/tests/host-runtime.test.ts` (+2): `from` is the raw address, including query and fragment. It is absent for `?token=`, `#access_token=`, and `user:pass@`, and no secret appears in the ref.

## Commands run and observed results

- Failing first:
  - Core: `npx vitest run .../evidence-loop/tests/rerun-place.test.ts` gave `Tests 2 failed | 8 passed (10)`. The put-back test received `[["rerun.1", {...}]]` with no `.place`. The in-place note test passed already: t194-w57 landed that note.
  - Core: `npx vitest run` over the extend-subject, refuted-result-port and step-failure-port tests gave `Tests 4 failed | 32 passed (36)`. Examples: `expected {} to deeply equal { Object (f2) }` and `expected undefined to deeply equal { Object (node.s7) }`.
  - Downstream narrow run gave `not ok 50 - a state ref carries the page's own address as the token a reset navigates to`, `# pass 76 # fail 1`.
- `npx vitest run` (packages/fluxiq) over `R/llm/node-tools R/llm/evidence-loop R/service/runtime-adaptation R/service/flow-bootstrap-commands R/recovery` gave `Test Files 94 passed (94)`, `Tests 953 passed (953)`. I ran it after the implementation and again at the end.
- `bash .../heavy.sh "t194-w64 pnpm check fluxiq" pnpm check`:
  - Run 1, rc 1: `step-failure-port.test.ts(93,5): TS18048 'detail.actionAttempts' is possibly 'undefined'`, which is my test.
  - After the fix: rc 0. The final rerun was rc 0 (`reuse ... inputs and outputs match the stamp`).
- Core `node scripts/structure-audit.mjs` gave `structure-audit: passed (222 warning(s), 349 baselined)`. It adds one advisory: `llm/loop-configuration.ts: 403 lines is past the 400-line advisory threshold`. The file was at 400 before my field.
- Downstream domain typecheck `pnpm --filter @fluxiq-web-extension/domain check`:
  - First run, rc 1: `host-runtime.test.ts: Property 'from' does not exist on type 'AutomationStudioHostStateSnapshotRef'`. The domain checks against Core's compiled `dist`, which `scripts/check/core-build.mjs` reported as "42 minute(s) behind its source".
  - I rebuilt Core with `bash .../heavy.sh "t194-w64 core fluxiq build" pnpm --filter fluxiq build`, rc 0. `dist/.../host-runtime.d.ts:21` now reads `from?: JsonObject;`.
  - Then the domain check passed, rc 0. The final rerun was also rc 0.
- Downstream narrow tests for `runtime/`: the repository-layout doc names no per-directory domain command; `test-domain.mjs` takes no filter. I used a scratch script that bundles `domain/src/runtime/tests/*.test.ts` exactly as `test-domain.mjs` does, into `domain/.test-build-scratch/t194-w64/`, and runs them. Result: `# tests 77 # pass 77 # fail 0`.
- Downstream `node scripts/structure-audit.mjs`:
  - First run: `FAIL [failure-as-empty] domain/src/runtime/host-runtime.ts ... line 208`, from my `try { new URL } catch { return undefined }`.
  - I rewrote it to lean on `screenedEvidenceUrl`, which already answers `undefined` for an address that does not parse. Then: `structure-audit: passed (159 warning(s), 118 baselined)`, with no `host-runtime` line.

## Not verified

- No live run and no provider call.
- Whether stored run details keep `stateRefs.beforeAction.from` through persistence and the run-detail read. It is inferred from `conversions.ts:204` (`stateRefs` copied whole) and was not observed in a stored record. The murwcmx2 artifacts hold no run detail with stateRefs.
- Whether a refuted run's attempt `nodeId` equals the graph node id that the seed keys on. The murwcmx2 judge text names `node.bootstrap.28a03ca3abb0a39e.main.s7`, which is the id shape `flow-bootstrap/adaptation.ts:204` mints for graph nodes, so they appear to match. I did not check this against a run detail.
- The domain only captures snapshots for nodes that act on a page (`actsOnPage`): web output nodes and recorded web actions. Both the list read and the click are web output nodes, so they get start pages; an LLM or code node never does.
- The Core tree had concurrent edits by other workers (activity, result-verification, harness, `evidence-loop/resume.ts`, ui). Those were part of what `pnpm check` and the Core `dist` build compiled.

## Open questions or contradictions found

- **The screened step token (outside my ownership).** `domain/src/runtime/llm-evidence/node-run/replay.ts:105` writes a step's `replay.from` from `evidence.location`, the screened address. On a page whose URL holds a secret-named parameter, a draft step's reset, the dry run's reset, and the step-place put-back would all navigate to `...?token=(withheld)`. The new snapshot `from` avoids this by writing nothing in that case. The step token should probably follow the same rule: the raw address when nothing is withheld, otherwise none. Suggested for a downstream `node-run/` brief.
- The brief says the narrow domain command for `runtime/` is in `docs/architecture/repository-layout.md`. It is not: the doc lists only the whole-package `pnpm --filter @fluxiq-web-extension/domain test`, and `scripts/test-domain.mjs` takes no path filter.
- `loop-configuration.ts` is now past the 400-line advisory, at 403. That is advisory, not a failure. A later split could move the `draft` option type into its own file.

## Doc paragraph for Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` (for the lead to apply)

> **A re-author's rerun starts where its node started.** A re-author seeds its draft from the Flow, and a step carried from the Flow records no `replay.from`, because the build never ran it. So a rerun of such a step used to run wherever the refuted run had left the target. In live run `run-murwcmx2-a1c6edf7`, the rerun of the Flow's list read ran on results page 5 and read 11 records from 1 page. Now the host may state, on each state snapshot, its own reset token for that state (`AutomationStudioHostStateSnapshotRef.from`, the same token as a step's `replay.from`; the web writes `{ location }` only when the address holds nothing the evidence packet withholds). The re-author build reads each node's first `before_action` token off the refuted run (`llm/node-tools/run-start-pages.ts`, called in `service/runtime-adaptation/reauthor-build.ts`). The extend seed keeps those tokens beside its steps as `startedOnByStepId`, not in `replay.from`, so the dry-run gate sees the same draft. The loop receives them as `draft.seedStartedOn`. A rerun of a carried step, or of the step that took its place (`standsFor`), that has no start page of its own is put back there through the ordinary reset before it runs. Its result says `rerunPlace: { place: "put_back", startPage: "seeded_run" }`. Where no start page is known, the rerun runs in place and says `start_page_unknown`.

## Commit message

```
Re-author rerun of a carried step starts where its node started in the refuted run

Live run run-murwcmx2 (t194 C-D): the re-author's rerun of the Flow's list
read ran on results page 5, where the refuted run left the page ("11 records
from 1 page"), and the model resent it until the re-author ended.

- host-runtime.ts: AutomationStudioHostStateSnapshotRef.from, the host's own
  reset token for the snapshot's state, carried unread.
- reauthor-build.ts: reads each node's first-attempt start page off the run
  and hands it to the build; service.ts threads it into the extend subject and
  the loop's draft (seedStartedOn); extend-subject.ts seeds with it.
- evidence-loop.ts: a rerun of a carried step (or the step standing for it)
  with no replay.from of its own is put back to that start page first.

Task: t194
Worker: t194-w64
```

Downstream (separate commit):

```
Web state snapshots carry the reset token for the page they captured

captureStateSnapshot returns from: { location } with the page's real address,
only when it equals the published one (nothing withheld), so Core can put a
re-author's rerun back where its node started (t194 C-D, run-murwcmx2).

Task: t194
Worker: t194-w64
```
