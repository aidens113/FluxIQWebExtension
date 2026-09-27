# t221 — MVP-today compaction map

## Outcome

`docs/working/mvp-today-plan.md` is 988 lines, above the protocol's 800-line compaction trigger.
Its `Current State` is already under 150 lines, but it predates live run 1 and t217. The main size
driver is completed worker coordination: t170–t218 briefs occupy about 600 lines. The safest
compaction is to archive those briefs intact, fold settled outcomes into a rewritten Current State,
and retain the binding rules and current contracts as concise reference material.

No shared document was edited by t221.

## Move intact to archive

Create:

`docs/working/mvp-today-plan/archive/2026-09-26-t170-t218-worker-briefs.md`

Move the brief preamble and complete brief bodies for **t170 through t218** from `## Worker Briefs`
into that archive. Preserve their original order and wording. In the working document, replace them
with one line such as:

> Completed briefs t170–t218 moved to
> `mvp-today-plan/archive/2026-09-26-t170-t218-worker-briefs.md`; their unique reports remain under
> `mvp-today-plan/reports/`.

Keep **t219-run2-preflight-delta** in the working document until its result is integrated. Any brief
added after t219 also stays while active. When a brief finishes, its body may join a later archive;
the report, Current State outcome, and ledger entry—not the dispatched brief—are the current truth.

This single move should remove roughly 590–610 lines and bring the document below 400 lines before
the small replacements and new ledger entries are added.

## Move historical detail after summarizing it

Create:

`docs/working/mvp-today-plan/archive/2026-09-26-pre-run-audit-and-integration-history.md`

The following blocks are valuable evidence but no longer need full narrative in the active plan:

| Current block | Treatment in active document | Archive content |
| --- | --- | --- |
| `## What The Audit Found` | Replace with a short “Audit basis” paragraph: t163 found retryability/stage contradictions, unguarded execution seams, dead recovery rungs, no provider retry, and an over-broad browser failure code. | Move the full measured counts, file/line discussion, and ranked ownership narrative intact. |
| Historical opening and closing paragraphs of `## What The Defences Now Do` | Keep only the current defensive-execution contract and any still-open evidence-account item. | Move the t167 discovery narrative, before/after comparisons, and implementation chronology. |
| Historical opening, cost calculation, and implementation chronology in `## What The Judge Now Does` | Keep the current screened-context/directive contract and the statement that malformed advice cannot invalidate a verdict. | Move the t164 discovery narrative, byte/token calculation, and “what was widened when” history. |
| Completed steps 1–4 in `## The Order Of Work` | Replace with the current run-2 sequence. | Move the original six-step pre-run order intact because it explains why the first run was delayed until integration was whole. |
| `## What Would Make This Fail` | Retain a compressed risk list, rewritten for current state. | Move the original pre-run risk prose intact. |

Leave one short archive pointer at the first removed historical block. Do not delete the archived
counts or causal arguments: they explain why the binding rules and implementation choices exist.

## Keep in the active document

### Header

Keep all eight protocol fields. Update:

- `Status: Active`
- `Status detail:` run 1 reached exploration but emitted no proposal; t217 fixed terminal diagnosis;
  run 2 remains required.
- `Last updated: 2026-09-26`

Do not mark the document `Blocked`, `Paused`, or `Complete`.

### Binding requirements

Keep `## The Binding Rules`, including all four numbered subsections. These are durable product
requirements, not task history:

1. defensive execution is default and bounded;
2. only move-money, delete, and send/publish consequences remain gated;
3. the judge provides screened, actionable repair direction without making advice mandatory;
4. permissive minimal parameters, nearest-match resolution, explicit removal, and versioned changes
   remain in force.

The rules may receive copy edits to remove duplicated examples, but their normative meaning must not
be summarized away.

### Current contract summaries

Retain compact reference sections for:

- defensive Core and browser dispatch, including safe treatment of mutating actions;
- provider retry and bounded accounting;
- risk-only permission handling;
- screened judge context/directives and repair handoff;
- partial extraction and observable recovery evidence;
- the hard-scenario exit condition: two consecutive passing live runs, with one Lab run at a time.

### Work Ledger

Keep the existing opening entry. Append, in order:

1. the compaction entry required by protocol;
2. the accepted run-1 measurement entry;
3. the accepted t213/t217 terminal-classification entry.

The run-1 product verdict was failed, but its finalized measurement is an accepted work unit. Do not
label it `Blocked`; later stages were unmeasured because build never produced a proposal.

### Active brief and open questions

Keep t219 while active. Add `## Open Questions` at the end if any unresolved decisions remain;
otherwise use a compact `- None.` so the protocol section order is explicit.

## Current State facts that must remain

The rewritten Current State should retain these facts and no stronger live claim:

- The document exists to enforce the three user rules: defensive-by-default execution, risk-only
  grants, and an actionable judge.
- Local integration work through t217 is implemented; the established Core and downstream checks
  were green before the live run, and t217 subsequently passed its 57 focused tests, Core check,
  and Core build.
- Historical runs showed language-driven creation and answer refutation working, but run 1 did not
  reproduce those later stages.
- Live run 1 (`run-muj2kzx1-8f9f8271`) used 26 build calls, 366,210 tokens, and estimated USD
  0.0573657.
- Run 1 reached only Stage 2 exploration. It emitted no valid proposal, runtime run id, dataset,
  judgement, repair, persistence, or replay.
- The final completion could not answer the instruction. Core then incorrectly overwrote that known
  refusal with an iteration-limit diagnosis.
- t217 fixed only that terminal classification: a final unusable decision now reaches the stalled
  callback, while generic usable non-completion still ends iteration-limit.
- t217 did not change the 26-call limit, tokens, cost, time, tool limits, draft policy, completion
  answerability, or model convergence.
- Created-from-language is not proven by run 1; deterministic replay, self-repair, and self-judgement
  were not exercised by run 1. Historical evidence may remain described separately from this run.
- Run 2 must use the same default 26-call profile. A 27-call diagnostic cannot count as an MVP pass.
- The same hard scenario must pass twice consecutively before opening the other nine lanes.
- The known `git worktree add` machine limitation is operational, not a product-behavior blocker.
- There is no current product blocker to attempting run 2 after rebuild/freshness/readiness checks.

## Proposed rewritten Current State

The following outline is about 45–55 lines as rendered, comfortably under the 150-line limit.

```markdown
## Current State

**Purpose.** This document applies three binding product rules: every node executes defensively by
default; only move-money, delete, and send/publish consequences require a separate grant; and a
judge's refutation carries screened, actionable repair direction.

**MVP criteria.**

| Criterion | Current evidence | Still required |
| --- | --- | --- |
| Created from language | Historical runs authored ten-node Flows, but live run 1 emitted no valid proposal. | The hard scenario must produce a faithful Flow under the default profile. |
| Runs deterministically | Not exercised in run 1 because runtime never began. | Provider-free replay with the exact expected dataset. |
| Repairs itself | Route and contracts are implemented; not exercised in run 1. | Wrong-answer judgement, directed repair, persistence, and successful replay. |
| Judges its own answer | Historical runs refuted wrong tables; not exercised in run 1. | Live actionable directive evidence on the hard scenario. |

**Implemented.** The defensive Core/browser paths, provider retry, risk-only permission boundary,
screened judge directive, extraction/recovery changes, documentation, and focused/integrated test
reconciliation are complete. t217 additionally preserves a final unusable completion through the
stalled callback. Its 57 focused tests, Core `pnpm check`, and Core `pnpm build` passed.

**Live run 1.** `run-muj2kzx1-8f9f8271` reached Stage 2 exploration and stopped before proposal.
All 26 provider calls were build calls: 360,775 input plus 5,435 output tokens, 366,210 total,
estimated USD 0.0573657. No runtime run id, dataset, judgement, repair, persistence, or replay was
produced. The last completion failed `bootstrap.cannot_answer_instruction`; the old loop exit then
misreported generic iteration-limit.

**What t217 did and did not prove.** The same final refusal now retains its actionable issue through
Flow Bootstrap's classifier; ordinary usable non-completion still reports iteration-limit. No
budget, answerability, draft, or convergence rule changed, so this is not evidence that run 2 will
author a valid Flow.

**Next.** Complete the t219 rebuild/freshness/readiness delta, create the no-hindsight run-2 debug,
and run the same scenario serially with the default 26-call profile. Debug the complete bundle. Fix
only what it measures and repeat until the scenario passes twice consecutively; only then open the
other nine lanes. A 27-call diagnostic may inform investigation but cannot count as an MVP pass.

**Blockers.** None to attempting run 2 after readiness checks. This machine cannot spawn
`git worktree add`; that is an operational limitation, not a product-behavior blocker.
```

## Proposed post-compaction outline

```text
# MVP Today
<protocol header>
---
## Current State                         (~45–55 lines)
---
## The Binding Rules                    (retain four normative subsections)
## Current Runtime And Judge Contracts  (condensed present-tense facts)
## Live Validation Contract             (default profile, serial Lab, two-pass exit)
## Risks And Non-Goals                  (short current list)
## Active Order Of Work                 (run 2, measured fix, consecutive rerun, other lanes)
## Worker Briefs                        (archive pointer + t219 and later active briefs)
---
## Work Ledger                          (opening, compaction, run 1, t217)
## Open Questions                       (`- None.` if empty)
```

Expected active-document size after moving t170–t218 briefs and historical narrative is roughly
250–400 lines, leaving ample room for run-2 coordination without another immediate compaction.

## Compaction ledger entry

```markdown
### 2026-09-26 — Compact completed pre-run and run-1 coordination history
- Agent: supervisor, with t221 map
- Changed: `mvp-today-plan.md` and archives `2026-09-26-t170-t218-worker-briefs.md`, `2026-09-26-pre-run-audit-and-integration-history.md`
- Why: The active document reached 988 lines; completed briefs and pre-run narrative obscured current run-2 state.
- Validation: working-document structure/line-count check -> Current State under 150 lines, active document under 800 lines, archived text retained with pointers.
- Outcome: Accepted
- Follow-up: append the run-1 and t217 ledger entries, then integrate t219 without restoring completed brief bodies.
```
