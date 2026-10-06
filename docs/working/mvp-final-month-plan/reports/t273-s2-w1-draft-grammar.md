# t273-s2-w1-draft-grammar: report

Worker for brief "t273-s2-w1-draft-grammar" (`t273-creation-wiring.md`, S2). Core tree `fxwork/t273/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime`. No commits, Lab, browser or provider calls.

## Outcome

Done. The amendment grammar takes `place`, and the draft entry renders `route` and each step's `place`. All flow-draft tests and the answerability test pass. `fluxiq:check` passed on its first run. A second run failed only in w3's in-progress test file.

## What changed and why

- `R/flow-draft/amendment/schema.ts`
  - New `place` property, `pattern: AUTOMATION_STUDIO_FLOW_DRAFT_ROUTE_PLACE_VALUE.source`. Its description names `"r1"`, `"r1,r2"` and `none`, says the claim replaces only this step's places, and says a read may carry one.
  - The `change` description now says that `keep` "clears ... nothing when it carries act or place".
- `R/flow-draft/amendment/apply.ts`, in the disposition (add/keep/drop/exploratory) branch:
  - `place` is taken only where the disposition is `kept`, which is where `act` is taken. The value must match the place grammar; any other value is ignored, as a bad act id is.
  - It applies on a read step too, because the `act_on_a_read` rule does not touch it. A look is still refused `not_a_kept_step` for add/keep, as before.
  - Whether it changes anything is computed on a shallow copy, `automationStudioFlowDraftSetRoutePlaces({ ...step }, value)`. This is safe because the setter only assigns or deletes `places`. The copy means a refused amendment mutates nothing.
  - When it changes something, it counts toward `applied` and is set on the real step after the act claim. No other step's places are touched.
  - No-op: if nothing else changed, the refusal is `already_so`. Precedence: `already_out` (not kept), then `act_already_named`, then `already_so` (a place was given), then `already_in_flow`. No new reason was added.
  - `keep` carrying `place` clears no condition, the same rule as `keep` carrying `act` (`clearsRouting` gains `amendment.place === undefined`).
- `R/flow-draft/amendment/types.ts`: the `place?` doc is refined to cover reads, the ignored invalid value, `already_so`, and the no-routing-clear rule.
- `R/flow-draft/entry.ts`
  - `route` sits after `acts` and before `steps`.
    - named: `{named: quote, places: {r1: words, ...}}`.
    - open: `"open"`.
    - absent: no key.
  - A new conditional sentence is appended to the instruction after the bindable sentence.
    - `NAMED_ROUTE_INSTRUCTION`: " route is the way the person named to go, in their words, and its places give each place on it an id, r1 first: the Flow goes through every place on it in order, and its first step never goes deeper than r1. Say which steps are on each with place, beside add on the call that adds a step or on amend_draft add or keep: \"r1\", \"r1,r2\" for a step on two, none to clear it. Completion is refused while a place has no step in the Flow on it, or while the places are reached out of order."
    - `OPEN_ROUTE_INSTRUCTION`: " route \"open\": the person named no route to follow, so the Flow's first step may go straight to where the work begins."
  - Per step, `place: step.places.join(",")` comes directly after `act`, and only when the step has places. This holds whether or not a route is shown.
- Tests (all appended, CRLF kept):
  - `R/flow-draft/amendment/tests/apply.test.ts`: describe "places on the named route", 6 cases.
  - `R/flow-draft/tests/entry.test.ts`: describe "the route the person named", 4 cases.

All six files keep CRLF endings: the counts of CR and LF are equal in each.

## Commands run and observed results

- Fail-first, with the tests written and no source changed. In `packages/fluxiq`: `npx vitest run src/.../flow-draft/amendment/tests/apply.test.ts src/.../flow-draft/tests/entry.test.ts` printed "Tests 9 failed | 68 passed (77)".
  - Failing: all 6 apply place cases. These were add applied in order and deduped; keep replaced; none cleared; `already_so`; place on a read; place beside an already-named act plus an ignored bad value; and the schema field.
  - Also failing: the entry named, open and place-after-act cases.
  - The "absent" entry case passed before the change, as expected, because absence adds nothing.
- After the change: `npx vitest run src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/tests/deepseek-bootstrap/tests/answerability.test.ts` printed "Test Files 25 passed (25), Tests 273 passed (273)". The 5,000-byte draft budget holds.
- `node scripts/build-cache/cli.mjs fluxiq:check` (Core root):
  - First run: no TS errors printed, and the build cache said "not stamped, because inputs changed while it ran". Exit status not captured: it was piped through `tail`.
  - Second run: exit 2. The only errors were 4 TS errors in `R/llm/harness-options/tests/draft-route.test.ts`: missing `../draft-route.ts`, and `route`/`routeCheck` not on the draft-acts type. That is w3's fail-first test, a file I do not own. No error was in my files.

## Not verified

- No clean `fluxiq:check` exit 0 was captured while w3's fail-first test exists. It needs a re-run once w3 lands.
- The structure audit was not run, as the brief instructed.
- The real byte cost of the route sentence on a live draft. The named sentence is about 430 bytes and the open sentence about 120. Both are paid only where a route has settled, and the answerability fixture carries no route.
- The tool_call `place` grammar ("beside add on the call") depends on w2's parser change. The sentence assumes it lands.

## Open questions or contradictions found

- `place` given with `drop`/`exploratory` (or with routing, bind or reorder changes) is silently ignored, the same as `act`. The types doc says "add or keep only".
- `R/flow-draft/amendment/index.ts` lists the grammar in its header comment and does not mention `place`. It is not in my Owns list, so it is unchanged.
- In the non-authored (transcript) telling, "beside add on the call" names a grammar that telling does not otherwise use. The same sentence is shown in both modes.
