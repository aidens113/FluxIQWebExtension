# t262 live lane A preparation

Status: Complete
Owner: resume-live-prep worker
Updated: 2026-10-03
Scope: Read-only command, ownership and guard preparation; no launch or runtime mutation.

## Current State

- Run from `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQWebExtension`, paired with `../!FluxIQ`. Both HEADs contain their local dev: downstream `88c58d82`, Core `f6ef9f48`, lacking zero commits at inspection.
- Slot 2 and slot 3 directories are empty. Slot 1 and slot 4 hold zero-byte `owner` markers; preserve them. Select slot 2 for this resumed lane A, with instance `t262-slot-2`, after the supervisor rechecks processes and claims it exclusively. Slot numbering is ownership, not scenario identity.
- Machine metadata: `STOP-balance` absent; no `OVERRIDE-*` files; zero ledger entries for `t262-slot-2`. Fresh instance therefore has no previous-run debug/unchanged or recent-start loop refusal. The production launcher must still evaluate all guards immediately before launch.
- Do not call `admitLiveRun` merely to inspect: it reconciles the ledger. This worker only read ledger and ancestry metadata and did not mutate any slot, guard, ledger, environment file, profile or provider state.
- Claude lane A run 3 completed; its lead report's in-progress row is stale. Ledger and saved entry/summary agree: `run-musuq910-0e2ae903`, failed, $0.048319884, finished 2026-10-03T20:41:09.803Z (ledger finish 20:41:11.339Z), 141 recorded steps, 23 screenshots. No matching run-3 debug file was found in t174's debug directory. This failure remains an investigation requirement; a fresh label must not be used to rerun unchanged failed source or evade that investigation.

## Ready-to-run command

The exact scenario is `crossborder-marketplace`; instruction task is `crossborder-marketplace-hub-to-cart`. Use one direct launcher invocation rather than the campaign's default three attempts. The browser launcher hardcodes `headless: false`; there is no headed flag to add. The default creation path is the extension chat, with the live panel enabled; do not add `--direct-api-build` or `--no-live-panel`.

```powershell
$env:FLUXIQ_LAB_INSTANCE = 't262-slot-2'
$env:FLUXIQ_TEST_ENV_FILES = 'none'
$env:FLUXIQ_TEST_TARGET = 'isolated'
$env:FLUXIQ_LLM_RUN_COST_CEILING_USD = '0.10'
$env:npm_config_workspace_concurrency = '1'
node scripts/lab/run-lab.mjs run crossborder-marketplace --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --llm-cost-ceiling-usd 0.10
```

Environment values above are public controls. Do not print provider variables or forward installation account credentials. `FLUXIQ_TEST_ENV_FILES=none` prevents existing-install configuration from contaminating the throwaway topology; the provider-credential reader resolves its credential separately. Test environment files being disabled does not disable `labCostCeilingValue`'s separate checkout configuration resolution. Explicit launcher environment pins .10; Core receives the same amount with `FLUXIQ_LLM_RUN_COST_CEILING_SCOPE=test` only in its Lab-owned child. Ordinary UI processes keep independent policy defaults.

Appending `--dry-run` checks the provider-free runner plan after necessary builds. It bypasses paid-run guard evaluation by design, so its success does not prove admission, live browser correctness, provider balance or cost savings. Do not use the compiled CLI directly with only an instance label: required built-path exports are provided by `run-lab.mjs`.

## Ownership and prerequisites

1. Preserve Claude's existing trees and markers. Recheck Lab process inventory and slot-2 emptiness immediately before claiming. There is no automated slot-owner acquisition in the launcher: slot directories document human/agent lane ownership. The supervisor can claim `lab-slots/slot-2/owner` with an exclusive `wx` creation recording task t262, lane A, instance, owning supervisor PID and timestamp. If creation fails because it exists, inspect rather than overwrite. Release only this task's own marker after its browser/topology has stopped.
2. Finish the reviewed A toggle/stale-handle integration and owning regression checks before the paid run. Investigate the completed failed run 3 and write its debug in the expected working-doc location; do not treat the fresh label as permission to ignore it.
3. Build changed Core library output (`pnpm.cmd --filter fluxiq build` in paired Core) after source freezes. No stale/behind override. The launcher checks Core ancestry, commit, missing entries, quiet output and source staleness before using Core.
4. Let the launcher's serialized build-cache prelude prepare instance-owned scenario, domain, extension, runner and host dependencies; this is runtime preparation, not a full test sweep. No separate repository-wide check/test/build sweep is required. Output paths are `.lab-instances/t262-slot-2/` inside the owning packages; host and unpacked extension paths are exported by the launcher.
5. Ensure inherited existing-install target variables are absent when using the isolated target; never expose their values. The authorized session permits this isolated Lab-owned panel/browser, not replacement of another running user's panel.
6. Keep one launch supervised. The production guard refuses empty balance, missing debug, unchanged failed source, stale dev ancestry, or three launches in thirty minutes. No override files may be manufactured by agents. After any failure, stop, inspect/debug, fix source, check narrowly, then rerun. A balance stop requires the user's intervention.

## Acceptance and evidence

- Verify `snapshots/flow-lane.json` reports `buildEntry: chat`; a created/persisted Flow, build test/judgements and actual playback must exist. Do not count compilation, model's completion wording or build-only success as pass.
- Four fixture facts must hold after playback: cart count 3, orders shipped 0, the exact intended cart line/options/quantity, and official-store coupon held. Read the oracle fact IDs and verdicts privately; do not publish captured page contents or credentials. Inspect whether cancelling option presses remain, whether exploration residue biases judges, and whether tabs grow across build tests/playback.
- Evidence bundle defaults to `test-runs/instances/t262-slot-2/<runId>/`; central local record is `C:/Users/osrs_/FluxStuff/lab-runs/<local-date>/<runId>/`. Inspect `entry.json`, `summary.json`, `evaluation.json`, `snapshots/live-llm.json`, `snapshots/flow-lane.json`, step `meta.json` and screenshots/review records. Record six-stage reach, full failure cause, calls by purpose, time, build purse and total run spend separately.
- Reconcile total run spend from observed usage against the central entry/ledger. `snapshots/live-llm.json` `observed.totalEstimatedCostUsd` is total spend; the per-build ceiling must be verified with recorded build spend (`buildCeilingUsd`, `maxBuildCostUsd`, `buildsOverCeiling` in finish ledger where present). The .10 creation/recovery purse is per build, not a claim that all chat/judge/other phases summed together are capped at .10.
- Inspect actual browser screenshots for extension chat, panel/overlay status, correct target options, final playback and failure presentation. Record browser version, Chromium extension build target, scenario, instance and isolated state. For later reuse/repair, preserve the resulting persisted Flow and reference its own artifacts; do not silently rebuild a different Flow.
- Every paid run needs `docs/working/language-driven-flow-loop-plan/debugs/<runId>.md`, even when passed, plus a continuation ledger entry and Claude handoff detailing reproduced causes, exact integrated files, validations, remaining gaps and next command.

## Verification performed / remaining

Performed: read lane A command/report, launcher and invocation paths, budget resolver, build prelude, guard rules/ledger reader, fixture oracle definitions; inspected only machine owner metadata, filtered ledger metadata and git dev ancestry. No browser/provider/panel operation, no slot claim, no guard or ledger mutation, no source changes, no tests/builds. Runtime output readiness, credential availability, live admission and correctness remain supervisor verification after integration.
