# t151 — The screen's vocabulary gets its own module, and one inconsistency is settled

## Outcome

Done, both items. Core's parameter vocabulary is now its own module with its own
argument, and the screen that consults it is back under the advisory; and a
predicate over page text is no longer disclosed in one section of a repair
request and named as withheld in another.

Changed, all in `F:\!FluxIQ` on `dev`, uncommitted, no commit and no Core build:

- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/parameter-vocabulary.ts`
  — **new**, 283 lines
- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/parameter-screen.ts`
  — 426 lines to 270
- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/index.ts`
  — five comment lines, no export added; the reason is below
- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/tests/parameter-screen.test.ts`
  — one expectation changed, three cases added

`runtime/tests/refuted-result/tests/repair-context.test.ts` was **not** touched.
Its 14 tests pass unchanged, and its `+5` in `git diff --stat` is t147's
uncommitted assertion, not mine. Net production code across both modules is a
two-word vocabulary change and a signature that takes a number instead of a
struct; everything else is prose moved and prose written.

## Item 1 — the split, and the evidence that nothing changed

`parameter-vocabulary.ts` holds `coreVocabularyKey`, the three key sets and
`MAX_NAMED_KEY_DEPTH`. `parameter-screen.ts` keeps the recursion, its bounds, the
URL reduction and the withholding record. The division is not by size but by
kind: **the vocabulary answers "is this key one of Core's words, and how deep may
it be believed", and the screen answers "where am I and what is allowed here".**
That is why `MAX_NAMED_KEY_DEPTH` went with the words and `MAX_DEPTH`,
`MAX_NAME_LENGTH` and the rest stayed with the walk.

`coreVocabularyKey(key, at: ScreenPosition)` became
`coreVocabularyKey(key, nameDepth: number)`. Moving `ScreenPosition` would have
put the recursion's own bound in the vocabulary module, which is the wrong home
for it; passing the one number the vocabulary actually reads leaves the coupling
at exactly what it is.

**The prose survived.** Every argument t141 and t147 wrote is still in the tree,
in whichever module now owns the decision:

| Reasoning | Now lives in |
| --- | --- |
| Three kinds of word; `text`/`value` in none of them | vocabulary header, and the line between a payload and a comparand is now stated rather than implied |
| `run-muhubegx-9469de5e`, the screened blob it handed the re-author, why the allowance could not reach the words | vocabulary header, in full |
| Non-monotonicity (`fields.price` vs `fields.price.kind`) | vocabulary header in full; named in the screen header as the reason the two rules live apart |
| A list and its items are one level | screen, at `ScreenPosition` and `screenedListItem` — it is a position rule, and it was already stated there in full |
| The scalar-item half that had been unapplied | screen header |
| Why a comparand is carried (the `context.ts` and `flow-graph.ts` precedent, the relation-is-not-a-payload-slot property, the bound) | vocabulary header and `COMPARAND_KEYS` |
| `handling` admitted, `header` declined | vocabulary header and `CLASSIFIER_KEYS` |
| The residue: an author may name a column `kind` | vocabulary header |
| A domain's forgiving spelling of a relation is withheld | `COMPARAND_KEYS` |
| The reduced-URL disclosure, and why `withheld` names a reduction | screen header, untouched |

`step-parameters.ts`'s import is untouched — it imports
`automationStudioScreenedNodeParameters` from `./parameter-screen.ts`, which
still exports it with the same signature.

**The barrel deliberately does not export the new module**, and says so in five
comment lines. `recovery/index.ts` re-exports this barrel so the Testing Lab can
reach the screen; `coreVocabularyKey` is the screen's own policy, and calling it
from outside would mean reimplementing the screen around it. So the directory's
public surface is byte-identical to before, which is part of "nothing changed".

**How I know nothing changed.** I ran the split and the vocabulary change
separately. With the two modules in place and `expected`/`operator` removed from
the sets — i.e. the refactor carrying exactly the old vocabulary — the whole of
both suites passed at **444 tests across 31 files with not one expectation
edited**, which is t147's closing figure to the test. Same suites, same count, no
test file open. The split is prose moved and one signature narrowed; nothing else
could have moved, and nothing did.

## Item 2 — `expectedState.conditions[].expected` is carried

**Decided: carry it.** `expected` joined `COMPARAND_KEYS`, bounded by
`MAX_NAMED_KEY_DEPTH` exactly as the other five relations are. `operator` joined
`CLASSIFIER_KEYS`. `signalPath` was declined and is named as residue.

Three arguments, each a property of the position rather than a hope about the key,
and each checkable:

1. **`expected` is the comparand slot by declaration.** `model/conditions.ts`
   declares `AutomationCondition` as `{ signalPath, operator, expected }` with
   `operator` drawn from a closed union — so the relation is in a sibling key and
   the comparand is under `expected`. The extraction grammar puts the relation in
   the key (`contains: ["Sold out"]`). **Same position, two spellings of one
   grammar**, and this vocabulary already refuses to let spelling decide: it is
   why `field_id`, `fieldId` and `FieldID` are one key. "It is a different key"
   was the only thing distinguishing them, and the brief is right that it is not
   a property.
2. **The screen already carried it whenever it was not a string.** A number and a
   boolean are returned before any key is consulted, so `{ operator: "equals",
   expected: true }` — Core's own `fixtures/recorded-task.ts` writes exactly that
   — has always come through intact. The section's behaviour was therefore not
   "withhold the comparand" but "withhold the comparand when its author wrote
   text", which is a property of the value's *type* and of nothing about the
   position. Asserted in the new tests.
3. **It is the same object, not merely the same shape.** This is the one I did not
   expect to find, and it is what makes the old behaviour a defect rather than an
   inconsistency of taste. `runtime/executor/expected-transition.ts:9` reads
   `node.parameterValues?.expectedState` and puts it in the transition;
   `recovery/context.ts:306` puts that object into `expected_transition` **whole**
   (the section-wide screen there is the locator screen and nothing else). So
   `parametersWithheld: ["expectedState.conditions[0].expected"]` was a false
   claim about the request it sat in: the value it named as withheld was two
   sections above it, verbatim, unscreened for credentials and unbounded in
   length. This file's own paragraph — a screened parameter and a parameter the
   step never had must not read alike — fails from a third side when a parameter
   is named as withheld *and carried elsewhere in the same request*.

**What carrying it does not give away.** This screen stays strictly stricter than
`context.ts` is with the identical object: a credential-shaped, locator-shaped or
over-long comparand is still refused and still named, and the allowance still
binds, so a column an author happened to call `expected` is a column. All four are
asserted. Carrying `expected` narrows the disagreement between two sections; it
does not hand the screen's guarantees over.

**Why `operator` came with it.** A comparand is believed *because* it sits under a
relation. A record that cannot show the relation cannot be checked against that
reason, so the justification and the record have to agree. Beyond that,
`operator` is drawn from `AutomationConditionOperator`, a closed union Core's own
model declares — the definition of a classifier — and `op`, the same word
abbreviated, was already carried at any depth. Withholding `operator` was the
spelling deciding again. I am flagging it as a second, smaller decision inside
item 2 rather than burying it: it is the only change here the brief did not name.

**Why `signalPath` was declined, honestly.** Not on a property argument — I do not
have one I believe. It is neither a classifier nor a comparand but an *address*
into the run's value bag, and whether Core's state paths are names it carries is a
question about bindings (`step-parameters.ts` says a state-bound parameter carries
its binding) rather than about comparisons. So Core's canonical spelling of a
condition now reaches a repair as an operator and a comparand with its subject
withheld and named, and the web domain's spelling — which names its subject with
`kind` or `field`, both already carried — reaches it whole. The new tests pin the
withholding so the residue is a decision somebody can find rather than an
artefact. It is the same move t141 made with `handling` and t147 then finished.

**The line the whole vocabulary now rests on, stated in the module.** Both
`expected` and a typing step's `text` are authored Flow-document data, so "the
user wrote it" cannot be what decides — and t147's precedent argument, taken
alone, would license `text` too. What decides is what the position *does* with the
value: `text` and `value` are where a step puts what the person supplied, to be
sent into the page; a comparand is a test applied to something the page had
already shown. A payload has to sit under a key that says where it goes. The new
tests assert `text` refused in the same condition object whose `expected` is
carried, which is that sentence as an executable claim.

## Commands run and observed results

All from `F:\!FluxIQ` or `F:\!FluxIQ\packages\fluxiq`, as the brief specifies.

- `npx tsc --noEmit` → **exit 0, no output**, run twice: after the split and after
  the test changes.
- `npx vitest run src/programs/automation-studio/runtime/recovery
  src/programs/automation-studio/runtime/tests/refuted-result` → **`31 passed
  (31)` files, `447 passed (447)` tests.** t147's 444 plus my three new cases;
  none fewer, and the refuted-result file's 14 pass untouched.
- `node scripts/structure-audit.mjs` → `structure-audit: 1 violation(s) across 1
  rule(s)`: `FAIL [file-lines] runtime/flow-bootstrap/generation-failure.ts: 817
  lines`. **Identical to t147's closing figure**; that file is another worker's
  and was already red. Grepping the full audit output for `repair-context` and
  `parameter-` returns exactly one line, a pre-existing `warn` on
  `runtime/tests/refuted-result/tests/repair-context.test.ts` (487 lines), a file
  I did not open. **Nothing of mine is a FAIL and nothing of mine is past the
  400-line advisory:** `parameter-screen.ts` 270, `parameter-vocabulary.ts` 283,
  `tests/parameter-screen.test.ts` 394. `runtime/llm/deepseek/` no longer appears
  at all — the worker there has split it since t141 measured it. `pnpm
  structure:baseline` was **not** run; the `1 baseline entries can be lowered`
  line predates this work, as t141 already recorded.

**Item 1's proof that nothing changes.** Two runs, in this order:

1. Both modules in place, `expected` and `operator` **in** the sets, tests
   untouched → `1 failed | 443 passed (444)`, `30 passed | 1 failed (31)` files.
   The single failure was
   `expectedState.conditions[0].expected: expected null, received "Aiden
   Stapler"` — item 2's behaviour change and nothing else. 443 of 444 tests did
   not move.
2. Same modules, the two words removed → `31 passed (31)` files, `444 passed
   (444)` tests, **no test file edited at all**. Same suites, same count as
   t147's close, zero expectations changed.

**Item 2's narrowness proof.** With the final tests in place I put the
pre-decision vocabulary back (the two words removed — a more precise revert than
restoring the whole file, because the split is provably behaviour-neutral by run 2
above) and ran `…/repair-context` plus `…/tests/refuted-result`: **`4 failed | 39
passed (43)`**. The four were exactly:

| Failing case | What it pins |
| --- | --- |
| reads a list item's keys as the definition's wherever the list sits | the one pre-existing expectation this task changes |
| carries what an expected-state condition expected, because the same object is already two sections above it | `expected` carried, in both authored spellings, and the boolean form that always was |
| carries Core's canonical condition as its operator and its comparand, and still withholds its subject | `operator` as a classifier, `signalPath` still withheld |
| withholds an expected value that is a credential, a locator or over-length, and the payload written beside it | the three refusals *plus* the carried control |

Being honest about the fourth: its three refusals, its `text` refusal and its
allowance-bound assertion would pass under either rule — they are guards. What
fails there is the carried control and the shorter `withheld` list that follows
from it. The other 39 tests in those three files passed against the old
vocabulary, including all 14 in `refuted-result/tests/repair-context.test.ts`.

`git stash` is denied to workers by a hook, so the revert was done by rewriting
the two set literals and restoring from a scratchpad copy. No git history was
touched and nothing was committed.

**Mechanical check of the three sets** (script in the scratchpad, parsing the new
module): `NAMING_KEYS: 15 | CLASSIFIER_KEYS: 12 | COMPARAND_KEYS: 6`;
`duplicates across the three lists: []`; `'text' or 'value' anywhere: []`;
`naming unchanged vs t147: True`; `classifier added: ['operator'] removed: []`;
`comparand added: ['expected'] removed: []`. Nothing was dropped in the move and
the three sets are still disjoint.

**One housekeeping note.** `parameter-screen.ts` reached me as LF-only in a
working tree where `core.autocrlf=true` and every sibling is CRLF; an
intermediate edit of mine wrote it LF as well. Both my files are now CRLF like
their siblings, and `git diff --stat` shows a content diff rather than a
whole-file one.

## Not verified

- **Nothing was run live.** No provider call, no browser, no rerun of
  `run-muhubegx-9469de5e`. That a repair *behaves* differently once shown what an
  expected-state condition expected is an expectation; what is verified is that
  the value reaches the request, and that the request no longer contradicts
  itself about it.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run**, per the brief, and
  Core was not built. Only the `fluxiq` package was type-checked and only the two
  named test paths were run. A consumer of this screen outside them would not
  have been caught; a grep says `step-parameters.ts` is still the only one in
  `packages/fluxiq/src`, and `coreVocabularyKey` has exactly one caller.
- **The extension repository was not type-checked or tested.** Nothing there
  imports this Core-internal module, and the directory's exports are unchanged, so
  there is nothing for it to have noticed — but I did not prove that by running it.
- **Whether a live `expectedState` condition ever carries a value I would not want
  carried.** The argument is about what the position can hold, not a survey of
  what Flows have written. I read the schema
  (`model/conditions.ts`), Core's own fixtures and the web domain's spelling in
  the existing tests; I did not read authored Flows out of `test-runs/`.
- **`operator` at a depth a classifier is carried from.** It is now carried at any
  depth, so a column an author names `operator` has its page field carried, the
  same residue `kind` and `mode` already admit. I asserted the classifier residue
  no further than t141 did.
- **Two other workers were editing Core throughout.** `runtime/flow-bootstrap/`,
  `runtime/llm/` and `runtime/service/flow-bootstrap-commands/` are modified in
  the working tree by them. My runs were clean, but the figures above were taken
  from a tree they were also writing to.

## Open questions or contradictions found

1. **`signalPath` is the named gap, and it is now asymmetric on purpose.** Core's
   canonical condition reaches a repair as "something contained `/plus`" — the
   relation and the comparand, not the subject — while the web domain's spelling
   arrives whole. Deciding it means deciding whether a path into the run's value
   bag is a name this screen carries, which is the binding question rather than
   the comparison question. A test pins the current answer so the next task
   inherits a decision rather than an accident.
2. **`context.ts` is the looser of the two screens, and this task did not touch
   that.** It applies the locator screen to a whole section and nothing else, so
   `expectedState` reaches a provider there with no credential screen and no
   length bound. The parameter screen is stricter, which is the right direction
   for the two to differ in, but the asymmetry means a credential authored into an
   `expectedState` condition reaches the model through `expected_transition` while
   being refused three sections down. That is a `recovery/context.ts` decision and
   that file is not mine under this brief; it is worth a task.
3. **A repair that reads both sections now sees the same comparand twice.** With
   `expected` carried, `expected_transition` and `step_parameters` overlap on
   exactly the text that was the point of disagreement. That is bytes rather than
   a contradiction, and the byte budget already drops sections in a fixed order —
   but if the packet gets tight, `step_parameters` is now slightly more
   compressible than it was and nobody has measured it.
4. **The vocabulary module will attract the next decision, which is what it is
   for.** It is 283 lines, of which roughly 180 are the argument. The next word
   admitted should go in it with its own paragraph; the next *position* rule
   belongs in the screen. If a task cannot tell which it is holding, that is the
   signal that the split was drawn in the wrong place, and the table above is what
   to check it against.
