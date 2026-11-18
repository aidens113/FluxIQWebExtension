# t893 scripted result authoring correction

2026-11-12. Outcome: Done for the bounded two-file unit; browser acceptance remains held for t905 integration.

## Change

- `packages/test-runner/src/attempt-lane/scripted-model/scripts/professional-network-accept-messaged-invitations.ts`: the deliberately selected final read (`read-accepted` or `back-read`) is handled before current-page lookup, overlays, navigation or transient structure fields. A successful read whose exactly identified draft step is `taken` returns `amend_draft` with `change: "take"` and that actual call ID. Completion occurs only once that same step is `kept`.
- Missing/duplicate actual call identity, unsuccessful reads, replaced/written/intermediate steps and withdrawn dispositions produce a diagnosis. No last-position/input-shape guess or other probe is adopted.
- A fresh `notes-back` attempt already on Messaging follows its normal conversation-read path even without per-attempt `back-*` history. Invitation landing behavior and all four forms remain covered.
- `packages/test-runner/src/attempt-lane/scripted-model/scripts/tests/professional-network-accept-messaged-invitations.test.ts`: 18 focused tests now cover both result branches, all forms, unchanged earlier result/probes, exact identity refusals, Messaging landing, completed-read dispatch before unrelated page actions, and zero-row judge refusal.

The oracle, task, fixture, result rows, judge array, panel interpretation allowance and 24-decision allowance were not changed. The `notes-back` judge array remains three replies; every one still rejects zero rows. No Core, helper, other script or shared working document was edited.

## Required stable dependency

The lead approved the t905 Core interface: model-facing `core.flow_draft` steps expose optional `callId` from their own actual step call ID, including replaced entries. A missing actual call ID stays absent; neither checked nor prior-execution identity is a substitute. The script requires this interface and t905's existing `take` / result-ledger / save-correspondence protocol. The t905 owner is implementing the Core view seam and tests separately.

Bounded read-only inspection established that the prior public draft view and amendment feedback did not provide an authoritative successful-call-to-kept-step receipt. No source identity was invented downstream to work around that absence. The current shared Core was not rebuilt or edited by this worker, and browser acceptance must not run until the accepted dependency is integrated.

I also checked whitelisted keys/booleans from the actual decoded t893 `read-accepted` and `back-read` evidence. Both are `toolId: core.run_node`, boolean `ok: true`, and status `succeeded`; their visible draft action is `web.output.dom-extract_list`, disposition `taken`, changed `yes`, result code `web.inspect.succeeded`. The implementation's success/action checks match the actual model-visible shape. No page contents, rows, credentials or raw request were copied into this report.

## Observed validation

All commands ran from the t893 worktree, through the lead's shared heavy-slot wrapper. The owned source/test files were frozen from each queued command through its endpoint. Only the owning test-runner was built; the command checked Core currency without rebuilding shared Core, and the domain build was reused from cache.

1. Initial red command:

   `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t893-authoring-red -- "pnpm --filter @fluxiq-web-extension/test-runner build && node --test packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/professional-network-accept-messaged-invitations.test.js"`

   Observed: build passed, then 17 tests ran: 11 passed / 6 failed; exit 1. Failures reproduced premature completion of unkept result reads, absent identity/eligibility diagnostics, and the fresh Messaging attempt trying to open My Network.

2. First green command:

   `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t893-authoring-green -- "pnpm --filter @fluxiq-web-extension/test-runner build && node --test packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/professional-network-accept-messaged-invitations.test.js"`

   Observed: build passed; all 17 tests passed; exit 0.

3. The lead requested the additional completed-read/page-order regression before the final check:

   `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t893-authoring-red-routing -- "pnpm --filter @fluxiq-web-extension/test-runner build && node --test packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/professional-network-accept-messaged-invitations.test.js"`

   Observed: build passed, then 18 tests ran: 17 passed / 1 failed; exit 1. The new case selected an unrelated page control (`tool_call`) instead of authoring the completed read (`amend_draft`). Hoisting completed-read dispatch ahead of page inspection fixed that cause.

4. Final green, package check and audit:

   `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t893-authoring-final -- "pnpm --filter @fluxiq-web-extension/test-runner build && node --test packages/test-runner/dist/attempt-lane/scripted-model/scripts/tests/professional-network-accept-messaged-invitations.test.js && pnpm --filter @fluxiq-web-extension/test-runner check && node scripts/structure-audit.mjs"`

   Observed: owning build passed; all 18 tests passed, zero failures/skips; `test-runner:check` ran successfully; `structure-audit: passed (250 warning(s), 552 baselined).` Combined exit 0. The audit emitted advisory warnings; this is not a warning-free claim.

## Limits and next step

No full suite, browser session, provider call, paid work, panel management, git mutation or Core source edit occurred. Unit checks prove the script's authoring decisions against the agreed public call-ID contract; they do not prove saved-candidate assembly or deterministic replay. The real four-attempt task, continuation identities, zero-call later runs, exact remaining judge count, Firefox and other t893 readiness acceptance remain unverified.

The lead must integrate the accepted t905 result protocol and actual-call-ID view, recheck the paired source, and then perform the unchanged professional-network four-attempt acceptance under ordinary Lab guards. If it still requests a fourth judge, preserve that failure for diagnosis; do not expand the script allowance or skip proof of the exact Flow.

## Return contract

Outcome: Done
Changed: `packages/test-runner/src/attempt-lane/scripted-model/scripts/professional-network-accept-messaged-invitations.ts`; its adjacent `scripts/tests/professional-network-accept-messaged-invitations.test.ts`; this report.
Validation: The four exact heavy-slot commands above observed red 11/17, green 17/17, ordering red 17/18, then final 18/18 plus owning package check and structure audit passed.
Not verified: Browser/deterministic acceptance and integrated t905 actual-call-ID behavior; no full suite run.
Report: `docs/working/mvp-launch-plan/reports/codex-t893-authoring-fix.md`
Notes: Lead owns git. Shared Core unchanged by this worker. Browser acceptance remains held until t905 integration.

Lead acceptance: independent final script tests passed 18/18 in 6469.3169ms (TEMP/fluxiq-codex-t893-authoring-final.log). Local checkpoint only; browser acceptance awaits integrated t905 actual-call-ID and result protocols. No push yet.
