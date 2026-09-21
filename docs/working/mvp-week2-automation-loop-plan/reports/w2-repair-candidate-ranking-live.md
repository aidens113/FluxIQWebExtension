# w2-repair-candidate-ranking-live

Status: downstream candidate projection implemented and live browser-proven; real-panel repair stopped before provider dispatch on stale workspace readiness.

## Isolation

- Downstream/Core pair: detached t027 heads under `F:\fxlab\t027-ranking\`.
- Fresh browser evidence run root: `F:\fxlab-runs\t027-ranking`.
- Fresh real-panel workspace copy: `workspace-v2`; loopback panel/gateway 3371/4941.
- User port 3000, user profile/data, shared `dev`, and Core source were untouched.
- No provider response, credential, selector, DOM, page value, or opaque identifier is recorded here.

## Live-first proof

Pre-change, a real Chromium content-harness run exercised the production content-script snapshot and downstream failure-evidence sanitizer against `basic-form`. The bounded `web-llm-evidence.v2` packet contained 12 semantic elements, five actionable elements, `failedTargetUnknown: true`, and one repair parameter. It contained opaque handles and no selectors/raw DOM, but no deterministic repair-candidate projection. The supervisor's parallel ambiguous-target probe independently found 15 elements/1,879 bytes with stable handles, accessible names and distinct form/landmark/heading context, confirming the needed ranking inputs already exist.

After implementation, the same live path produced a `ranked` `web-repair-candidates.v1` projection with five candidates in 680 bytes. Every candidate was an opaque handle already present in the packet; no selector, raw DOM, or duplicated semantic page text was added. The live test passed in 5.4 seconds.

## Downstream implementation

- `target/candidates.ts` filters by the existing repairable-action compatibility rules, ranks semantic state deterministically (`focused`, `changed`, `recent`, then form/heading/landmark, with packet order as tie-breaker), caps results at eight, and fits the entire projection to its reserved byte budget.
- Known web actions carry only `compatible` opaque handles for their declared role. Recorded `builtin.policy.action` failures, whose capture request does not disclose the dispatched web verb, carry `action_unknown` plus closed possible roles rather than inventing one.
- Closed refusal categories are `action_not_repairable`, `incompatible`, and `limit`. The projection contains counts only for refused rows.
- Failure capture reserves at most 1,024 bytes (and at most one-third of the caller's total allowance), sanitizes the original packet within the remainder, then measures the exact JSON property-envelope cost before fitting and attaching the projection. The final whole packet is therefore bounded by Core's existing failure-evidence gate, including the `repairCandidates` key/comma/colon rather than only the candidate object's bytes.
- `repairCandidates` is omitted from state digests: it is derived packet metadata, not page state.
- No query/action node was added. Existing `web.dom.capture_snapshot` / `web.inspect_current_page` remains the sole evidence producer.

Owned source/test files:

- `domain/src/runtime/llm-evidence/target/candidates.ts`
- `domain/src/runtime/llm-evidence/target/index.ts`
- `domain/src/runtime/llm-evidence/{tools,sanitize,state-digest,index}.ts`
- `domain/src/runtime/llm-evidence/target/tests/candidates.test.ts`
- `domain/src/runtime/llm-evidence/tests/{tools,packet-carries-no-selector}.test.ts`

## Approved real-panel provider attempt

The approved task was the existing instruction-only form with semantic submit-target drift, expecting two provider calls (diagnosis + patch), with a hard maximum of three only if one evidence decision was genuinely used. The full oracle required one manual `edit_action_target` proposal, no mutation before UI approval, a passing approved rerun, and passing restarted reuse with zero provider calls.

The fresh copied workspace stopped before the provider boundary with closed code `adaptation_readiness.bootstrap_invalid`: current readiness requires exactly one applied Flow Bootstrap adaptation. Sanitized SQLite inspection found zero adaptation rows in both the copied workspace and its source workspace under the saved project. Provider calls added: **0**. No retry was made. The proposal/apply/restart oracle was therefore not entered, and the ranking has not yet been provider-proven in a repair prompt.

The next live run needs a freshly prepared current-t027 workspace whose creation/bootstrap is applied through the real UI, not another copy of this stale preserved workspace. That setup changes the precondition rather than retrying the failed provider attempt.

## Focused checks after live work

- Domain build passed.
- Directly bundled focused tests passed 22/22: candidate projection, failure-evidence binding/budget (including a 900-byte whole-packet regression), and no-selector packet policy.
- `git diff --check` passed.
- No broad suite was run.

Supervisor integration review was applied after the live run: `sanitize.ts` now consumes the candidate type through the `target/index.ts` barrel, the total evidence-size calculation includes the JSON attachment envelope, candidate objects use the checked `present<T>()` boundary instead of contract spreads, and the panel response-parse fallback is explicitly documented as a closed best-effort failure. The contract-spread and swallowed-failure rules passed; the focused domain build and 22 tests were rerun after those corrections. No additional live or provider run was needed or attempted.

## Notes

- The first attempted recursive PowerShell copy hit Windows path-length gaps and left a disposable partial `workspace`; the complete `workspace-v2` was made with `robocopy`. Neither was user data.
- Temporary sanitized inspection/build artifacts remain only under `F:\fxlab-runs\t027-ranking` and ignored domain test-build output. No commit or push was made.
