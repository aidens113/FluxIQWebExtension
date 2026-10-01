# Core state panels UI audit

Status: Complete - read-only audit; implementation held
Owner: recording_controls
Date: 2026-10-01

## Written waiting-interval brief

- Keep generic Tree source/test unchanged while its current tests-first baseline queues; resume original unit after genuine result. No duplicate check or abandoned operation.
- READ-ONLY exact Core apps/web/src/features/automation-studio/state/StateStructuredPanel.tsx, StateRawPanel.tsx, StateComparePanel.tsx and StateDiffPanel.tsx. Read parent Current State; own this report only additionally. Never inspect actual state/snapshots/recordings/private fixtures.
- Audit displayed loading/empty/diff/error guidance, native control/keyboard labels, local selection/owner changes and bounded rendering of source-provided large/malformed synthetic values. Preserve passive state versus executable action distinction; do not promote display data to execution.
- Separate source-confirmed local defects from missing direct helper contracts or unmeasured native browser performance. At most two held exact source/NEW test partitions with observable acceptance, compatibility and relevant command filenames.
- Test filename discovery only, no test body/helper/backend/runtime/service/storage/context-packet traversal. Name missing direct dependency if necessary rather than expand.
- Own report only, progressive evidence/limits. No source/tests/shared docs/commits/checks/broad/live/browser/Lab/provider/panel/private-state operations for this audit. Preserve original Tree baseline/fix/check evidence separately and freeze report when complete.

## Current State

Completed exact four Core panel source reads and filename-only nearest test discovery while preserving the original generic Tree baseline and unchanged Tree product. No actual state, snapshots, recordings or private fixture values were inspected. Parent consolidated Current State confirms isolated t224, Claude integration/protected ownership and disjoint Core workers. No source/test/shared helper/config/working document outside this own report changed. No audit checks, browser/provider/backend/panel operations ran. Two local implementation candidates remain held; no executed regression is claimed.

## Source evidence

### S1 - Structured row intercepts its native fact button

StateStructuredPanel.tsx puts a native button inside a focusable tr. The button stops click propagation, but the row onKeyDown responds to any bubbled Enter/Space without checking event target/currentTarget, defaultPrevented, composition/native229 or modifiers. Therefore an Enter/Space key originating on the fact button is consumed by the row, which invokes onSelectFact itself and prevents the button's normal keyboard behavior. A previously handled or modified/composing key on the row is also consumed. This is the same source-level event boundary issue as generic Tree, although it is a different file/callback and no Tree change should be copied automatically without an explicit brief.

The callback only selects a passive fact path built from namespace/path; it does not execute the displayed value. Preserve this distinction. Whole-row pointer and direct-row keyboard activation may be intended convenience. Row and button both being Tab stops is visible, but not automatically a defect; do not delete either affordance without a contract decision.

Structured rendering is bounded to 100 rows per page. requestedPage is locally clamped when row count shrinks; the effect synchronizes that clamped page. New equally-sized inputs retain the page, since no source/owner key is supplied to this component. Whether the parent keys the component per selected state is outside scope. The table has no local accessible name/caption and headings lack explicit scope, though native th has default header semantics. Pagination has clear native Previous/Next buttons and finite page calculations derived from array length, but its page text is not live. No loading/error prop exists; absence of local loading is caller-owned, not evidence of a failed fetch.

### S2 - Raw expansion is lazy but unbounded and has no local serialization recovery

StateRawPanel.tsx serializes only after the user chooses Show raw JSON. It uses useMemo(JSON.stringify(model.raw, null, 2)), renders that entire string into pre and passes it to ClipboardButton. Collapsed state performs no serialization. Large valid plain JSON yields an unbounded displayed string; no truncation/size notice exists here. This is a source-confirmed rendering boundary gap, not a measured browser freeze.

JSON.stringify can throw for cyclic values or BigInt, and can return undefined for certain non-JSON inputs. This component has no local catch or recovery UI, so those inputs can fail its expanded render. Whether such values satisfy NodeStateViewModel.raw and can reach the actual view is unknown: model/types is an uninspected direct dependency. Do not claim a production malformed-state incident or alter backend state contracts.

Show/Hide buttons are native, clearly named and expose expanded/controls attributes. The controlled region exists only when expanded, so the collapsed controls reference a currently absent region; record this static fact without asserting a browser accessibility failure. ClipboardButton is keyed by activeSource.id/activePhase, a local identity reset for that child. The expanded flag is not reset on source/phase changes. Whether keeping expansion across selection is desired, or a parent remounts the view, needs caller inspection; no disclosure/authority claim follows.

### Other panels

StateComparePanel.tsx distinguishes No runtime comparison from a selected source having No comparable facts. Guidance says to select runtime actual output; populated summary separates matched, failed and irrelevant counts. Each row is a named native button with visible Match/Mismatch/Irrelevant wording and expected-to-actual text. It routes selection to evidence when evidenceId exists, otherwise passive fact selection. No arbitrary display value becomes executable.

Comparison maps all supplied rows; there is no local cap/page. severity or optional score is shown; score.toFixed assumes a numeric model contract. No local loading/error/pending API is declared. Actual source-size constraints, score shape and caller locks are unknown without model/types and the parent boundary. Do not infer a wrong async operation or quantify native performance from this file.

StateDiffPanel.tsx renders before/after rows as passive text, with clear No diff rows guidance. It maps the full supplied array and has no loading/error/cap API. Whether model generation bounds the array is unknown. No native action is present, so keyboard activation is not applicable. No execution command or mutation authority is introduced by these panels.

## Held partition A - structured fact event ownership

Exact product: apps/web/src/features/automation-studio/state/StateStructuredPanel.tsx.
Exact NEW owning test: apps/web/src/features/automation-studio/state/tests/StateStructuredPanel-keyboard.test.tsx.

Accept only direct-row, previously unhandled, plain, non-composing Enter/Space for row selection, excluding native229 and all modifiers before preventDefault or callback. Native button key behavior remains its own. Preserve its click callback/stopPropagation, whole-row pointer convenience, namespace/path mapping, 100-row pagination, direct-row keyboard and public props. Do not add state execution, owner APIs or shared event helpers.

Tests first actual mounted panel with explicit simulated row/button bubbling if renderer lacks a native DOM: direct plain row Enter/Space invokes exactly the fact path; button-origin key is not canceled or routed by the row; separately invoke button click callback once; handled, composition, native229 and each modifier do not select/cancel; other keys remain untouched; pagination still renders at most 100 rows and shrink clamps correctly. Simulated click callback assertions do not prove native key-generated clicks. Existing fixture/helper bodies require release before reuse.

## Held partition B - bounded raw display with local error recovery

Exact product: apps/web/src/features/automation-studio/state/StateRawPanel.tsx.
Exact NEW owning test: apps/web/src/features/automation-studio/state/tests/StateRawPanel-recovery.test.tsx.

First release only the exact direct model/types and existing StateRawPanel test/support reads needed to establish accepted raw shape and original full-copy contract. Add a fixed displayed-character bound and explicit truncation notice for large valid raw JSON while preserving the complete serialized value for the existing explicit copy action. Catch serialization failure locally, show a truthful diagnostic error and allow Hide plus explicit Retry serialization; do not echo raw values/error details into the error sentence. Handle non-string stringify output according to the established raw model contract rather than inventing state. New model input must replace the previous result/error; no data from another selected model may survive in the current preview or copy value.

This bounded unit can cap rendered DOM text after serialization, not the cost of JSON.stringify itself. Do not claim serialization performance is bounded, serialize while collapsed, copy truncated JSON as complete, change raw state/backend storage, or silently normalize unsupported types. A separately designed bounded serializer/helper would require a future explicit partition if profiling later establishes that need. Preserve source-keyed ClipboardButton behavior and current public API.

Tests first: collapsed render does not serialize; valid small JSON remains unchanged and copies full content; oversized synthetic valid JSON displays an explicit bounded preview while copy retains the full contract; serialization failure presents local recovery rather than throwing the panel render; explicit retry/hide works; changing model replaces old error/content/copy value. Malformed cases remain synthetic contract probes until the direct model type establishes reachability. Existing owning StateRawPanel assertions must be retained; no old-test edit is implied by this plan.

Partitions A and B are disjoint; neither is released. Root should observe owning NEW suites plus unchanged relevant contracts under heavy wrapper and actual-config strict roots/declarations/all dependencies when released. Proposed NEW command filenames are the two owning paths above; no full-suite/browser command is proposed during current frozen gates.

## Discovery and limits

Filename-only discovery found state/tests/StateRawPanel.test.tsx, StateExplorerView.test.tsx, StateVisualCanvas.test.tsx, state-isolation-contract.test.tsx, state-visual-models.test.ts, model/tests/state-source-index.test.ts, state-comparison.test.ts and commands/tests/commands.test.ts. No body was read. state-view-test-fixtures.ts and model/state-model-test-fixtures.ts were discovered only by filename; their data was not inspected.

Missing direct boundaries: model/types for accepted display shapes, parent StateExplorerView for remount/selection/loading context, and shared ClipboardButton for actual copy outcomes. They are not authorized by this four-read brief and were not opened. No screen reader, native keyboard session, timing profile, real state or backend operation was exercised. Reports are source findings and held acceptance plans, not validation claims.
