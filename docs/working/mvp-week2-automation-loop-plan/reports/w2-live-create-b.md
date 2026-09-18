# w2-live-create-b — live DeepSeek creation runs, catalog extraction slice

Live campaign, real DeepSeek provider (`deepseek-chat`), `--llm-task create-flow`,
profile `lab-create-flow`, instance `camp-b`, isolated target. Run 2026-09-17.

Command (exactly as briefed, key read across from `.env.local`, never printed):

```
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated FLUXIQ_LAB_INSTANCE=camp-b \
  pnpm lab:campaign product-catalog-first-page-absolute-links product-catalog-all-pages \
  product-catalog-all-pages-short-catalog product-catalog-all-pages-link-pagination \
  product-catalog-numbered-pages product-catalog-search-lamp product-catalog-search-no-results \
  product-catalog-in-stock product-catalog-photos
```

Campaign exit code 1 (it exits non-zero when any task fails). All nine tasks were
attempted; eight produced a run bundle. Every result below was read from
`test-runs/instances/camp-b/<runId>/snapshots/live-llm.json` and
`evaluation.json`, not from the campaign's verdict line.

## Result

**4 passed, 4 failed, 1 no-result.** 22 provider calls, 110,317 tokens, **$0.05244**
total. Zero budget breaches. Every passing task matched its expected dataset
exactly — no partial credit was needed.

| # | Task | Judgement | `observed.calls` | Cost | What happened |
|---|---|---|---|---|---|
| 1 | first-page-absolute-links | passed | 3 | $0.00786 | 8/8 records, 32/32 fields |
| 2 | all-pages | passed | 3 | $0.00858 | 23/23 records, 92/92 fields, 3 pages |
| 3 | all-pages-short-catalog | **failed** | 3 | $0.00849 | 5 rows stored, **all 5 refused by record validation** -> 0 records |
| 4 | all-pages-link-pagination | passed | 2 | $0.00599 | 23/23 records, 92/92 fields, 3 pages |
| 5 | numbered-pages | **no-result** | — | — | build race, never measured |
| 6 | search-lamp | passed | 2 | $0.00537 | 4/4 records, 16/16 fields |
| 7 | search-no-results | **failed** | 1 | $0.00000 | no Flow built: input budget exceeded, HTTP 400 |
| 8 | in-stock | **failed** | 7 | $0.01616 | no Flow built: 5 consecutive unusable decisions |
| 9 | photos | **failed** | 1 | $0.00000 | no Flow built: input budget exceeded, HTTP 400 |

Run ids: 1 `run-mu656nn1-b985930b`, 2 `run-mu65bk6z-9935a6ac`,
3 `run-mu65ebt2-443356d6`, 4 `run-mu65gv0l-d592f09c`, 6 `run-mu65j1ih-ded6f936`,
7 `run-mu65lpkv-9e4e0dd4`, 8 `run-mu65nyco-d572e85c`, 9 `run-mu65puv2-cb9813fe`.
Task 5 produced no bundle.

## Two fields the brief asked for that Core does not publish

**`taskKind` per call is unavailable on every one of these eight runs.** Each
snapshot carries `observed.perCallRecords: "not recorded"` and
`observed.observedCalls: []`, with `unrecordedCalls: null`. Per
`packages/test-runner/src/live-llm/observed-usage.ts`, `"not recorded"` means
Core published no per-call lines at all, so call counts come from
`observed.accounting` and no call can be attributed to a task kind. This is not
a gap in this run — it is a gap in what Core emits for `create-flow` runs. If
per-call task kinds matter for the Week 2 measurement, Core has to publish the
per-call lines first.

**`exploration` is `null` on every run** — the whole record, not just its
fields, so there is no `requested` or `status` to report. That is expected
rather than wrong: the exploration record is written for repair runs under an
`explore_and_adapt` grant, and these are `create-flow` / `build_and_adapt` runs.
The evidence loop these runs *do* have is reported under `build.evidenceLoop`
instead, and that is where the useful detail turned out to be.

## The failures, concretely

### Task 3, short-catalog — the silent empty table

This is the most serious finding, because nothing in the run said it went wrong
until the dataset was judged.

- `web.dom.extract_list` action status: **succeeded**.
- Flow runtime status: **succeeded**. `reportedVerdict: passed`.
- Dataset: `datasetPages: 1`, **`invalidRows: 5`**, `recordCount: 0`.
- Expectation: 5 records on 1 page. Observed: 0.
- Failure sentence: `Extract step extract-all-pages yielded 0 record(s), expected 5`.

So the created Flow found the 5 product cards, produced 5 rows, and Core's own
record validation (`RunDatasetSummary.invalidCount`, "rows Core's own record
validation refused") rejected every one. The user-visible outcome is an empty
table from a run that reports success. The three provider calls were real and
the build outcome was `proposed` with a normal evidence loop
(`web.inspect_current_page`, `web.detect_repeating_structure`, 6,817 evidence
bytes) — the model's proposal was accepted and applied; it is the rows it
produced that were refused.

Worth noting the same instruction and the same two tools succeeded on the
full catalog (task 2, 23/23) and on the link-pagination variant (task 4, 23/23).
Only the 5-product `short-catalog` variant produced invalid rows.

### Task 8, in-stock — five unusable proposals in a row

The richest trace of the run, from `build.evidenceLoop.steps`:

| Step | Tool | Result code |
|---|---|---|
| 1 | `web.inspect_current_page` | `web.inspect.succeeded` |
| 2 | `web.detect_repeating_structure` | `web.structure.detected` |
| 3 | `core.decision_unusable` | `bootstrap.required_input_unconnected` |
| 4 | `core.decision_unusable` | `bootstrap.required_input_unconnected` |
| 5 | `core.decision_unusable` | `web.handle.malformed` |
| 6 | `core.decision_unusable` | `bootstrap.required_input_unconnected` |
| 7 | `core.decision_unusable` | `bootstrap.required_input_unconnected` |

Failure: `flow_bootstrap.evidence_unusable_decision`, stage
`provider_output_validation`, `issueCodes: ["bootstrap.required_input_unconnected"]`.

Evidence gathering worked. The model then emitted five Flow proposals in a row,
each with a **required action input left unconnected to any registered output**,
and once an element handle Core could not parse. It never recovered, spent
33,561 tokens and $0.01616, and built nothing. This is the repository's own
input/output contract ("an action input must map deterministically to a
registered output") failing at the generation step, five times without
improvement — the loop retries but does not learn from the issue code.

In-stock is the hardest task in the slice: tick a filter checkbox, then paginate,
then extract five columns including `availability`. It is plausible the
unconnected input is the checkbox interaction's target.

### Tasks 7 and 9 — the prompt is too big to send

Both failed identically and cost nothing:

- `flow_bootstrap.provider_input_budget_exceeded`, stage `provider_request`, **HTTP 400**.
- `observed.calls: 1`, but `inputTokens: 0`, `outputTokens: 0`, `estimatedCostUsd: 0`.
- Declared limits: `maxInputTokens: 8000`, `maxTotalTokensPerRequest: 10000`.
- No Flow was built (`flowCreated: false`), so there is no extraction to judge —
  which is why the campaign records the judgement as "not measured" rather than
  a dataset mismatch.

Note the accounting shape: a call is counted with zero tokens and zero cost. The
mirror of the hazard the brief warned about — here the verdict is honest but the
call count suggests a provider round trip that was rejected at the door.

Task 9 (photos) asks for four columns read from image attributes; task 7
(no-results) is a search whose page has nothing on it. Neither is obviously a
large page, so the 8,000-token input ceiling is being hit by the assembled
prompt, not by page size alone.

### Task 5, numbered-pages — never measured

Not a product failure. The build step died:

```
Error: ENOENT: no such file or directory, rmdir 'F:\!FluxIQWebExtension\domain\dist\io'
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @fluxiq-web-extension/domain build
{"status":"failed","category":"environment.missing",
 "message":"pnpm --filter @fluxiq-web-extension/test-runner... build exited with 1"}
```

The campaign did **not** retry (it went straight to `no-result` on attempt 1 of 3,
because the category is `environment.missing`).

The cause is a shared-directory race. `FLUXIQ_LAB_INSTANCE` isolates
`apps/extension/.lab-instances/<instance>/`, `apps/scenario-lab/.lab-instances/<instance>/`
and `domain/.lab-instances/<instance>/`, but **`domain/dist/` is not
instance-scoped**. Three sibling agents were running concurrent campaigns in the
same checkout, and `domain/scripts/clean-dist.mjs` removed a directory another
instance's clean was about to remove. This is exactly the hazard `AGENTS.md`
describes as the trigger for a separate worktree: concurrent validation in one
checkout. `product-catalog-numbered-pages` needs a clean re-run, alone.

## What this says about extraction

Against the prior measurement of 4 of 14 extraction tasks passing, this slice
passed 4 of 8 measured tasks. Where a Flow was built at all, extraction was
excellent: three tasks matched 23/23 and 4/4 records with every field present
and zero unexpected fields, including two different pagination mechanisms
(button `Next` and anchor `Next`) across 3 pages. Pagination is not the weak
point it was.

The failures are not extraction-accuracy failures. Three of the four are
**build-time** failures where no Flow was ever produced — two prompt-size
rejections and one loop that could not wire a required input. Only one
(short-catalog) is a data failure, and even that one is a row-validation
rejection rather than a wrong-value extraction: the fields were read, the rows
were refused.

So the useful reading is that the generation step, not the extraction step, is
now where this slice loses. Four items worth acting on, in order:

1. Why does Core's record validation refuse all 5 rows on `short-catalog` while
   accepting 23 rows of the same shape on the full catalog? A run that stores
   invalid rows and reports success is a silent-data-loss path regardless of the
   answer.
2. `bootstrap.required_input_unconnected` five times without improvement — the
   bootstrap loop re-proposes rather than repairs against its own issue code.
3. An 8,000-token input ceiling that two of nine tasks cannot fit inside.
4. `domain/dist` is not instance-scoped, so concurrent lab instances in one
   checkout race during build.

## Not verified

- Per-call `taskKind` — Core published none (see above).
- `exploration.requested` / `exploration.status` — the record is `null` on all
  eight runs; not applicable to `create-flow`.
- `product-catalog-numbered-pages` — never ran; no product judgement exists.
- Which specific field or value made the 5 short-catalog rows invalid. Core
  reports `invalidCount` but the bundle carries no per-row reason, and
  `logs/core.log` (8 lines) says nothing about it.
- Whether the two input-budget failures are page-size driven or prompt-assembly
  driven. Not distinguishable from the bundle.
- Concurrency check (done, and clean): two source files are modified in the
  working tree — `scripts/lab/live-campaign/lab-run/command.mjs` and
  `apps/scenario-lab/src/scenarios/member-directory/styles.ts` — by sibling
  agents, not by this worker, which edited no source file. Their mtimes are
  23:25:32Z and 23:27:54Z, and my last run finished at 23:25:06Z, so neither
  edit was live during any run here. The eight runs span 23:09:45Z to 23:25:06Z.
  The campaign's own command builder was therefore identical for all nine tasks.
- Each failure was observed once. Given this machine's known faulty RAM, the
  single `ENOENT` build failure is consistent with either the concurrency race
  or hardware noise; the race is the better explanation because the error names
  a directory another process would plausibly have removed.
