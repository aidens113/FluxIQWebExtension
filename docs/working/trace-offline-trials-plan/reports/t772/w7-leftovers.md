# t772 w7: what the ledger reports as left matches settlement

## Outcome

Partial. Everything inside the fence is built, tested and green.

- One function now decides whether an act is left, and every settlement answer and every leftover record reads it.
- The new tests failed first where today's code disagreed.
- The six named test directories pass (760 of 760), the Core typecheck is clean, and the structure audit has 0 violations.

One part of item 3 does not hold, and its cause is outside my fence:

- Under trace withholding, a trial act's `values` carries the location `[withheld]`, not the address the run executed with.
- The cause: `executor/executed-locations/locations.ts` pairs only a diff's `controls`.
- The test that shows this is committed as `it.fails`, with a comment naming the gap. See "Open questions", item 1.

## What changed and why

Core paths are relative to `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

### One answer for "is it left" (item 1)

**New: `site-reset/leftover.ts`.** It is exported from the `site-reset/index.ts` barrel and provides:

- `automationStudioSiteResetLeftover(act, irreversible, unmet)`, a pure function;
- the type `AutomationStudioSiteResetLeftover`.

It answers one of these:

| `left` | `standing` | When |
| --- | --- | --- |
| `no` | `restored` | Undone, or a start hook took it back |
| `no` | `unchanged` | Settled unchanged ("left unchanged"), or a legacy act whose page showed nothing of it |
| `yes` | `in_place` | Open, and the model's to undo |
| `yes` | `irreversible` | Its class is `move_money` or `send_or_publish` |
| `possibly` | `unsettleable` | Closed as `gate_unsatisfiable`; carries `failed` (the `AutomationStudioSiteResetUnmet` it failed) |
| `possibly` | `kept` | A legacy act the build kept |
| `possibly` | `possible` | A press that declared no lasting class but changed its page (t593) |

**`site-reset/ledger.ts`.** A private `leftOf(act)` settles the act first (`settledNow`), then calls that function, with `unmet` asked last and lazily. Everything below reads it:

- `inPlace()`: acts whose standing is `in_place`.
- `toUndo()`: the same test; the undo claims and `beforeTrial` use it.
- `unsatisfiable()`: acts whose standing is `unsettleable`, carrying `failed`.
- `possiblyInPlace()`: acts whose standing is `possible`.
- `standing(id)`: now returns `leftover(id)?.standing`. Its union gains `unsettleable` and `possible`.
- New public `leftover(id)`.
- `trialRan()`: returns the acts whose standing is `in_place`, `unsettleable` or `kept` (the new `LEFT_BY_TRIAL` constant). Before, it returned every act that was undoable, not undone and not `possible`.

I checked branch by branch that `inPlace`, `unsatisfiable` and `possiblyInPlace` give exactly the same sets as before. The `agrees` helper in the new tests asserts this on every scenario.

**Answers that changed:**

1. `standing()` answered `in_place` for an act listed apart under `actsUnsettleable`. It now answers `unsettleable`.
2. `trialRan()` returned an act settled `unchanged` as left on the site (it fed `leftOnSite`). It no longer does. Such an act is still told to the judge under `startedWith.cannotUndo`; `beforeTrial` is untouched.
3. A possibly lasting act's `standing` was `in_place`; it is now `possible`.

The readers outside my fence already handle these values the same way:

- `brief-ports.settlementAnswer` treats any standing other than restored or unchanged identically.
- `reset-done.ts` filters unsettleable and possible acts out before it reads `standing`.

**`site-reset/project-ledger.ts`.** Each act in `snapshot()` now carries:

- `left`: `yes`, `possibly` or `no`;
- `failed`: only when the act is unsettleable;
- `inPlace`, read off the owner brief's `leftover()`. Its meaning is unchanged.

Both the type and the header are updated. This is data only, so t774 can word endings from it. I changed no wording anywhere.

### Room in `ledger.ts` (item 4)

- **New: `site-reset/trial-stamp.ts`.** It holds `automationStudioSiteResetTrialStamp`, the former private `stamped` method, moved whole with its doc comment. Its behaviour is unchanged.
- The only difference is that the two receipt stores are passed in.
- It is not exported from the barrel.
- `ledger.ts` went from 799 to 771 lines, and its header gained the "What is left agrees with settlement (t772 w7)" paragraph.

## Tests

The fixtures use a neutral domain: a library's reading list, a book's Reserve control, and an app's preferences page. No realistic scenario's words appear.

### Item 2

**`site-reset/tests/project-ledger.test.ts`, new describe "what the ledger reports as left agrees with settlement (t772 w7)".** Each case calls the `agrees(project)` helper. It checks, for every act, that these all agree:

- `standing`;
- `leftover`;
- the snapshot's `inPlace`, `left` and `failed`;
- `inPlace()` membership;
- `unsatisfiable().failed`.

| Case | What it checks |
| --- | --- |
| (a) | A toggle undone at its own control and read back: `{no, restored}`; snapshot `left: "no"`; `trialRan([])` is `[]` |
| (a') | An act settled unchanged on a named list: `{no, unchanged}`; `trialRan([])` is `[]` |
| (b) | Slot 4's shape: a looped pass on another item at a distinct place (`pl:reserve-primer` against the receipt's `pl:reserve-atlas`), undone there: `{no, restored}`; snapshot `left: "no"`; project `unsatisfiable()` is `[]`; `trialRan([])` is `[]` |
| (c) | A row changed on a list the build read before (`no_admissible_undo`): `{possibly, unsettleable, failed: "no_admissible_undo"}`; `standing` is `"unsettleable"`; snapshot `{inPlace: false, left: "possibly", failed: "no_admissible_undo"}`; still returned by `trialRan` |

**`reset-settlement/tests/ledger-value.test.ts`, new describe for value acts (d).**

- A value act restored by its own Save and a fresh read: `{no, restored}`, and `trialRan([])` is `[]`.
- Capped after two own undos with fresh reads still showing the set value: `{possibly, unsettleable, failed: "value_not_back"}`, `standing` is `"unsettleable"`, and `inPlace()` is `[]`.

### Item 3

- **`site-reset/tests/start-check.test.ts`.** A read with well-formed `values` keeps them. Five malformed shapes each drop all of `values` and keep the read.
- **`service/candidate-trial/tests/landed-acts.test.ts`**, two new tests:
  1. A trial attempt whose `stateDiff.values` is well formed yields an act whose `values` sit at the diff's location. Four malformed shapes drop `values` and keep the act.
  2. The `it.fails` test: a graph run with a row-bound address. `controls.location` gets the executed address, but `values.location` is `[withheld]`.

### Existing tests updated

All are in owned folders, and each change follows one of the changed answers above.

- `settlement-unmeetable.test.ts:54`, `settlement-unreachable.test.ts:108` and `settlement-shapes.test.ts` shape F: `standing` is now `unsettleable`, not `in_place`.
- `settlement-shapes.test.ts` "answers where every kind of act stands": `act-2` (no witness, nothing to name) is now `unsettleable`. I added an assertion that `unsatisfiable()` lists it as `nothing_to_name`. Before, `standing` said `in_place` while `unsatisfiable()` listed the act apart.
- `ledger-looks.test.ts:45` and `settlement-shapes.test.ts` shape E: an act settled unchanged is no longer in `trialRan`'s return.
- `project-ledger.test.ts`: the exact snapshot gains `left: "yes"`; the possibly lasting act gains `left: "possibly"`.

## Commands run and observed results

All Core test commands ran from `!FluxIQ/packages/fluxiq`.

### Failing first

Before any implementation, the new tests alone (`project-ledger`, `ledger-value`, `start-check`, `landed-acts`) gave: `Test Files 3 failed | 1 passed (4)` / `Tests 9 failed | 53 passed (62)`.

- Most failures were `TypeError: lend.leftover is not a function`, because the accessor was new.
- The two `project-ledger` exact-snapshot tests failed on the missing `left` field.
- `start-check` passed, because the supervisor's wiring already works.
- The landed-acts executed-location test failed with `- "location": "https://settings.test/profiles/7"` / `+ "location": "[withheld]"`.

### Disagreements in today's code

To see where today's code actually disagrees, I ran the same scenarios with only today's API (no `leftover`) as temporary probe files, then deleted them:

- **project-ledger probe:** `Tests 2 failed | 2 passed (4)`.
  - Unchanged case: `AssertionError: expected [ { act: 'act-1', …(2) } ] to deeply equal []`, because `trialRan` returned the settled-unchanged act as left.
  - Unsettleable case: `AssertionError: expected 'in_place' to be 'unsettleable'`.
  - (a) and (b) passed on today's code; w1 had already fixed (b) at its source.
- **ledger-value probe:** `Tests 1 failed | 11 passed (12)`. The capped case gave `expected 'in_place' to be 'unsettleable'`.

### After implementation

- **Same new tests:** `Test Files 2 passed (2)` / `Tests 25 passed (25)` for `project-ledger` and `ledger-value`.
- **First run of the brief's group command:** `Test Files 4 failed | 65 passed (69)` / `Tests 6 failed | 754 passed (760)`. These were the six pinned old answers listed under "Existing tests updated", which I then updated.
- **Final run of the brief's command:** `node ../../scripts/vitest-groups.mjs --groups=parallel <FB>/site-reset <FB>/reset-settlement <FB>/reset-admission <FB>/reset-answers <RT>/service/candidate-trial <RT>/service/project-build-ending` gave `Test Files 69 passed (69)` / `Tests 760 passed (760)` / `[vitest-groups] all groups passed: parallel`.
- **Readers outside my fence, run narrowly and not edited:**
  - Files: candidate `trial-gate-reset` and `reset-witness`; subflow-candidate `subflow-trial-gate` and `subflow-trial-whole`; flow-bootstrap `site-reset-build` and `action-permissions`; dispatch `reset-done`, `unsettleable-acts` and `whole-trial-port`; supervisor `left-on-target`, `provider-stopped`, `whole-trial` and `reset-next`; service/project-build `ledger`, `phase-start`, `reset-settle`, `reset`, `trial-reset`, `reset-calls` and `acts-record`; service/subflow-trial `site-reset`.
  - Result: `Test Files 19 passed (19)` / `Tests 193 passed (193)`.
- **Typecheck:** `node --max-old-space-size=8192 ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` exited 0 with no output.
- **Structure audit:** Core root `node scripts/structure-audit.mjs` gave `structure-audit: passed (445 warning(s), 1152 baselined).` That is 0 violations. Advisory warnings on files I touched:
  - `ledger.ts`: 771 lines, 35 methods (`stamped` removed; `leftover` and `leftOf` added);
  - `site-reset/`: 21 files;
  - `site-reset/tests/`: 25 files. I added no file there.

## Not verified

- No live, browser or Lab run (forbidden by the brief). I have not shown that the chat ending now says the right thing on the real flow. That needs t774's wording to read `left` or `failed`, or to keep reading `inPlace` and `unsatisfiable()`, which already agree.
- I did not run full suites. I did not run the downstream tree, because nothing downstream changed.
- I did not read or change `left-on-target.ts`, `reset-done.ts`, `phase-start.ts` or `brief-ports.ts` beyond confirming how they handle the new standings.
- The `failed` reason now reaches the snapshot, but no ending reads it yet.
- The w1 closure (`own_back` / `already_back`) still cannot be reached through a ledger path, so (c) is tested with `no_admissible_undo`, plus `value_not_back` for (d). The function handles every `AutomationStudioSiteResetUnmet` the same way.

## Open questions or contradictions found

1. **The value witness's location under withholding (item 3, outside my fence).**
   - `automationStudioExecutedLocations` (`executor/executed-locations/locations.ts`) pairs only `stateDiff.controls`.
   - So `landed-acts.ts` `valuesOf` reads `[withheld]` as the location of any step that reached its page by a row-bound or input-bound address.
   - A live trial act's value witness then names no real page. Its settle words and Core's `lookFirst` would point at `[withheld]`.
   - Fix options:
     - (a) pair `stateDiff.values` in `executed-locations` as `controls` is paired, by keying the saved `values` object too;
     - (b) in `landed-acts.ts`, fall back to the controls' executed location when the step's `values.page` equals `controls.page`.
   - Remove `.fails` from the landed-acts test once it is fixed.
2. **Settled unchanged no longer appears in `leftOnSite`.** This follows the brief ("left-unchanged is never reported as left"). The trial judge still hears it under `startedWith.cannotUndo`, with `LEFT_UNCHANGED` words that begin "left on the site; …". That wording belongs to t774, and t775 is retiring the trial gates. Flag it if the words should change too.
3. **Documentation.** Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` is not in my fence. It should gain a line under "How an act settles" saying that `standing`, `leftover`, the snapshot's `left`/`failed` and `trialRan` all read `site-reset/leftover.ts`.
