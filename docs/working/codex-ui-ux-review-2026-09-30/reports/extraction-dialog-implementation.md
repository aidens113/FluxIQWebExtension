# Extraction dialog implementation

Status: Complete (worker; pending supervisor verification)
Owner: extraction-dialog-implementation worker

## Current State

Seven approved files source-complete and frozen. Original five public lifecycle failures reproduced; final30focused tests and seven-root TypeScript check passed. Local modal DOM harness only; shared fake/privacy/recording/background untouched. Supervisor independent/broad verification pending.

## Decisions

Temporary root mount while open isolates moving recording entry. Restore original inert values and panel parent; active extension document only. Focus snapshot restores logical field/control/caret after synchronous rebuild. Epoch guards reject old mount/poll/preview/command completions. Cancellation erases local preview and DOM immediately but holds pending/failure shell until acknowledgement; Confirm freezes editable controls.

## Validation

Pending narrow reproduction. Shared fake/privacy/recording/background/Core untouched.

- Original five public lifecycle cases reproduced nativeexit1; all5failed after local harness classList support fixed. No production source was changed during reproduction. Confirm fixture corrected to actual flat count wire shape. First incomplete harness run generated unrelated classList errors and is not accepted evidence.
- Product implementation now integrates temporary root portal/inert preservation, targeted render focus repair, per-open/close/confirm/cancel epochs, busy editable freeze and immediate local/DOM preview erasure with pending/failed cancellation retry shell. Narrow tests pending.

- Expanded focused run passed25/25 (663.3698ms), native0, including unchanged preview/preview-reread privacy tests. Scoped TypeScript rejected exported inferred anonymous harness Observer class private callback (TS4094); made that local callback publicly readonly, no product changes. Added exact same-column newer-pick epoch case, capture/preview race, prepare/confirm failure and document-recreation regressions before final run.


## Final files and behavior

- panel.ts: epoch-guarded mount/poll/preview/prepare/confirm/cancel completions, modal open/close integration, field/control focus repair around render, consistent busy controls, immediate preview erasure from memory AND rendered DOM. Pending/failed cancel keeps visible shell with safe retry until acknowledgement. Captured count receipt remains open; restored recorded/no-session state closes. No new reconnect/private persistence policy.
- panel-elements.ts: programmatic panel/status targets, status/alert roles, existing IDs/labels/section/CSS intact.
- dialog-focus.ts (new): sheet alone portals to ownerDocument.body during open, returns hidden sheet to current connected original host on close; original inert values restored exactly, new body siblings isolated via scoped observer, listener/observer cleanup. Tab boundaries/empty enabled-list fallback, IME/shortcut/busy Escape guards. Only active visible extension document may focus; browser page selection/document destruction does not cancel or pull focus back. Current visible enabled opener/selected tab receives return focus.
- index.ts: synchronized focused helper export.
- tests/dialog-dom.ts (new): local deterministic document, keyboard/focus/inert/reparent/removal/observer/clock/runtime harness, importing unchanged shared primitive. No global fake edits or new dependencies.
- tests/dialog-focus.test.ts (new):5isolated focus/modality cases.
- tests/panel.test.ts (new):16public component cases including host reparent, field caret/removal, failed cancel retry, editable Confirm freeze, count receipt, prepare/Confirm refusals, stale mount/poll/preview/new-pick/same-column/capture races, absent/recorded sessions and Firefox document recreation. All fixture data synthetic.

## Final validation

- Heavy label codex t224 extraction final narrow; package cwd apps/extension. pnpm exec esbuild four test roots panel.test.ts,dialog-focus.test.ts,preview.test.ts,preview-reread.test.ts with --bundle --platform=node --target=node22 --format=esm; external Core/websocket packages; --loader:.css=empty --sourcemap=linked --out-extension:.js=.mjs --outdir=.test-build-scratch/codex-extraction. Then node --enable-source-maps --test all four corresponding bundles. Then pnpm exec tsc -p .test-build-scratch/codex-extraction/tsconfig.json --noEmit. Scoped ignored config extends owning tsconfig.test.json with empty include/exclude and only seven approved roots.
- Native final chain exit0:4test bundles,30tests/30pass/0fail/0skip/0cancelled,476.7854ms; scoped TypeScript exit0 (empty log). Owned git diff --check exit0 (line-ending notices only). No product edits after this run.
- Exact logs: C:/Users/osrs_/AppData/Local/Temp/codex-t224-extraction-{before,build,final,types}.log. Before:5fail/0pass/0skip,7849.7922ms after harness correction. Intermediate expanded25pass/native0 also retained in codex-t224-extraction-expanded.log. First scoped typing error TS4094 was harness-only and fixed before final checks.
- Independent supervisor can execute existing apps/extension/.test-build-scratch/codex-extraction/{dialog-focus,panel,preview,preview-reread}.test.mjs without rebuilding concurrently. Source/report frozen for supervisor verification/checkpoint.

## Limits

No whole-suite/check/build/audit, live browser/accessibility certification, Lab/provider/panel process, commits/pushes, shared/architecture document changes, Core/other-worktree edits or excluded production/test changes. Focus/inert/Firefox recreation tested in local controlled model only; browser layout, focus timing and screen-reader announcements remain live-validation limitations. No durable preview copy, picker ownership change, new reconnect policy or recording/shell/content/background edits.
