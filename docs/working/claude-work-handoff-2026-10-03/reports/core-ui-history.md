# Core and paused UI history reconciliation

Status: Complete
Status detail: Read-only document/status/history audit; historical results are not fresh validation.
Created: 2026-10-03
Last updated: 2026-10-03
Owner: core-ui-history worker
Scope: Core top-level working plans, paired t224 UI evidence and current integration dependencies.
Paired document: none (Core inspection only)
Related: ../claude-work-handoff-2026-10-03.md

## Current State

Claude's current Core work is the general Flow-authoring and live-campaign dependency chain, already integrated through Core dev `6beae684`. The older t224 UI review is paused, but its source checkpoints have already been merged into both dev branches. Its remaining held UI fixes and live browser certification have not been shown complete by this audit.

## Coverage and limits

- Read Core AGENTS.md and working index. Inventoried all 33 top-level Core working documents (34 Markdown files including README); extracted every header, all available Current State sections and historical status/next-action headings. Deep reads focused on defensive runtime, Week 1/2, extraction, version history, scalable data, render separation, UI certification and paired review. This was a status/history reconciliation, not a literal line-by-line reread of every old implementation ledger.
- Inventoried and scanned full-text headings/status/pending-work evidence in all 141 nested UI Markdown files in downstream main and all 141 corresponding files in t224. Four are archives and 137 are reports. Deep-read the wind-down handoff in both checkouts, twelfth supervisor verification, held extraction accessibility/caret/feedback/receiver reports and Core editor/state audits.
- Compared all 141 paired files. There are 22 byte differences, but after CRLF normalization only the wind-down report differs substantively: t224 includes the later user-authorized remote checkpoint update. No nested UI file is missing from either copy.
- Read Core and downstream git history and tested checkpoint ancestry; no runtime/private data, browser/provider requests, test commands or panel management. No code changed. The only written file is this report.

## Integrated work versus stale handoffs

Git confirms the current dev ancestry contains Core `c4683b61`, downstream AskControls `3a55a8b1` and lazy completion `28ee7f6a` (all three merge-base ancestry checks exit 0). Core first-parent `bff4c6be` merged t224 at `e05597bb` in round 7; downstream `7f11c441` merged t224 at `da6477b5`. Therefore do not plan to merge those same fixes again.

Preserved t224 local tips are Core `73bbdb57` and downstream `8f4071db`, each adding checkpoint bookkeeping. The t224 wind-down report explicitly records that the user requested pushing: both origin task/t224 branches were created at Core `e05597bb` and downstream `da6477b5`. Earlier no-push/no-merge prose describes the prior checkpoint; main's wind-down copy misses that update. This audit inspected local git evidence, not remote connectivity or later test outputs.

The inherited t224 Core structure failure was service.ts 4,506 lines against 4,505 baseline. That is historical evidence, not a statement that current dev still has the same violation. The protected synthetic recording.delete EPERM and earlier login/flow.create failures were handed to Claude; no root cause was established in the paused UI lane. Current sweep evidence must be reconciled before scheduling redundant broad checks.

## What Claude most recently integrated in Core

| Task | Observed Core integration | Resulting behavior |
| --- | --- | --- |
| t252 | `6beae684` | General Flow authoring may write steps, bind row/input values, test repeat per row, check lasting acts without pressing again and present one judge line per row. Earlier-output authoring remains P5 pending: supervisor source review found `$step` returns `step_binding_not_yet` in `flow-draft/binding-forms.ts:124`; the merge subject overstates that part. |
| t254 | `e6290d80` | Purse uses actual billed/off-peak/cached pricing, prices only sent input, removes reply caps, reserves judging calls and measures next-round admission; recovery priced per call. |
| t255 | `d89877d3` | Run records retain complete ending, judge/consequence costs separately and per-amendment/refused-repeat step folders. |
| t256 | `75e66057` | Adaptations/inbox distinguish applied, held-with-reason and waiting-for-judged-run runtime patches. |
| t258 | `f044b596` | Missing project store settles the run failed with a reason instead of throwing. |
| lanes B/C/D | `8b952335`, `58db495f`, `2da9ce41` | Tests run written Flow and avoid repeated instructed acts; clipped judge verdicts survive; finishing success is confirmed; stalls are not mislabeled not doable; repeats/row controls and omitted-row judge evidence strengthened. |

These are integration subjects, not new source-level certification. The downstream live-loop documents own current lane assignments and scenario outcomes.

## Paused UI work delivered

The t224 reports cover shell/login/logout recovery; operational refresh, payload validation and parameters; deployment/Docs/database recovery; bounded runtime workspace/log reads; authoring review/navigation/Problems; clipboard/download cleanup; Combobox/Field/Menu/Tree/tooltip/overlay ownership; hierarchy dialogs; extension chat/automation/connection/settings/utility/navigation recovery; extraction draft/read/preview and real session binding; AskControls keyboard eligibility; and lazy-list queued-growth completion.

The final recorded extension gates passed 2,088 tests, package types/build and structure, emitting Chrome/Firefox/e2e bundles. Core's last three UI units passed supervisor-owned eight suites/146 tests and seven-root strict typing. Fresh full Core gates were deferred during the credit wind-down. Browser/assistive-technology behavior was unexercised throughout t224. Integration into current dev supersedes its proposed future merge, but does not retroactively supply the missing browser evidence.

## UI continuation plan, after current live-campaign priorities

1. Reconcile current dev gates against the inherited Core failures; use affected-directory tests and touched-package types plus structure. Full sweeps remain at most twice daily, not per fix. Preserve protected failures until actual current results close them.
2. Resume the exact extraction caret unit: `panel/extraction/dialog-focus.ts` plus new owning `dialog-focus-selection.test.ts`. It was held before dispatch and no source edit occurred. Restore caret only to matched replacement of original control; fallback focus must retain its own selection.
3. Implement extraction preview table semantics, then automatic-preview pending/result feedback serially where both touch `panel-elements.ts`. Preserve five-row cap, immediate excluded-column erasure, raw draft and current Confirm/Cancel semantics; table needs explicit name and truthful empty-cell wording.
4. Separately release unissued background-start currentness and content receiver exact-ID/retirement partitions. Current held plans require a synchronized refusal vocabulary and explicit stopPick/reset/tombstone decision; preserve genuine no-pick testDefineExtraction seam. Existing IDs are not authorization, and local retirement cannot retract issued work or prove worker-restart ordering.
5. Core structured-state keyboard ownership is source-confirmed. Raw state bounded serialization and Flow editor readiness/provider retirement need their exact held dependency/consumer reads before release. Pagination malformed-input production reachability, toolbar policy and native graph shortcut delivery remain questions, not proved runtime defects.

## Live UI validation to include

Use isolated fixtures and an explicitly authorized panel session. Exercise Chrome/Edge side-panel and Firefox popup where the shared contract applies: recording pause/resume/start; extraction field selection/caret/table/automatic read/failure/retry/confirm/cancel; session A-B-A replacement and stale callbacks; settings save/disconnect/forget; current-owner chat and automation rows; utility Open FluxIQ/report/download flows. For Core, cover sign-in destination/session recovery/draft preservation, native keyboard ownership in trees/menus/dialogs, tooltip pointer/keyboard dismissal, current-run detail/log reads/retry/export, parameter validation, operational hidden-tab/backoff/reconnect, and authoring review handoff.

Record actual browser/build/page/state and synthetic scenario results, including keyboard, focus, IME, zoom, constrained viewport, screen-reader/accessibility-tree evidence where applicable. Source/unit tests cannot certify native pointer bridges, announcement timing, focus across popup closure, actual file download or browser worker lifecycle.

## Other Core plans: retain, reconcile, defer

- `flow-version-history-plan.md`: design only. Existing graph revisions support independent subflow history; missing provenance, reading inverse chain, verdict-to-version binding and extend-mode restore. Record phase first; automatic rollback explicitly waits for a second real regression not caught by reachability. No current implementation claim found.
- `automation-studio-scalable-data-architecture-plan.md`: harness implemented, actual full matrix/24-hour soak/crash injection/1,000-switch heap/query-plan/backup-restore/replay evidence still missing by its own record. Do not remove storage flags before passing evidence. This is a separate scale-certification workstream.
- `automation-studio-render-data-separation-plan.md` and `ui-ux-upgrade-audit-plan.md` carry old browser-pending claims, while later Complete `web-panel-ui-ux-functionality-audit-plan.md` records Sept 1 browser/scale certification: 144 production-routed tests, 12 viewport/browser projects and 32 visual baselines. Avoid scheduling their whole old matrices as if no later evidence exists; determine exact overlap and preserve latest accepted envelope. New t224 modifications still need focused fresh browser evidence.
- `automation-studio-runtime-debug-ui-cleanup.md` has an old clean-typecheck/browser-review gap; later runtime UI work changes its surface. Prioritize current Runtime Debug verification, not stale type errors from Sept 5.
- `first-class-data-extraction-plan.md` is a Sept 15 snapshot holding K10/K12c for review and K11 for Week 3, with stream/256 MiB/lease/retry/download end-to-end evidence absent then. Its old uncommitted/not-pushed statements are not current branch facts. Downstream extraction plan owns present sequencing; do not independently restart held K phases.
- `mvp-week2-automation-loop-plan.md` explicitly labels its unstarted snapshot historical and documents landed t024/t026 on Sept 20. `flow-authoring-and-defensive-runtime-plan.md` lists Sept 22 t081/t087/t088/t089 branches as open; current downstream history supersedes those ownership statements.
- `adaptive-flow-training-roadmap.md` records Sept 6 diagnosis-only limits, fixed model and no-live-call evidence. Current live/general-authoring commits and newer purse work supersede those operational restrictions; do not apply old $0.25/reply caps as today's campaign policy.
- `module-size-governance-plan.md` owns remaining service decomposition, but its counts are historical. Keep service wiring serial and generic behavior in Core. Agent protocol/token plan obligations are largely complete; compact oversized docs on touch rather than a bulk rewrite.
- Completed plans: action visual entity, element fingerprint foundation, strict workspace, codebase audit, node evidence, runtime kernel, later web-panel audit. Element fingerprint foundation Complete does not claim mandatory resolver coverage in every output.
- Paused legacy backlogs: state object indexing, initialization/router, Flow unification/Task-Routine migration, LLM 41-phase expansion and recording proposal follow-ups. Confirm overlap with newer implementations before assigning any of them. Six old Studio data/cache/lag/load plans are explicitly superseded by render separation and architecture docs.

## Validation

Observed only read-only git ancestry/history and full paired-document content comparison. No tests, build, structure audit, browser session, live provider call, panel operation, commit or push was performed by this worker. Historical recorded gate counts above are attributed to their reports and remain historical.
