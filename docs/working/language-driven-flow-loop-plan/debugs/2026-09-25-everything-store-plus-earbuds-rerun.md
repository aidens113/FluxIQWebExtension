# Run debug — `everything-store-plus-earbuds-under-50`, rerun

`run-muher0en-508ddb69`, 2026-09-25. The second run of this scenario in the
loop, against the t125 and t126 fixes. Stage 1 is unchanged and lives in
[the first run's debug](./2026-09-24-everything-store-plus-earbuds.md).

- 27 provider calls, 949,622 ms, $0.0447, 367,786 tokens
- `flowCreated: true`, `resultVerification: refuted`, verdict failed

---

## What the previous run's causes did

| Cause | Status |
| --- | --- |
| 3 — five `target_unobserved` refusals, the model could not reach the search field | **Gone.** Zero `target_unobserved` rows in 33. Iterations 1–3 all succeeded where the previous run's 4–8 were all refused. |
| 4 — the model was offered nodes whose only answer was a refusal | **Gone.** Zero `invalid_input` rows, against fourteen in `run-mug776kx-0214b287`. |
| 5 — one answer authored as two extractions, digesting into two datasets | **Gone, and it dissolved exactly as predicted** rather than being fixed directly: one extraction, `1 record set`. |
| 6 — the repair diagnoses and produces no patch | **Still present.** Two `diagnosis` interventions, `runtimePatchAttempts: []`, `adaptationIds: []`. |

**The instrumentation works.** `resultReason` and `nodeId` are published for the
first time — row 0 reads `start_location_not_reached` on
`web.output.dom-capture_snapshot` — and `at` is on all 33 rows. The one
remaining refusal in the whole exploration is an `action_timed_out` on
`web.output.dom-extract_list` at iteration 7, which the model recovered from.

## Stage 5 — the answer, which can now be read

| | Previous run | This run |
| --- | --- | --- |
| Observed records | 0 | **15** |
| Compared | 0 | **13** |
| Expected fields present | 0 of 0 | **52 of 52** |
| Unexpected fields | 0 | 0 |
| Matched in order | 0 | 0 |
| Matched in any order | 0 | 1 |

Every column the instruction asked for is present on every row. The rows
themselves are the wrong rows.

**Precisely wrong, and in three ways that name their own cause.** Observed
values include `$69.99` and `$79.99` against an instruction that says under
$50; a rating of `3.7` against one that says 4.0 or higher; and a url of
`/scenarios/everything-store/sspa/click?ie=UTF8&adId=sp-3M8XT4&url=...`, which
is a sponsored placement against an instruction that says to leave them out.
The expected 13 are all $34.99 or less and 4.0 or better.

**So none of the qualifying clauses reached the node.** The authored extraction
carries the four fields and **no `where` at all**, with `paginate.maxPages: 1`
against an instruction that says "going through every page". The previous run
*did* author `where` with `atLeast: 4` and `lessThan: 50`, so this is not a
missing capability — the filtering exists and has been used. It is the model
omitting it on this attempt.

## Stage 6 — judgement and repair

**Judgement was right again**, and for a second consecutive run on a Flow that
stored plausible-looking rows: `core.result.does_not_answer_request`, with its
own account — "15 records stored, across 1 record set". A table of fifteen
well-formed earbuds with four correct columns was refused rather than reported
as an answer.

**The repair is now the blocker, and it is measured rather than inferred.** Two
diagnoses, both validating clean, no patch attempted. The fix this run needs is
one sentence — add `where` to the extraction, raise `maxPages` — and none of
the five patch kinds can say it. They are all `temporary_`: an action sequence,
a wait/retry, a target override, a recovery subflow call, a reroute. **None
amends a node's parameters.**

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| 7 | **The extraction was authored with no `where` and `maxPages: 1`**, so fifteen unfiltered rows from one page — including sponsored placements, items over $50 and items rated below 4.0 — were returned for an instruction that excludes all three. | Core, authoring | **Not by making `where` mandatory.** Filtering is optional by design and a parameter the model omits must get a permissive default, never a restrictive one. The loop's own answer is the repair: verification already refuted this result correctly, so what must work is cause 8. | open |
| 8 | **The repair cannot amend a node's parameters**, so a refuted result whose fix is "add these three conditions to the extraction" produces no patch at all. Observed live twice now, having previously only been read off source. | C `llm/harness/structured-response.ts:155` | Extend the patch vocabulary with a durable amendment to a node's parameters. | next |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| 6 | **Why the repair chose to attempt no patch.** Two diagnoses are recorded as having happened and as validating clean, and nothing records what either concluded or why it produced nothing. A diagnosis that reaches no patch is exactly the case worth reading. | C, the harness-recovery record |
