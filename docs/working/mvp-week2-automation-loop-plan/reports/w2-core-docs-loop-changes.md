# w2-core-docs-loop-changes: Core architecture docs updated for the 2026-09-16 loop changes

## Outcome

Done. Four Core docs were updated in place, and nothing was committed. Every
statement below was checked against the code. Files other workers had changed
but not committed were re-checked against `git show HEAD:` (Core HEAD
`c0b04be`). `AS/` = `packages/fluxiq/src/programs/automation-studio/`.

## What changed and why

### `docs/architecture/automation-studio.md`

| Statement changed | Backed by |
| --- | --- |
| Lanes paragraph: the "optional domain validator (node ID and definition ID)" text was replaced with a pointer to one shared domain check. That check covers proposed **and** executed overrides. | `AS/runtime/live-patch.ts` `checkRuntimeTargetOverride`, `preflightAutomationStudioRuntimePatch`, `executeAutomationStudioRuntimePatch` |
| "PIN-authorized review/apply endpoint" (in two places) was **false**. It now says `review-flow-adaptation`, which needs `flows.write` and a gates pass, and no PIN. | `AS/api/handlers/runs.ts` (registration `classification: "authoring"`); PIN rule in `persistence.md` "Which endpoints ask for the operator's PIN" |
| "Persisted Flow settings allow one through 64 LLM calls" now says the settings API still requires a count of 1 to 64, but no run takes its call count from it. | `AS/api/handlers/llm-execution-settings.ts:21`; no reader of `.maxCalls` in `packages/fluxiq/src` outside grants and contracts (grep); `apps/web/.../runtime/run-input-model.ts:116-119`; `.../settings/flow-settings-model.ts:493-497` |
| "failure ... revokes all unused authorizations" now says only a failure **that ends the grant** does this, and a spent call leaves the grant as it was. | `AS/runtime/llm/execution-grants.ts` `settleFailedCall` (605-613), `abandonTimedOutCall` (624-632), `finishCall` |
| Live patch preflight: a target override also needs the domain check. | `live-patch.ts` `preflightRuntimePatch` / `checkRuntimeTargetOverride` |
| "Promotion is gated by successful validation, risk, ..." was replaced with the real gate list: a succeeded trial or replay, or a named approval (read from `metadata.review.approvedBy`); an approval never outweighs a latest failure; not destructive, disabled, or rejected; a linked proposal for a structural change; a target on every patch except `create_subflow`. | `AS/runtime/recovery/adaptation-promotion.ts:22-35, 57-60, 92-97`; `AS/runtime/flow-change/confidence.ts:22-60` (no `kind` counts as a trial, other kinds are not counted) |
| New: review order (typed store, then Bootstrap, then the file-backed applier). Both runtime paths run the gates. The typed store takes `promotionGates` as required, and missing, throwing, or inconsistent gates refuse the apply with a `policy_blocked` event. An older approval is taken from the audit trail. | `AS/runtime/service.ts:3957-3960, 4018-4019, 4798`; `AS/storage/project/adaptation-store.ts` `applyApprovedAdaptation`, `decidePolicy`, `promotionGateVerdict`, `withAuditedReviewer`, `promotionGateVerdictFrom` |
| New: a typed-store apply is one graph patch that writes the whole parameter map and a provenance stamp. A repair lands in `parameterValues.target` for a native node and `parameterValues.parameters.target` for a `builtin.policy.action` node. A payload that is not a plain object is refused, and so is `edit_recovery`. | `adaptation-store.ts` `graphPatchOperationsForAdaptation`, `actionTargetParameterValues` (HEAD lines 436-497) |
| "four guards" became six: cost, tokens, recovery deadline, no progress, unusable decisions, and the patch reserve (moved into the list). It states that a small call count is not the bound. The token guard with a grant is now "per-call total × calls, held to `maxTotalTokensPerRun`". The no-progress reasons gain `unusable_decision`. | `AS/runtime/recovery/progress-guard.ts:41-62`; `recovery/unusable-decision.ts`; `recovery/runtime-exploration.ts:124-150`; `recovery/annotation/exploration.ts:213-243`; `recovery/annotation/patch-reserve.ts`; `recovery/annotation/run-budget.ts:87-127`; `llm/failure-disposition.ts` |
| New paragraph: per-call records at `metadata.llmGate.providerCalls` and `providerCallsOmitted`. It lists the record fields, `reported` against `charged`, the 250-record limit, and says no text is kept. | `AS/runtime/recovery/annotation/annotate.ts:328-346`; `llm/run-call-record.ts`; `llm/run-budget.ts:43-51, 266-269` |
| Flow Bootstrap paragraph: an unusable decision or refused completion is asked again, and 3 in a row (or fewer) end creation as `flow_bootstrap.evidence_unusable_decision`. | `AS/runtime/loop-limits/flow-bootstrap-evidence-loop.ts` (`maxConsecutiveUnusableDecisions`); `llm/evidence-loop.ts:209-272`; `service.ts:1911-1950` |
| New subsection "What a failed call does to its grant": the disposition table (17 pre-send refusals and the authorization codes end the grant; network and model codes spend the call; `http_error` spends the call only on a 5xx) and the conditions under which a spent call keeps the grant. | `llm/failure-disposition.ts` (full table); `execution-grants.ts:370-376, 605-638` |
| New subsection "Repair targets and their refusals": re-aiming at the failed node, `outputId` (with its sources), `matched` or `resolved`, and refusal when no validator is bound. The closed reason table has 10 entries. The refusal is recorded in `metadata.targetOverrideRefusal` and `metadata.runtimePatchAttempts[].targetOverrideRefusal`, and a refused override leaves no adaptation or proposal. | `live-patch.ts:46-95, 181-208, 236-285, 287-333`; `recovery/annotation/patches.ts:98-124`; `annotate.ts:352` |

I re-checked the existing worst-case table against the code and left it unchanged: 26 calls and 100,000 tokens (52,000 output) at USD 2.00; 64 calls and 640,000 tokens (128,000 output); no grant, 144,000 tokens and USD 0.25; `diagnosis_only`, 10,000 tokens and USD 0.25. The sources are `execution-grants.ts:183-204` and `run-budget.ts:93-120`. The exploration defaults are 24 and 24 with a ceiling of 64 (`exploration-budget.ts:101-138`), the recovery deadline is 600 s (`recovery-deadline.ts:37,40`), and the per-call timeout is 20 s by default and 45 s at most (`provider-contract.ts:78-79`).

### `docs/architecture/automation-studio/llm-flow-bootstrap.md`

| Statement changed | Backed by |
| --- | --- |
| "Required intent groups are selected first" now describes how the catalog is filled. Required nodes are reserved first in condensed form (80-character description, no parameter text), then grown to whole form. Preferred and ranked nodes are added whole. The whole-entry limits are 240, 600, and 600 bytes. | `AS/runtime/flow-bootstrap/plan/catalog.ts:6-11, 40-83, 85-106` |
| "invokes the harness exactly once" is now limited to the path without `evidenceGuided`. On that path, parameters go through domain resolution, and a named handle is refused (`handlesIssued: false`). | `service.ts:1963-1985` |
| New section "Plan handles": the `{handle}` and `{handle, location}` shapes, the reserved-shape rule, the malformed limits (64 characters, 2,048-character location, 16 per node), the `resolvePlanNodeParameters` contract and its three answers, Core's 7 refusal codes and the 16,384-byte limit, and `assertAutomationStudioFlowBootstrapPlanHandlesResolved` running at create and at apply. | `AS/runtime/llm/harness-options/plan-node-handles.ts`; `harness-options/binding.ts:81-110`; `harness-options/plan-parameter-resolution.ts`; `llm/harness/structured-response.ts:65-67`; `service.ts:2049, 4098` |
| The post-completion classification paragraph was rewritten. There are now 5 ordered checks inside the loop, including the new `flow_bootstrap.evidence_completion_parameters_unresolved`. Refused plans are fed back to the model (refusal code, up to 16 codes with their paths, and a fixed instruction) and count as unusable decisions. Diagnostics now carry `issueCodes`, which are codes only with at most 16, plus the `core.decision_unusable` and `core.decision_complete` steps. | `harness-options/bootstrap-completion.ts`; `llm/evidence-loop.ts:139-160, 255-270`; `flow-bootstrap/generation-failure.ts:155-182, 243-316`; `flow-bootstrap/decision-step-ids.ts` |
| "malformed output ... fail closed" and "The final plan is parsed and registry-validated again" were replaced: malformed output is asked again, and the proposal is written only from an accepted completion. | `evidence-loop.ts:230-270`; `service.ts:1955-1962` |
| "at most 16 content-free steps" is now 65 (64 decisions plus the initial observation). | `generation-failure.ts:588-605` |
| The target-override validator paragraph now applies to proposed **and** executed overrides, adds `outputId`, says an unbound validator refuses the override, and links to the reason table. | `live-patch.ts` (as above) |
| The build button no longer relies on "one call" as a saved limit. It always asks for one call, and the saved call count is not read. | `apps/web/src/features/automation-studio/authoring/blank-flow-authoring-model.ts:3-15, 120-151` |
| The website exploration request's "four-call ... 48,000 tokens by default" was replaced. The request names no count, so it gets Core's 26 and a 100,000-token run budget, with no confirmation needed. It carries USD 0.25 per call and USD 1 in total. The browser waits 60 s + 600 s + 15 s. The panel describes the run by its bounds. | `blank-flow-authoring-model.ts:17-49, 153-172`; `authoring-commands.ts:4-6`; `BlankFlowAuthoringPanel.tsx:9, 22-27`; `execution-grants.ts:183, 195-196, 247` |
| The confirmation dialog rule changed from "per-call × calls" to the run budget (or the per-call total if larger). Only a preflight with no budget falls back to per-call × calls, and an unreadable budget asks for confirmation. | `blank-flow-authoring-model.ts:60-74`; `BlankFlowAuthoringPanel.tsx:149` |
| "The standard PIN-protected review endpoint" was **false**. It is now `review-flow-adaptation`. | `AS/api/handlers/runs.ts` |

### `docs/architecture/automation-studio/persistence.md`

| Statement changed | Backed by |
| --- | --- |
| Run-detail metadata: added `llmGate.costAccounting`, `providerCalls`, and `providerCallsOmitted`. | `annotate.ts:328-346` |
| "rebuilds and re-saves it from the durable runtime session" is kept. Added: every save is serialized per run and merged onto the stored detail, so a rebuild never removes `llmGate` or the adaptation context. Only a session with no stored detail is rebuilt, and an index that is present but unreadable is an error. | `AS/runtime/service/summaries/run-detail-writer.ts:14-40`; `run-detail-merge.ts:1-40, 51-70`; `summaries/store.ts:109-114, 144-160` |
| New paragraph on typed-store adaptations: `promotionGates` is required; the `policy_blocked`, `stale_base`, and `apply_failed` audit events; the whole-map write and stamp, with an inverse `rollback` artifact that also removes the stamp; the `parameters.target` write; and `listAdaptationsPage` filtering on `failureSignature` and `confidenceTier`. | `adaptation-store.ts` (`applyApprovedAdaptation`, `graphPatchOperationsForAdaptation`, `actionTargetParameterValues`, `listAdaptationsPage` 104-107) |
| New section "Adaptation Matching Migration" for migration 0020. It covers the three columns with their checks and derivation rules, the two indexes, that the columns are nullable and the migration rewrites no row, and the backfill in batches of 200 on store open. It also says a 0.5.0 build still works on a migrated database. | `AS/storage/project/schema/adaptation-matching.ts`; `adaptation-store.ts` `adaptationMatchingColumns`, `mapUnmappedAdaptations`, `MATCHING_ASSIGNMENTS` on every insert and update; `AS/storage/schema-migrations.ts:88-107` (unchanged since before 0.5.0: `git merge-base --is-ancestor e55a141 0e5c447`); 0.5.0 store at `0e5c447` names its insert columns and maps rows by name (`summaryFromRow`) |

### `docs/architecture/package-boundaries.md` (0.6.0 migration note; only statements that were false)

| Statement changed | Backed by |
| --- | --- |
| "None of it is forward-only: no table ... changes shape, nothing is rewritten on load" was **false**. It now says one table gains columns (0020), the store fills them on open, and a 0.5.0 build still works. | same as the migration row above; `fluxiq` is still `0.6.0` |
| "Patches run live. Each patch the Flow's policy permits is run" was **false** for target overrides. It now adds that the domain validator must accept the override. | `live-patch.ts` |
| Added to the `validateTargetOverrideEvidence` bullets: it judges executed overrides too, an unbound validator means refusal (`domain_check_unavailable`), the argument gains `outputId`, and the refusal `reason` comes from the closed list. | `live-patch.ts:55-95, 195-203, 240-247` |
| "Applying. An adaptation now needs a succeeded validation result, or an `approved` audit event" was **inaccurate**. It now says a trial or replay (a result with no kind counts as a trial, other kinds don't count), the reviewer is read from `metadata.review.approvedBy` (the typed store also accepts the audit event), and a latest failure blocks the apply. | `adaptation-promotion.ts`; `confidence.ts:22-26`; `service.ts:3988`; `adaptation-store.ts` `withAuditedReviewer` |
| New bullets: the typed store's required `promotionGates`, and the `parameters.target` write for policy actions. Before this commit the target was written beside the payload. | `adaptation-store.ts`; `git show c0b04be` removed line `else values.target = patch.after as JsonValue;` |
| "Old records ... are not rewritten" now says their detail is not rewritten, only the new columns are filled, and an old succeeded result counts as a trial. | `adaptation-store.ts` `mapUnmappedAdaptations`; `confidence.ts:24` |

## Commands run and observed results

- `node scripts/structure-audit.mjs` (Core root): exit 0. It printed `structure-audit: passed (153 warning(s), 355 baselined).` The output was saved to the scratchpad `w2-core-docs-audit.txt`, and none of its warnings name a `docs/` file.
- `node scripts/structure-audit.mjs --rule docs-links` (Core root): exit 0. It printed `structure-audit: passed (0 warning(s), 0 baselined).` This rule checks local links **and** heading anchors, including the new `#repair-targets-and-their-refusals`, `#what-a-failed-call-does-to-its-grant`, `#plan-handles`, `#grant-bound-generation-command`, `#llm-assisted-deterministic-automation`, and `#iterating-adaptations-and-their-bounds`.
- Core's root `check` is `pnpm structure:test && node scripts/structure-audit.mjs && pnpm -r check`. Each package's `check` is `tsc --noEmit`, so the structure audit is the only part of `check` that looks at docs.
- `git diff --stat -- docs/architecture/` printed `4 files changed, 420 insertions(+), 101 deletions(-)`.

## Not verified

- I did not run `pnpm docs:reference` because the brief forbids it. I also did not run `node scripts/docs-reference.mjs --check`: it is not part of `check`, and it reflects code other workers are still editing. The generated reference was not regenerated.
- I did not run `pnpm structure:test` or `pnpm -r check`. They cover code only, and this change touched no code.
- The 0.6.0 note's "182 names are newly exported" was **not recounted**. It is probably stale, because several exports landed after that note, including the failure disposition, unusable-decision, plan-handle, completion-check, and refusal-reason modules. Recount it after `pnpm docs:reference`.
- The cost figures in the worst-case table (USD 0.09 and USD 0.39) are arithmetic I re-did, not measured runs.
- I did not check that an older build actually opens a 0020-migrated database by running one. That claim rests on reading the 0.5.0 migration runner and store code.

## Open questions or contradictions found

1. **The Bootstrap apply gate is not wired.** `evaluateBootstrapAdaptationApplyGates` (`adaptation-promotion.ts:42`) has no caller outside tests. `applyFlowBootstrapAdaptation` (`service.ts:4091`) still accepts any `validated` status, so Bootstrap apply does not follow the evidence rule that function's comment describes. The docs do not claim it is wired.
2. **In-flight code other workers had not committed** (not at HEAD, so not documented): `live-patch.ts` (trial verdicts, a `remainingSteps` input), `service/adaptations/patches.ts` (the file-backed applier adopting `actionTargetParameterValues`), `flow-change/action-target-parameters.ts` (the helper moved), and `recovery/annotation/{annotate,exploration,patches}.ts`. When those land:
   - "for at most 50 steps" (in `automation-studio.md` "What the shipped app reaches" and in the `package-boundaries.md` explore bullet) may become false.
   - The "In the typed store" qualifier on the `parameters.target` rule can be dropped.
   - The persistence.md sentence "Successful temporary fixes may create validated adaptations" should be re-checked. I did not change it; it was outside this brief's topics.
3. **Code and comment disagree on `domain_check_unavailable`.** The comment says the reason is "Never passed through", but `automationStudioRuntimeTargetOverrideRefusal` keeps it when a domain supplies it, because `Object.hasOwn` includes that key. The docs do not claim domains cannot send it.
4. **The 0.6.0 note is missing changes that landed after it at the same version.** These are host-visible:
   - failed calls only spend a call instead of revoking the grant;
   - `resolvePlanNodeParameters`;
   - the evidence-loop `unusableDecisions` and `checkCompletion` options;
   - the new Bootstrap failure codes and `issueCodes`;
   - the run-detail merge-on-save.

   None of these is a false statement, so I did not add them (the brief's scope). Whether to add them, or to bump past 0.6.0, is the supervisor's call.
5. Beyond the six listed topics, I fixed the false "PIN-authorized/PIN-protected review endpoint" wording, because it sits directly beside topic 6.
