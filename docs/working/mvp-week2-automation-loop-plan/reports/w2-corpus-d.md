# w2-corpus-d — support desk and order operations, live creation

Worker report, 2026-09-17 (UTC 2026-09-18). Lab instance `corpus-d`, isolated
target, DeepSeek `deepseek-chat`, Core `cf176fe` rebuilt at 22:40:33 local by
the supervisor, extension `3ba6742` (tree dirty only by a sibling's untracked
report). No source, test or Core edits; nothing committed.

## Outcome

**2 of 10 passed**: both SLA-breach reads. Last time this slice scored 0 of 10.
**Creation now acts:** all 5 Flows that were built contain `select` and 2
contain `click`, whereas in the previous run of this slice none of 78 calls
authored an interaction. **No state-changing job left the page changed.** Five of the ten jobs built no
Flow at all; each was stopped by a different guard, detailed below. The
known "row checkboxes crowd out page buttons" gap is at most the cause of one
failure (triage), and is unproven even there. It is not what stopped the other
four state-changing jobs.

One verdict disagreement: **`order-operations-batch-export` reported `passed`
while its oracle said `failed`** (7 rows returned, 13 expected, 0 matched).

All 68 provider calls were real and billed (527,188 tokens, $0.2406). None was
refused locally (no one-call, zero-token, $0 run), and no `domain/dist` ENOENT
race occurred.

## Per-task results

| Task | Reported / oracle | Flow built | Built Flow (action types) | Records exp / obs / matched | Page changed? | What stopped it | Calls · tokens · USD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| support-desk-sla-breaches (probe) | passed / passed | yes | navigate, select, extract_list | 12 / 12 / 12 | n/a (read) | — | 3 · 23,528 · 0.0107 |
| support-desk-sla-breaches-recovered | passed / passed | yes | navigate, select, extract_list | 3 / 3 / 3 | n/a (read) | — | 3 · 23,610 · 0.0108 |
| support-desk-triage-backlog | failed / failed | yes | navigate, select, extract_list, click ×2, extract_list | — (playback goal) | **no**: failed before any assignment | `web.target.not_found` on the first click: a positional row selector (`ticket-rows > tr:1 > td:4 > button`) whose element, the subject button "Request to add a second billing contact", the fingerprint refused (−0.26). Never named the triage shortcut or the Assign button. | 4 · 37,700 · 0.0172 |
| support-desk-reply-and-resolve | no verdict (no Flow) | **no** | — | — | **no**: TCK-2100 opened (wrong ticket; asked for TCK-3101), still Open | `flow_bootstrap.evidence_unusable_decision`: 4× `bootstrap.unknown_parameter` + 1× `bootstrap.required_input_unconnected` on five Flow drafts | 14 · 115,332 · 0.0530 |
| support-desk-escalate-longest-breach | no verdict (no Flow) | **no** | — | — | **no** | `flow_bootstrap.evidence_tool_failed`: the 64,000-byte bootstrap evidence ceiling was spent (63,882 B) by 7 navigations; the next tool was offered ≈118 B and failed | 9 · 93,160 · 0.0417 |
| order-operations-partial-refund | no verdict (no Flow) | **no** | — | — | **no**: ORD-40100 still "Paid", no order opened; **confirmation dialog never reached** | reveal `target_unsafe`, navigate `no_progress`, one draft `web.handle.wrong_control`, then `flow_bootstrap.evidence_repeat_without_progress` | 8 · 51,248 · 0.0233 |
| order-operations-batch-export | **passed / FAILED** | yes | navigate, select ×2, click, extract_list | 13 / 7 / **0** | n/a (read) | Narrowed, but the wrong 7 rows (35/35 fields present). No `type` step, so the date range was never entered. The two selects cannot have been Paid + Unfulfilled (46 such orders would contain all 13). Also the `unscanned-store` false redaction failure. | 5 · 35,621 · 0.0163 |
| order-operations-batch-export-quiet-week | failed / failed | yes | navigate, select ×2, extract_list | 3 / 0 / 0 | n/a (read) | Wrong filter values, no date step; the Flow itself reported `ambiguous_or_unknown` | 3 · 21,204 · 0.0099 |
| order-operations-line-items | no verdict (no Flow) | **no** | — | — | n/a | 3× `web.handle.unknown_field` (extraction columns not in any detected structure), `no_repeating_structure` on the reached page, then `evidence_repeat_without_progress` | 13 · 89,052 · 0.0410 |
| order-operations-dispatch-run | no verdict (no Flow) | **no** | — | — | **no**: order list untouched (same failure screenshot hash as partial-refund) | reveal `target_unsafe`, one draft `web.handle.unknown_field`, then `evidence_repeat_without_progress` | 6 · 36,733 · 0.0167 |

Run ids: probe `run-mu6j76fk-46332bfc`, then in table order `run-mu6jbrpv-efc42b7b`,
`run-mu6je1lu-1350050f`, `run-mu6jh81a-55478f58`, `run-mu6jjt35-37968933`,
`run-mu6jnwhw-b10a9944`, `run-mu6jpmxx-ec302a6f`, `run-mu6jteua-7f5fc3a8`,
`run-mu6jvvj9-74bcc97b`, `run-mu6jz5m3-df36ab9f`, all under
`test-runs/instances/corpus-d/`. Campaign summaries:
`test-runs/campaigns/2026-09-18T05-41-31-244Z` (probe) and `2026-09-18T05-45-01-147Z` (nine).

## What changed and why

Nothing in the repository. The only file written is this report, plus scratch
files in the session scratchpad: logs, and the read-only `corpus-d-analyze.cjs` that
prints each run's evaluation, flow-lane and live-llm fields. The campaign built
the scenario lab into `apps/scenario-lab/.lab-instances/corpus-d/` (ignored
output, under the Lab build lock), because a fresh instance has none.

## Findings, in order of how much they block this slice

1. **The Flow builder cannot author "act, then read what appears" jobs.** In
   reply-and-resolve, partial-refund, line-items and dispatch-run, the thing
   to act on or read only exists after a click. The exploration's
   `web.reveal_safe` refused that click as `target_unsafe` every time it was
   tried (4 of 4 jobs). Drafts that then named what was never observed were
   rejected: `web.handle.unknown_field` (line-items ×3, dispatch-run ×1),
   `web.handle.wrong_control` (refund ×1), and `bootstrap.unknown_parameter`
   (reply ×4). Then the loop stopped on `evidence_repeat_without_progress`.
   `web.handle.unknown_field` is an **extraction-column** refusal
   (`domain/src/runtime/llm-evidence/plan-resolution/extraction-columns.ts:129`):
   the draft named columns such as the line-item or dispatch-note columns
   that no detected structure has. It is not a missing button handle.
2. **On order-operations, the safety rule likely refuses every order opener.**
   Orders open through `[data-order-ref="ORD-…"] a` (fixture `manifest.ts:16`).
   `webRecoverySafeActionVerdict` (`harness-options/safety.ts:92-97`) refuses
   (a) any element whose name, text **or selector** matches
   `WEB_RECOVERY_COMMITTING_WORDS`, which **includes `order`** (`safety.ts:46`),
   and `data-order-ref` matches it as a whole word; and (b) any non-button
   element, which rules out `<a>`. Both refusal rules apply to the opener. **Inferred from
   code plus fixture markup; the run records do not store which rule refused which
   element.**
3. **Escalate hit a fixed limit, not a model error.** The bootstrap evidence
   ceiling is `maxEvidenceBytes: 64_000`
   (Core `runtime/loop-limits/flow-bootstrap-evidence-loop.ts:107`). After
   seven successful navigations (63,882 B) the next tool call got
   `min(24000-512, 64000-63882)` = 118 B (`runtime/llm/evidence-loop.ts:445`),
   failed, and surfaced as `evidence_tool_failed` rather than
   `evidence_limit`. This is the kind of limit the Current State says to
   treat as the defect itself.
4. **Triage: the Flow names a row button, not a page button.** The designed
   path is triage shortcut → select-all checkbox → Assign → dialog → confirm,
   all page-level controls. The Flow's first click is positional, the column-4
   button of row 1, which is a ticket subject. **Consistent with** the known
   row-control flood, but **unproven**: the element packet the model saw is
   not kept in the run folder, because the isolated workspace is discarded.
5. **batch-export narrows but gets the wrong rows, and reports success.** Both
   batch-export Flows lack any `type` step, so the 1–14 March range was never
   entered, and their select values produced sets that do not contain the
   expected orders. In the baseline, the result verification passed a 7-row
   result that the oracle says holds none of the 13 target orders. In quiet-week
   it caught the 0-row result (`ambiguous_or_unknown`).

## Commands run and observed results

- Key export as briefed, then `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=corpus-d pnpm lab:campaign --no-build support-desk-sla-breaches`
  → `campaign.usage`: "Cannot find module …\.lab-instances\corpus-d\dist\scenarios\index.js" (a fresh instance has no build). No calls.
- The same without `--no-build` → the instance built; then the Lab refused: "FluxIQ Core's build is 53 minute(s) behind its source … result-verification/index.ts". Campaign `05-38-14-067Z`, noResult, 0 calls.
- **The same with `FLUXIQ_LAB_ALLOW_STALE_CORE=1`** → I ran this before the
  coordinator's HOLD arrived, after checking that Core's post-build source
  changes were comment- and test-only (`4a1b39c` moved a comment, `cf176fe`
  touched only a test) and that the compiled dist had `94b6d07`'s
  `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES` and `actingDefinitions`. The run
  failed with `ERR_MODULE_NOT_FOUND …\fluxiq\dist\programs\automation-studio\index.js`
  (Core was mid-rebuild), campaign `05-39-39-037Z`, noResult, **0 calls**. I did not use
  the override again.
- Waited for the rebuild: `dist/programs/automation-studio/index.js` 22:40:32 and `dist/runtime/storage.d.ts` 22:40:33, both newer than the source at 22:09:47, and quiet for 30 s.
- The probe without the override → `"state":"quiet"`, **passed**, `live-llm.json`: `observed.calls 3`, `inputTokens 23086`, `outputTokens 442`, `estimatedCostUsd 0.01074128`, `providerInvocation attempted`.
- `… pnpm lab:campaign --no-build <nine tasks>` → `{"tasks":9,"passed":1,"failed":8,"noResult":0,"providerCalls":65,"reportedTokens":503660,"reportedCostUsd":0.22990616}`.
- Per run: `node corpus-d-analyze.cjs <runDir>` and events.ndjson reads. The sweep over all ten found redaction only on `run-mu6jpmxx-ec302a6f` (`.fluxiq/global.sqlite`, `unscanned-store`) and ENOENT nowhere.

## Not verified

- **What the model saw.** The element packets and the Flow node parameters (select values,
  click targets, draft parameter names) are not stored in the run folder.
  So the triage/button-flood link, the batch-export select values, the
  `unknown_parameter` name in reply-and-resolve, and which safety rule refused
  each reveal are inferred, not observed.
- **Page state from screenshots.** Page state was judged from the oracle where one ran, and otherwise
  from failure screenshots (reply-and-resolve, partial-refund,
  dispatch-run). Triage-backlog and escalate have no screenshot, so their
  "not changed" rests on the Flow failing before, or never reaching, a
  mutating step.
- **Reproducibility.** Every task ran exactly once, and every result rests on a single observation.

## Open questions or contradictions found

- The brief said Core was "built and current". At dispatch it was 53 minutes behind by mtime (a
  comment move), so the Lab guard correctly refused it until the supervisor rebuilt.
- Every `select` and `click` that succeeded reports `targetResolution:
  unresolved_no_candidates, candidateCount 0`. That is either misleading
  telemetry or a resolution path that goes unrecorded.
- A no-Flow build is recorded as `facilityFailure: {stage: scenario.execute,
  reason: unclassified}` and "judgement not measured". It is a product
  refusal (`flow_bootstrap.*`), not a facility fault, and the campaign row hides that.
- Triage-backlog's retryable `web.target.not_found` did not invoke harness
  recovery (`harnessRecovery.attempted: false`). Is that intended for created Flows?
- Should `order` stay a committing word when it is matched against selector text? On a
  back-office order screen it matches nearly every row control.
