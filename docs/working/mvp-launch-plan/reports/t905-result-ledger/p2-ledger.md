# t905 phase 2: the result ledger (Core, no wiring)

## Outcome

Done. `AF/result/` holds the attempt's one result (`AttemptResult`): state, one operation per row of design (b)1,
the output step, coverage, the answer contract, the answer's rows, the header, the change line, a look's line, the
empty-result refusal, and a small port for the wiring. Nothing is wired. Priya fix 4 was already on this branch
(a79248cb5); I added the run's own wording as a test.

AF = `packages/fluxiq/src/framework/automation-service/service/answer-first` in `fxwork/t905/!FluxIQ`.

## What changed and why

New `AF/result/` (21 source files, the largest about 75 lines; tests in `AF/result/tests/`):

| File | Holds |
| --- | --- |
| `types.ts` | Version, Read, StepRef, Event, Page, Step, Ledger, AnswerContract, Coverage |
| `version.ts` | `automationStudioAnswerFirstResultSameReading(a, b, "may be unsaid" \| "must be said")` |
| `ledger.ts` | `automationStudioAnswerFirstResultLedger(contract)` (empty), `automationStudioAnswerFirstResultApply(ledger, event)` |
| `page-set.ts`, `step-set.ts`, `dropped.ts`, `take.ts` | The operations; `holder.ts` finds the step that holds a (possibly folded) draft step |
| `place-order.ts`, `place-label.ts` | Where a page goes by place; what a page is called |
| `output-step.ts`, `coverage.ts` | Output step; coverage per version |
| `answer-contract.ts`, `answer.ts` | Contract from the request; the answer's rows under it |
| `header.ts`, `change-line.ts`, `look-line.ts`, `empty-refusal.ts`, `statement-words.ts` | The model-facing statements, all worked out from the ledger |
| `port.ts`, `index.ts` | The port; the barrel (exports everything) |

`runtime/flow-authoring/bootstrap/answerability/tests/instruction-columns.test.ts`: one case added with run
mwblz4aq's own words ("columns author, comment and date: author is the username of whoever wrote it, ...").
`instruction-columns.ts` itself needed no change: the colon rule (fix 4) landed earlier in a79248cb5.

### The API the wiring calls

```ts
// port.ts
automationStudioAnswerFirstResultPort(instruction: string): AutomationStudioAnswerFirstResultPort
type AutomationStudioAnswerFirstResultPort = {
  record(events: readonly AutomationStudioAnswerFirstResultEvent[]): string | undefined; // one call's or run's events -> its answer's line
  header(): string;            // the fixed-slot statement
  outputStep(): AutomationStudioAnswerFirstResultStep | undefined; // for ending.ts / keep.ts
  answer(): { rows: JsonObject[]; columns: readonly string[]; unmatched: readonly string[] };
  emptyRefusal(): string | undefined; // completion refusal words, or undefined when the result holds rows
  ledger(): AutomationStudioAnswerFirstResultLedger; // for the phase 3 judge summary
};

// types.ts (inputs, plain data)
type Version = { conditions: readonly JsonValue[]; fields: JsonObject; listKey?: string };
type Paging = { verdict: "moved" } | { verdict: "ended"; reason: string };
type Read = { source; version; place?; kept; leftOut?; where?; paging?; carried? };   // source = call id or batch id
type StepRef = { id: string /* draft step's stable id */; position: number; intermediate?: boolean };
type Event =
  | { kind: "page"; step: StepRef; read: Read }        // a draft read step read a page (add, rerun, run pass, batch, carry-on)
  | { kind: "step"; step: StepRef; version: Version }  // a read step is in the draft as this version (add or amend)
  | { kind: "paging"; stepId: string; paging: Paging } // verdict said after the step's latest page was recorded
  | { kind: "dropped"; stepId: string }
  | { kind: "look"; read: Read }                       // a read not in the draft
  | { kind: "take"; source: string; step: StepRef };   // amend_draft change "take"
```

Pure functions under the port, for callers that hold the ledger themselves: `...Apply`, `...ChangeLine(before,
after)`, `...Header`, `...LookLine(ledger, source)`, `...EmptyRefusal`, `...Answer`, `...OutputStep`,
`...Coverage(step)`, `automationStudioAnswerFirstAnswerContractOf(instruction)`.

### Each rule and its test (every rule was reverted once; the named tests failed)

The mutation script, `t905-mutations.mjs` in my scratchpad, changed one line, ran the two test folders and restored
the file. The failures it printed are below.

| # | Rule | Where | Tests that failed with it reverted |
| --- | --- | --- | --- |
| M1 | A place read again replaces its page, never adds beside | `place-order.ts` | ledger "replaces the page…", evidence mwa19obz, change-line "page read again", carried-replaced (4) |
| M2 | Numbered places stand in list order whatever order they were read in | `place-order.ts` | ledger "numbered order", paging-on-latest, coverage order (3) |
| M3 | D2: a new step with equal said `listKey`, conditions, fields folds | `step-set.ts` | D2 fold test, **Saturday**, dropped-with-folded (3) |
| M4 | A version change drops the old version's pages | `step-set.ts` | version tests (2), change-line, header "no page yet", **mwbk0twg** (5) |
| M5 | A dropped step's pages leave, announced | `ledger.ts` | drop tests (2), change-line working read (3) |
| M6 | D1: a look never changes the result | `ledger.ts` | **mwafor01**, **mwaudvnh**, look test, header looks, take, refusal, change-line (8) |
| M7 | `take` makes a look a step with its page | `ledger.ts` | take test (1) |
| M8 | Carry-on pages are marked carried | `page-set.ts` | carry-on test (1) |
| M9 | Output step = last read step not `intermediate` | `output-step.ts` | output-step test, drop announcement (2) |
| M10 | Answer narrowed to the sure contract's columns | `answer.ts` | **mwb2kkv5**, answer narrowing (2) |
| M11 | Fix 4: a colon after an item ends the column list | `instruction-columns.ts` | 3 instruction-columns colon cases, contract priya case (4) |
| M12 | A list that ran on is an unsure contract | `answer-contract.ts` | contract unsure, header unsure (2) |
| M13 | An unsaid `listKey` never makes a new version | `version.ts` | "only the list key is said" test, late fold test (2) |

Other tests that pin a behaviour, not one revertible line: "no place said is next after the last place"; D3
(left-out rows are never rows); "a draft that never assembles still has a result" (the ledger has no input that
names the assembled Flow, so no line can be reverted to make it fail: it documents the property); the header
template; the change-line wordings; coverage first/unknown/moved; the empty refusal.

## Commands run and observed results

- `cd .../t905/!FluxIQ/packages/fluxiq && npx vitest run src/framework/automation-service/service/answer-first/result src/runtime/flow-authoring/bootstrap/answerability`
  -> `Test Files 10 passed (10)`, `Tests 75 passed (75)` (run again after the mutation run restored every file).
- `node <scratchpad>/t905-mutations.mjs` -> each of M1-M13 `exit 1` with the failures listed above; afterwards
  `git status` shows `instruction-columns.ts` unmodified and grep finds no mutation left in `result/`.
- `cd .../t905/!FluxIQ && node scripts/structure-audit.mjs` -> `structure-audit: passed (537 warning(s), 969 baselined)`.
  Two advisory warnings are mine: `result/` has 21 source files (advisory 15, hard 25), and `tests/support.ts`
  exports 15 values (advisory 8).
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t905 -- "cd '.../packages/fluxiq' && pnpm check"` -> after the queue, `heavy-slot: t905 took slot-1`, then
  `tsc --noEmit` through the build cache: `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; ...","ms":113328}`.
  It printed no `error TS` lines and ended `EXIT 0`.

## Not verified

- No wiring, so no real-service or real-SQL test. Design (d) asks for the evidence-run shapes "with real SQL" as in
  `af/tests/latest-read.test.ts`. Here they are ledger-level tests through the port; the real-SQL versions belong
  with the wiring.
- No `rows/tests/*` case was ported: they test the row sink, which still exists until the wiring step deletes it.
- The header, change line and refusal are not yet under the judge word guard (`flow-less/tests/judge.test.ts`), which
  is a phase 3 file. I wrote them with generic words only: no site, task or product word. They do name
  `amend_draft` and `take`, which are tool words.

## Open questions or contradictions found

1. **No place said is a real gap, not an edge.** "Next after the version's last place" is the design's rule, so a
   rerun from the start of a step whose domain says no `place` appends duplicate pages: a short re-read without a
   place followed by a run gives 4 + 10 + 10. This is correct only once phase 1's domain `place` is on every list
   read's answer and on the batch. The wiring should treat a missing place on a paged read as a domain defect to
   report, not a normal case.
2. **Fold equality includes `fields` and `conditions` as the call wrote them.** If the domain writes a handle into
   a field spec or condition (`t12.text`), then three detections under three handles (Saturday) differ in fields and
   do **not** fold, even with one `listKey`. The Saturday test assumes handle-free fields. Phase 1 or the wiring must
   make sure versions carry no handle, or version equality needs a handle-free normal form from the domain.
3. **The design leaves D2's fold as a question; the lead decided it.** Implemented: a fold records the duplicate
   step as `folded` under the existing step, announced in the change line. A folded step that later reads
   differently parts again with no pages. Dropping the holder hands its pages to the first folded step.
4. **Positions.** The ledger keeps each step's `position` (what the model reads) and decrements later positions when
   a step is dropped. A *move* is not an event: the wiring must send a `step` event with the new position for every
   step that moved.
5. **Paging verdict timing.** The brief put the verdict on the page event. A page's verdict is known only after the
   next-page act, so I added a `paging` event that sets it on the step's most recently read page.
6. **The answer narrows only when it is safe.** A sure contract narrows rows to the named columns. A named column is
   matched by exact name, then ignoring case, spaces, `_` and `-`. If any named column has no held column of that
   name, the rows stay as read and that column is reported as `unmatched`. Narrowing could otherwise throw away the
   named column held under another name, which only the judge can weigh.
7. **"Whether the first place was read"** is known only for numbered places (lowest is 0 or 1). A cursor or an
   unplaced read says `unknown`. A domain `first` flag on the answer would make this exact.
8. **Barrel.** `AF/index.ts` (not mine) does not yet export `./result/index.ts`. The audit passes without it; the
   wiring step should add it.
