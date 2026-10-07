# Intake B: Codex infrastructure chain (t296-t337)

Worker: intake-infra-chain. Read-only, 2026-10-07. Heads: downstream `dev` 53324d18 (product source as of b8a158f8), Core `dev` a2672def. Also read the fxwork t334/t335/t337 trees (git status/diff only, nothing changed).

## Outcome

Done. Plain-English answers first, file:line evidence under each section.

**Summary.** About a third of t296-t337 changed what the product does by default: the acceptance fence, build identity, Stop/cancel, the typed browser fixes, the extra fixtures, and turning chat builds into candidate drafts. The rest, roughly 8,000 inserted Core lines across t300/t304/t309/t313/t317/t320/t323/t325/t329/t331/t332, is infrastructure that no default caller reaches. It only runs when a caller passes `commandOutcomeMode: "required"` or builds the canonical SQLite authority by hand, and nothing in production does either; only tests do. Meanwhile t330 switched every evidence-guided chat and panel build to "candidate" mode. That mode always ends in a draft with `promotionAllowed: false`, and nothing exists that promotes it. The Lab creation lanes are hard-refused until the whole chain exists. The chain the Current State calls "required before promotion" has about ten links. One is in place (the required-mode executor and consumption, for a Core-only subset of nodes), two are partial (native web execution, click only and uncommitted; detached candidate execution, test-only), and the rest are absent. At least three are very large: trusted requirement interpretation, the closed writer host covering every writer, and original-ID adoption. Most of the chain is restart/duplicate-effect and storage-integrity hardening. The consultant revision schedules that for Oct 29-Nov 4, or does not ask for it at all. Here it has been pulled ahead of the P1/P2 vertical slice.

## What changed and why

Only this report file was created. No source, docs, builds or tests were touched.

## 1. One line per unit

"Default" means a production path reaches the unit without an opt-in flag or test-only construction.

| Unit | What it does | Reached by default? |
| --- | --- | --- |
| t296 acceptance-fence | Result-check agreement needs a second affirmative verdict. Unsupported held-repair topologies are refused before applying. | **Default.** Core `result-verification/agreement.ts`, `runtime-adaptation/held-candidate.ts`, `repair-rerun.ts` |
| t297 lab-build-identity | Extension background and content report their build identity; the Lab asserts it. | **Default** in the extension (`background/diagnostics/build-identity.ts`); the assertion is Lab-only. |
| t298 build-cancel-control | Stop button, cancel endpoint, `AutomationStudioBuildCancellation`. | **Default.** Core `service.ts:388,1471-1474`; extension `panel/chat/stop-control.ts` |
| t299 candidate-authoring | Candidate draft store, candidate generation and submission. | **Default since t330** (chat build), `service.ts:1552-1570` |
| t300 candidate-evidence-gate | Verification controller, predicates, detached candidate execution. | **Test-only.** `AutomationStudioCandidateVerificationController` and `runAutomationStudioDetachedCandidate` have no non-test caller. |
| t301 typed-browser-readiness | Checkbox state, list-change detection, type permission. | **Default** (content scripts, domain plan resolution) |
| t302 core-runtime-identity | Core build identity plus a diagnostics endpoint. | **Default** endpoint; the assertion is Lab-only. |
| t303 browser-navigation-readiness | Navigation landing/outcome refactor in `runtime/navigation/`. | **Default** (extension) |
| t304 durable-candidate-receipts | Durable candidate-verification store and session. | **Test-only.** `AutomationStudioCandidateDurableSession` is used only in tests. |
| t305 loaded-domain-host-identity | Host build identity at `bindNativeNodeRuntime`. | **Default** binding; the assertion is Lab-only. |
| t306 meaningful-assert-wait | Assertion and wait evaluation. | **Default** (content) |
| t307 atomic-project-graph-import | Atomic monolithic-to-graph import. | **Default.** `service.ts:1854` `importMonolithicFlowGraph` |
| t308 professional-paginator | Fixture paginator. | Lab fixture only |
| t309 staged-project-authority | `storage/project/accepted-state/` snapshot store. | **Test-only.** Only re-exported from the barrel; no importer. |
| t310 executing-server-adapter | Web server/gateway build identity. | **Default** read; the assertion is Lab-only. |
| t311 command-session-binding | A result from the wrong session cannot settle a pending command. | **Default.** Core `client-gateway/service/commands.ts` `settle()`, `inbound.ts` |
| t312/t316/t318 qualification fixtures | Ten new tasks (67 total), fixture state. | Lab fixtures only |
| t313 durable-command-reconciliation | Gateway command-ledger controller plus project SQL ledger. | **Opt-in.** Reached only through the durable `executeAction(…, options)` overload (`commands.ts:74`). |
| t314 user-script feasibility | Playwright probe. | e2e test only |
| t315/t319/t321 typing | Sanitized typing, target liveness, observation window. | **Default** (content `actions/type.ts`) |
| t317 durable-gateway-production-seam | Durable dispatch, command-context controller. Wired into `resolveCommandLedger` (`_shared/runtime.ts:73`). | **Wired, idle.** A context is only minted in required mode, so default dispatch never takes it. |
| t320 original-project-authority-guard | Authority-guard SQL records. | **Test-only.** Only canonical-authority code uses it, and nothing constructs that (see t325/t332). |
| t322 / t326 / t328 | Reports and checkpoints only, no product source. | n/a |
| t323 command-run-admission | Closed one-command run admission. | **Opt-in** (required mode) |
| t324 requests-policy-foundation | Requests OFF policy and Settings field (disabled). | **Default** (settings, `domain/src/requests/policy/`) |
| t325 canonical-owner-routing | Canonical SQLite owner store and project coordinator. | **Test-only.** `createCanonicalAutomationStudioSQLiteRepositories` (`storage/sqlite-repository.ts:78`) has no production caller; production uses memory repositories (`service.ts:402`, `_shared/runtime.ts:64-70`). |
| t327 runtime-gateway-event-authority | Compatibility `client.action_result` no longer emits `command.result`. | **Default** (`runtime/client-gateway-transport.ts`) |
| t329 command-outcome-consumption | Consumed-outcome contract on the ledger. | **Opt-in** (required mode) |
| t330 creation-callers-draft-only | Chat build, create-here, explore, improve and the panel's "Explore and build" send `authoringMode:"candidate"`. The Lab creation lanes always throw. | **Default.** `conversations/commands/build.ts:33-38`; downstream `test-runner/src/flow-lane/creation/readiness.ts:4-5` |
| t331 actual-executor-effect-propagation | Executor split (`node-execution/attempt.ts`), required-mode node entry, issued context and consumption; domain `dispatchWithCommandContext`. | **Mixed.** The refactor sits on the default path (behaviour preserved). Every new branch is gated on `options.commandRun`, which is set only in required mode. |
| t332 whole-writer-ingress | Canonical whole-operation for new project and Flow creation. | **Test-only.** `CanonicalAuthorityWholeOperation.fromFactory` (`whole-operation.ts:34`) has no non-test caller. Writers accept an optional `authority` that is never supplied (`flows/writer.ts:57`). |
| t333 original-source candidate bridge | Candidate builds bind the full original instruction inventory (schema v2). | **Default** on the candidate path (`service.ts:1499-1507`). A build without bound active instructions now fails before any provider call (`flow_bootstrap.active_instructions_required`). |
| t336 atomic fixture reset provenance | Scenario-lab reset and reseed publication. | Lab only (`apps/scenario-lab`, `test-runner/flow-lane/reset-scenario-lab.ts`) |
| t334 / t335 / t337 | Uncommitted. See section 4. | None |

## 2. The "required mode" executor (t331, extended by t334)

**Callers by default: none.** Required mode is turned on only by `commandOutcomeMode: "required"` on `runRuntimeSession`. The only callers in either repository are tests (downstream `domain/src/io/tests/required-context.ts:42`). Normal Flow runs, the build loop's node runs and saved-Flow playback all call `executeAction` with two arguments. That is the legacy, non-durable, in-memory pending path (`domain/src/io/gateway-output-dispatcher.ts:31`, `runtime/llm-evidence/node-run/run.ts:367`, `capture.ts:528`; the durable branch is taken only with a third argument, Core `client-gateway/service/commands.ts:74`).

**Supported nodes on dev today.** Core built-ins only: the control-flow, data, logic, math, random and timing families, plus `builtin.policy.action` and `builtin.policy.recovery` (`executor/node-execution/attempt.ts:39`). Anything else with an `execute` is refused (`:63-64`). The only effect allowed is `policy.output.dispatch` (`:233`). Canonical Call Flow composites are allowed only through the registered owner (`:134`).

Every web step a model authors is a domain native node (`web.output.dom-*`, downstream `domain/src/output-nodes/definitions.ts:180-198`) and runs through `nativeNodeExecutor` (`native-runtime.ts:101-105`). Required mode skips that executor (`attempt.ts:113` `!options.commandRun ? … : undefined`), then stops the run with `executor.unsupported_native_or_composite` (`attempt.ts:134-135`).

**A Flow with type, select or read-list nodes in required mode:** the first such node stops the command run and throws before any browser effect. The run ends failed through `endFailure`. Core nodes that ran earlier have already executed. Required mode also refuses adaptive or repair modes (`service/command-execution/lifecycle.ts:17`), resuming an existing session (`:20`), and runs without project SQL storage (`:16`). It forces `no_llm_intervention` (`service.ts:2521`), which rules out live repair, the main thing adaptation needs.

**With t334 (uncommitted):** native nodes in required mode go to a separate private "required executor". It has exactly one descriptor, `web.output.dom-click` / `web.dom.click` (t334 downstream `domain/src/output-nodes/required-output/owner.ts:8,20`). Type, select, extract_list and next_page would throw `native_output.unsupported_definition` (t334 Core `native-node-runtime.ts`, `#executeRequired`). extract_list and next_page have their own dispatch shapes (`native-runtime.ts:84,88`) and record capture, so each needs its own descriptor and proof.

## 3. The chain required before promotion and qualification (Current State, "Production sequence still required")

| # | Link | State | Evidence | Rough size |
| --- | --- | --- | --- | --- |
| 1 | Required-mode executor with fences (next-node, state, timeout, child, retry) | **Exists**, Core-node subset only; adaptive/resume refused | t331; `lifecycle.ts:13-20`; `attempt.ts` | done |
| 2 | Authentic consumed command outcome | **Exists in required mode only** | t329/t331 `attempt.ts:265-269` | done (unused) |
| 3 | Native production execution of typed web nodes | **Partial.** Click only, uncommitted; browser proof not yet passing | t334 report "Browser implementation" | L: about 15 more actions, with extract_list/next_page/record capture the hardest |
| 4 | Candidate full requirements (trusted interpretation) | **Absent.** t337 is a proposal for one sentence family | t337 report, grammar section | XL / open-ended (see §4) |
| 5 | Actual declared browser/document start | **Absent** in the product. t336 is a Lab fixture reset producer only, which its report says is "not browser/start/causal proof" | Current State line 37 | M |
| 6 | Private exact oracle and effect attribution | **Absent.** The `observe` port is declared with no implementation | Core `flow-bootstrap/verification/contracts.ts:104` | L |
| 7 | Detached candidate execution through the normal runtime | **Partial, test-only** | `verification/detached-execution.ts:13`, no caller | M |
| 8 | Independent installation and closed host gating every retained/direct writer | **Absent.** t335 partition A (installer only) is uncompiled; B/C not started. The t335 report lists 9 ingress families, about 177 public service methods to refuse, and six unguarded canonical kinds | t335 report, "Complete closure prerequisites" | XL |
| 9 | Original-ID adoption (offline, drained) | **Absent** | t335 report | L |
| 10 | Complete non-repair capture, all writers | **Absent.** t320 guard plus t332 cover new-project creation only, and only in tests | `whole-operation.ts:34` | L |
| 11 | Pinned reads | **Absent** | t335/t337 reports "remain distinct dependencies" | M-L |
| 12 | Sole accepted original-project CAS promoter | **Absent.** Port declared, returns `unsupported_storage_authority` as a valid answer | `verification/contracts.ts:106` | M, after 8-11 |
| 13 | Lab readiness hold lifted | **Unconditional throw** | downstream `flow-lane/creation/readiness.ts:4-5`, called at `build-proposal.ts:362`, `chat/build-from-chat.ts:92`, `lane.ts:338`, `review-proposal.ts:26` | follows 1-12 |

Measured against Codex's own output (one unit is about 400-1,200 lines and a day or more with review), the absent links come to roughly 10-20 more units before a chat build can produce a promoted Flow through this path. Links 4 and 8 may not converge at all at the current level of strictness.

## 4. Uncommitted t334 / t335 / t337 work

**t334 (fxwork/t334, Core based on a2672def, downstream on 2affcc28, one commit behind dev).**
- Core: about 225 changed lines across 12 tracked files plus a new `runtime/native-output/` (165 lines with its tests). Covers the native-runtime private required-executor registry, an `attempt.ts` branch, the service private field, and a controller `acceptsNativeExecutor`.
- Downstream: 74 changed lines (`native-runtime.ts`, `web-panel-host.ts`), new `domain/src/output-nodes/required-output/` (126 lines) and `apps/extension/e2e/native-command-authority/` (177 lines).
- Completeness: the report says the root types, the 96 focused cases and the build all pass, the actual browser probe failed on a fixture bug (`session.state` vs `session.status`), and the native browser proof is still pending.
- Shared docs: the Core tree also holds **uncommitted edits to Core `docs/working/mvp-final-month-plan.md` and `docs/working/README.md`** (a root ledger entry, "t334 root exact native service binding under verification"). Removing the worktree would lose them.
- Safety: additive. The legacy path is unchanged, since every change is gated on `commandRun` or the new descriptor. It has no default-path effect, because nothing runs required mode.
- **Recommendation: park.** Commit to its task branch as WIP so the ledger notes and source are kept. Do not merge to dev until it is decided whether required mode is the MVP execution path.

**t335 (fxwork/t335, Core based on 5eac215b, two task merges behind).**
- New `storage/closed-host/` (408 lines including a 137-line test) plus two barrel exports. Downstream has only the report.
- The report says "No source builds or tests have run yet". It is an exclusive first-install journal (`.fluxiq-installation`) for a closed writer host that does not exist and that no caller selects.
- Safety: new files only. Dropping it loses only unvalidated code.
- **Recommendation: drop, or park without merging.** It is the first of at least three sub-partitions (A/B/C) of link 8 and has no MVP consumer.

**t337 (fxwork/t337).**
- Only a 10-line untracked test (`verification/tests/identity.test.ts`) that imports a two-argument digest signature that does not exist yet, plus the 117-line report. The "released" interpretation source was never written.
- Content: a closed, anchored English grammar, `"Fill in the form with <v> as the <field> and the <option> <field>, then submit it."`. It supports CREATE form submission only. It marks scheduling as unknown and says it "cannot certify the entire form task executable from pure-click support" (report "Ordering/method qualifier review").
- One hand grammar per task family cannot cover a 67-task, arbitrary-instruction product without a model-based interpreter, and the plan currently forbids a model-supplied "complete" flag.
- **Recommendation: drop the source. Copy the report to dev if the analysis is wanted.**

## 5. MVP-blocking vs release hardening (consultant revision)

**MVP-blocking and done:**
- P0 (`consultant-revision.md:147-170`): t296 fence, t297/t302/t305/t310 identity, t298 Stop/cancel, and the receipt seam definition (t300 contracts).
- P3 browser blockers (`:229-248`): t301/t303/t306/t315/t319/t321.
- Fixture readiness: t308/t312/t316/t318.

**MVP-blocking, P1/P2, and only partly addressed:**
- Candidate submission (t299/t333).
- Declared start and reset (t336 Lab side only).
- Requirement receipts and evidence (t300 test-only, t337 proposal).
- Detached candidate execution (test-only).
- A promotion gate with a base-revision check (`:127-132,199-227`). The consultant asks for "promote atomically… check the base accepted revision". That is one compare-and-swap, not links 8-11.

**Contradiction with the revision.** P1.1 (`:177-178`) says to put the new authoring interface behind a feature flag with "legacy behavior stays available for comparison". t330 instead made candidate-only the default for every evidence-guided chat and panel build, and nothing promotes candidates. The default chat path therefore can no longer produce a runnable Flow (intake A should confirm the user-facing effect).

**Release hardening pulled forward (Oct 29-Nov 4 window, `:395-399,417`: "network drop before/after an effect, late acknowledgement… restart receipts must avoid duplicate effects"):**
- The durable command ledger and required-mode chain: t313, t317, t323, t329, t331 (required parts) and t334.
- Consultant finding 9 (`:92-96`) framed duplicate effects as "a risk to reproduce, not a claimed observed failure".

**Not in the consultant revision at all:**
- Closed writer host, first-install provenance, original-ID adoption, all-writer non-repair capture and pinned reads: t309, t320, t325, t332, t335 and chain links 8-11.
- The nearest requirement is the single base-revision check at `:131-132`. These links are storage-integrity work beyond MVP scope as the revision defines it.

## Commands run and observed results

All read-only:
- `git log --first-parent dev | grep "Merge task t2/3xx"` in both repos. Found merges t296-t333 and t336; no t334/t335/t337 merges.
- `git diff --stat <merge>^1 <merge>` per merge, non-docs, non-test files, written to the scratchpad.
- `grep -rn` for each new owner's exported symbol across Core `packages/fluxiq/src` and `apps/web/src` and downstream `domain/src`, `apps/extension/src` and `packages`, excluding `/tests/` and `dist`. That produced the default / opt-in / test-only classification. Callers found: `commandOutcomeMode` only in tests; `fromFactory`, `createCanonicalAutomationStudioSQLiteRepositories`, `AutomationStudioCandidateVerificationController`, `AutomationStudioCandidateDurableSession` and `runAutomationStudioDetachedCandidate` with no non-test caller.
- `git status --short` and `git diff --stat` in the fxwork t334/t335/t337 trees, plus `wc -l` on their untracked files. Counts are as reported above.

No builds, tests, Lab runs, provider calls or panel.

## Not verified

- No test or build was run, so t334's "96/96" and t331-t333's receipts were not re-checked.
- The default-path refactors in t331 and t303 were not re-run; "behavior preserved" is taken from source shape plus the recorded receipts.
- Size estimates are judgement, not measurement.
- Whether Codex intended required mode to become the default run path at some point: no flag or plan line making it default was found.
- The t337 test's target signature was inferred from the test body.
- The `!FluxIQ` sibling under fxwork/ and the other fxwork trees were not inspected.

## Open questions or contradictions found

1. t330 versus consultant P1.1: the legacy path was removed from chat with no promoter, so a working default became a dead end. The supervisor must decide whether to restore the legacy path behind a flag or build the minimal promoter.
2. Chain links 8-11 (closed host, adoption, all-writer, pinned reads) are not in the consultant revision. They appear to have been added during Codex's execution. Does the user's acceptance require them for the MVP?
3. The t334 Core worktree holds uncommitted shared-doc edits (Core `docs/working/mvp-final-month-plan.md`, `README.md`). They must be saved before any `pnpm task abandon`.
4. Required mode forces `no_llm_intervention` and refuses adaptive mode (`service.ts:2521`, `lifecycle.ts:17`). Even when complete, it cannot run the repair/adaptation lifecycle the Oct 12-23 window requires without further work.
5. t337's per-family grammar cannot scale to the 67-task corpus. A requirement interpreter acceptable to the user probably needs a model, which conflicts with the current "no model complete flag" rule.
