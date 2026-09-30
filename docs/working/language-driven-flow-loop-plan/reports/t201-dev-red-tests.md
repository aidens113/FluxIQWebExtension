# t201: three tests red on dev

Worker report. Trees: `fxwork/t201/!FluxIQ` and `fxwork/t201/!FluxIQWebExtension`, branch `task/t201-dev-red-tests`. Nothing committed.

## Outcome

Done. All three are green. For item 1 the product was already safe on delete. The test was stale, and the product had two defects in the same place, both now fixed. Items 2 and 3 were stale tests: the product changes that broke them were intended.

## What changed and why

### 1. Core `conversations/commands/tests/execute.test.ts`: "never grants a delete by typing"

**Cause:** a semantic merge conflict at `ad1aa5b0` ("Merge task t195: live lane D (integration round 2)"). The test came from `3997445b`, the extension-chat lane (02:13). It used a `send_or_publish` confirm as its example of an ask that typing may grant, because `destructive.ts` then had `send_or_publish: false` (confirmed with `git show 564863b7:.../destructive.ts`). Lane D's `05266957` (02:55, not an ancestor of `3997445b`) gated `send_or_publish` again under the user's rule that money, delete and send/publish always ask. After the merge, `answer-ask.ts` refuses a typed yes to the publish ask. The observed failure was `status: "failed"`, summary `"...saying yes to that would delete something or move money, which is confirmed with your PIN..."`.

**Verdict:** the product's refusal is correct and the test was stale. A typed "yes" never granted a delete: the refusal ran before `answer-ask` was called. I did find two product defects in the same command, and fixed both:

- **Misleading message:** a person answering a publish question was told it "would delete something or move money". The header comment said only two classes were gated. The message now names each gated class from `AUTOMATION_STUDIO_ACTION_CONSEQUENCE_PHRASES` (for example "send or publish something that others will receive or see"). The comment names all three classes and records the history.
- **Latent hole, choice and open answers:** the check ran only when `answer.kind === "grant"`. `ask.ts` documents that "a `confirm` or a `choice` that commits something says so" in `consequences`. For such a choice ask with `consequences: ["delete"]`, typing an option's label ("go ahead") settled it through `answer-ask` without the PIN. No producer raises a choice ask with gated consequences today, because `person-needed-ask.ts` and `result-check-schedule` both pass `[]`. The rule is now that a gated ask is settled from words only by a **deny**. A grant, a choice or passed-on text are all refused.

The test is rewritten against the current gated set:
- A `modify_existing` confirm is granted by a typed yes.
- `delete`, `send_or_publish` and `move_money` confirms each refuse a typed yes, with "PIN" and the class phrase in the summary, and the ask stays pending.
- A choice ask with `delete` refuses "go ahead".
- A typed "no" to the delete ask is taken as a deny.
- An unclear answer is still unread.

Files: `packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/answer-ask.ts`, `.../commands/tests/execute.test.ts`.

### 2. test-runner `run-evaluation/tests/runner-wiring.test.ts`: the redaction attestation pin

**Broken by `38acbc05`** (t182, "The extension reconnects, keeps private data out, and can report a problem", 2026-09-29 17:22). I found it with `git log -S "workspaceWrittenSince: target.mode" -- packages/test-runner/src`, which lists `39598232` (added the pinned string) and `38acbc05` (removed it). t182 added the extension storage in the run's own browser profile as a third redaction scope, bounded by the same `writtenSince`. To do that it hoisted `writtenSince` into a const, so the verbatim call the test pinned no longer existed. The product change is intended and still scans more, not less.

**Fix:** the test pins the new shape:
- `writtenSince` is set only for `persistent-isolated`.
- The call passes `workspaceWrittenSince: writtenSince, extensionStorage`.
- The profile is `topology?.allocation.browserProfileDir`, never a user's own.
- Extension storage carries the same `writtenSince`.

The ordering assertions are unchanged.

### 3. test-runner `tests/demo-workspace.test.ts`: "resolves one reusable demo directory below the configured runs root"

**Broken by `c16fb5bd`** (t179, 2026-09-29 17:29). I found it with `git log -S 'FLUXIQ_DEMO_HEADLESS", false)'`. That commit changed the default of `resolveDemoWorkspaceConfiguration` to headed (`headless: false`) under the user's rule that Lab browsers are never headless. It updated `demo-workspace/tests/configuration.test.ts` but not this older assertion (`config.headless === true`). The product is right. The assertion is now `false`, with a comment giving the rule and the commit.

## Commands run and observed results

- `npx vitest run conversations/commands/tests/execute.test` (Core `packages/fluxiq`, before the fix): 1 failed, 9 passed. The failure matched the brief: `expected { capabilityId: 'ask.answer', …(3) } to match object { status: 'done', …(1) }`.
- `npx vitest run conversations/commands` (after the fix): `Test Files 4 passed (4)`, `Tests 25 passed (25)`.
- `npx tsc --noEmit -p .` (Core `packages/fluxiq`): exit 0, no output.
- `node scripts/structure-audit.mjs` (Core): `structure-audit: passed (199 warning(s), 354 baselined)`, exit 0. It also said "1 baseline entries can be lowered". Neither of my files is in the baseline.
- `pnpm --filter @fluxiq-web-extension/test-runner build`, then `node --test dist/tests/demo-workspace.test.js dist/run-evaluation/tests/runner-wiring.test.js`:
  - before the fix: `not ok 11` (runner-wiring:122, "a persistent-isolated workspace is bounded…") and `not ok 24` (demo-workspace:38, `false !== true`), 34/36
  - after the fix and a rebuild: `# tests 36 # pass 36 # fail 0`
- `node --test dist/run-evaluation/tests/*.test.js dist/demo-workspace/tests/*.test.js dist/redaction-attestation/tests/*.test.js dist/tests/demo-workspace*.test.js`: `# tests 140 # pass 140 # fail 0`.
- `npx tsc --noEmit -p tsconfig.json` (`packages/test-runner`): exit 0.
- `node scripts/structure-audit.mjs` (downstream): exit 1. The one violation is `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`. This is **not from this change**: `git status` shows only my two test files modified, and nothing under `docs/`. The README is a shared document, so I left it alone.

## Not verified

- The full Core vitest suite, and `apps/web` tests that may show the `ask.answer` summary text. I found no other code or test containing the old wording, apart from an unrelated walkthrough report in the downstream docs.
- Whether the panel's own question control really takes a PIN for a `send_or_publish` ask. The refusal text keeps the product's existing "confirmed with your PIN on the question itself" claim. I did not trace the panel UI.
- I did not run `git bisect`. The breaking commits come from `git log -S` on the exact changed lines, with parent-state checks (`git show 564863b7:...`).

## Open questions or contradictions found

- The downstream structure audit is red on dev for the `docs/working/README.md` index (it needs `pnpm structure:baseline`). This is a supervisor job.
- `05266957` reported "Core vitest 2422/2422" because lane D's branch did not yet contain `3997445b`'s test. The break only appeared after the merge. The integration round's check after `ad1aa5b0` should have caught it.

Ready to commit:
- Core: `packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/answer-ask.ts`, `packages/fluxiq/src/programs/automation-studio/runtime/conversations/commands/tests/execute.test.ts`
- Downstream: `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`, `packages/test-runner/src/tests/demo-workspace.test.ts`, and this report

Validation: `npx vitest run conversations/commands` -> 25/25 passed. `node --test` on the two test-runner files -> 36/36. The neighbouring test-runner suites -> 140/140. Both `tsc` runs -> exit 0. Core structure audit -> passed. Downstream structure audit -> 1 violation, the stale README index from before this change.
