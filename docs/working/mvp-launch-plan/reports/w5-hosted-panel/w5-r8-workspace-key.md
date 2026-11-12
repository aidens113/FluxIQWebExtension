# W5 round 8: the workspace-key test failure on the merged tree

## Outcome

Done. This was a stale test. It did not come from t898. The product code is right and was not changed. I updated the test to the rule that was decided, and it still proves everything it proved before, plus the new choose-time refusal.

## The evidence

**The failing assertion.** In `panel-assistant/tests/workspace-key.test.ts`, line 236 (before my edit) was:

```ts
expect(await call("secret-keys", "set-default-key", owner, { id: mine.id })).toMatchObject({ ok: true });
```

It received `{ ok: false, … }`. That is the owner choosing the member's key as the default before the member has offered it. The other six tests in the file passed.

**Where the refusal comes from.** `secret-keys/api/handlers.ts`, `set-default-key`, calls `unofferedKeyRefusal(...)`. That function refuses another person's key that has not been offered, with: "That key belongs to someone else, who has not offered it to this workspace." It was added in the t901 checkpoint 7 commit `bd923ac5e`, and t898 did not touch it.

**Why it is not a t898 interaction.**
- `0d98e99ec^1` is `bd923ac5e`, the checkpoint 7 commit.
- `git diff --stat bd923ac5e 0d98e99ec` over `programs/secret-keys`, `automation-studio/api/panel-assistant`, `runtime/conversations/assistant`, `_shared/api.ts`, `_shared/iam` and `platform/iam` shows only three files:
  - `platform/iam/predefined/user-access.ts`: t898 added `iam:GetMyPreferences` and `iam:UpdateMyPreferences` to the member's self-service rule on `user/${fluxiq:PrincipalId}`. The owner's `set-default-key` call does not use that rule.
  - `assistant-tools.generated.json` and `read-only-actions.generated.ts`: new preference and task-settings entries.
- Nothing in t898's run-session `personUserId`, the person preference, or "context only from the caller" is on this call path. The test calls `registry.call` directly with its own actor and never goes through program-route or run-requests.
- So the code under test is the same as at checkpoint 7. The failure was already there at `bd923ac5e`.

**Why it passed "at checkpoint 7".**
- The worker report `w5-round7-keys.md` describes `set-default-key` as still accepting any key (line 61), and asks in open question 3: "Say if it should refuse too."
- The committed `bd923ac5e` answers yes. Its message says: "both choosers refuse another person's key until its holder has offered it". The new test `secret-keys/api/tests/key-offers.test.ts` asserts that refusal: "lets an owner make another person's key the default only once its holder offered it".
- `workspace-key.test.ts` was not updated to match. The worker's passing run happened before that decision was applied.

## What changed and why

I changed one file: `packages/fluxiq/src/programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts`, the second half of that test. The member-side refusals at the start are unchanged. The test now checks this sequence:

1. **Before the member offers the key:**
   - The owner's `set-default-key` and `set-assistant-model` on the member's key are both refused, with the exact message above.
   - No provider call is made.
2. **The member offers the key and the owner sets it as the default.** The owner's message is paid with the member's key, released to the member's own unlock (`Bearer` member value).
3. **The member withdraws the offer.** The key is still chosen but no longer offered.
   - The owner's message gets the `NOT_OFFERED` answer with no provider call (still 1 call).
   - The member's own message is still paid with their own key.
4. **The member offers the key again.** The owner's message is paid with it once more (3 calls, all with the member's value).

This keeps what the old test proved:
- a member's key never pays for another person until it is offered;
- a chosen key that is not offered pays only for its holder.

It also covers the refusal when an owner tries to choose the key before it is offered. The test name still holds, so I kept it.

## Commands run and observed results

- Free memory checks before each vitest run: 2174, then 1846 (waited), 2939 (ran), 1743 (waited), 4024 (ran).
- Reproduction, `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts` → 1 failed, 6 passed. The failure was at `workspace-key.test.ts:236:82`: expected `ok: true`, received `ok: false`.
- Acceptance, `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/api/panel-assistant src/runtime/conversations/assistant src/programs/secret-keys` → `Test Files 41 passed (41)`, `Tests 328 passed (328)`.
- `pnpm structure:check` → `structure-audit: passed (543 warning(s), 916 baselined).`
- `git status --short` shows only my test file plus the other workers' identity-access and apps/web files.

## Not verified

- I did not run the test at `bd923ac5e` in a separate checkout, because I must not switch branches. That it failed there too is inferred from the empty diff of the code under test.
- The exact `error` string of the original failing response was not printed. The rewritten test now asserts that exact string, and it passes.
- No typecheck: vitest does not typecheck, and the edit only uses identifiers that already exist in the file.

## Open questions or contradictions found

1. `w5-round7-keys.md` (lines 61 and 171) still says `set-default-key` accepts another person's key without an offer. The code and the commit message say it refuses. The lead may want to correct the round 7 report and any architecture-doc wording that repeats it.
2. The file's header comment (lines 15-18) still describes the rule correctly, so I did not change it.
