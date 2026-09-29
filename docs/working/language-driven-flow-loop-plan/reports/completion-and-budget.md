# Completion and budget

Worker report. Brief: fix how Core decides a Flow build is complete, and what
happens when a build runs out (defects 1 to 5 from the lane debugs
`lane-run-mulxk0ro-36bf090d`, `lane-run-mulxsbyy-d4d4c7a1`,
`lane-run-mulx76vv-a882551e`). Nothing is committed.

Status: **in progress**. This file is written early and updated as work lands.

## Recovery note

The session restarted once before any edit. `git status` over every owned
path in both repositories was empty afterwards and this file did not exist,
so nothing was lost: the restart happened while I was still reading.

A machine crash followed, after the first five files were written
(`plan/profile-limits.ts`, `plan/evidence-schema.ts`, `plan/index.ts`,
`instructed-acts/contracts.ts`, `instructed-acts/instruction-acts.ts`). Each was
checked afterwards: present, no NUL bytes, ending on its closing brace, and
`evidence-schema.ts` consistently CRLF (121 of 121 line ends).

**Concurrent edit in my area.** Another worker has uncommitted changes in
`flow-bootstrap/generation-failure/codes.ts` and `phase-failure.ts` (closed
request-refusal codes, the local-classifieds re-author cause). I do not edit
those two files; nothing I do needs a new failure code.

## Plan (as decided after reading)

1. **Instructed acts.** Core reads the instruction's lasting acts from its own
   words (a closed, conservative vocabulary, the same approach as
   `answerability/instruction-ask.ts`): save, add or put into a cart or list,
   collect a coupon, switch or set a store, filter or radius, open a place to
   read from, and submitting acts (book, buy, order, send, post, create,
   confirm, withdraw, place a bid, check out, ask for a quote). A negation in
   front of the verb ("do not check out") drops it. Draft steps are opaque to
   Core, so the model names the draft step that performs each act in the
   completion's optional `acts` field, and Core checks the claim: the step
   exists, is kept, changed something, and is claimed by no other act. An act
   with no valid step refuses completion, with the act and the person's own
   words named.
2. **All gates at once.** Every completion gate runs on every attempt: the
   plan checks, profile limits (now naming which limit, its maximum and the
   actual value), parameter resolution, validation, answerability,
   reachability, instructed acts, and the draft's dry run. One refusal carries
   every failure.
3. **Forced final decision / resumption.** The complete-only phase starts with
   two decisions left rather than one, so a refused final completion still has
   a turn to correct it. An exhausted build's best draft becomes a versioned,
   explicitly `incomplete` record with the outstanding completion failures,
   from which a continuation build is seeded. Never recorded as a success.
4. **Token budget vs cost.** Measured from the debugs; fix the Lab's creation
   grant so cost and the stall guard bind, not tokens.
5. **Debuggability.** Amendment refusal reasons and node ids on the published
   steps in a shape the Lab's projection keeps.

## Progress log

- **Defect 1, instructed acts: landed.** `flow-bootstrap/instructed-acts/`
  (contracts, reader, check, barrel, two test files). The reader was run over
  every instruction of the ten realistic sites: 17 consequential instructions
  yield exactly their acts, 10 read-only ones yield none (30 tests). The check
  refuses `run-mulxk0ro`'s draft with `a1 save` and `a2 open` both
  `no_step_named` and the person's sentence quoted (8 tests).
- **Defect 2, all gates at once: landed in the completion check.**
  `llm/harness-options/bootstrap-completion.ts` now runs every check whose input
  exists and returns every failure: `verdict.codes`, `feedback.refusals`, each
  check's own account (`cannotAnswer`, `cannotReach`, `missingActs`,
  `limitsExceeded`) side by side, and one instruction covering them. The profile
  limit now names the limit, its maximum and the actual value
  (`flow-bootstrap/plan/profile-limits.ts`).
- **Found while doing defect 2, probably the cause of crossborder #41:** a plan
  Core assembles from the draft was held to the limits for one model *reply*
  (12,000 bytes, 16 nodes a subflow). A drafted plan carries resolved
  parameters and can be as long as the job needs (bigbox's recorded script is
  30 steps), so it is now held to the Flow's own limits (65,536 bytes, 64
  nodes); a written plan keeps the reply limits. Not proven for #41: the bundle
  never said which limit fired.

## Outcome

(pending)
