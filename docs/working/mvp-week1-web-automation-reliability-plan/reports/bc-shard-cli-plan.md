# `bc-shard-cli-plan` — flags and deterministic partition

## Outcome

Implemented the bounded command/parser and pure plan-partition seam without
changing campaign identity, persistence, execution, or the CLI dispatcher.
Serial command output is shape-compatible when `--shards` is absent.

Creation accepts `--shards 2..8` and optional `--jobs 1..shards`. It rejects
unsafe/non-integer values, duplicates, `--jobs` without `--shards`, and all
shard/job overrides on `--resume`.

The exported sharding surface is:

- `CAMPAIGN_SHARD_ALGORITHM` (`result-round-robin-v1`)
- `MIN_CAMPAIGN_SHARDS` / `MAX_CAMPAIGN_SHARDS`
- `CampaignPlanShard`
- `createCampaignPlanShards`
- `assertExactCampaignShardCoverage`

Partitioning groups result identity as
`[corpusRowId, scenarioId, workflowId, variantId, lane]`, deliberately excluding
repeat. Groups retain first-plan order and are assigned round-robin; therefore
all repeats remain together and group counts differ by at most one. Child
ordinals are local and contiguous while identity-bearing cell keys are
unchanged.

Coverage validation fails closed on invalid shard counts/indices/algorithm,
bad full or local ordinals, duplicate/foreign/overlapping/omitted cells, split
repeats, and identity or metadata changed behind a preserved cell key.

## Validation

- Direct strict TypeScript compilation of the owned source/test dependency
  graph: passed.
- Direct command and shard-plan tests from isolated compiled output: 26/26
  passed, including four focused shard tests.
- `git diff --check` over all owned code files: passed (only expected LF/CRLF
  checkout warnings).
- An earlier full package run reached 735 tests: 734 passed and one new overlap
  fixture failed because its deliberately appended cell had a nonlocal ordinal.
  The fixture was corrected to preserve local ordinals, then the focused test
  passed. This was a test-fixture precedence issue, not a product failure.
- Final package-wide `check` could not run cleanly because concurrent integration
  outside this brief left `campaign/store.ts` referring to missing
  `parseExecution`, while `run-bench.ts` and `campaign-store.test.ts` omitted a
  newly required `execution` member. Those files were not changed here. The
  supervisor must rerun the full package check/test after that integration lands.

## Contract follow-up for the supervisor

`assertRunEvaluation` is publicly unsound for a direct schema-0.1 caller: its
normalizing validator can return a different schema-0.2 value, but the assertion
narrows the original unmodified object. The production path inspected for this
work constructs current evaluations and does not appear to expose that legacy
case, but external/direct assertion callers can.

Minimal correction: preserve schema-0.1 normalization in the value-returning
`validateRunEvaluation` and `parseRunEvaluationJson` APIs, but make
`assertRunEvaluation` reject whenever validation normalized/replaced the input
(for example, `checked.value !== input`). Migrate the direct legacy assertion
test/caller to parse or validate and consume the returned value. No contract
files were edited under this brief.

## Files

- `packages/test-runner/src/commands.ts`
- `packages/test-runner/src/tests/commands.test.ts`
- `packages/test-runner/src/bench/campaign/shard-plan.ts`
- `packages/test-runner/src/bench/campaign/tests/shard-plan.test.ts`
- `packages/test-runner/src/bench/campaign/index.ts`
- this report

No Lab execution, production campaign execution, commit, or push was performed.
