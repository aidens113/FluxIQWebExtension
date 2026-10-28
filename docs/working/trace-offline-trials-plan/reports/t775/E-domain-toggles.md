# t775-E-domain: idempotent toggle presses (downstream half)

## Outcome
Done. Not committed (worker).

## What changed and why
- New `domain/src/actions/toggle-signature/` (signature type, reading shape, words, derive `webToggleSignatureOf`, match `webToggleSignatureShown`, untrusted parser `webToggleSignatureValue`, barrel, tests/). Exported from `domain/src/client/index.ts` so the extension imports it.
- `actions/types.ts`: command field `ensureState`, result field `skipped: "already_in_state"`. `actions/schemas.ts`: click entry gains `ensureState`. `client/gateway-action-parameters.ts` lifts it; `client/gateway-mapping.ts` carries `skipped` in the payload.
- `node-run/press-effect/toggle-signature.ts` (`webPressToggleSignature`, barrel) derives the `toggle` output from the before/after packets of the pressed handle: aria-pressed/checked/selected or native `checked` flip gives attribute signature with `idempotentWith: "web.dom.check"`, else name gains/loses; nothing for a navigation, other location, gone target, or no change. `outcome.ts` adds `toggle`; `run.ts` sets it (same line as `choice` to stay at the 800-line limit); `written-step.ts` and the look outcome pass `toggle: undefined`.
- Extension: `content/actions/toggle-reading.ts` reads the live target; `click.ts` checks `ensureState` before the actionability gate and, when already shown, returns success with `skipped: "already_in_state"` without pressing.
- Existing draft statement `toggle: {key,to}` (`press-effect/toggle.ts`, Core reversal pairing) is a different thing and untouched; the new one is on the node outcome.

## Commands run and observed results
- `DOMAIN_TEST_BUILD_LABEL=t775-e node scripts/test-domain.mjs actions/ press-effect/tests node-run/tests` -> tests 463, pass 463, fail 0 (earlier broader run incl. client/tests: 454/454).
- `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` in domain -> no output (clean). Used instead of `pnpm check`, which refuses: Core's build is stale (Core is being edited concurrently).
- `npx tsc -p tsconfig.json|tsconfig.test.json --noEmit` in apps/extension -> clean.
- `EXTENSION_TEST_BUILD_LABEL=t775-e node scripts/test-extension.mjs content/actions/tests/click` -> tests 51, pass 51, fail 0 (includes the two ensure-state tests).
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (228 warning(s), 616 baselined)" after fixing three violations my first pass caused (tests dir 26 files, run.ts 802 lines, barrel import).
- Fail-first cases all covered and green: Save/Unsave Senior Engineer gives gains [unsave] loses [save]; matches "Unsave Product Designer", not "Save Product Designer"; aria-pressed false to true gives attribute signature + idempotentWith; click with ensureState shown does not press (events empty) and answers skipped.

## Not verified
- No live browser run; the content harness (`e2e/`) was not touched or run.
- `ensureState` skipping goes through `runtime/click-landing.ts` in the worker; not exercised there (the skip result is a plain success with no navigation).
- Accessible-name source differs by side (packet `name ?? text` vs descriptor `accessibleName ?? name ?? text`); matching is on lowercased words so small differences should cancel, unverified live.
- Core's reading of `toggle` on node outputs is the concurrent Core half; not checked.

## Open questions
- `toggle` sits on the node outcome (shown to the model too), not only the draft statement; if Core expects it on the draft statement, moving it is one line in `run.ts`.
- Extension test for ensureState lives in `content/actions/tests/click/tests/ensure-state.test.ts` (the tests dir was at the 25-file cap).
