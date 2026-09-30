# t195-w8: a press the site refuses as "too fast" is waited out and done again

## Outcome

Done. That includes the lead's mid-task fix: the wait was lost because the layer text was read out of document order.
A non-link press that opens a going-too-fast notice now fails as `web.action.rate_limited`. The record is `action_failed`, retryable, stage `execution`, `effect: "unacted"`, and it carries `retryAfterMs` (N s + 500 ms, capped at 60 s). Core repeats it even on a mutating node, after the hinted wait.

## What changed and why

**One deviation from the brief: the wait travels on the failure record, not the result payload.** The payload route needs `domain/src/actions/types.ts` (the result type), `domain/src/client/gateway-mapping.ts` (`webAutomationActionResultPayload` copies field by field) and `apps/extension/src/shared/protocol.ts`. All three are on the must-not-touch list. Core's `outputs` would also nest the payload at `outputs.result.result`, where `automationStudioRetryHintMs` does not look. The record already crosses every hop unchanged: content result, gateway `failure`, Core `client-gateway-transport` parse, `io-policy` `dispatchFailure` parse, attempt-trace parse and `attempt.failure`. So Core's record gained an optional `retryAfterMs` beside the `effect` the brief asked for.

Core (`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`):
- `packages/contracts/src/failure/record.ts`: adds `AUTOMATION_STUDIO_FAILURE_EFFECTS`, `AutomationStudioFailureEffect`, optional `effect` and `retryAfterMs` on the record, and `retryAfterMsMax: 3_600_000` in the limits.
- `packages/contracts/src/failure/parse-record.ts`: accepts both fields. `effect` must be a known value. `retryAfterMs` must be an integer from 0 to the max. A new consistency rule rejects a `retryAfterMs` on a record that is not retryable.
- `packages/fluxiq/.../executor/defensive/assess.ts`: `faultFromRecord` uses `record.effect` when the record has one, otherwise the old derivation. The hint order is now fault, then record (`automationStudioRetryHintMs(attempt.failure)`), then outputs.

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQWebExtension`):
- `domain/src/runtime/failure/codes.ts`:
  - New `RATE_LIMITED: "web.action.rate_limited"` row: `action_failed`, retryable, `execution`, `effect: "unacted"`.
  - The definition type gains an optional `effect`.
  - `WebAutomationFailureComparison.retryAfterMs` is added. `webAutomationFailureRecord` keeps it only on retryable codes, rounds it and bounds it with `WEB_AUTOMATION_RETRY_AFTER_MAX_MS`, and takes the effect from the row.
- `apps/extension/src/content/action-runtime/rate-limit-notice.ts` (new): `watchRateLimitNotice(pressed, probe?)`.
  - It takes a baseline of `overlaysOverPage()` before the press. After the press it looks for a new layer whose `boundedLayerText` passes `isRateLimitLayerText`, and reads N from it.
  - It checks at once, then every 100 ms. If a notice has no readable wait yet, it keeps looking until the window closes.
  - It ends early when the pressed element leaves the document, or on `beforeunload`, `pagehide` or Navigation API `navigate`, so a submit that navigates still sends its result.
  - Only `afterMs` and `retryAfterMs` leave the watch. No page text does.
- `apps/extension/src/content/actions/click.ts`: in the non-link branch, the watch starts in the gesture's `beforePress` hook and settles within `RATE_LIMIT_WINDOW_MS = 500` (shortened by the command's `timeoutMs`). A notice returns `deps.rateLimited(...)`.
- `actions/types.ts`: adds `watchRateLimitNotice` and `rateLimited` to the deps. `action-runtime/execute-action.ts` wires them, and `action-runtime/index.ts` exports the types.
- `action-runtime/results.ts`: `actionRateLimited` builds the failed result with bounded texts that describe the conclusion, not the notice.
- `interference/vocabulary.ts`: adds a closed phrase list, `isRateLimitLayerText`, and an acknowledgement label list `isRateLimitAcknowledgeLabel`: OK, Okay, Got it, Understood, I understand. The label list is anchored at both ends and "Try again" is on no list.
- `interference/way-out.ts`: the acknowledgement is read only on a layer whose text is a rate-limit notice, after the dismissal and consent paths. It shares `ownLabelSays` with the consent decline.
- `interference/layer-text.ts` (new): `boundedLayerText`, moved out of `way-out.ts` and rewritten to read text nodes in document order. The old per-element order read "try again in <span>12</span> seconds." as "try again in seconds. 12". That is the cause of "it named no wait" in `run-munq51ik-a7ebd077`.
- `interference/index.ts`: barrel additions.
- `recovery/fault.ts`: adds the fault word `rate_limited`, which the totality test requires. It is never absorbed by the page-side loop (`ABSORBED_ELSEWHERE`): its five-second budget is shorter than the notice's wait.
- `recovery/record.ts`: carries `retryAfterMs` through the rebuilt record.
- `docs/architecture/failure-taxonomy.md`: the code table now has nineteen codes, plus a paragraph on `RATE_LIMITED`.

## Commands run and observed results

- Core `packages/contracts`: `npx vitest run --minWorkers=1 --maxWorkers=2 src/failure` printed `Tests 9 passed (9)`.
- Core `packages/fluxiq`: `npx vitest run --minWorkers=1 --maxWorkers=2 src/programs/automation-studio/runtime/executor/defensive` printed `Test Files 4 passed (4)`, `Tests 60 passed (60)`.
- `heavy.sh "t195 w8 tsc" npx tsc --noEmit -p tsconfig.json` exited 0 in `packages/contracts` and exited 0 in `packages/fluxiq`, with no diagnostics.
- Domain: `npx tsc -p tsconfig.json --noEmit` exited 0, and so did `-p tsconfig.test.json --noEmit` (both through heavy.sh). `DOMAIN_TEST_BUILD_LABEL=t195w8 heavy.sh ... node scripts/test-domain.mjs` printed `# tests 921`, `# pass 921`, `# fail 0`.
- Extension: `heavy.sh ... node scripts/check-extension.mjs` (both tsc projects plus the bundle check) exited 0. `EXTENSION_TEST_BUILD_LABEL=t195w8 heavy.sh ... node scripts/test-extension.mjs` printed `# pass 1254`, `# fail 0` on the final run.
- `node scripts/structure-audit.mjs`:
  - Downstream: `passed (125 warning(s), 120 baselined)`, the same counts as before this work. `results.ts` is at 440 lines against the 400-line advisory.
  - Core: `passed (194 warning(s), 354 baselined)`.
- Fails without its change: each change was reverted from a backup, the test was run, and the file was restored and confirmed byte-identical with `cmp`.
  - `assess.ts` reverted: 2 of the new assess tests failed.
  - `parse-record.ts` reverted: the round-trip test failed.
  - `click.ts` and `way-out.ts` reverted: 3 extension tests failed (`not ok 387`, `388`, `502`).

## Not verified

- No browser run, per the brief. The lead's live run `run-munq51ik-a7ebd077` saw the detector fire. Whether the document-order fix now reads N live is not verified.
- I did not revert-check the new document-order test (`way-out.test.ts`, "a layer's words are read in document order"). I reasoned that the old reader produced "...try again in seconds. OK 12", which the test's regex rejects.
- Codes and vocabulary tests import symbols that did not exist before, so they would fail without the change. I did not revert-check them separately.
- The latency cost: every non-link press whose control stays in the document and whose document does not navigate waits the full 500 ms. It is not measured live.
- The Core contracts `dist` already contained the new fields when I checked (rebuilt 23:24; I did not run the build). Whoever rebuilds Core's dist must include these files.
- Core's `docs/architecture` is not updated for `effect` and `retryAfterMs`. I don't own it, and `automation-studio.md` has another worker's uncommitted edits.

## Open questions or contradictions found

- The brief says to cap the wait at 60 s. Core's `automationStudioBoundedRetryWaitMs` caps any one wait at 30 s (`AUTOMATION_STUDIO_MAX_RETRY_WAIT_MS`), and a node's arrival at 60 s. A notice asking for more than about 30 s is shortened by Core.
- The `retryAfterMs` record field is a Core contract addition beyond the brief's `effect`. The supervisor should confirm it, since the payload route was blocked by must-not-touch paths.
- These files carry uncommitted edits from other workers. I did not touch them: `blocking-dialog.ts`, `interference/clear.ts`, `resolve-target.ts`. My `way-out.ts` and `vocabulary.ts` edits sit on top of the lead's uncommitted consent-layer changes.
