# t357: candidate scripts can mark optional steps and choose options by desired state

Worker: t357-optional-choose. Edits only in the Core tree `C:\Users\osrs_\FluxStuff\fxwork\t357\!FluxIQ`
(branch `task/t357-candidate-optional-and-choose`), not committed.

## Outcome

Done, with one deliberate departure from the brief's wording, explained below. A candidate script can now
say `optional: yes` on a step. The one existing checker reads it and refuses a bad placement, naming the
line. The candidate-only text now teaches choices as the state they leave, using `web.dom.check` and
`web.dom.select`, and says when a press is right instead. The legacy format and completion schema bytes did
not change, and a sha256 test now pins them.

**Departure: the shape an optional step assembles to.** The brief says "assembling to the existing
`metadata.sometimesPresent`". A plan node (`plan/contracts.ts` `AutomationStudioFlowBootstrapNode`) has no
`metadata` field. The plan reader rejects unknown node fields (`plan/parsing.ts:107`), and only
`adaptation.ts` writes Flow node metadata. So reaching `metadata.sometimesPresent` would need a new plan field
across three files I do not own. That would also be a new graph format, which the brief forbids.

Instead, an optional step assembles to the existing **optional shape**: `step.failed -> Merge` and
`step.success -> Merge`. A drafted `optional` step already becomes exactly this (`authoring/draft-routing.ts`).
`executor/step-skip/absent-step.ts:18-23` defines "sometimes-present" as either that shape or the metadata
flag, and handles the two the same way: an absent target takes the `failed` edge to the Merge, with no retry
and no fault. State routing goes through the same function (`executor/state-routing/decision.ts:68`). So the
runtime behaves exactly as it would with the flag, and nothing new is asked of the plan, the Flow or the
runtime. A test proves the absent-step skip goes past an optional step, and does not go past the same step
without the line.

One semantic note: the optional shape (like drafted `optional`) also routes a non-absent failure of that step
to the Merge. The flag alone would fail the run instead. The format text says "the run goes on past it when it
cannot be done", which matches the shape.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

- `authoring/contracts.ts`: new `AutomationStudioFlowScriptOptional` type (`text`, `line`) and an optional
  `optional` field on `AutomationStudioFlowScriptStep`.
- `authoring/parse.ts`: inside a step, a line whose key is `optional` or `sometimes present` is read onto the
  step exactly as written. It is reserved like `node:`, so it is never read as a node parameter. No node
  declares a parameter with either name; I checked with grep in Core `src` and downstream `domain/src`. The
  parser stays lenient: it does not judge the value.
- `authoring/assemble.ts`: new private `optionalScriptSteps`. It runs per block, before
  `routeAutomationStudioFlowScriptRepeats`, and lowers each `optional: yes` step into the drafted optional shape
  (a `failed` branch to a derived Merge step labelled `:optional<block>.<n>`, then success falls into it). No
  written label can equal that label, and it is unique across blocks.
  - Values: `yes`, `true`, `y`, `optional` or empty mean yes. `no`, `false` or `n` mean the step is treated as
    if the line were absent.
  - Refusals. Each is an error whose path is `flow.line.<the optional line>`:
    - `flow_script.optional_invalid`: any other value.
    - `flow_script.optional_misplaced`: the step runs a block; the step is inside a repeat span or is the step
      that says repeat (helper `repeatedScriptSteps`); the step has its own `on <port>:` line (the message
      names the port and its line); or the node has no `failed` output.
    - `flow_script.optional_unavailable`: the library has no Merge.
  - A step whose node is unknown is left for the existing `flow_script.unknown_node` refusal.
  - A block with no optional line comes back as the same array, so legacy scripts are untouched.
- `plan/flow-script-format.ts`: `AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE` is the candidate-only constant that
  `candidate/authoring-loop.ts:29` already shows. I could not add a new constant, because `candidate/**` is
  t356's, and only this constant reaches the model. It now opens with four guidance lines:
  1. A choice is written as the state it leaves. A press toggles, so pressing an already-chosen option
     un-chooses it.
  2. Use `web.dom.select` for a dropdown. Use `web.dom.check` with `checked: true` or `false` on a checkbox or
     radio, including one drawn as a swatch, chip or button. It presses only when the state differs.
  3. Press with `web.dom.click` only for a plain button with no box, radio or dropdown behind it, and only when
     the page arrives with it unchosen. A choice the page arrives with already chosen needs no step. A press is
     right for apply, add, send, open and next.
  4. `optional: yes` is for a step only sometimes needed (a cookie banner, popup or notice). It is never for a
     step the answer depends on, never inside a repeat, and never beside an `on` line.

  The example now has an optional cookie-banner press (`consequences: none`, `optional: yes`). The colour is
  set with `web.dom.check` and `checked: true` instead of a select. The header comment records why.
  `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT` is byte-identical.
- `authoring/tests/optional-step.test.ts` (new, 11 tests). It covers:
  - the exact plan nodes and edges, which match the drafted shape in `draft-routing.test.ts:77`;
  - plan validation;
  - the runtime absent-step skip, with and without the line;
  - `sometimes present: yes`, bare `optional:` and `optional: no`;
  - no change without the line;
  - two blocks with no label clash;
  - an optional step right before a `repeat while` span builds and validates;
  - refusals, each naming its line: invalid value (line 9), a step that also branches (line 9), a step inside
    a span (line 18), the step that says repeat (line 8), and a node with no failed port (`builtin.control.end`,
    line 7).
- `plan/tests/flow-script-format.test.ts`: the act-example block was rewritten for the new constant. Its tests
  check that:
  - the guidance and example stay out of the format and out of the legacy completion schema;
  - the example builds as eight nodes (navigate, click, merge, check, select, type, click, wait), with the
    banner press declaring `[]` and the basket press `modify_existing`, the swatch carrying `checked: true`,
    and the banner's failed and success edges both going to the Merge;
  - every press in the example carries `consequences:`;
  - the desired-state sentences are present, and no "choose" step in the example is a click;
  - the optional sentences are present.

  A new block pins the sha256 of the legacy format (`1209b6dd...80cc`) and of the JSON completion schema
  (`85c8a062...f575`). Both digests were measured with the HEAD source swapped back in.

## Commands run and observed results

All run from `C:\Users\osrs_\FluxStuff\fxwork\t357\!FluxIQ\packages\fluxiq` unless noted.

- **Fail-first.** I copied my four source files to scratch, put the HEAD versions back
  (`git show HEAD:<path> > <path>`), and ran
  `npx vitest run .../authoring/tests/optional-step.test.ts .../plan/tests/flow-script-format.test.ts` plus a
  temporary digest probe. Result: `Tests 16 failed | 11 passed (27)`. All 10 optional-step tests and all 6 new
  or rewritten format tests failed. The digest test failed only because its value was still a placeholder. The
  probe printed `DIGEST_FORMAT 1209b6dd3c48a87d8d5366b38b4c3061114cbdb99a64cbc99697a2de67f480cc` and
  `DIGEST_SCHEMA 85c8a062a18c40ba32b650a02b8cc3936e3df549565f664113f97efa9187f575` at HEAD. I then restored my
  files and deleted the probe.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests src/programs/automation-studio/runtime/flow-bootstrap/plan/tests`
  -> `Test Files 29 passed (29)`, `Tests 294 passed (294)`.
- Neighbours that read the act example, or that the optional shape touches:
  `npx vitest run .../flow-bootstrap/candidate/tests .../service/flow-bootstrap-commands/tests .../conversations/commands/tests/extension-chat.test.ts .../executor/tests/absent-step.test.ts .../flow-bootstrap/tests`
  -> `Test Files 34 passed (34)`, `Tests 285 passed (285)`.
- Nonincremental typecheck: `npx tsc --noEmit -p tsconfig.json` -> no output, exit 0 (about 40 s).
- Structure audit, from the Core root: `node scripts/structure-audit.mjs` -> `structure-audit: passed (288 warning(s), 508 baselined).`,
  exit 0. It also printed `1 baseline entries can be lowered`. I did not remove any violation, so that entry is
  not from this change, and I did not run `structure:baseline`.
- `as never` in my files: grep finds none. The only hit nearby is the existing `routes.test.ts:73`.

## Not verified

- No live or Lab run, and no provider call (forbidden by the brief). Whether the model writes `optional: yes`
  and `web.dom.check` correctly is untested.
- Whether the page view gives the model a handle for a radio or checkbox hidden under a swatch. `web.dom.check`
  needs the `<input>` itself (`apps/extension/src/content/action-runtime/checkable-state.ts`), and a label
  handle is refused `not_checkable`.
- I did not exercise the downstream domain's real `web.dom.check` definition. I used Core's fixture, which
  declares the same `checked` flag.
- Candidate trial execution of an optional step through the normal runtime. I proved it at the
  absent-step-skip level, not by running the graph.

## Open questions or contradictions found

1. **Brief versus ownership** (see Outcome). `metadata.sometimesPresent` cannot be reached from a plan without
   a new plan field in `plan/contracts.ts`, `plan/parsing.ts` and `adaptation.ts`. I used the equivalent
   existing optional shape. If the flag itself is wanted, a follow-up needs those three files.
2. **Shared reader.** Legacy goes through the same parser and assembler, so a legacy script that wrote
   `optional:` would now be read as the optional line. Before, it was resolved by near-match or refused as an
   unknown parameter. The legacy prompt never teaches the word, and the prompt and schema bytes are unchanged
   and pinned.
3. **Already-chosen options versus the acts checklist.** The guidance says a choice the page arrives with
   already chosen "needs no step at all". t342 round 2 found that the instructed-acts checklist keeps asking
   for such a step (its C2: no "already chosen" state). If candidate mode checks instructed acts at submission
   or trial, a script following this guidance could be refused there. That rule lives in
   `flow-bootstrap/instructed-acts/`, which this brief did not own.
4. **Existing gap I did not fix.** A drafted or written repeat whose head is a Merge adds a `success` branch
   from the Merge. That works only because the built-in Merge declares `success`; the bare
   `nodes/control-flow/merge.ts` declares only `next`. The test "an optional step before a repeat" passes with
   the real registry.
