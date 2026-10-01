# Extraction matched-control caret restoration

Status: Paused
Status detail: User requested wind-down at 6% credits; brief not dispatched, no source/test edits.
Owner: runtime_contracts
Date: 2026-10-01

## Written implementation brief

- Read parent Current State, your completed extraction-caret-fixture-readiness.md and accessibility partition B. Root accepted source-confirmed cross-control selection leakage. Prior extension integrated full45050/type63587/build93194 are CLOSED native0; no source-reading gate is active.
- Exact two downstream paths HELD FOR RESUME: apps/extension/src/panel/extraction/dialog-focus.ts and NEW tests/dialog-focus-selection.test.ts. The earlier release was revoked before dispatch at the user's wind-down request. Existing dialog-dom/dialog-focus tests and all panel/controller/background/wire/Core paths frozen.
- Restrict selection restoration to the successfully matched eligible original field/control replacement. If original control/row is removed, different or disabled/hidden, preserve existing next/previous/initial focus policy but leave fallback control's own caret/selection untouched. Keep matching predicate, actual visibility/focus/IME/Tab/Escape/inert/open/close/return behavior unchanged.
- Tests FIRST using actual public withDialogDom support and test-local per-instance setter wrappers/descriptor restoration. Prove matched selection delegation once, zero delegation to neighbor/previous/initial/different/disabled-hidden fallback and equal-range sentinel, deliberate focus movement and lost document focus/visibility before/during work; ordinary redraw unchanged. Unsupported selection sources must be null, not fake helper numeric defaults.
- Preserve every original assertion; no helper export/edit, copied focus algorithm, new public API, wire/session/currentness or generic lifecycle expansion. No real browser/clamping/screen-reader claim.
- Run heavy NEW native suite plus unchanged dialog-focus and relevant mounted extraction panel/session/draft/read-recovery suites discovered by exact names. Capture actual native child exit and tests/time; avoid PowerShell stderr adaptation ambiguity. Actual-config strict two roots includes declaration roots and ALL dependency/config diagnostics; whitespace/module budgets.
- Record genuine failing baseline/fixture corrections before source fix, final results/limits progressively. Freeze exact source/test/report for root independent review. No commits/shared docs/broad/live/browser/Lab/provider/panel/private data or protected backend operations.
