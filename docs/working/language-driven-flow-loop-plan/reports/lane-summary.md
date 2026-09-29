# Lane summary: t172 live lane on hard sites

Worker lane t172, debug only, no product code changed. The lane ran in
`F:\fxwork\t172-live-lane-hard-sites` (extension 260a4e17) against the shared
Core `F:\fxwork\!FluxIQ` at 717f035, with deepseek-flash on the production
profile. It stopped at the four-run cap: one run on each of four sites, and
none on everything-store.

**No run passed.** Two Flows were built and ran but returned the wrong answer,
and the verifier refuted both correctly. Two builds ran out of budget without
writing a Flow.

## Runs

| Run | Task | Verdict | Where it stopped | Root cause (file and line) | Full debug |
| --- | --- | --- | --- | --- | --- |
| run-mulwm2dc-0bd95f22 | job-board-remote-rust-roles | Failed: Flow built, 12 rows, 0 of 7 matched; re-author applied, same wrong rows | Verification refuted twice; the Lab stopped waiting before Core's recovery finished | A detected list offers an anchor only as its URL, so `title` came out as a link (`apps/extension/src/content/extraction/infer-fields.ts:308-309`). The consent wall's buttons are in shadow DOM and never reach the model (`apps/extension/src/content/dom-snapshot.ts:254`), which cost half the build loop | `lane-run-mulwm2dc-0bd95f22.md` |
| run-mulx76vv-a882551e | bigbox-retail-pickup-cart | Failed: no Flow; `flow_bootstrap.evidence_iteration_limit` after 32 decisions, $0.06 of $0.25 | Build: the token budget ran out with a 12-step draft | Stalled loop: 11 of the last 16 decisions changed nothing (`!FluxIQ/.../runtime/llm/evidence-loop.ts:656-667,704-707`). An exhausted build writes nothing (`evidence-loop.ts:353-365`) | `lane-run-mulx76vv-a882551e.md` |
| run-mulxk0ro-36bf090d | local-classifieds-save-dining-tables | Failed: Flow built with search and extract only, no save; 0 of 5 matched; re-author failed | Build accepted `complete` on half the job; re-author died in `generate()` | Completion checks only that records are produced, never that the instruction's actions have steps (`!FluxIQ/.../flow-bootstrap/answerability/check.ts:57-78`). The advisory cross-check saw it and refuses nothing (`flow-bootstrap/adaptation.ts:127-133`). Re-author: `flow_bootstrap.unexpected_error` from an anonymous guard (`generation-failure/phase-failure.ts:84-87`) | `lane-run-mulxk0ro-36bf090d.md` |
| run-mulxsbyy-d4d4c7a1 | crossborder-marketplace-hub-to-cart | Failed: no Flow; three completions refused, the last on the forced final decision | Build: `bootstrap.completion_profile_limit_exceeded` on decision 41, then the iteration limit | The final completion was refused by an unnamed limit (`!FluxIQ/.../llm/harness-options/bootstrap-completion.ts:190-191`, limits at `flow-bootstrap/plan/limits.ts:22-32`), with no turn left to fix it and nothing written | `lane-run-mulxsbyy-d4d4c7a1.md` |

### Setup failures, not results

These were fixed and rerun, and none is counted above.

- `run-mulwg1fy-bf2507b3`: the Core panel's Next build failed with `memory allocation of 96 bytes failed`, exit 3221226505.
- `run-mulwipxd-1b7c71bf`: the same build hit a Turbopack panic at `registry.rs:117:35`.
- Run 2, first attempt: `tsc` in `packages/test-contracts` crashed with an access violation (0xC0000005). The Lab reported it as `environment.missing`.
- Three native crashes, with 10 GB free each time, match the machine's known faulty RAM. The coordinator reports that the machine then crashed outright during this lane.
- Core `dev` moved to 8b56084 ("A stalled evidence loop is redirected long before it runs out") partway through. So runs 2 to 4 used `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` to stay on the pinned 717f035. **The stall findings below predate 8b56084.**

## Causes ranked by how many runs they blocked

"Blocked" means the cause was on the path to that run's failure, either as the
main cause or as a contributing one.

| Rank | Cause | Runs | Status | Where |
| --- | --- | --- | --- | --- |
| 1 | **Stalled loops**: `already_answered`, identical `draft_unchanged` amendments, one step flip-flopped keep/drop, malformed replies in a row | 4 (main cause in run 2; contributing in runs 1, 3 and 4) | **Being fixed** (stalled loops; Core 8b56084 is not yet measured here) | `!FluxIQ/.../runtime/llm/evidence-loop.ts:656-667,704-707`; `domain/src/runtime/llm-evidence/repeated-refusal.ts:84` |
| 2 | **Shadow-DOM controls invisible** to the model and to the overlay scans. Job-board consent wall; classifieds radius picker; crossborder store coupon (likely) | 3 (runs 1, 3, 4) | **Being fixed** (shadow-DOM controls). The fix belongs in the snapshot, not the dismissal vocabulary: accept or reject cookies must stay the model's choice (`interference/vocabulary.ts:31-37`) | `apps/extension/src/content/dom-snapshot.ts:254`; `action-runtime/interference/overlays.ts:111`; `interference/way-out.ts:59` |
| 3 | **An exhausted build writes nothing, and the token grant acts as a decision cap.** About 16k input tokens per decision against a 600k grant makes about 34 decisions, which leaves 4 beyond this cart task's 30 recorded steps for any inspecting, exploring or correcting | 2 (runs 2, 4) | **New** | `!FluxIQ/.../runtime/llm/evidence-loop.ts:353-365`; `!FluxIQ/.../runtime/llm/loop-budget.ts` (`tokensLeft < perDecision`) |
| 4 | **Anchor text is never offered as a column**, so a linked title can only be read as its URL | 1 (run 1) | **Being fixed** | `apps/extension/src/content/extraction/infer-fields.ts:308-309`; `extraction/field-reader.ts:61-62` |
| 5 | **The repair ignores the verifier's advice.** The verifier said to fix the title field and add filter, dedupe and sort. The re-authored Flow re-read the same 12 unfiltered rows | 1 (run 1) | **Being fixed** | re-author path `!FluxIQ/.../runtime/service.ts:2644-2660`; outcome in run 1's `flow-lane.json` actions 4 and 5 |
| 6 | **Completion checks only that records are produced**, never that the instruction's lasting actions (save, add to cart) have a step. The consequence cross-check knew (`undeclared`) but is advisory and computed after the loop. This is a completeness issue to feed back at `complete`, not a permission gate | 1 (run 3) | **New** | `!FluxIQ/.../flow-bootstrap/answerability/check.ts:57-78`; `flow-bootstrap/adaptation.ts:127-133`; `flow-bootstrap/action-permissions.ts:209-216` |
| 7 | **The re-author fails with an anonymous `flow_bootstrap.unexpected_error`**: any plain `Error` from a guard inside `generate()` is flattened to one code, and the message is dropped | 1 (run 3) | **New** | `!FluxIQ/.../flow-bootstrap/generation-failure/phase-failure.ts:84-87`; candidate guards at `runtime/service.ts:2645` and `runtime/llm/execution/grants.ts:188-310` |
| 8 | **Completion refusals are unnamed and come one at a time.** The profile-limit refusal does not say which limit. Each attempt reports only the first failing gate (reachability, then dry run, then profile). The final forced `complete` can be refused with no turn left | 1 (run 4) | **New** | `!FluxIQ/.../llm/harness-options/bootstrap-completion.ts:166-191`; `flow-bootstrap/plan/evidence-schema.ts:92-104` |
| 9 | **Pagination with no stop reason**: `pagesRead: 1` with `maxPages: 50`, and the extraction record says nothing about why it stopped | 1 (run 1, contributing) | **Being fixed** | extraction record in run 1's `flow-lane.json` action 3 |
| - | Invented locators (`target_not_a_handle`, `handle_not_in_packet`): a turn or three per run, and self-corrected in runs 1 and 2 | 3 (runs 1, 2, 4), minor | Known pattern, not blocking on its own | `domain/src/runtime/llm-evidence/node-run/run.ts:228-232` |
| - | Cart structure detector refusing `nothing_repeats_around_target` | 0: no run reached a cart extraction | Fixed in 1fb57cbc (not in this lane's build) | - |

### Diagnosis gaps (new, all four runs)

These did not fail any run, but each one stopped a debug from naming a cause
precisely.

- **Amendment refusal reasons are dropped from the bundle.** The Lab keeps no array-of-object member, so `amendmentsRefused` never survives. The provider-failures copy is cut at 8,000 characters. See `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts:68,84-89`.
- **The re-author's provider calls and iterations are not recorded.** `repair.observed.perCallRecords: "not recorded"`, and no step trace exists. That affected runs 1 and 3.
- **The Lab deletes the run root with Core's store** for clone-target runs (`packages/test-runner/src/run-scenario.ts:600-602`, `coordinator.ts:242-246`). As a result, no decision content, handle or page text is recoverable after a run.
- **The Lab stops waiting before Core's recovery finishes.** `RECOVERY_RECORD_WAIT_MS = 300_000` at `packages/test-runner/src/flow-lane/terminal-run-wait.ts:124`, and run 1 ended `unsettled: "recovery"`.

## What to do next

1. **Re-measure the stall on Core 8b56084** before treating cause 1 as open.
   It touched every run.
2. **Causes 3 and 8 together** would have produced a Flow in runs 2 and 4:
   write the proposable steps when the budget ends, and report every
   completion gate and the exact limit on the first attempt. The repair loop
   would then have something to improve.
3. **Cause 6** is the only new cause that let a wrong Flow through as
   complete.
4. **Cause 7** needs a closed code per guard before it can be fixed at all.
