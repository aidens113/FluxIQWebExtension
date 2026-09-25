# Run debug — `everything-store-plus-earbuds-under-50`

Rung 3 of the ladder and the first of the ten realistic sites. This is the case
that has never produced a correct answer.

Stage 1 was written on 2026-09-24 before any result was read, as the protocol
requires. Stages 2 to 6 record `run-muhd1vc7-0ec27a16`, 2026-09-25.

---

## Header

- Run id: `run-muhd1vc7-0ec27a16`
- Scenario / workflow: `everything-store` / `plus-under-fifty`
- Command: `FLUXIQ_TEST_ENV_FILES=none pnpm lab:campaign everything-store-plus-earbuds-under-50`
- Date, provider, model: 2026-09-25, DeepSeek, `deepseek-flash`
- Code under test: `dev` with t125's instrumentation built into Core's `dist`,
  and **without** the t126 fixes, which were written while this run was in
  flight.

## Stage 1 — the instruction and the expected chain

**The instruction, verbatim:**

> Find every pair of wireless earbuds in the store's search results that is
> Brightaisle Plus eligible, rated 4.0 or higher and priced under $50, going
> through every page of results. Leave out sponsored placements and accessories
> such as ear tips or charging cases, list each pair only once even if it turns
> up on two pages, and keep the order the search results show them in, with
> columns name, price, rating and url.

**What a correct answer requires.** Seven separate obligations: search; three
filters that must all hold together; every page traversed; sponsored placements
excluded; accessories excluded, which is semantic rather than structural;
deduplication across pages; and the search result order preserved.

**What a wrong answer that looks right looks like here.** The first page only.
Everything matching "earbuds" including ear tips and charging cases. Sponsored
rows kept. Duplicates across pages. The right set in the wrong order. Each
produces a table that reads as a correct answer, so stage 5 must compare rows
and their order, never shape or count.

## Stage 2 — exploration

21 provider calls, 838,826 ms, $0.026, 254,024 tokens. 22 decision rows, every
one carrying a timestamp for the first time in this project.

| Iter | Call | Result |
| --- | --- | --- |
| 0 | `core.run_node` | `web.action.rejected.not_at_start_location` |
| 1 | `core.run_node` | `web.action.succeeded` |
| 2 | `web.detect_repeating_structure` | `web.structure.detected` |
| 3 | `core.run_node` | `web.action.succeeded` |
| 4–8 | `core.run_node` ×5 | **`web.action.rejected.target_unobserved` ×5** |
| 9 | `web.detect_repeating_structure` | `web.structure.detected` |
| 10 | `core.run_node` | `web.inspect.succeeded` |
| 11–14 | `core.decision_amend_draft` ×4, two carrying a `rerun` | one `action_timed_out`, two `inspect.succeeded` |
| 15 | `core.run_node` | `web.action.rejected.invalid_input` |
| 16–17 | `core.run_node` ×2 | `succeeded`, `inspect.succeeded` |
| 18 | `core.decision_complete` | — |

**The five refusals at iterations 4 to 8 are the run.** They are the attempts to
reach the store's search field, and every one was refused. Which of the ten
`target_unobserved` reasons refused them is still unknown, for the reason under
`Instrumentation gaps found`.

## Stage 3 — the proposed Flow

Five nodes: `browser-navigate` ×3, `dom-extract_list` ×2. **No `dom-type` and no
click anywhere in it**, so the Flow never searches. All three navigations go to
the bare origin, the same URL three times.

The filters, by contrast, were authored correctly and reached the node. The
first extraction's `where` carries `atLeast: 4` and `lessThan: 50` — "rated 4.0
or higher and priced under $50". The second carries a `contains` with
`not: true`, an exclusion. `paginate.maxPages` is 5 on both. The model
understood the qualifying clauses; it could not get to the page they apply to.

## Stage 4 — replay

Six actions, all executed, none refused.

| # | Node | Status | ms | Page after |
| --- | --- | --- | --- | --- |
| 1 | `browser-navigate` s1 | succeeded | 2277 | 5202 bytes |
| 2 | `browser-navigate` s2 | succeeded | 1280 | **812 bytes** |
| 3 | `dom-extract_list` s3 | succeeded | 11082 | 5843 bytes |
| 4 | `browser-navigate` s4 | succeeded | 1363 | **848 bytes** |
| 5 | `dom-extract_list` s5 | succeeded | 10068 | 848 bytes |
| 6 | `dom-extract_list` s5, attempt 5 | failed | 1018 | — |

**The page collapses after the second navigation.** 5202 bytes is a real page;
812 and 848 are not. Both extractions ran against a near-empty page, which is
what re-navigating to the same URL leaves behind here.

## Stage 5 — the answer

16 records stored, across **2** record sets. The oracle expected 13 in the
answer and observed **0**: 13 mismatched, 0 compared, 0 matched.

**Why two record sets, and why this is not a `recordOutput` defect.** Both
extractions were authored with `recordOutput: null`, and that is handled —
`domain/src/output-nodes/extract-list/dispatch.ts:62` derives a record output
when none was authored, so the rows are saved. The derived `datasetId` is a
digest of the field map **and the `where` conditions**, deliberately, so that an
unfiltered read and a read that left the sponsored placements out cannot append
into one table. The two extractions carry different conditions — three on the
first, two on the second — so they digest differently, land in different
datasets, and the Flow produced two partial tables rather than one answer.
"List each pair only once even if it turns up on two pages" cannot hold across
two datasets.

That behaviour is correct in isolation. The defect is upstream: a Flow whose
answer is one table should not have been authored as two extractions carrying
different filters.

## Stage 6 — judgement and repair

**Self-judgement worked, and this is the first time it has been shown to on a
multi-node Flow.** `resultVerification: "refuted"`, and the run reported
`core.result.does_not_answer_request` with its own account: "16 records stored,
across 2 record sets; the Flow's steps were browser-navigate, browser-navigate,
dom-extract_list, browser-navigate, dom-extract_list." The answer was wrong and
FluxIQ said so rather than reporting success. That falsifies the standing entry
claiming a multi-node Flow self-reports success unjudged — for a Flow that
stores records, at least.

**The repair did not.** `harnessActivations: 2`, two `diagnosis` interventions,
both `validationOk: true`, and `runtimePatchAttempts: []`, `adaptationIds: []`,
`changeProposalIds: []`. It diagnosed twice and produced no patch. That is
consistent with the standing finding that the five patch kinds cannot express
"the Flow is missing a step" — what this Flow needs is a search typed before the
extraction, and no patch kind inserts a step.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 3 | **The root cause: the model could never reach the search field.** Five consecutive `web.action.rejected.target_unobserved` refusals at iterations 4–8, after which it stopped trying and navigated to the bare origin instead. Every later defect is downstream: no search means no result set, so the extractions ran on the homepage and then on a near-empty re-navigation of it. Which of the ten reasons refused it is not recorded — see the gap below. | unknown until the reason is published | Rerun with the reason carried through, then fix what it names. | open |
| 4 | **The model was offered nodes whose only possible answer was a refusal.** `run_node` enumerated the whole registry in a closed `enum`, and Core's built-ins are available in every scope, so a web build was handed `builtin.control.for-each`, `builtin.data.filter-list` and the rest; every call naming one reached the domain, which runs web nodes only. The previous run, `run-mug776kx-0214b287`, spent fourteen consecutive calls this way. | C `llm/harness-options/binding.ts`, D `runtime/llm-evidence/tools.ts` | **Done.** `runsNodes` gains `runnable`, and the offered library is its intersection with the registry. Narrowing costs nothing: control flow is authored as a routing word on steps that ran and Core derives the nodes. Core `7848f93`, domain `9002620`. | t126 |
| 5 | **One answer was authored as two extractions with different filters**, which by design digest into two datasets, so no single table is the answer and cross-page dedupe is impossible. | Core, authoring | Not fixed. It may dissolve once cause 3 is fixed, because a Flow that reaches the search results has one list to read rather than two passes over the wrong page. Re-assess after the rerun rather than fixing speculatively. | open |
| 6 | **The repair diagnosed twice and produced no patch.** Two `diagnosis` interventions, both validating clean, no patch attempted. The Flow needs a step inserted and no patch kind can express that. | C `llm/harness/structured-response.ts` | The standing repair-vocabulary gap, now observed live rather than read off source. | open |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 2 | **Which of the ten `target_unobserved` reasons refused the five search attempts** — the one thing this run needed to answer. The domain computed a reason for every one of them, Core accepted it, put it on the loop's row, published it on the step and parsed it there, and all of that landed: 0 of 22 rows carried one. `sanitizeEvidenceLoopTrace` is a **fourth** rebuilder, standing between the loop and the step builder, rebuilding every row member by member; it had been taught `at` and not the reason. The t125 brief named three files and this was not one of them, which is the supervisor's defect and not the worker's. | C `service/flow-bootstrap-commands/evidence-trace.ts:52-82` — **fixed in `638ab1c`**, with a test asserting the property rather than the fields, so the next member added to a row fails a test instead of going quiet. Third occurrence of this exact pattern. |
| 2 | **Which node each `core.run_node` call named.** `nodeId` was dropped for the same reason and is fixed by the same commit. | as above |
| 4 | **What the near-empty 812- and 848-byte pages actually were.** The byte size is recorded and the content is not, so "the page collapsed after re-navigating" is an inference from size. E7, the screenshot adapter, and E9, the local-only sidecar, both remain open and either would have answered it outright. | L `run-scenario.ts:123` (E7), and E9 |
