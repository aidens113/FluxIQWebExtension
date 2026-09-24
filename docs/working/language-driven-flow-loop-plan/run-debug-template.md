# Run debug — `<run-id>`

Copy this file to `debugs/<run-id>.md` and fill every field. A field that cannot
be filled from the run's artifacts is written as `NO EVIDENCE:` followed by what
would have been needed — that line is a Phase 0 instrumentation finding, not an
excuse to move on.

Fill Stage 1 **before** reading anything the run produced.

---

## Header

- Run id:
- Scenario / variant / task:
- Command:
- Date, provider, model:
- Provider calls, tokens, cost:
- Verdict as reported:
- **Stage reached:** the highest stage below that completed — 1 instruction,
  2 exploration, 3 proposal, 4 replay, 5 answer, 6 judgement and repair.

## Stage 1 — the instruction and the expected chain

- The instruction, verbatim:
- The node chain a correct Flow must have, written before looking at the run:
  1.
  2.
  3.
- What a wrong answer that looks right would look like here:

## Stage 2 — exploration

One row per model turn, in order. No summarising.

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |

- Repeats, and what the loop believed was progress:
- Rejections and refusals received, and whether each said enough to route around:
- Where the context was evicted or truncated, if anywhere:

## Stage 3 — the proposed Flow

- Node list as authored, with each node's real parameters:
- Divergences from the stage 1 chain, one line each, naming the node:
- For each divergence: misread the page / misread the grammar / could not express it:

## Stage 4 — replay

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |

- Any node that reported success while doing nothing:
- Provider calls during replay (expected: zero):

## Stage 5 — the answer

- Records expected vs returned:
- Fields compared, matched, mismatched:
- Every mismatch, observed value beside expected:
- If the comparison was count-only, say so — that is a gap, not a pass:

## Stage 6 — judgement and repair

- Did the system judge its own result, and what did it conclude:
- If the answer was wrong, did a repair trigger automatically:
- What context did the repair receive — prior steps with parameters and results,
  the conversation, the page as it was when it broke, the Flow with the failing
  node in place, the failure record. Name which were present and which absent:
- Was the repair persisted, and did the re-run use it:

## Causes

One row per cause, named at the level of the value, node, selector, parameter or
missing step. "Extraction was wrong" is not a cause.

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
