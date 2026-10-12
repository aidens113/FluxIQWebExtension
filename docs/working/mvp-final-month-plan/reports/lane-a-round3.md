# Lane A round 3 â€” crossborder hub-to-cart, candidate mode

Lead: t342 lane A (lead). Tree `fxwork/t342` (both repos on `task/t342-lane-a-baseline`; downstream 67661406 = dev
6e07993f plus lane evidence, Core 01621c94 = Core dev). Instance `t342-slot-2`, slot 2, workspace `t342-a`.
2026-10-12 UTC.

## Fix log

| # | Fix | File | Run that exposed it | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| - | none so far | - | - | - | - |

## Command

```text
FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 --authoring-mode candidate -- --target persistent-isolated --workspace t342-a
```

Spawned as `pnpm lab run crossborder-marketplace --live-llm --llm-profile lab-create-flow --llm-provider deepseek
--llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task
crossborder-marketplace-hub-to-cart --llm-max-input-tokens 992000 --llm-max-output-tokens 8000
--llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t342-a`.

## Preflight (0 provider calls)

- Campaign `--dry-run`: one spawned command (above).
- Lab `--dry-run` of it: exit 0, `status ready`, `providerCallCount 0`, created-flow, chat entry, persistent-isolated,
  deepseek-flash, `coreAuthoringMode candidate`, `candidateTrial {trialRunner: true, startReset: true, source:
  lab-plan}`, maxCalls 48, $0.10, `permittedConsequences []`, instruction 219 chars sha256 `2e6f5e7d...a405`. The
  prelude rebuilt the scenario Lab and the extension for the instance; everything else reused.

## Runs

| # | Run | Verdict | Oracle | Calls / cost | Debug |
| --- | --- | --- | --- | --- | --- |
| 1 | `run-mv4jihmm-af72a1e1` | passed | 4/4, final state held | 18 / $0.0304 | `debugs/run-mv4jihmm-af72a1e1.md` |
| 2 | `run-mv4jvo7k-612f0bbb` | passed | 4/4, final state held | 16 / $0.04782936 | `debugs/run-mv4jvo7k-612f0bbb.md` |

Both on guard fingerprint `sha256:686f7f26...` (the same product pair).

## 2026-10-11 evidence review

Both creation passes verified against saved steps, identity receipts, oracles and accounting. A is **not yet fully qualified**: separate zero-provider `lab replay` receipts for these two saved Flows are absent; their internal playback includes one model result judge each. All four running identities match across runs. Run-2 consequence receipt inconsistency and generic Clear the page recovery remain documented findings. Exact replay commands and IDs, evidence digests, qualification wording and limits: `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-review.md`. No fresh runs launched by the reviewing worker.

## 2026-10-11 separate reuse proofs completed

Both owed provider-free replays now passed on the frozen original product pair: run 1 -> `replay-mv4kt6g0-4e4900a8`; run 2 -> `replay-mv4kv3z1-2cfab70c`. Exact original saved hashes unchanged, task playback goal held, Core/accounted/provider/intervention/harness counts all zero, model wiring false, stored keys preserved. Both commands exited 0; every build reused, no source changes. **Creation/reuse qualification evidence complete; supervisor sign-off owed.** Earlier pending note above describes the initial review; this result supersedes its missing-replay gap. Consequence/UI/recovery findings remain. Full commands, receipt validation and limits: `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-zero-call-replays.md`.
