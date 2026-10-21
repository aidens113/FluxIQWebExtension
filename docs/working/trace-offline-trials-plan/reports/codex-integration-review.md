# Codex integration review, 2026-10-20

## State

Recovery in progress. t753 accepted and merged in both repositories (downstream daabd593, Core d1c39c0a);
t751 and t752 remain in their isolated task trees.
Recovery documentation pushed on both dev branches: downstream `9c29db20`, Core `5f92d155`.
The user's `.clinerules/fluxiq.md` edit remains uncommitted and untouched.

## Independent review findings

- t751: candidate contracts gain witness stamps, t752 adds earlier-advice context to the same contract. Preserve both on integration.
- t751: new unidentified project actions must not enter through legacy admission; standalone compatibility needs an explicit boundary.
- t751: admission must precede preparation hooks and baseline mutation at candidate, subflow, predecessor, whole-run and phase-start doors. Reject model-supplied stamps.
- t752: original located-defects code proves references exist, not that a claim about a row is true. Compare measurable claims with stored cells/conditions; do not treat existence as semantic proof.
- t752: earlier advice is context, never authority over the original request. Changing a revision does not prove advice was followed or correct. Keep older relevant advice.
- t752 follow-up confirmed by worker: claimed-value comparison used exact column keys while grounding accepted fuzzy aliases, permitting skipped contradictions. Resolve a unique canonical column conservatively. Advice keyed/filtered by revision also discarded prior advice on same-revision retests and rebriefs; retain ordered completed-trial history. Both require tests and fixes before acceptance.
- t752: preserve absent versus explicit empty defect lists, and non-row failures such as ordering, formatting, required fields and lasting actions. Unknown correctness remains nonpromotable.
- t752 final parser review: current `loop_verification` dispatch passes an explicit strict flag into provider decoding, so persisted-record compatibility does not exempt current replies. Minor integration cleanup pending: remove the unused strict flag accidentally added to the private structured-response helper, and reconcile old comments about dropped defects with strict current-negative rejection. Do this during the required integration rebuild, not during the worker's frozen build.
- t753: inherited UI change incorrectly classified successful zero-row reads as failed. Preserve transport/domain outcome and report empty results honestly.
- t753: verify actual rendered extension text, not just Core wording. Browser evidence must distinguish the content harness from real gateway delivery.

## Supervisor checks observed

- Initial main `git status --short`: only the user's `.clinerules/fluxiq.md` edit downstream; Core clean.
- Initial `git rev-list --left-right --count dev...origin/dev`: `0 0` in both repositories.
- `git diff --check` in all six task worktrees: exit 0 before subsequent recovery edits; whitespace check only.
- `pnpm.cmd structure:baseline` in both main repositories: exit 0; downstream 651 baseline entries, Core 1155; neither grew.
- Final documentation-only `node scripts/structure-audit.mjs --update --rule working-docs`: exit 0 in both main repositories.
- Both documentation pushes completed with pre-push structure audits enabled. No hooks bypassed.
- t753 stable UI slice: supervisor ran `pnpm.cmd test src/ui/activity-action src/ui/person-facing` in its paired Core `packages/fluxiq`: parallel `Test Files 14 passed (14)`, `Tests 277 passed (277)`; real-SQL selected no files and exited 0; runner ended `all groups passed: parallel, real-sql` (native exit 0). This accepts that slice only; integration and browser checks remain.
- t751 stable reset slice: supervisor ran `pnpm.cmd test src/programs/automation-studio/runtime/flow-bootstrap/reset-admission src/programs/automation-studio/runtime/flow-bootstrap/reset-settlement`: parallel `Test Files 9 passed (9)`, `Tests 70 passed (70)`; real-SQL selected no files and exited 0; `all groups passed: parallel, real-sql`, native exit 0. Integration/trial-entry and browser gates remain separate.
- Chromium UI images independently inspected and preserved at `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-21/codex-t753-ui-review/` (`chromium-company-website-chat-ending-overlay.png`, `chromium-job-board-chat-ending-overlay.png`). Both show compact non-stuttering overlay text in clear edge bands and plain ending text. The chat frames omit full panel context/base typography and composer, so this is partial-renderer evidence, not full chat-surface acceptance. Worker asked to correct harness styling/context without altering product CSS to compensate.
- Refreshed full-panel Chromium images independently inspected and preserved as `chromium-full-panel-company-website.png` and `chromium-full-panel-job-board.png` in the same evidence folder. Real panel shell/theme/chat renderer/composer now present, ending is plain, composer remains visible at both panel and popup sizes. Source inspection confirms the test actually types/sends after the failure and asserts one send. Still scripted Core replies/content harness, not authenticated gateway generation. Firefox review exposed a possible thin-text sampling gap; owning reproduction/fix pending.
- Final adaptive Chromium/Firefox images preserved in the same external evidence directory (`chromium-adaptive-*`, `firefox-adaptive-*`). Supervisor inspected Firefox: header, hero heading, statistics and composer clear at actual panel/popup dimensions. Browser logs observed: Chromium 12 passed, Firefox 2 passed. Firefox probes remain slower (company 361–401 ms per measured check); this is an explicit limit, not a claimed speed improvement. Supervisor independently reran final overlay owner folder: 82 passed/0 failed, native exit0.
- t752 corrected changed-owner grouped gate: 32 files/362 tests passed; real-SQL none, runner all groups passed, native exit0. Includes tracked changed owner fixtures, located-defects and earlier-advice tests; untracked current-negative route19 was passed by worker and is explicitly required again in integration. All earlier failing owner files have passing focused coverage; no full suite used.
- t753 merged-source review found earlier whole-run counts omitted from candidate-less endings after a refused later assembly. Worker confirmed reachability through submission clearing the current candidate; bounded failing regression then fix preserves history without inventing a current assembly. Supervisor reviewed the two-file diff; owning gate reported 17 tests passed. Integrated gates/build still required.

## Integration gates still required

- Workers finish and leave stable trees; inspect final diff and reports independently.
- Commit coherent task units with Task/Worker trailers, integrate current dev in both trees, regenerate framework reference through its owner if needed.
- Rebuild paired Core; confirm downstream Core-build currency; run affected package typechecks, owning grouped tests, prompt contracts and audits.
- Inspect provider-free headed browser results and UI screenshots. Record actual browser/target and limitations.
- Finish downstream before Core, preserving each task's merge boundary; push both dev branches together after acceptance.
- Begin P6 only after t751 is integrated. No paid round with known fixes in flight; full sweeps remain subject to the daily limit.
- P6 integration review must also cover t753's new whole-run ending counts: recorded/offline evaluations cannot inflate the number of live episodes. t752's automatic disclosures may be unsupported on inert snapshots; those must become explicit gaps, never implicit live clicks.

## t753 acceptance

Observed post-merge gate report/logs: Core 1633 parallel +111 real-SQL tests, web79, domain432, extension1131,
affected package typechecks, both structure audits, current stamped Core/domain builds. Supervisor docs:check exit0.
Downstream task finish's audit passed; Core task finish's mandatory3prompt-contract files/64tests passed.
The full Core check was skipped because these narrow gates were actually run and the user limits full sweeps.
Both task merges and paired ledger/baseline updates are pushed: downstream858773fc, Coref08dc4a6.
Main Core and domain ignored builds were regenerated successfully after the merge; extension bundle regeneration is running.

Root's two t751 fixture files now pass a cleaned grouped two-file gate: real-SQL11tests; emptyparallel0; allgroups0.
Temporary diagnostics removed. Remaining Core witness issue: a bare own-list/control stamp depends on optional
runtime diff data and may lose its original witness. Worker is correcting actual retained witness provenance.
P5/t752 review also found unsupported automatic disclosures could become answered failures; source correction
passes root's independent22-case offline reevaluator gate, and realistic browser proof is still required.

## 2026-10-21 owning-gate follow-up

- Supervisor t752 grouped owner gate uses `runtime/result-verification` (an earlier mistaken `runtime/service/result-verification` selected no tests and counts as no validation). Correct owner gate exposed more existing route fixtures missing current structured defects and stale re-ask assertions. Worker owns migration of these newly failing files; the supervisor's three run-outcome fixture files remain stable and pass again. Final build stopped to avoid stamping known stale inputs.
- Supervisor owns t751 `service/project-build/tests/project-build-reset.test.ts` and `project-build-trial-reset.test.ts` exclusively. Added complete resource-bound original inventories and matching action identities. First run: 8 failed/3 passed; own-trial reset refusal/undo/passing run now works, but dependent-entry setup and old cannotUndo expectations require migration. No result from these two files is accepted yet. Worker owns shared resolution helper, single-subflow/brief-ports fixtures and production strict-stamp correction.
- t751 worker reported a genuine fail-first regression: a destination-stamped project trial without a diff spot incorrectly inherited legacy settlement. Fix must retain explicit standalone compatibility. Browser photo dialog is preservation only; pristine-pair page-order is genuine fail-first. Do not claim dialog reproduced the original paid-run failure.
- t753 thin-text regression reproduced first; adaptive fine sampling now confirms only coarse-clear placements. Worker reports 82 overlay unit cases passing, occupied-page probes unchanged at672; final headed browser measurements pending. Pathological all-fixed scan cost remains unchanged at20132 probes and is not represented as a performance improvement.

## Supervisor implementation partition: t752 fixture migration

Worker t752 excludes these Core files while the supervisor updates them:
`result-verification/tests/run-outcome.test.ts`, `run-outcome-repair.test.ts`, and `run-outcome-harness.ts`.
Migrate current negative provider fixtures to the structured defect contract. Keep genuine supported negatives negative;
empty/action-only claims without evidence must remain unverified. Preserve independently proven refutation and repair-route coverage.
No other t752 file is in this supervisor editing partition.

## Current checkpoint after independent retained-witness verification

- t751 supervisor service fixtures are frozen and passed the clean two-file real-SQL gate:11tests, native0.
- Independent retained-witness gate passed3files/36tests: trial-witness18, toggle-baseline5, witnesses13; real-SQL selection empty, allgroups/native0. External evidence survives at lab-runs/2026-10-21/codex-t751-review/supervisor-retained-witness-tests.log.
- Worker corrected retained control originals, exact resource matching and control-only repeat receipts. Final review then found exploration could still admit a declared control without an actually captured original, and custom project tools could bypass the run-node-specific check. Required bounded closure is authorized, tests first; no reset build or acceptance until this every-door invariant holds. Explicit standalone legacy compatibility remains.
- t752 integrated owner run:315parallelfiles/2463tests, exactly2 stale label assertions; real-SQL1file/3tests passed. Root reviewed the two assertion diffs: they now require the concrete PART contradiction rather than a generic unsupported label while preserving unsure outcomes. Focused two-file rerun7tests passed, native0; Core types passed. One frozen Core build is running before downstream/browser gates.
- Independent package export cleanup is dispatched as t754 in its own paired worktrees; no P6 implementation has started before t751 integration.
