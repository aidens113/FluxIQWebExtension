# t772 w4: value witness, phase A (design and domain half)

## Outcome

Done for phase A.

- **Domain half:** implemented and green. 101 of 101 tests pass, both `tsc --noEmit` passes are clean, and the structure audit passes.
- **Core:** two new standalone files with a unit test. Neither is wired in; no existing Core file was touched.
- **Phase B:** the Core design is below, with its exact files and the tests to write first.

**Decision: option (a), the domain seam, but not only in `diff.ts`.** A value witness needs the domain on both of its evidence routes and on settlement:

1. **Explored acts are not read off the step diff.** act-19 was an exploration act (0089). Core reads an explored act's evidence from its own start-state reads just before and just after the call (`site-reset/act-places.ts`). That path already counts a reload to the same address as "stayed", because it compares locations, not documents. The `documentChanged` rule in `diff.ts` only affects trial acts.
2. **The pressed control is not where the value shows.** On the fixture (`everything-store/pages/checkout.ts` line 44-45), the confirming press is "Deliver to this address", a button. The value it changes is a separate `<p>`. Even with `controls` emitted across the reload, the button's place would show only the chooser closing, never the address. Relaxing `documentChanged` alone (the debug note's untested inference) would not have witnessed act-19.
3. **Settlement needs fresh reads to report values by place.** Core can only see "the value is back" if every read carries the value at each place. Building that place token from a read alone needs the selector, which never leaves the domain.

So the domain now gives:

- every start-state read a `values` map (place to value token);
- every step diff that stayed on its page a `values.replaced` list;
- `controls` across a same-address reload too.

Core applies the same replacement rule to the two reads around an explored act.

## What changed and why

### Domain (downstream tree `C:/Users/osrs_/FluxStuff/fxwork/t772/!FluxIQWebExtension`)

**New files:**

- `domain/src/runtime/llm-evidence/control-spot/values.ts`: `webValueStates(page)`.
  - Returns each shown value of a read as `Record<placeToken, valueToken>`.
  - **Place:** `scope` digest of `resource\0location\0value\0frame\0selector`. These are the same parts a list's scope token uses.
  - **Value:** digest of `[page-view words, field value, chosen option]`.
  - **Left out:** stateful controls (they are read by state), hidden elements, anything in a dialog or a layer or under one, elements with no words and no value, places shared by two elements, and pages with more than 2,000 places (the whole answer is then `{}`).
- `domain/src/runtime/state-diff/places/value-replacements.ts`: `webStateValueReplacements(before, after)` and the type `WebStateValueReplacement`.
  - A place shown on both sides is a replacement when its value changed and the old value is gone from the page. Values that are still on the page only moved (a sort, or a row inserted above others).
  - `newValue: true` marks a new value the page did not show before.
  - Bounded at 256 replacements; past that, it returns none.

**Changed files:**

- `domain/src/runtime/state-diff/places/diff.ts`:
  - New key `values: { page, location, replaced: [{ place, from, to, newValue? }] }`, emitted when the step stayed on its page and replaced at least one value.
  - "Stayed on its page" now means the same document, or a reload at the same address on the same trusted source (`reloadedInPlace`). `controls` uses the same test.
  - Lists (`items`, `collections`) still require one document.
  - Header updated.
- `domain/src/runtime/llm-evidence/start-state/observe.ts`: every read answers `values` (absent when empty). This is a domain contract extension.
- `domain/src/runtime/llm-evidence/tools.ts`: added `values?: Record<string, string>` to the `startState` return type (one line). This is a domain contract extension.
- **Barrels:**
  - `llm-evidence/control-spot/index.ts` and `llm-evidence/index.ts` export `webValueStates`.
  - `state-diff/places/index.ts` and `state-diff/index.ts` export `webStateValueReplacements`.

**Tests (written first; observed failing, see below):**

- `state-diff/places/tests/value-witness.test.ts` (new, 7 tests).
- `llm-evidence/control-spot/tests/values.test.ts` (new, 3 tests).
- `llm-evidence/start-state/tests/observe-values.test.ts` (new, 1 test).
- `state-diff/places/tests/places.test.ts`: one assertion changed. It asserted that a same-URL `documentChanged` step carries no `controls`. A same-address reload now carries them, so the "moved" case uses another address.

**The rule changed during the work, and why.** The first version also required `to` to be new to the page, to filter out positional shifts. The fixture's chooser is inline: its option labels (`<label>` holding the address line) show the new address before the press. That filter would have dropped exactly the act-19 replacement. The rule now needs only `from` gone. Shifts and label-seen values are kept as weak replacements (no `newValue`), which Core never lets keep an act open. The inline-chooser fixture test pins this.

### Core (paired tree `C:/Users/osrs_/FluxStuff/fxwork/t772/!FluxIQ`), new files only, not wired

Under `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/reset-settlement/`:

- `value-witness.ts`: `automationStudioSiteResetValueReplacements(before, after)`. It is Core's copy of the domain rule, for an explored act read around by Core. Also exports the type `AutomationStudioSiteResetValueReplacement`.
- `value-tracker.ts`: `AutomationStudioSiteResetValueTracker`, with `read`, `witnessed`, `landed` and `standing`. It returns `AutomationStudioSiteResetToggleStanding` (the type is imported from `control-tracker.ts`, which is not edited). Rules (header):
  - **Starts:** one start value per place, from the first read while no act of the build replaced that place. A trial act seeds an unread place's start from its own `from`.
  - **holds:** the latest read of the page, taken at or after the act's clock and the ledger's current clock, shows the start value at one or more started places, and no `newValue` place still shows its `to` (unless that `to` is the start).
  - **stale:** that read is older than either clock, or there is none.
  - **unproven:** no place has a start.
  - **open:** anything else.
- `tests/value-witness.test.ts`: 7 tests.

## Commands run and observed results

All domain commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t772/!FluxIQWebExtension/domain`.

- **Failing first.** `DOMAIN_TEST_BUILD_LABEL=t772-w4 node scripts/test-domain.mjs state-diff/places/tests control-spot/tests/values start-state/tests/observe-values`:
  - Before any code, bundling failed: `No matching export ... for import "webValueStates"` and `"webStateValueReplacements"`.
  - With empty stubs: `# tests 25 / # pass 18 / # fail 7`. All 7 new behaviour tests failed, and all 18 existing tests passed.
- **After implementation**, the same command over `state-diff/ control-spot/tests start-state/tests runtime/tests/host-runtime`:
  - First run: `# tests 98 / # pass 98 / # fail 0`.
  - After the rule revision: `# tests 101 / # pass 101 / # fail 0`. The count rose by the added inline-chooser test and split cases.
- `pnpm --filter @fluxiq-web-extension/domain check` was refused by its gate: `FluxIQ Core's build at ...\t772\!FluxIQ is not current with its source`. Other workers are editing Core in that tree, so I did not rebuild Core's dist.
- **Typecheck instead:** `node ../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` gave `src tsc exit 0`, and `... -p tsconfig.test.json --noEmit` gave `test tsc exit 0`. Both ran against the existing Core dist, and no diagnostics were printed. My domain change uses nothing new from Core.
- `node scripts/structure-audit.mjs` (downstream root): `structure-audit: passed (226 warning(s), 616 baselined)`.
  - The first run failed on my deep import `../node-run/layer/element`; I fixed it to use the barrel.
  - The only warning on a touched file is the existing `tools.ts: 790 lines` advisory. I changed one line there and added none.
- **Core:** `npx vitest run .../reset-settlement/tests/value-witness.test.ts` (in `packages/fluxiq`): `Test Files 1 passed (1) / Tests 7 passed (7)`.
- **Core typecheck** of only the new files: a scratch tsconfig extends `packages/fluxiq/tsconfig.json` with `files` set to the 3 new files, run with `npx tsc -p` → `exit 0`.
- **Core** `node scripts/structure-audit.mjs`: `structure-audit: 1 violation(s)`. The violation is `[as-never]` in `service/project-build/tests/project-build-told.test.ts`, another worker's untracked file. No line names my files.

## Core design for phase B

The neutral fixture throughout is a choir rehearsal planner:

- tokens: page `p:planner`, value place `pl:room`, values `v:room-a` / `v:room-b`;
- the act's own control: spot `{ resource: "r:tab", scope: "p:planner", place: "pl:buttons", state: "st:use-room" }`;
- an option radio: spot `{ resource: "r:tab", scope: "p:room-list", item: "i:room-a", place: "pl:radios", state: "st:room-a" }`.

### B1. Contracts and parsing

- `site-reset/contracts.ts`:
  - `AutomationStudioSiteResetRead.values?: Record<string, string>`.
  - `AutomationStudioSiteResetPlace.values?: AutomationStudioSiteResetValueWitness` (explored acts).
  - `AutomationStudioSiteResetTrialActPlace.values?: AutomationStudioSiteResetValueWitness` (trial acts).
  - Add `"step"` to the admit `on` union of `AutomationStudioSiteResetTarget`.
- `site-reset/start-check.ts`: `valuesOf(read.values)`. Every key and value must match `/^[A-Za-z0-9:_-]{1,128}$/`, with at most 2,000 entries; otherwise drop the whole map (as `controlsOf` does).
- `service/candidate-trial/landed-acts.ts`: `valuesOf(attempt.stateRefs?.stateDiff?.values)` reads `{ page, location?, replaced[≤256] of { place, from, to, newValue?: true } }`, with tokens checked. The location comes through `automationStudioExecutedLocations` exactly as `controlsOf` does. Any malformed entry drops `values` and keeps the act.
- `reset-settlement/index.ts`: export `./value-witness.ts` and `./value-tracker.ts`. Switch the new test's imports to `../index.ts`.

### B2. How `ledger-act.ts` / `ledger.ts` record the witness

- `ledger-act.ts`: `value?: AutomationStudioSiteResetValueWitness`. It is "the shown values its press replaced (t772); only for an act that declared exactly `modify_existing`".
- `ledger.ts`:
  - Own `private readonly values = new AutomationStudioSiteResetValueTracker()` beside `tracker`.
  - `observed(read)`: call `this.values.read(read, this.clock)` next to `tracker.read`.
  - Explored acts:
    - `act-places.ts` computes `automationStudioSiteResetValueReplacements(before.values, after.values)`. It does this only when `stayed`, `before.scope === after.scope`, both maps are present, and the result is non-empty. It passes `values: { page: after.scope, location: before.location, replaced }` in `placed()`.
    - `ledger.placed()`: if `onlyModifies(entry.consequences)` and there is a value witness, set `entry.value`, call `this.values.witnessed(entry.value)`, and set `entry.changeSeen = true`.
    - The read before the act has already started the places, because `act-places` observes `before` first.
  - Trial acts, in `trialRan()`: if `act.values` is present and `onlyModifies(act.consequences)`, call `this.values.landed(act.values)` *before* `if (!recorded) continue` (as `tracker.landed` is placed). Then set `recorded.value`.
  - Judge ports: add `values: this.values`. Admission ledger port: `value: (act) => this.judge.valueOf(act)`.

### B3. How settlement judges by value (`judge.ts`, `decision.ts`)

**Design choice:** the value standing lives in the new `value-tracker.ts`, not in `control-tracker.ts`. The toggle tracker keeps counts per place; values are one token per place, and their start and staleness rules mirror R1/R2. Folding them into one class would mix two witness kinds.

**`judge.ts`:**

- `AutomationStudioSiteResetJudgedAct.value?`.
- `valueOf(act)` returns `act.value` **only for an otherwise-witnessless act**: no group (from `groupsOf`), no `toggleOf(act)`, no `controlOriginal`, no `transfer`, no `subjectUndo`. This keeps list and toggle acts exactly as today. A timestamp or a page notice that changed at the same time can then never block an act that already has a sound witness.
- `evaluate()` passes `value: valueOf(act) ? ports.values.standing(act.value, act.clock, ports.clock()) : undefined` to `settleDecision`.
- `unmet()`:
  - a `baseline` reason (from an `unproven` value) maps to `no_baseline` as today;
  - the new reason `value` goes to `more?.(reason)`.

**`decision.ts`:**

- Input `value?: AutomationStudioSiteResetToggleStanding`.
- `VALUE_REASON = { stale: "look", unproven: "baseline", open: "value" }`, all with `witness: "value"`.
- The no-witness check becomes `!groups.length && !input.toggle && !input.value`.
- `OpenReason.reason` gains `"value"`, and `witness` gains `"value"`.
- A held value settles `restored` (`changeSeen` was set when the witness was recorded).

**`lookFirst`:** unchanged. A stale value reason is `look` with a location, so Core reads the page itself before asking the model.

### B4. Admission (`undo-admission.ts`, `undo-paths.ts`, `undo-reach.ts`, `undo-claims.ts`, `reset-answers/`)

**Value block in `undo-admission.ts`**, placed right after the toggle block and before the `undeclared_press` check, when `ledger.value(act)` is defined:

- `own` = `sameControl(act.spot, declared.control)`: `resource`, `scope`, `place` and `state` are all present and equal, and `dialog` and `item` are each equal or both absent.

| Control | Declares | Answer |
| --- | --- | --- |
| `own` | exactly `["modify_existing"]` | admit `{ on: "own", allowed: ["modify_existing"] }` |
| `own` | anything else | refuse `consequence_not_inverse`, `this_page` |
| not `own`, same `resource` | nothing (`[]`) | admit `{ on: "step", allowed: [] }`: a choice made with no lasting class is a step toward the undo, not an undo |
| not `own` | a lasting class | refuse a new failed code `value_not_own_control`, `this_page` |

Notes on the table:

- The `own` refusal for other declarations is meetable: the same control declaring `modify_existing` is admitted.
- The `step` row matches on resource, not scope. A chooser's radios sit in a list, so their spot `scope` is the list's scope, not the page's. A `step` adds no unasked class and counts no attempt, so it is no wider than the same call without `undoes`.
- For `value_not_own_control`, add it to `reset-answers/failed.ts` and `condition-words.ts`, worded generically: "Set the choice back with a press that declares no lasting class, then press the control this act pressed, declaring modify_existing."

**`undo-claims.ts` `ran()`:** `on: "step"` is no attempt. It sets no `undoneBy` and no `chain`, but it does call `ledger.pressed(place)` (it changed the page, so earlier reads go stale). After attaching any named destination, `if (look || step) return`.

**The mislabel fix:** `subjectDeletion` only for an act that created a subject.

- In the admission, the `aboutTheAct && reverses` branch also requires `PATHS.deletesCreated(act)`.
- In `unmatched()`, when `!PATHS.deletesCreated(act)` and the control is not on a named destination, return `["no_exact_inverse", "no_call"]`, never `no_destination_read_before` or `no_item_identity`. With the value block in place, act-19 never reaches `unmatched`. This is for a witnessless `modify_existing` act with no value witness.

**`undo-paths.ts` and `undo-reach.ts`:**

- New `undo-paths.ts` gate `ownControl(act)`: `act.spot` has `resource`, `scope`, `place` and `state`.
- `undo-reach.ts`, for reason `value`: answer `no_admissible_undo` when `!ownControl(act)`, since no own press can ever be admitted; otherwise undefined (meetable). This gives the honest `gate_unsatisfiable` exit.

**Invariant (debug fix 5):** every act in `actsToUndo` has a call its settle words name that `target` admits; otherwise it is in `actsUnsettleable`; and no refusal for an unsettleable act says `this_page`.

### B5. Settle words by witness kind (`reset-settlement/words.ts`)

These are generic and name no site.

| Reason | Words |
| --- | --- |
| `look` + `value` | `read the page${at} again so the value this act set can be seen` |
| `value` | `the value this act set still shows${at}: set it back where it shows -- choose the value it replaced with a press that declares no lasting class, then press the control this act pressed, declaring modify_existing, each naming this act under undoes -- then look at the page` |
| `baseline` + `value` | `the value it changed${at} was never read before the build changed it, so nothing read can show it put back: no call can settle it in this build` |

The list route ("read the list ... name resetDestination") stays only for `name`, which a value act never gets, because a value witness is a witness.

### Failing-first Core tests to write in phase B

All use the choir planner fixture above, and no realistic scenario name.

**FB/site-reset/tests/ledger-value.test.ts (new):**

1. An explored `modify_existing` press whose reads around it are at one address replaces `pl:room` (weak, no `newValue`). The trial is refused, and the act's `settle` contains "set it back where it shows", not "resetDestination". Today it says "read the list ... resetDestination".
2. The option radio declaring `[]` under `undoes` is admitted `step`, and `attempts` stays 0. Today: `undeclared_press`.
3. The own control declaring `modify_existing` under `undoes` is admitted `own`, with `modify_existing` unasked. Today: `no_destination_read_before`, `no_call`.
4. After 3, a fresh read showing `v:room-a` settles the act `restored`, and the next `beforeTrial` admits.
5. The radio declaring `modify_existing` is refused `value_not_own_control`, `this_page`. Today: `no_item_identity`.
6. The own control declaring `[]` is refused `consequence_not_inverse`, `this_page`.
7. A value act whose place was first read after the act is in `actsUnsettleable` as `gate_unsatisfiable` / `no_baseline`, and no refusal for it says `this_page`.
8. A trial act with diff `values` gets the same witness, and a later read at the start settles it.
9. A witnessless `modify_existing` act with no value witness and no named list is refused `no_exact_inverse` / `no_call`, never `no_destination_read_before`.
10. An act with a toggle or a group witness ignores a value witness: a notice that changed at the same time never blocks it.

**FB/site-reset/tests/settle-invariant.test.ts (new):** a property test over generated ledgers mixing value, toggle, list and witnessless acts, checking invariant B4. Generated over spot shapes, with and without own-control tokens, and with and without starts.

**FB/reset-settlement/tests/value-settlement.test.ts (new):**

- `judge.evaluate` returns `look`, `value`, `baseline`, then settled `restored`, with locations;
- `unmet` gives `no_baseline` for an unproven value, and `no_admissible_undo` through `more` when the own control has no tokens;
- the value words are generic.

**Parsing tests:** service/candidate-trial `landed-acts` parses diff `values` (and drops it when malformed); `start-check` parses read `values`.

**Domain contract Core can rely on:**

- read `values?: Record<placeToken, valueToken>`, with tokens `p:[0-9a-f]{32}`;
- diff `values?: { page, location, replaced: [{ place, from, to, newValue?: true }] }`, at most 256 entries;
- the diff `values.page` equals the read's `scope` for the same page;
- the diff `controls` is now also present on a same-address reload.

## Not verified

- **No live, browser or Lab run.** Whether the live office page produces the witness end to end is inferred from reading the fixture:
  - the confirm press uses `location.reload()`;
  - the shown address `<p>` has a positional selector, stable because the chooser `div` is only unhidden;
  - the option labels make it a weak replacement.
- That the extension's real capture of a `<label>` gives the same page-view words as the `<p>` (equal tokens, hence weak) was checked only with fixture captures.
- **Selector stability in general.** A page that inserts a same-tag sibling above a value can shift its place and produce a weak spurious replacement. By design that never blocks an act; it can only fail to help it hold.
- **Liveness cases not solved:**
  - An otherwise-witnessless act whose only replacements are incidental (a "saved at" time alone) never holds.
  - A value witness whose own control is gone from the site stays open with `value` while its own-control tokens exist.

  B4 gives no exit for these beyond `no_admissible_undo` when tokens are missing. A bounded rule ("after N landed own undos with no start value seen, `no_admissible_undo`") is a candidate, and is not designed here.
- **Size:** read answers now carry one token pair per shown value (up to 2,000, about 75 bytes each). I did not measure the effect on read logging or memory.
- **No Core wiring.** Core currently drops `values` silently (`start-check.ts` and `landed-acts.ts` whitelist fields), so nothing changes in behaviour until phase B.
- `pnpm --filter ... domain check` did not run through its own gate: Core's dist was stale from other workers' edits. Both `tsc` passes ran directly instead.
- The Core unit tests were written beside the new standalone modules, not observed failing first. Only the domain tests were.

## Open questions or contradictions found

- **The debug note's fix 1 is incomplete as written.** "The domain emits the place for a same-address reload" would not have witnessed act-19. It was an explored act, whose evidence is Core's reads, and the pressed button is not where the value shows. The value-by-place reading above is what both routes need.
- **The `step` admission changes a rule.** A press declaring nothing under `undoes` on a value act's resource is admitted instead of refused `undeclared_press`. That rule existed to make an undo declare its class. Please confirm this narrowing (value acts only) before phase B.
- **Documentation.** Architecture docs describing the state diff's `controls` rule ("only for a step that stayed on its document") and the start-state read fields should be updated in phase B. I did not locate or edit them.
- **Another worker is active in the same domain directory.** `domain/src/runtime/llm-evidence/control-spot/tests/place-per-page.test.ts` (untracked, not mine) appeared in `control-spot/`. My only edit in that directory's existing files is one added barrel line in `control-spot/index.ts`.
