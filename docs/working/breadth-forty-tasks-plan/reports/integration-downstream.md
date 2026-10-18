# integration-downstream (t718) report

Worker: `integration-downstream`. Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t718-integration-checks` (dev at 26c89262). Nothing committed.

## Outcome

Done. Every check in the brief passes. The only two failures were the two known ones, and both are fixed at their cause. No failure came from merging two lanes: the domain structure tests, `field-sample.ts` and `packet.ts` included, all pass under `runtime/llm-evidence`. Nothing outside `domain/`, `apps/extension/` or `apps/scenario-lab/` needed a change.

## What changed and why

### (a) `domain/src/runtime/tests/carried-service-repair.test.ts`: "refuses missing start before full-test actions"

- **Cause.** The test was out of date, not the product. Core commit `15190471` (2026-10-16, t688, "The result repair starts where it stands…") added `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/starts-where-it-stands.ts`. Under that rule, when the first step of a test is an unchanged carried step and the run being repaired captured no start for it, the test sends the step from where the page currently stands, with no reset, the same way the saved Flow's own playback starts it. The `missingStart` fixture is exactly that case. The run now repairs and succeeds instead of being refused with `full_run_required`. The test still expected the pre-t688 refusal. That fits lane 3 finding the failure already present on dev fb3919e2.
- **Change.**
  - The `for (missing of ["declaration","start"])` loop is split into two tests.
  - The declaration test is unchanged: it still expects `failed`, `full_run_required`, and no repair actions.
  - The new start test is "actual saved repair without a captured start tests the carried Flow where it stands". It asserts:
    - the saved run executes click and type;
    - the replacement is checked;
    - **no `web.browser.navigate`** is sent, so no reset is invented;
    - the carried opener `#open` replays, then the type with `right`;
    - the accepting judge comes after those commands;
    - status is `succeeded` and the final text is `right`.
  - The test keeps the old "URL-less host captures must not invent a start token" assertion. It is now limited to the saved run's attempts, meaning the attempts before the `result-verification` attempt. The repaired Flow's later playback is captured through the evidence gateway, whose page includes the URL, so those attempts rightly carry `beforeAction.from`. I confirmed this by dumping the attempts once (temporary diagnostic, now removed): the saved `start`/`open`/`type` attempts had no `stateRefs`, and only the attempts after verification had `from`.

### (b) Extension panel/chat tests: "Cannot assign to read only property 'chrome'"

- **Cause.** The real trigger is the filter fragment `panel/tests`, not `css-tokens.test.ts` itself. That fragment also matches `src/background/panel/tests/*`. Two of those files define the global without `writable`, and so does `src/background/tests/scripted-navigation-control.test.ts` (it is not matched by that fragment, but leaks the same way in wider runs). All three use `Object.defineProperty(globalThis, "chrome", { configurable: true, value })`, which leaves the global non-writable, and never restore it. The files are:
  - `background/panel/tests/auto-connect.test.ts`
  - `background/panel/tests/panel-control.test.ts`
  - `background/tests/scripted-navigation-control.test.ts`

  Every later `globals.chrome = …` in the same process then throws. The panel chat tests (`chat-panel`, `chat-run-controls`, `live-run-display`, `build-request`) all assign that way.
- **Reproduced.** `EXTENSION_TEST_BUILD_LABEL=t718 node scripts/test-extension.mjs panel/chat panel/tests` gave 10+ `not ok` with that exact error. By contrast, `panel/chat panel/tests/css-tokens` passed (367/367) before the fix.
- **Change.** In each of the three files, the chrome installer now takes the node:test `TestContext`, saves the previous descriptor, and restores it, or deletes the global, in `t.after`. The call sites now pass `t`, and the callbacks changed from `async () =>` to `async (t) =>`. auto-connect's inline `defineProperty` goes through the same helper. Each file got a short comment explaining why.

## Commands run and observed results

Commands were run from the worktree. Labels were `DOMAIN_TEST_BUILD_LABEL=t718` and `EXTENSION_TEST_BUILD_LABEL=t718`.

**Typechecks** (all exit 0)

| Command | Directory | Result |
| --- | --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | `domain/` | exit 0 |
| `npx tsc -p tsconfig.test.json --noEmit` | `domain/` | exit 0 (rerun after the edit: exit 0) |
| `node scripts/check-extension.mjs` | `apps/extension` | exit 0, before and after the edits |
| `npx tsc -p tsconfig.test.json --noEmit` | `apps/extension` | no output, after the edits |
| `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check` | root | exit 0 |

**Domain tests**

| Command | Result |
| --- | --- |
| `node scripts/test-domain.mjs runtime/llm-evidence output-nodes element-fingerprint actions client` | tests 1623, pass 1623, fail 0, exit 0 |
| `node scripts/test-domain.mjs runtime/tests` (before the fix) | tests 114, pass 113, fail 1 (`not ok 69 - actual saved repair refuses missing start…`: expected `failed`, got `succeeded`; diagnostic `repairActions` click, type, click, type, `judgeCalls` 5) |
| `node scripts/test-domain.mjs runtime/tests/carried-service-repair` (after the fix) | tests 6, pass 6, fail 0 |
| `node scripts/test-domain.mjs runtime/tests` (after the fix) | tests 114, pass 114, fail 0, exit 0 |

**Extension tests**

| Command | Result |
| --- | --- |
| `node scripts/test-extension.mjs content background panel shared` (before the fix) | tests 2849, pass 2849, fail 0, exit 0. This filter order hides (b). |
| `node scripts/test-extension.mjs panel/chat panel/tests` (before the fix) | the read-only `chrome` failures above |
| `node scripts/test-extension.mjs panel/chat panel/tests` (after the fix) | tests 428, pass 428, fail 0, exit 0 |
| `node scripts/test-extension.mjs content background panel shared` (after the fix) | tests 2849, pass 2849, fail 0, cancelled 0, exit 0 |

**Scenario-lab and structure**

| Command | Result |
| --- | --- |
| `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test` | tests 871, suites 26, pass 871, fail 0, cancelled 0, exit 0 |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (208 warning(s), 638 baselined).`, exit 0 |

## Not verified

- No full suites were run (`pnpm check`, `pnpm test`, `pnpm build`), as the twice-a-day rule requires.
- No Core tests were run. Core was not edited.
- No live or browser validation was done. Every change is test-only.
- `src/background/tests/extraction-harness.ts` and `src/panel/extraction/tests/preview-reread.test.ts` also install a fake `chrome` and do not restore it. They define it with `writable: true`, so they cannot cause the read-only error, and I left them alone.

## Open questions or contradictions found

- The start test expects four repair-phase acts with no navigate: click and type for the build's whole test, then click and type again for the repaired Flow's playback. The ordinary test shows the same doubling, plus a navigate. I read that as the "every_run" result check running the applied Flow again. I did not trace it into Core.
- Core's rule that a carried first step with no captured start runs where it stands (t688) is the behaviour this test now pins. If the supervisor did not intend t688 to cover a capture that only lacks a URL, the place to change that is Core, not this test.
