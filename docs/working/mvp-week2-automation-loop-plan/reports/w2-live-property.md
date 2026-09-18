# w2-live-property — live DeepSeek creation run on the property-listings fixture

**Date:** 2026-09-17 (run wall clock 2026-09-18T00:16Z–00:34Z)
**Lab instance:** `prop-a` · isolated target · `FLUXIQ_TEST_ENV_FILES=none`
**Outcome:** the run tested nothing. All eight tasks failed before a single
request left the machine. Zero provider calls, zero tokens, $0.00 spent.

## What was run

Exactly the briefed command, unmodified:

```
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=prop-a \
  pnpm lab:campaign property-listings-newest-homes \
    property-listings-newest-homes-agent-withheld \
    property-listings-kelford-homes \
    property-listings-kelford-homes-renamed-pagination \
    property-listings-no-matches property-listings-cheapest-home \
    property-listings-home-facts property-listings-last-page
```

with `DEEPSEEK_API_KEY` exported from `.env.local` beforehand (key extracted,
35 characters, never printed). The campaign exited 1 after roughly eighteen
minutes.

Per task the campaign resolved to
`pnpm lab run property-listings --live-llm --llm-profile lab-create-flow
--llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow
--instruction-task <task> --llm-max-input-tokens 48000
--llm-max-output-tokens 8000 --llm-max-total-tokens 56000
--llm-max-run-tokens 600000 --llm-max-cost-usd 0.25`.

## Result table

| # | Task | Judgement | Run id | `reportedVerdict` | `oracleVerdict` | `flowCreated` | `observed.calls` | Tokens | Cost |
|---|---|---|---|---|---|---|---|---|---|
| 1 | property-listings-newest-homes | failed | `run-mu67klye-4907b91a` | null | null | false | 0 | 0 | $0.00 |
| 2 | property-listings-newest-homes-agent-withheld | failed | `run-mu67pion-b679b67e` | null | null | false | 0 | 0 | $0.00 |
| 3 | property-listings-kelford-homes | failed | `run-mu67qo8j-3b4355e2` | null | null | false | 0 | 0 | $0.00 |
| 4 | property-listings-kelford-homes-renamed-pagination | failed | `run-mu67rmsp-303267ff` | null | null | false | 0 | 0 | $0.00 |
| 5 | property-listings-no-matches | failed | `run-mu67t9ch-2c332e93` | null | null | false | 0 | 0 | $0.00 |
| 6 | property-listings-cheapest-home | failed | `run-mu67u9jl-611dfefa` | null | null | false | 0 | 0 | $0.00 |
| 7 | property-listings-home-facts | **no-result** | *(no run directory)* | — | — | — | — | — | — |
| 8 | property-listings-last-page | failed | `run-mu67xb58-0df2d9a7` | null | null | false | 0 | 0 | $0.00 |

Every line in the campaign log reads `judgement not measured`.

### Where the numbers come from, and what is absent

- `snapshots/live-llm.json` **does not exist** in any of the seven run
  directories. The only snapshot written is `redaction-attestation.json`. The
  run dies before the live-LLM lane opens, so there is no `observed.calls`,
  no `observed.accounting`, no `exploration.requested` and no
  `exploration.status` to read. The zeros in the table above come from
  `evaluation.json`'s `llm` block, which reads
  `{"mode":"live","profileId":"lab-create-flow","calls":0}` in all seven.
- This is *not* the "calls 1, tokens 0, cost $0" case the brief warned about,
  where a call is refused locally after being counted. The call count is 0.
  Nothing was attempted against the provider at all.
- `evaluation.json` has `extraction: null` in all seven, so there are no
  `expectedRecords` / `observedRecords` / `matchedRecords` / `expectedFields`
  / `presentFields` / `pagesFollowed` figures. Nothing was extracted, because
  no Flow was ever built.
- `reportedVerdict` and `oracleVerdict` are both `null` in all seven, so the
  passed-while-extracting-nothing disagreement this run was told to hunt for
  **did not occur and could not occur here** — neither verdict was produced.
  That specific defect is neither confirmed nor cleared by this run.

## The blocker (tasks 1–6 and 8): a stale FluxIQ Core build

All seven runs fail identically and deterministically at the same point.
`summary.json` `firstFailure`:

```
FluxIQ control request failed: /api/programs/automation-studio/update-flow-settings
(400): LLM execution limit is invalid.
```

`evaluation.json`: `failureCategory: "environment.missing"`,
`facilityFailure: {"boundary":"finalized-bundle","stage":"scenario.execute","reason":"unclassified"}`.
`events.ndjson` holds exactly two events: the dispatch, then that error.

The cause is a mismatch between FluxIQ Core's **source** and Core's **built
`dist`**, and the Lab runs the built `dist`.

Core source,
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\api\handlers\llm-execution-settings.ts`
(modified 2026-09-17 17:25, working tree ` M`, on top of commit `37679ce`
"Size the token limits to the model, not to a number nobody chose"):

```ts
const maxInputTokens  = boundedWholeNumber(tokenLimits.maxInputTokens,  1, 64_000);
const maxOutputTokens = boundedWholeNumber(tokenLimits.maxOutputTokens, 1, 64_000);
const maxTotalTokens  = boundedWholeNumber(tokenLimits.maxTotalTokens,  1, 64_000);
```

Core build,
`F:\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\api\handlers\llm-execution-settings.js`
(built 2026-09-17 15:22, two hours older than the source):

```js
boundedWholeNumber(tokenLimits.maxInputTokens,  1, 50_000)
boundedWholeNumber(tokenLimits.maxOutputTokens, 1, 50_000)
boundedWholeNumber(tokenLimits.maxTotalTokens,  1, 50_000)
```

The campaign sends `maxTotalTokens: 56_000`. Against the source ceiling of
64_000 that is legal; against the stale 50_000 in `dist` it is not, so
`boundedWholeNumber` throws `"LLM execution limit is invalid."` and the
endpoint returns 400. Every other field in the payload is inside even the
stale bounds: `maxInputTokens` 48_000 ≤ 50_000, `maxOutputTokens` 8_000,
`maxCalls` 26 ≤ 64, `timeoutMs` 25_000 (the Lab already clamps to Core's
`CORE_MAX_TIMEOUT_MS`), `maxEstimatedCostUsd` 0.25 ≤ 0.25, `retryCount` 0.

`pnpm lab run` does not build Core. Its log line
`{"lab":"core-build","state":"quiet","root":"F:\\!FluxIQ",...}` only *waits*
for Core's tree to stop changing; it then uses whatever `dist` is on disk.

**No flag combination fixes this without rebuilding Core.** Under the stale
50_000 ceiling the largest legal budget is input + output ≤ total ≤ 50_000,
i.e. the old `42_000 / 8_000 / 50_000` production profile — precisely the
headroom the recent commits moved away from because it was measured as the
single biggest blocker on 2026-09-17. Retrying at 50k would produce results,
but they would be results for the ceiling the team has just rejected, not for
the one under test.

I did not rebuild Core. `git status` in `F:\!FluxIQ` shows ten or more
`packages/fluxiq/src` files modified in the working tree right now, so a
rebuild would compile whatever another agent is mid-edit, and would swap the
Core build out from under any sibling Lab instance currently running. That is
the supervisor's call, not a worker's.

## The second, separate failure (task 7): shared `domain/dist` rebuilt mid-campaign

`property-listings-home-facts` returned `no-result` rather than `failed` and
produced no run directory at all. Its build step died:

```
> node scripts/clean-dist.mjs && tsc -p tsconfig.json && node scripts/rewrite-dist-specifiers.mjs

[Error: ENOENT: no such file or directory, lstat
 'F:\!FluxIQWebExtension\domain\dist\runtime\llm-evidence\plan-resolution\resolve-plan-node.js'] {
  errno: -4058, code: 'ENOENT', syscall: 'lstat',
  path: '...\\domain\\dist\\runtime\\llm-evidence\\plan-resolution\\resolve-plan-node.js' }

ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fluxiq-web-extension/domain@0.1.0 build
```

The log also shows `[lab] waiting for the build lock held by process 23672`
immediately before it. This is a concurrency artefact, not a product defect:
several agents share one checkout, and `domain/dist` is a single shared
directory that `clean-dist.mjs` empties and `tsc` refills. One agent's
`rewrite-dist-specifiers` walked the tree while another's `clean-dist` was
removing it. The per-instance `.lab-instances/<instance>/` isolation covers
the extension and scenario-lab builds but not `domain/dist`.

Had this not happened, task 7 would have failed at `update-flow-settings`
like the other seven.

## What the fixture was going to be checked against, and was not

Recorded so the next run does not have to rediscover it. From
`apps/scenario-lab/src/scenarios/property-listings/manifest.ts`,
`listings.ts`, `search.ts` and `live-instructions.ts`: 288 homes, page size
10, five areas. Kelford has 57 matches across 6 pages, and
`extract-area-homes` declares `pagination: followNext` with
`optionalFields: ["floorArea"]`. `extract-no-matches` declares `minItems: 0`
and expects `count: 0`, so an empty table is the only correct answer.
`extract-home-facts` targets `LISTING_PAGE` — the home's own page — with
`optionalFields: ["councilTax"]`. The two drift cases are the
`agent-withheld` variant (`optionalFields: ["floorArea", "agent"]`) and the
`renamed-pagination` variant, whose Next control reads "More homes" over a
reworded counter and must still yield the same 57 homes over the same 6
pages. `property-listings-last-page` is judged by `playbackGoal`
(`last-page-of-kelford-three-beds`), not by a dataset.

None of these were exercised. The missing-value behaviour (~29 homes with no
floor area, 28 with no council tax band) is likewise untested.

## Recommended next step

Rebuild FluxIQ Core (`packages/fluxiq`) once its working tree is quiet and no
sibling Lab instance is running, confirm the built
`llm-execution-settings.js` carries `64_000`, then re-run this slice. Until
then any live creation campaign in this repository that declares more than
50_000 total tokens fails at `update-flow-settings` with a 400 before
reaching the provider — which means the whole live creation corpus is
currently blocked, not just this slice. Serialising `domain/dist` rebuilds
across agents, or giving each Lab instance its own `domain/dist`, would
remove the task-7 class of failure.

## Commands run

- `pnpm lab:campaign <8 property-listings tasks>` with the briefed
  environment → exit 1; 7 runs `failed`, 1 `no-result`; log kept at
  `<scratchpad>/prop-a.log`.
- Read `test-runs/instances/prop-a/run-*/summary.json`,
  `evaluation.json`, `events.ndjson` and `snapshots/` for all seven runs.
- Compared Core's `llm-execution-settings.ts` against its compiled
  `llm-execution-settings.js`, and checked file mtimes and `git status` in
  `F:\!FluxIQ`.

No source file was edited, no test written, nothing committed.
