# t669 one session-picking rule

## Outcome
Done.

## What changed and why
- New `domain/src/runtime/web-sessions/eligible-web-session.ts`: `isEligibleWebSession(session: ClientGatewaySession, alsoDeclaring?)`, the single rule. Barrel `web-sessions/index.ts`.
- `host-resources/leasable-session.ts`: filters by the predicate, still requires exactly one; header no longer claims a restated rule.
- `llm-evidence/tools.ts`: private `eligibleWebSessionIds` now filters by the predicate and maps ids; behaviour unchanged.
- Both callers already used `ClientGatewaySession` (gateway snapshot sessions), so one type.
- New test `web-sessions/tests/eligible-web-session.test.ts` (6 tests: each condition, snapshot-action alternative, alsoDeclaring).

## Commands run and observed results
- `npx tsc -p tsconfig.json --noEmit` (domain) -> EXIT=0
- `npx tsc -p tsconfig.test.json --noEmit` (domain) -> EXIT=0 (after fixing an invalid status literal in my test)
- `DOMAIN_TEST_BUILD_LABEL=t669 node scripts/test-domain.mjs runtime/web-sessions/tests runtime/host-resources/tests` -> `# pass 12`, `# fail 0`
- `pnpm structure:check` -> `structure-audit: passed (201 warning(s), 639 baselined).` No baseline run needed.

## Not verified
Evidence-tools callers exercised only by typecheck, not by their own tests.

## Open questions or contradictions found
None. Note: `pnpm typecheck` does not exist in domain; used tsc directly with the two configs `pnpm check` uses.
