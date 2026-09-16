# Report: w2-flow-creation-iterates

Two repositories changed:

- **FluxIQ Core** (`F:\!FluxIQ`): only `apps/web/src/features/automation-studio/authoring/`.
- **This repository**: only the Lab's creation demo files and their tests.

Nothing was committed or pushed. No demo, `pnpm lab`, `pnpm dev` or `--live-llm` command was run. Nothing was run in a browser or against a real provider.

## Outcome

**Done.** "Build a new Flow by exploring a website" no longer carries a call count anywhere in the panel or in the Lab.

**Panel requests.**

- The preflight and grant requests for an exploration send no `maxCalls` and no `maxUses`, so Core applies its iterating default (26 calls, with a 100,000-token run budget).
- The grant's `ttlMs` is now a 60 s claim window, not a whole-run duration.
- The browser now waits 675 s for the exploration command: the 60 s claim window, plus Core's 600 s run lease, plus 15 s for the reply. It used to wait 195 s (4 calls × 45 s + 15 s).

**High-token warning.** It is now judged on the preflight's `maxTotalTokensPerRun`, taking the larger of that and one call's limit, which is Core's own rule.

- If the preflight has no run budget, the panel falls back to the old per-call × calls product.
- If the run budget is present but unreadable, the panel asks for confirmation.
- Effect: Core's default exploration (26 × 12,000 = 312,000 by the old product, 100,000 by budget) no longer triggers the confirmation dialog.

**On-screen text.** "Up to 4 model calls at 45 seconds per call." is gone. The panel now says:

> The model is asked as many times as the exploration needs, at up to 45 seconds per call. It stops when it has a proposal or stops making progress, or at 100,000 tokens, $1.00 estimated cost, or 10 minutes, whichever comes first.

- The token figure comes from the availability preflight. If the preflight gives none, the text says "its token budget" instead.
- The confirmation dialog now shows the run's real bounds: total tokens for the run, "As many as needed, at most N" calls, and a 10-minute time limit.

**Unchanged.** The single-call "author from instruction" build is exactly as before: `maxCalls: 1`, `maxUses: 1`, no `ttlMs`, and exact saved limits required.

**Lab.** The creation demos neither type nor assert an exploration call count.

- **Checks.** Both aggregate checks in `explore-proposal-ui.ts` (the high-token diagnostic and the accounting bound) now use the 100,000 run budget instead of 12,000 × 4 = 48,000.
- **Settings form.** The Lab no longer types a "Max calls" value into Flow Settings for the exploration Flow. The single-call build still types 1, which the panel requires.
- **Timeout.** The Lab's wait mirrors the panel's 675 s.

**Required checks, all passing:**

| Check | Result |
| --- | --- |
| Core `pnpm check` | exit 0 |
| Core web automation-studio tests | 1,067/1,067 |
| This repository's `pnpm check` | exit 0 |
| test-runner tests | 981/981, 0 failed |
| Structure audit, both repositories | passed |

## What changed and why

### Core, `apps/web/src/features/automation-studio/authoring/`

**`llm-preflight-run-limits.ts` (new, one export: `llmPreflightRunLimits`)**

- Reads a preflight answer (or a payload wrapping one) defensively and returns `perCallTotalTokens`, `maxCalls` and `runTokenBudget` (a number, or `"unreadable"` when the field is present but not a positive safe integer).
- The per-call figure is not held to finite, so an unbounded value still reads as high, as it did before.
- It is in its own file because `blank-flow-authoring-model.ts` already sits at 9 exported values, past the audit's advisory threshold of 8. It was 9 at `HEAD` and is still 9.

**`blank-flow-authoring-model.ts`**

- `WEBSITE_EXPLORATION_LIMITS`:
  - dropped `maxCalls: 4`;
  - gained `maxEstimatedCostUsd: 0.25` and `providerRetryCount: 0`, which were previously borrowed from the build profile;
  - gained `grantClaimWindowMs: 60_000`, Core's default TTL, inside Core's 1 s to 300 s range;
  - gained `runLeaseMs: 600_000`. This restates Core's `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS`, because the web app imports nothing from Core packages.
- `WEBSITE_EXPLORATION_OVERALL_TIMEOUT_MS` is now claim window + lease + 15 s = 675,000, where it was calls × per-call timeout + 15 s.
- `llmRequestRequiresHighTokenWarning` uses the reader and the rule above. `FlowRunView.tsx` (not mine) also calls it. Its existing fixtures carry no run budget, so they keep the old judgement, and its tests pass. A runtime recovery whose preflight returns Core's 100,000 budget will stop prompting too, which matches Core.
- Request building was split:
  - A shared private base covers the blank, instruction and provider/key checks.
  - `blankFlowAuthoringRequest` adds the one-call profile and still requires the saved limits to match exactly.
  - `blankFlowExplorationRequest` adds the exploration profile with no `maxCalls`, and ignores whatever call count the Flow saved.

**`BlankFlowAuthoringPanel.tsx`**

- The grant request is:
  - for an exploration, `ttlMs: WEBSITE_EXPLORATION_LIMITS.grantClaimWindowMs`, with no `maxUses`;
  - for the build, `maxUses: 1`.
- The run token budget from the availability preflight is kept in state for the bounds text.
- When the confirmation opens, the preflight's run limits are kept for the dialog rows. The dialog rows are generated per mode by a small private function.

**`authoring-commands.ts`**

- The value is unchanged in form (it still equals the overall timeout). A comment now says what it covers.

**`index.ts`**

- Re-exports `llmPreflightRunLimits`.

**`tests/blank-flow-authoring.test.tsx`**

Went from 11 tests to 15. Changed assertions:

- The exploration payload is checked exactly, with no `maxCalls`, including for a Flow that saved `maxCalls: 4`.
- The issue call is exactly `{ ...payload, ttlMs: 60_000 }`, with no `maxUses` and no `maxCalls`.
- The command policy timeout is 675,000.
- The build dialog rows are pinned, and the build still has `maxUses: 1` and no `ttlMs`.

New tests:

- The timeout derivation, the lease being over 600 s, and the claim window being within 1 s to 300 s.
- The high-token rule:
  - the default exploration gives no warning;
  - 100,001 warns;
  - an unwrapped 40,000 does not;
  - a per-call figure above the threshold warns;
  - with no run budget, the old product decides;
  - unreadable budgets (`"100000"`, 0, -1, 1.5, NaN, null) warn;
  - empty inputs do not.
- The exact bounds text with a 100,000 budget, and that the default exploration issues the grant without a dialog.
- The generic text when the preflight gives no budget.
- A 64-call, 640,000-token exploration: the dialog shows the real rows, and "Continue" issues the grant with `highTokenConfirmation`, the claim window, and no uses.

### This repository, `packages/test-runner/src/`

**`demo-llm-create-ui/limits.ts`**

- `EVIDENCE_GUIDED_CREATION_LIMITS` dropped `maxCalls` and `maxUses`, and added:
  - `maxTotalTokensPerRun: 100_000` (Core's derived default for this request);
  - `grantClaimWindowSeconds: 60`;
  - `runLeaseSeconds: 600`.
- `EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS` dropped `maxCalls`.
- `EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS` is (60 + 600) × 1000 + 15,000 = 675,000.
- `creationSettingsFields` includes the "Max calls" row only when the profile has one. So the build still types 1, and the exploration Flow's saved call count is left as it is. The Settings form accepts 1 to 8, and a new Flow defaults to 1.
- `FIRST_LIVE_CREATION_LIMITS` is unchanged.

**`demo-llm-create-ui/explore-proposal-ui.ts`**

- `aggregateAuthorizedTokens` is now `max(maxTotalTokensPerRun, maxTotalTokens)`.
- The accounting bound is now `totalTokens > maxTotalTokensPerRun`.
- The file no longer mentions `maxCalls` or `maxUses` (a test pins this).

**`demo-llm-exploration-request.ts`**

- The `providerBudget` readiness projection (type and value) dropped `maxCalls` and added `maxTotalTokensPerRun` and `runLeaseSeconds`.

**Tests**

- `demo-llm-create-ui/tests/exploration.test.ts`:
  - The profile and settings `deepEqual` checks are updated, and the timeout is 675,000.
  - The parser accepts exactly 100,000 tokens, and rejects 100,001 tokens and $1.01.
  - New test: the exploration profiles have no call count or uses; the exploration settings fields have no "Max calls"; the build's fields still include `["Max calls", "1"]`; and `explore-proposal-ui.ts` does not match `/maxCalls|maxUses/`.
- `tests/demo-llm-exploration-request.test.ts`: there is no `maxCalls` in `providerBudget`; the budget is 100,000 and the lease 600 s.

## Commands run and observed results

- **Core web type check.** `npx tsc --noEmit -p .` in `F:\!FluxIQ\apps\web`, before the tests were updated: exit 2. The single error was the old test reading `WEBSITE_EXPLORATION_LIMITS.maxCalls` (TS2339); the source compiled.
- **Core authoring tests.** `npx vitest run src/features/automation-studio/authoring`: 1 file, 15/15 passed.
- **Negative controls.** Each was applied to a scratch-backed copy, run, then restored. `cmp` confirmed both files byte-identical afterwards (printed `restored-identical`).

  | Control | Result |
  | --- | --- |
  | A. Warning ignores the run budget (old product only) | 2 failed: the high-token-rule test and the bounds/no-dialog test |
  | D. Exploration request sends `maxCalls: 4` | 4 failed |
  | B. Exploration grant sends `maxUses: 26` | 3 failed |
  | C. Exploration grant sends `ttlMs: 675_000` | 3 failed |

- **test-runner type check.** `npx tsc -p tsconfig.json --noEmit` in `packages/test-runner`: exit 0.
- **test-runner suite.** `pnpm --filter @fluxiq-web-extension/test-runner test`: exit 0, `# tests 981`, `# pass 981`, `# fail 0`.
  - The brief's baseline was 976. My change adds 1 test. The other 4 are presumably another worker's; I did not identify them.
  - The changed tests ran and passed: `ok 172` (parser), `ok 173` (no call count), `ok 174` (launcher/driver), `ok 175` (classifier), `ok 185` (Phase 3 UI driver, which still finds `limits.maxCalls` in the compiled output), and `ok 773` (readiness).
- **Core `pnpm check` (root).** Exit 0.
  - `structure-audit: passed (140 warning(s), 254 baselined).`
  - `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web` all reported `check: Done`.
  - The only audit line naming `authoring/` is the existing `[exported-values] … blank-flow-authoring-model.ts: 9 exported values` warning. `git show HEAD:` of that file also counts 9.
- **Core web automation-studio tests.** `npx vitest run src/features/automation-studio` in `apps/web`: exit 0, `Test Files 199 passed (199)`, `Tests 1067 passed (1067)`.
- **This repository's `pnpm check`.** Exit 0.
  - `structure-audit: passed (57 warning(s), 17 baselined).`
  - All ten workspace packages reported `check: Done`, including `packages/test-runner`.
  - The one audit line naming a file of mine is the existing `[exported-values] … demo-llm-exploration-request.ts: 11 exported values`; I added no exports there.
- **Core handler, read to confirm the omission is accepted.** `api/handlers/llm-generation.ts:55` forwards `maxUses: payload.maxUses` and `ttlMs: payload.ttlMs` untouched. An omitted `maxUses` therefore reaches `issue()` as `undefined`, which skips the "uses must match" check.
  - `preflight()` gives `build_and_adapt` (an iterating purpose) 26 calls when none are named.
  - The run budget is `max(12,000, min(312,000, 100,000))` = 100,000.
  - The exploration's `maxTotalEstimatedCostUsd: 1` is valid (between $0.25 and $2).

## Not verified

- **No browser, Lab demo or real-provider run.** The panel's new text, dialog and timing were checked only in `react-test-renderer`. No real exploration has run under the 26-call / 100,000-token / 600 s model.
- **The end-to-end request path.** It was not exercised through the real HTTP handler and grant service. The claim that Core accepts a `build_and_adapt` preflight and issue with no `maxCalls` or `maxUses` and a 60 s TTL rests on reading `execution-grants.ts` and the handler.
- **The restated constants.** Core's 600 s lease (panel and Lab) and 100,000 run budget (Lab only) are restated. They are pinned only by literal tests, not against Core's exported values (see open question 2).
- **The saved "Max calls" value.** The Lab no longer types it for the exploration Flow. That this keeps Settings saves valid rests on the form's 1-to-8 range and its default of 1 (`flow-settings-model.ts:178,322`), not on a run.
- **Wider test runs.** I did not run `pnpm test` or `pnpm build` in either repository, beyond the named package suites.

## Open questions or contradictions found

1. **Stale Settings text (not my file).** `apps/web/.../settings/FlowSettingsView.tsx:298` still tells users "Use 1 for diagnosis-only, 2 for diagnose-and-adapt, or up to 8 for bounded evidence-guided generation", with `FLOW_LLM_MAX_CALLS = 8`.
   - The exploration path no longer reads the saved call count, so the "up to 8" hint is now misleading.
   - The supervisor's `run-input-model.ts` comment suggests recoveries ignore it too.
   - The Settings field and its hint need a decision from whoever owns `settings/`.
2. **Core's built output is stale.** The Lab resolves `fluxiq/automation-studio` to `packages/fluxiq/dist`. The built `execution-grants.js` there (dated Sep 16 02:09) still has `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS = 8`, `EXPLORE_DEFAULT_MAX_CALLS = 6`, and no `…_MAX_RUN_MS`.
   - This means the Lab's suite and any Lab run import pre-change Core runtime code.
   - Once Core is rebuilt, a Lab test should pin `EVIDENCE_GUIDED_CREATION_LIMITS.runLeaseSeconds * 1000` to `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS`, and `maxTotalTokensPerRun` to `min(12,000 × AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS, AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD)`. Both constants are publicly exported from Core source.
   - I did not rebuild, because `packages/**` is outside my brief.
3. **The run budget in the Lab is Core's default, not the preflight's answer.** The Lab's aggregate check assumes Core's derived 100,000. If Core's default changes, the Lab check drifts silently until question 2's pin exists. The panel does not have this problem: it reads the budget from the preflight.
4. **The dialog cannot show a budget for the build path.** It shows "Total tokens for the run: Not reported" when a build preflight carries no `maxTotalTokensPerRun`, which is the existing test fixture. Real Core returns 5,000 there, so the row shows "5,000" in practice.
