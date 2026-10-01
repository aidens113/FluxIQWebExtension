# Extraction backend preview ownership implementation

Status: Complete (exact three product/test paths FROZEN; supervisor verification pending)
Owner: recording_controls
Date: 2026-10-01

## Written brief

- Implement the completed extraction-preview-ownership-plan.md; read parent Current State and that plan. Exact downstream t224 product ownership: apps/extension/src/background/extraction/control.ts and session-store.ts; NEW apps/extension/src/background/tests/extraction-preview-ownership.test.ts. Own only this report additionally.
- Full extension test/type/build sessions have closed successfully. Root owns disjoint Chat/shell import and catch-rationale reconciliation; no broad downstream gates until your freeze. Keep frozen frontend, definition, original tests, harness and protocol unchanged.
- Tests first: actual background adverse-order broad/narrow, exclusion erasure, old refusal/finally, deleted/replaced session, same-key pending deduplication, per-reply allowed projection/copy and20-row limit. Preserve all original assertions. Apply the store-owned operation design from the approved plan, within these three paths.
- Do not fix session-ID adoption, start/cancel/Confirm receiver or authorization here. Existing optional/global discovery policy remains for this unit. IDs are identity, not authorization.
- Run new failures before product edits, then named combined owning suites and exact actual-config three-root strict types, using heavy.sh for heavy commands. Report all dependency/global diagnostics; no baseline, harness or compiler weakening.
- No shared docs, commits, broad gates, browser/Lab/provider/panel or actual/private state. Request exact additional path release before expanding scope. Record progress/failures as they happen; freeze and return changed paths, commands/results, limitations and pending supervisor verification.

Tests-first checkpoint: NEW five actual-control deferred regressions executed against unchanged product source using heavy external harness. Native1,0/5 passed,573.0723ms: all-excluded retains rows; old broad success restores excluded key; old refusal clears newer rows; narrower pending retains old broad cells; deleted captured session is still serialized. Original tests/harness/definition/wire untouched. Proceeding exact control/store implementation.

Progress checkpoint: exact control/store first implementation passes combined four suites34/34, native0,621.6182ms (unchanged original29 plus reproduced new5). Store owns synchronous erasure, exact operation/proposal/session identity, pending same-key promise joining, allowed-key copy/20-row cap; control validates captured object and copies caller-bounded reply. Added next boundary cases in NEW owning test only; no changes to originals/harness/definition.

Boundary checkpoint: combined owning gate50/50 native0,902.7876ms; actual-config scoped3roots native0,0 owned/global and0 dependency diagnostics. Expanded NEW test covers pending dedup/cache, old finally/rejection, empty-before-dispatch/late completion, same-ID different object, independent replacement preview, source-key projection/null/missing/20-row cap/reply copy, current retry, recorded state and changed proposal. Final explicit-clear and cross-tab independence cases added; final freeze checks next.

## Frozen return

Changed only apps/extension/src/background/extraction/control.ts (365lines), session-store.ts (217lines), NEW apps/extension/src/background/tests/extraction-preview-ownership.test.ts (131lines), and this report. Source/test paths frozen after final observations. No helper/barrel/definition/protocol/frontend/old test/harness edits.

Store owns per-session object/proposal/state/current-operation identity and shared same-key pending promise. New selection clears held rows/key synchronously; all-excluded invalidates earlier work without a page read; clear/picked/recorded/replacement invalidate leases. Commits project actual proposal-key cells, preserve null/missing, copy at most20 rows, and old refusal/finally cannot clear newer rows or locks. Control checks captured object/proposal after await and returns independently copied current preview limited to each caller's own allowed fields; deleted/replaced session uses existing missing shape. Original global-latest optional discovery/Confirm/cancel policy and recording-first/count-only capture remain unchanged.

Final actual validation through Git Bash build-slots/heavy.sh:

- TEMP/codex-t224-extraction-preview-focused.mjs: four owning suites52/52 passing, native0,798.3253ms; original29 plus new23. No skipped/cancelled. Original5 failures were observed before product edits (native1,0/5,573.0723ms); intermediate34/50 passes recorded above. Final run waited for other heavy slots without modifying them.
- TEMP/codex-t224-extraction-preview-scoped-types.mjs: actual extension tsconfig, exact three roots; native0,0 owned/global and0 dependency diagnostics, no filtering/strict-option relaxation. Final run covers the added clear/cross-tab cases.
- Exact product/new test/report git diff --check clean. Protected definition, old three owning suites, shared harness, wire and entire frozen frontend extraction tree have no HEAD diff. No baseline changes.

Observed cases include broad/narrow/empty adverse order, refusal/rejection/oldfinally, pending same-key join/cache/retry, stale same-ID object/replacement/deletion/recorded/proposal changes, explicit preview clear, independent tabs, malformed extra/invalid cells,20-row cap, reply/source copy isolation and old narrow caller versus new broad commit. Data is synthetic only.

Limitations: no backend session-ID adoption, active-tab discovery migration, stale start/cancel/record receiver fix, project/recording authorization, host disposal, browser/Lab/provider/panel/private inspection, broad gates, commit or push performed. Issued reads are not claimed cancelled. Root independently verifies source and runs coordinated broad checks; real-ID implementation remains separately held.
