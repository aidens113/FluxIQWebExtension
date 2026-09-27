# t182 — Authored documentation impact

Status: Complete
Repository scope: `F:\!FluxIQWebExtension` and `F:\!FluxIQ`, read-only except this report
Date: 2026-09-26

## Verdict

Authored current-state documentation **must be updated before this change set is released**. Seven existing documents need reconciliation; no new architecture document is warranted. The largest problem is not omission but contradiction: Core's main architecture still says provider retries are unsupported, grants restrict task kinds, verification-stage failures are never retried, and `modify_existing` is permission-gated. The integrated source now implements the opposite contracts.

Recommendations below state only facts present in the integrated source or completed worker reports. Live effectiveness remains unverified and must continue to be labelled that way.

## Required updates

### P0 — `F:\!FluxIQ\docs\architecture\automation-studio.md`

This is the canonical Core current-state document and has four stale areas.

1. **`LLM-Assisted Deterministic Automation` / grant and provider paragraphs.** Remove or revise the statements that hidden retries are unsupported, Flow settings enforce a zero-retry provider policy, a grant purpose restricts task kinds, and the production resolver refuses calls outside a purpose-specific task list.

   Proposed facts:

   - Every provider call passes through the default provider-retry seam. A typed temporary provider fault may be attempted at most three times total; deterministic refusals and the per-call deadline timeout are not retried there.
   - An execution grant carries `providerRetryCount` from 0 through 2, default 2. The resolved allowance is clamped to remaining grant uses minus the current call; each provider attempt consumes and settles a real grant use, so the last remaining use permits no retry.
   - Grant purpose remains part of issuance, API/runtime-lane compatibility, accounting, and audit metadata, but it no longer gates model work by task kind, dry-run, side-effect, or risk flags. `build_and_adapt` is supported by the internal runtime session path.
   - Provider retry is bounded additionally by its attempt, wait, per-call, per-run, and process ledgers; do not claim a live-provider success because none was run.

2. **`Judging a finished run's result, including an empty one`.** Extend the section beyond verdict/status behavior.

   Proposed facts:

   - `flowShape` steps now include bounded labels and screened authored parameters. `parametersWithheld` names dotted paths whose original authored value was removed or transformed; `flowParametersWithheld` distinguishes a byte-budget omission from a step that simply has no parameters.
   - `loop_verification` receives the same screened step parameters used by repair, plus the conversation and per-step record counts. It still receives bounded result summaries rather than unrestricted rows.
   - A `does_not_answer` verification carries `automation-studio.result-repair-directive.v1`: Core-authored coded findings and fix lines plus optional screened judgement fields (`expected`, `observed`, `advice`) and a `withheld` flag.
   - The directive reaches the synthetic failed attempt and recovery context structurally, independently of the 1,024-character failure prose. Persisted result records keep Core's bounded facts; do not state that arbitrary model prose is persisted.

3. **Runtime recovery paragraphs beginning `Runtime action attempts now carry...` and `Retries are on by default...`.** Replace the blanket rule that only `retryable` records outside `verification`/`confirmation` are retried.

   Proposed facts:

   - `executeAutomationStudioNode` is the single defensive dispatch seam for built-in, output-dispatch, native, and composite nodes; thrown values become classified failed attempts rather than escaping the run.
   - The default policy classifies producer records, thrown errors, and legacy result messages, records every absorbed or refused assessment in the defence ledger, honours bounded retry hints, and applies per-attempt, per-node, and per-run wait ceilings.
   - `verification` or `confirmation` no longer refuses a retry by stage alone. Core asks whether the node could act a second time: read-only or otherwise demonstrably non-acting work may retry; an ambiguous mutating/destructive act is refused unless the node positively declares repetition safe.
   - A terminal non-fatal failure may be continued past under the defensive policy; record exactly what was absorbed or refused rather than claiming every failure is swallowed.

4. **`What a recovery may do that outlasts it` and every permission summary.** Replace the three-class destructive list.

   Proposed facts:

   - Only `move_money` and `delete` are permission-gated. `modify_existing`, `send_or_publish`, and `create_new` do not prompt merely because of their class.
   - The person's instruction remains authority for a gated consequence it explicitly requests. A destructive consequence not covered by the instruction or grant still parks/asks where a conversation port exists and otherwise ends with the structured request.
   - All five declarations remain visible to the instruction/consequence cross-check; narrowing the prompt gate did not erase declarations or weaken mismatch detection.

### P0 — `F:\!FluxIQ\docs\architecture\automation-studio\llm-flow-bootstrap.md`

Update **`Permission on the authoring path`**. It currently names `move_money`, `delete`, and `modify_existing` as destructive and says `create_new` and `send_or_publish` alone bypass the gate.

Proposed replacement facts:

- `AUTOMATION_STUDIO_DESTRUCTIVE_ACTION_CONSEQUENCES` is exactly `move_money` and `delete`.
- `modify_existing`, `send_or_publish`, and `create_new` never cause an authoring permission question solely from their class.
- A build still records all declarations and cross-checks them against the instruction; only an uncovered destructive subset produces `automation-studio.action-permission-request.v1`.
- The existing parked-question/apply-refusal lifecycle remains valid and should stay.

### P0 — `docs/architecture/web-capabilities.md`

Update **`How An Action Runs`**, the **Structured extraction**, **Pagination**, and **Dynamic elements** matrix rows.

Proposed facts:

- Every content action enters the default recovery loop. Target-absent faults use 250/500/1,000/2,000 ms backoffs; other transient blips use 250/500 ms; the defence has a 5-second ceiling and rechecks both its budget and the command deadline after every wait before another dispatch.
- Mutating actions retry only a target miss decided before dispatch. Read-only actions may absorb the full retryable web-code set. `web.dom.extract_list` is read-only only when it does not paginate; a paginating replay could press a control twice.
- The final result text records a bounded account of absorbed faults. Do **not** document a structured gateway recovery field: that follow-up was deliberately not implemented, and the current account travels only in bounded validation/failure text.
- Delete the current Dynamic-elements claim that acting verbs never poll or retry and always require an authored wait. Authored waits remain useful, but are no longer the only defence.
- List extraction now preserves partial/wide answers: an item read fault skips and counts the item; a page-advance fault ends with pages already read; optional fields default to `null` unless explicitly `required: true`; conditions that reject every row return the unfiltered rows and say so.
- Dispatch parsing tolerates and names unreadable optional request parts (`itemElement`, `paginate`, `minItems`, individual `where` clauses) while still refusing a missing/unreadable `item`, `fields`, or frame selection. A condition column may resolve by normalized or nearest measured name; author-facing plan resolution records the assumption rather than silently treating it as exact.
- The extraction summary/result prose now distinguishes selector misses, empty records, incomplete rows, item faults, page faults, wait termination, filtering, pages, and truncation. State which pieces are structured gateway summary fields and which currently exist only in bounded result text.
- New-document pagination resumes from an explicit checkpoint, retaining prior records/pages/item counts and de-duplicating across documents.

### P0 — `docs/architecture/failure-taxonomy.md`

Update **`The Closed Set`** from fifteen to eighteen codes and add the three integrated rows:

| Name | Code | Category | Retryable | Stage |
| --- | --- | --- | --- | --- |
| `BLOCKED_BY_DIALOG` | `web.action.blocked_by_dialog` | `unexpected_state` | no | `execution` |
| `BROWSER_PERMISSION_DENIED` | `web.browser.permission_denied` | `blocked_by_capability_or_policy` | no | `dispatch` |
| `TRANSPORT_TRANSIENT` | `web.transport.transient` | `action_failed` | yes | `execution` |

Also explain the distinctions: an ordinary dismissible interruption is recoverable state rather than human intervention; a manifest/browser-policy refusal is deterministic and must not consume retries; a content-message/frame transport failure happened before the verb was reached and may clear on another attempt. Keep `retryable` defined as producer evidence, while noting that Core and the browser additionally apply side-effect safety before repeating an action.

### P1 — `F:\!FluxIQ\docs\architecture\package-boundaries.md`

Extend **Migration Notes / 0.6.0** because host-visible and public contracts changed.

Required compatibility notes:

- LLM preflight/issue inputs may carry `providerRetryCount`; preflight/grant/resolution metadata now expose a bounded number rather than the literal zero. Valid range is 0–2, default 2, and a resolved grant may report less when remaining uses cannot fund retries.
- A custom provider or resolver must expect multiple separately authorized attempts for one harness request and must preserve typed retryability/status/refusal provenance.
- Grant purpose no longer authorizes task kinds; exhaustive purpose/task handling must not recreate the removed gate. Keep the distinct runtime endpoint compatibility checks documented.
- Result-verification summary types gain `AutomationStudioResultFlowStepSummary`, screened `parameters`/`parametersWithheld`, `flowParametersWithheld`, and a structured `repair` directive on `AutomationStudioResultVerification` when the verdict is `does_not_answer`.
- The destructive consequence export now contains only `move_money` and `delete`; consumers displaying or matching the list must not assume `modify_existing` remains gated.
- The executor's default recovery behavior changes without host opt-in and now classifies throws/messages as well as structured failures while applying node side-effect safety.

### P1 — `docs/architecture/testing-facility.md`

Update the lane/current-artifact sections. The document refers to `authoredNodes` once but never defines the created-Flow artifact that now writes it.

Proposed facts:

- Add the instruction-created Flow lane beside the recording and Flow lanes: it records request/build/review identifiers, Flow shape, screened authored nodes, own-page requirement, runtime run, extraction observation, and partial progress when the lane fails.
- Define `authoredNodes[]` as one entry per action node in Flow order: `nodeId`, `definitionId`, output ID, screened parameters, and `parametersWithheld` paths. A safe transformed value and a withheld path can coexist—for example, a URL origin is retained while `url` is named withheld because its path/query was removed.
- Explain that the projection uses Core's parameter screen and the test-contract validator, so selectors, page text, credentials, and denied evidence keys cannot enter the snapshot silently.
- In **`What a list read says about itself`**, add the newer `itemsSeen`, `emptyRecords`, and `listWait` fields if absent from the prose's enumerated shape; keep clear that item/page fault details presently appear in bounded result text rather than `RunExtractionRead` fields.
- Do not claim the new integrated behavior passed live. Package tests and builds passed; provider/browser measurement is still pending.

### P1 — `docs/architecture/sensitive-values.md`

Add a short subsection under runtime persistence/readers for the two new authored-data projections.

Proposed facts:

- Judge/repair context and created-Flow artifacts carry only Core-screened authored parameters. `parametersWithheld` names removed or transformed paths without carrying their original values.
- URL screening may retain an origin while naming `url` withheld; absence, safe transformation, and byte-budget omission are distinct facts.
- The result-repair directive bounds and screens model judgement fields before they enter recovery, while persisted result records retain Core-authored findings/fix data rather than unrestricted provider prose.
- This is authored Flow data, not captured page evidence; it does not relax the existing capture, extraction, secret-input, or denied-key rules.

## Optional reconciliation

### `F:\!FluxIQ\docs\architecture\automation-studio\persistence.md`

Optional one-line cross-reference only. No durable schema migration is introduced by this work, so the document need not repeat executor or judge internals. Its Flow-settings statement that configured provider retries are zero can remain if explicitly scoped to persisted Flow settings; it must not be presented as the execution grant's `providerRetryCount`, whose default is now 2.

### `docs/architecture/README.md` and `F:\!FluxIQ\docs\architecture\README.md`

No content change required. All recommendations update existing indexed documents; no new page needs indexing.

## Explicit no-update verdicts

- **`F:\!FluxIQ\docs\architecture\runtime-kernel.md`: no update.** Runtime transport status/failure propagation, command deadlines, and persistence fields did not change. The web recovery account did not gain a structured runtime/gateway field.
- **`F:\!FluxIQ\docs\architecture\automation-studio\client-gateway.md`: no update.** Pairing, command/result frames, ordering, and gateway ownership are unchanged; new web failure codes still travel through the existing optional structured failure record.
- **`docs/architecture/extension-client.md`: no update.** Recording, picker, side-panel/popup, and client lifecycle contracts are unchanged by the execution recovery loop.
- **`docs/architecture/page-evidence.md`: no update.** Page-evidence capture shape and caps did not change. Authored parameter screening belongs in `sensitive-values.md` and Core's Automation Studio document.
- **`docs/architecture/repository-layout.md`: no update.** Package ownership, commands, and generated-output layout are unchanged.

## Evidence reviewed

- Integrated source/interface diffs in both repositories, limited to executor, result verification/recovery, grants/provider retry, action permissions, web action recovery, extraction, failure-code, test-contract, and created-Flow projection paths.
- Completed change summaries t164–t171, integration review t173 and reconciliations t177/t181.
- Candidate authored architecture documents found by targeted term and heading searches.

No source, shared working document, existing architecture document, build output, Core file, or Lab state was changed. No build, test, Lab run, commit, or push was performed.
