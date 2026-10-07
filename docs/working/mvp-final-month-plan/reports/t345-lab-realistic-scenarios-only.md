# t345: the Lab refuses scenarios outside the ten realistic ones

Worker: t345-realistic-only. Worktree `C:\Users\osrs_\FluxStuff\fxwork\t345-lab-realistic-scenarios-only`
(branch `task/t345-lab-realistic-scenarios-only`, base `757d8bd6`). Not committed.

## Outcome

Done. Every Lab launch entry I found now refuses any scenario outside the ten,
with one message that names the entry, the refused scenario(s), the rule and
the ten:

> `lab run refused basic-form: every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios (user rule, 2026-09-29): everything-store, crossborder-marketplace, bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed, company-website, professional-network.`

Note: the brief named the worktree `fxwork\t345\!FluxIQWebExtension`; the
worktree that exists for branch `task/t345-lab-realistic-scenarios-only` is
`fxwork\t345-lab-realistic-scenarios-only` (flat). All edits are there.

## What changed and why

**The one list (proposed owner: the test-runner).**
`packages/test-runner/src/realistic-scenarios/index.ts` holds
`REALISTIC_SCENARIO_IDS`, `RealisticScenarioId`, `isRealisticScenario`,
`unrealisticScenarioRefusal(ids, entry)` and `assertRealisticScenarios`.
Test-runner owns it because the rule is about launching runs, which the runner
and the Lab scripts do; scenario-lab defines fixtures (and is not a test-runner
dependency). The code lives in the barrel itself, imports nothing and uses only
erasable TypeScript, because the `.mjs` launchers import it straight from
source (Node 22.23 strips types natively; verified) so they can refuse before
the runner is built. A separate `list.ts` re-exported as `./list.js` would not
resolve under type stripping, and the structure audit refuses a script importing
past a barrel. Re-exported from `src/index.ts`.

**Launch entries found (listed before editing) and what each now does:**

| Entry | File | Refuses |
| --- | --- | --- |
| `pnpm lab run / interactive / replay / matrix --scenarios-json` | `scripts/lab/run-lab.mjs` + new `scripts/lab/scenario-guard/` | First thing after `stop`: before the live-run guards (so nothing reaches the spend ledger), the Core checks and the build. The scenario must directly follow the command; `run --flow basic-form` is refused rather than guessed. `matrix --all` admitted (runner restricts it). |
| Runner CLI (`dist/cli.js`, `fluxiq-lab`) | `packages/test-runner/src/cli.ts` | Right after `parseLabCommand`, for run/interactive/replay/matrix; `matrix --all` expands only to realistic manifests; `bench` refuses any corpus naming another scenario (all three corpora today: smoke, week1, week2). |
| `pnpm lab:campaign` | `scripts/lab/live-campaign/selection.mjs` | A task named by id on another scenario is refused (live and dry run); `--kind`, `--all` and the dry-run default choose only realistic-scenario tasks. Each spawned run also passes through run-lab's guard. |
| `pnpm lab:adversarial` | (no change) | Spawns run-lab per condition, so run-lab refuses each. |
| `pnpm ui:e2e` | `scripts/run/ui-e2e.mjs` + new `ui-e2e/realistic-selection.ts` | Before preparing a workspace: each journey declares the scenarios it opens (F1/F3 llm-target-drift, F2 product-catalog, F4 both; P1-P6 not wired, none). |
| `pnpm panel:golden` | `scripts/run/panel-golden-path.mjs` | On `FLUXIQ_LLM_SCENARIO_ID` (default instruction-only-form) before Core starts. |
| Demo workspace browser sessions (`demo:*`, every ui:e2e journey) | `demo-workspace/browser-session.ts` (`withDemoBrowser`), `demo-workspace/scenario-lab.ts` (`demoScenarioIdOfPath`) | Before the scenario lab or browser starts. Backstop: for demo lanes that start Core first, Core is already running when this refuses (see Not verified). |
| Extension chat check | `extension-chat-check/run-chat-check.ts` | Private copy of the list removed; uses `assertRealisticScenarios` (same position, first line). |
| `pnpm lab:pair` | (no change) | Moves worktrees and names no scenario, so there is nothing to guard. |

**Docs.** `docs/architecture/testing-facility.md`, new subsection "Only the ten
realistic scenarios run" at the top of "Scenario lab and contract", with the
entry table.

**Tests changed to keep passing.** `src/tests/cli-llm.test.ts` (its live and
create-flow refusals used basic-form / product-catalog; now company-website and
the stub catalog under `everything-store`); `live-campaign/tests/tasks.mjs`
gains `REALISTIC_CATALOG`/`REALISTIC_REPAIRS` stand-ins, used by
`command-line.test.mjs` and `selection.test.mjs` (the original `CATALOG` stays
for row/runner tests that never select).

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner build` -> `{"build-cache":"build","step":"test-runner:build",...}` (tsc clean).
- `node --test dist/realistic-scenarios/tests/*.test.js dist/tests/cli-llm.test.js dist/ui-e2e/tests/*.test.js dist/demo-workspace/tests/*.test.js dist/extension-chat-check/tests/*.test.js` (in packages/test-runner) -> `# pass 79 # fail 1`. The one failure is `a dry run reports the Core web build it would serve, and whether it is cached` (`cached: false` vs `true`), pre-existing: the same test fails identically from the main checkout's dist on dev `8547c00b`. It is in t344's core-web-build area; not touched.
- `node --test scripts/lab/scenario-guard/tests/*.test.mjs scripts/lab/live-campaign/tests/*.test.mjs scripts/lab/tests/*.test.mjs` -> `# pass 47 # fail 0`. Includes a spawned `node scripts/lab/run-lab.mjs run basic-form --flow` (and `run product-catalog --live-llm ...`, `interactive basic-form`) whose only JSON line is `scenario-guard:refused`, exit 1, nothing written under its temp roots.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (176 warning(s), 182 baselined).` (none of the warnings are on touched files).
- `node --check` on `scripts/run/ui-e2e.mjs`, `scripts/run/panel-golden-path.mjs`, `scripts/lab/run-lab.mjs` -> OK.
- Fail-first, campaign: with `selection.mjs` restored to HEAD, `selection.test.mjs` + `command-line.test.mjs` -> `# pass 6 # fail 3` (the new refusal tests and the dry-run count); restored my version.
- Fail-first, runner CLI and chat check: compiled HEAD `cli.ts`/`run-chat-check.ts` to a scratch dir (deleted after) and probed: `run basic-form --flow --live-llm ...` and `run product-catalog ... create-flow --dry-run` both got past any scenario check to `DEEPSEEK_API_KEY is not set` (no rule refusal); HEAD chat check said `basic-form is not one of the ten realistic scenarios` (no rule, no list).

## Not verified

- No Lab or browser run (by brief). Refusals proven by unit tests and one spawned run-lab that refuses before doing anything.
- Fail-first was not observed for run-lab, the bench/matrix CLI paths or `withDemoBrowser`: on the unguarded code those commands would actually start a build, Core or a browser. The tests instead assert nothing was started or written.
- `matrix --all` restricted to realistic scenarios is not exercised by a test (it would start runs).
- Demo lanes (`demo:run`, `demo:record`, most `demo:llm:*`) start their Core before `withDemoBrowser`, so for those the refusal comes after Core starts, before the scenario lab or browser. Entry-level refusal would mean editing about 30 scripts under `scripts/*.mjs`; not done.
- The UI journey scenario table is a declaration; if a journey changes its scenario, `withDemoBrowser` still refuses by the page it opens.
- Not guarded (they are not Lab launches but do open browsers): `apps/extension` Playwright e2e (`test:e2e`), `apps/scenario-lab` e2e, and test-runner unit tests that launch browsers (`guarded-browser/tests/*`, `run-scenario/browser-session/*/tests/server-probe.test.ts`). The scenario-lab browser unit tests are all on realistic scenarios.
- No real `pnpm lab:campaign --dry-run` against the real catalog (it takes the Lab build lock while t344 works); covered by the stub-catalog tests.

## What the guard now refuses (existing commands, tests and scripts)

- `pnpm lab run|interactive|replay <any non-realistic scenario>`, `matrix --scenarios-json` naming one.
- `pnpm lab bench --corpus smoke|week1|week2` (every corpus).
- `pnpm lab:adversarial`: every condition (basic-form, dynamic-list, delayed-ui, auth-gate, ...).
- `pnpm lab:campaign`: 79 of 146 creation tasks and 19 of 30 repair tasks (counted from the t345 tree's scenario-lab dist) are refused by id and skipped by `--kind`/`--all`.
- `pnpm ui:e2e` (default provider-free lane, and each of F1-F4).
- `pnpm panel:golden` unless `FLUXIQ_LLM_SCENARIO_ID` names a realistic scenario.
- `pnpm demo:run`, `demo:record` and the browser-opening `demo:llm:*` lanes (default page `/scenarios/basic-form/`, or the instruction-only-form request).
- No unit test is refused: the only tests that went through a guard used basic fixture scenarios as stand-ins and were moved onto realistic ids.

## Open questions or contradictions found

- `pnpm ui:e2e`, bench, the adversarial lane and the demo lanes are now unusable until they are rebuilt on realistic scenarios. Decide whether to port them or retire them.
- `--kind`/`--all` silently narrow the campaign to realistic tasks rather than refusing; explicit ids are refused. Change to a refusal if the supervisor prefers.
- The brief listed "pair" among run-lab subcommands; `lab:pair` names no scenario, so it has no guard.
