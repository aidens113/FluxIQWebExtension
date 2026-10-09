# CW: Core web panel reads paused phase and stopped field

## Outcome
Done.

## What changed and why
All in `apps/web/src/features/automation-studio/conversation/activity/` (Core tree t376):
- `contracts.ts`: `"paused"` added to `ConversationActivityPhase` and `PHASES`; `stopped?: true` on `ConversationActivity`, read only when the wire value is exactly `true`.
- `headline.ts`: `ConversationActivityOutcome` gains `"paused"` (held, non-ending); headline "Paused: your turn on the page". `conversationActivityHeadline` takes a 4th optional `stopped` arg: failed + stopped reads "Run stopped" / "Build stopped".
- `pacer.ts`, `steps/messages.ts`: pass `event.stopped === true` to the headline (both are in the owned folder).
- `tests/paused.test.ts`: new; paused accepted, paused outcome/headline, stopped read only on `true`, stopped headlines, unknown phase refused.

Consumers: grep of `apps/web/src` found no consumer of `ConversationActivityOutcome`/`conversationActivityOutcome` outside this folder. Inside it, pacer passes outcome through; `steps/messages.ts` only checks `=== "failed"` / `"waiting"`, so paused is treated as not-ended.

## Commands run and observed results
- `npx vitest run src/features/automation-studio/conversation/activity` (apps/web): 7 files, 50 tests passed.
- `npx tsc --noEmit` (apps/web, what the `check` script wraps): no output (clean).
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (289 warning(s), 710 baselined).`

## Not verified
Live panel rendering of a paused/stopped run; step cards (`steps/outcome.ts`) have no paused-specific wording, a paused event shows only the headline.

## Open questions or contradictions found
None.
