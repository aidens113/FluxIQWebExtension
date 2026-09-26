# t160 — A withheld path is not a selector, and the fix is the notation rather than the screen

## Outcome

Done. Every path `parameter-screen.ts` names in `withheld` now reaches the model
as itself, including the ones that descend through a list index — which was all
of them, destroyed. The locator screen is untouched and exactly as strict. The
two screens that disclose one authored object now spell one position one way, so
the cost t154 recorded is gone rather than documented.

Changed, all in `F:\!FluxIQ` on `dev`, uncommitted, no commit and no Core build:

- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/parameter-screen.ts`
  — 270 lines to 321. **One character of behaviour**: `` `${path}[${index}]` ``
  became `` `${path}.${index}` ``. The other 50 lines are the argument.
- `.../repair-context/tests/parameter-screen.test.ts` — 11 path spellings in
  `withheld` expectations updated from bracketed to dotted. **No expectation
  about which values are carried was changed**, and the file is back at its
  original 394 lines.
- `.../repair-context/tests/withheld-notation.test.ts` — **new**, 96 lines,
  3 cases. Why a second file is below.
- `.../runtime/recovery/tests/authored-state-screen.test.ts` — the two cases t154
  pinned the loss with, updated to pin the fix. **This is not the file the brief
  named** and I say so plainly below.
- `.../runtime/tests/refuted-result/tests/repair-context.test.ts` — one new case
  and one fixture addition, so the claim is also asserted where a run bundle is.

`parameter-vocabulary.ts` was **not** touched: the defect is notation, not
vocabulary, and nothing about which of Core's words carry a value moved.
`authored-state-screen.ts`, `repair-context/index.ts`, `step-parameters.ts`,
`flow-graph.ts`, `runtime/recovery/context.ts`, `runtime/llm/`,
`runtime/flow-bootstrap/`, `runtime/flow-draft/` and `runtime/service.ts` were
not touched (verified by timestamp as well as by `git status`).

## Where the defect is, and why it is not the screen

The brief offered two candidates. It is the **notation**, and the argument is not
about scope — the screen could not be loosened correctly even by somebody who
owned it.

**1. A path is not Core's string.** Core mints the separators and the indices;
every other segment is a key an author or a domain wrote. `extractList.fields`
is Core's; `#confirm` in `extractList.fields.#confirm.kind` is an author's, and
it has to keep being redacted. An exemption for "a path Core minted" would carry
an author's own locator into the request labelled as bookkeeping. The brief's
framing — "it names a position, it holds no page text" — is true of the
punctuation and false of the segments, and the segments are most of the string.

**2. The screen is handed a string and nothing else.** `automationStudioWithoutLocators`
takes a `JsonValue`. There is no channel for provenance to travel in, and
`runtime/llm/deepseek/refusal.ts` re-checks the same shapes downstream with even
less context. A carve-out would have to be invented twice, in two places that
deliberately cannot see each other.

**3. An existing test already forbids it.**
`recovery/tests/request-locator-shapes.test.ts` walks the *whole* packed request
and asserts that no string in it matches a shape the screen names. A path that
needs an exemption to survive is a path that breaks that stated guarantee, so
"make the screen tolerate this one string" is not a smaller change than "spell
the string differently" — it is a larger one, in the invariant.

So a list member is written as a dotted segment. `authored-state-screen.ts`
reached the same spelling from the other side yesterday; the two now agree as a
string rather than as a position a reader has to translate.

## The defect, measured rather than argued

`automationStudioWithoutLocators` on real path shapes, run directly against the
module (Node 22 type-stripping, script in the scratchpad):

| Input | Output |
| --- | --- |
| `extractList.where[0].matches[0]` | `extractList.where[0][locator withheld][0]` |
| `extractList.where[0].read` | `extractList.where[0][locator withheld]` |
| `fields[0].text` | `fields[0][locator withheld]` |
| `expectedState.conditions[1].assert.expected` | `[locator withheld]` |
| `extractList.where.0.matches.0` | unchanged |
| `extractList.where.0.read` | unchanged |
| `fields.0.text` | unchanged |
| `extractList.fields.#confirm.kind` | `[locator withheld]` — in **both** notations |

Two things are worse than t154's summary of it. First, the common case is not a
clean loss but a **fabricated path**: `extractList.where[0][locator withheld][0]`
names no parameter that exists and reads as though a selector had been withheld
rather than a comparand. Second, `extractList.where[0].read` loses the *name* and
keeps the index, so a repair is told a list member was withheld and not which
field of it.

The reason nobody caught it is visible in the same table: `value[0]` and
`handle[0]` survive untouched, because nothing follows the `]`. The two existing
tests that asserted a bracketed path (`value[0]`, `handle[0]`) were exactly the
two shapes that could not fail. `fields[0].text` was in the third, and its
assertion read the screen's *input*, never its output.

## What was not weakened

Every guarantee the brief listed is still asserted, by the same tests, unchanged:

- A credential-shaped, locator-shaped or over-`MAX_NAME_LENGTH` **value** is
  still withheld, in a parameter and in a comparand alike. The five cases that
  hold that pass with only their path spellings changed.
- `text` and `value` are carried at no depth, in scalar and list form.
- A withheld value still keeps its key with `null`.
- A URL is still reduced to its origin and still named when it was reduced.
- A new case asserts the screen itself is intact:
  `automationStudioWithoutLocators('an element matching selector [data-testid="pay"]')`
  still returns `an element matching selector [locator withheld]`, and
  `label: "#pay-now"` / `accessibleName: "div.row-selected > .price"` are still
  refused and named.

The one case that reads a *value* rather than a name passes against the old
source as well as the new. I am naming it as a guard rather than a regression
test: "still refuses a locator in a value, and leaves the screen that redacts one
exactly as strict".

## The other minters — the list is worth more than the fix

`automationStudioWithoutLocators` has exactly **two** callers in this program:

1. `runtime/recovery/context.ts:303`, over every recovery-context section.
2. `runtime/llm/deepseek/refusal.ts:198`, over the provider's own refusal message.

Only (1) receives Core-minted paths, and only two modules put one there:

| Minter | Reaches | Notation | State |
| --- | --- | --- | --- |
| `repair-context/parameter-screen.ts:190` | `step_parameters.steps[].parametersWithheld` | was `[i]`, now `.i` | **fixed here** |
| `repair-context/authored-state-screen.ts:194` | `expected_transition.expectedStateWithheld` | `.i` | correct since t154 |

Two more mint a bracketed index and are **not screened today**, so they are
near-misses rather than live defects — worth knowing before something screens
them:

- `runtime/llm/deepseek/request-shape.ts:161` mints `messages[${index}].content`
  into a refusal diagnostic. `refusal.ts` screens the provider's *message* and
  not this list, so it survives; it would arrive as `messages[0][locator withheld]`
  the day that diagnostic enters a screened section.
- `model/recording-domain.ts:282` mints `${path}[${index}]` for recording-event
  validation issue paths. Same situation.

Everything else in the program already writes a dotted index:
`model/composites.ts:141,142,144`, `model/regions.ts:37,41,44`,
`model/action-element-target.ts:95,96`, `model/validation/adaptation.ts`. So the
repository's habit is dotted and the two bracketed minters are the outliers, not
the other way round.

## The two files the brief did not name correctly, and what I did about them

**The pinned test is not in `refuted-result`.** The brief says
`runtime/tests/refuted-result/tests/repair-context.test.ts` holds "the test t154
pinned to record the loss". It does not: t154's report says that file was not
touched, and `grep -rn "locator withheld"` across all three test directories
finds exactly one assertion, at
`runtime/recovery/tests/authored-state-screen.test.ts:139`. That file is not in
the brief's ownership list and is not in its must-not-touch list either, and its
two cases **fail** the moment the notation changes, so validation could not pass
without editing it. I made the minimal edit — two cases, retitled, with the
comment rewritten to say that it now pins the fix and where the measurement of
the old behaviour lives — and I am flagging it as a step outside the named files.

**The brief's "appears in `withheld` as itself" needed a decision.** The literal
string `extractList.where[0].matches[0]` cannot both keep its brackets and
survive, and the only file that could make it survive with brackets is one the
brief forbids. I read the requirement as being about the **position** arriving
whole, and asserted it three ways rather than one: the position is in `withheld`
as `extractList.where.0.matches.0`; every path the screen mints is measured
against the real `automationStudioLocatorShapedText` and
`automationStudioWithoutLocators` and comes back unchanged; and the bracketed
spelling of the same position is asserted to produce
`extractList.where[0][locator withheld][0]`, so the reason the notation changed
is pinned in the test rather than only in the report.

**A third file exists because of the 400-line advisory.** The three new cases
took `parameter-screen.test.ts` from 394 to 461 lines, a **new** warn (the audit
went 182 → 183 warnings, and the new line was mine). The brief says anything the
audit reports is mine, including that advisory, so I split the cases into
`repair-context/tests/withheld-notation.test.ts`. The split is by concern rather
than by convenience: that file's subject is how a refusal is *named* and whether
the name survives the journey out, which turned out to be a separate question
from what the screen keeps, with a separate answer. `repair-context/tests/` went
2 → 3 files, nowhere near the 15-file advisory, and both files are under 400
(394 and 96).

## Commands run and observed results

All from `F:\!FluxIQ` or `F:\!FluxIQ\packages\fluxiq`, as the brief specifies.

**Baseline, before any edit:**

- `npx tsc --noEmit` → **exit 0, no output.**
- `npx vitest run …/runtime/recovery …/runtime/tests/refuted-result` →
  `32 passed (32)` files, **`454 passed (454)`** tests. t154's closing figure to
  the test.
- `node scripts/structure-audit.mjs` → `passed (182 warning(s), 358 baselined)`,
  **zero FAILs**, exit 0.

**Final state:**

- `npx tsc --noEmit` → **exit 0, no output**, run three times over the work.
- `npx vitest run src/programs/automation-studio/runtime/recovery
  src/programs/automation-studio/runtime/tests/refuted-result` →
  **`33 passed (33)` files, `458 passed (458)` tests.** The baseline's 454 plus
  four new cases (3 in `withheld-notation.test.ts`, 1 in the refuted-result
  file), **none fewer**, and the file count is 33 rather than 32 because of the
  split.
- `node scripts/structure-audit.mjs` → **182 warnings**, identical to the
  baseline count, and **none of my files appears** except
  `refuted-result/tests/repair-context.test.ts` at 523 lines, which was already
  past the advisory at 494 before I added 29 lines — a pre-existing warn whose
  value moved. `pnpm structure:baseline` was **not** run.
- The audit now reports **2 FAILs, both another worker's**:
  `[imports] runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts` and
  `…/harness-failure.ts`, each importing `../../llm/refusal-record.ts` instead of
  that directory's barrel. Both appeared *after* my clean baseline run, in files
  created while I was working (`git status` shows the whole
  `generation-failure/` directory as new and untracked). `flow-bootstrap/` is in
  my must-not-touch list. The brief's "it passes outright, so anything it reports
  is yours" was true when I measured it and is no longer true; the supervisor
  will want to hand that to whoever owns `flow-bootstrap/`.

**Narrowness proof.** I copied my `parameter-screen.ts` to the scratchpad, wrote
the bracketed index back into it — the one-character reverse of the fix, since
the file was already `M` at HEAD from t147 and `git show HEAD:…` would not have
been the pre-change source — left all tests in place, and ran the four affected
files: **`10 failed | 44 passed (54)`**, across four files.

| Failing case | File | What it pins |
| --- | --- | --- |
| names a path through a list as itself, in a notation the locator screen leaves standing | `withheld-notation` | the live shape `extractList.where.0.matches.0`, and both halves of the measurement |
| mints no path the locator screen would touch, at every level it reaches | `withheld-notation` | the property over a whole tree, not one fixture, plus the author's-key case |
| withholds a comparison target that is a credential, a locator or over-length, and names each | `parameter-screen` | three comparand paths through a list |
| carries Core's canonical condition as its operator and its comparand, and still withholds its subject | `parameter-screen` | `expectedState.conditions.0.signalPath` |
| withholds an expected value that is a credential, a locator or over-length, and the payload written beside it | `parameter-screen` | four paths through `conditions` |
| carries nothing a typing step sent, in either spelling | `parameter-screen` | `value.0`, `fields.0.text` |
| carries a list's scalar items under the list's own key | `parameter-screen` | `handle.0` |
| names the same position the parameter screen names, in the same notation | `authored-state-screen` | the two screens agreeing as a string |
| names a nested path … in both sections of one request | `authored-state-screen` | the marker absent from `step_parameters`, the position present |
| names a withheld parameter inside a list as a parameter, not as a withheld locator | `refuted-result/repair-context` | the same claim where a run bundle reads it |

The third new case passed against the reverted source, deliberately: it is the
"nothing was weakened" guard and it should pass both ways.

`git stash` is denied to workers by a hook, so the revert was a scratchpad copy
plus a scripted one-character edit. No git history was touched and nothing was
committed. My copy was restored and verified (321 lines, CRLF throughout, one
`index}` occurrence), and both checks were re-run clean afterwards.

**Housekeeping.** An intermediate edit left one lone LF in
`parameter-screen.test.ts` in a tree where `core.autocrlf=true` and every sibling
is CRLF; all five touched files are now CRLF with zero lone LFs, measured byte by
byte. t151 and t154 both hit the same trap.

## Not verified

- **Nothing was run live.** No provider call, no browser, no rerun of
  `run-muhubegx-9469de5e`. What is verified is that the name a repair is handed
  survives to the request; that a repair *reads* it better is not claimed.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run**, per the brief, and
  Core was not built. Only the `fluxiq` package was type-checked and only the two
  named test paths were run.
- **The extension repository was not type-checked or tested.** Nothing there
  imports these Core-internal modules and `parametersWithheld` is read by no code
  in either repository (`grep` finds only `step-parameters.ts` passing it
  through), so a notation change should be invisible to it; unproven.
- **The audit warning *set* was compared by count and by my own files, not line
  by line.** I have the baseline's summary line (182) and the final's (182), and
  I checked that none of my files appears in the final output except the one that
  was already warned. I did not keep the baseline's full warn list to diff, so a
  swap of one unrelated warn for another would not have been caught.
- **A pathological author key can still create a shape across the separator.** A
  key containing `]` or `[` — `a]` followed by `.b` — still produces a
  locator-shaped path and is still redacted. That is fail-closed and correct, and
  it is the residue of fixing the notation rather than the screen: Core stops
  *creating* the shape and cannot stop an author from writing one.
- **The dotted index is ambiguous with a key literally named `0`.** Both spell
  `a.0`. Accepted because the list is read by a model looking for a position and
  parsed back into a pointer by nobody; not proven safe against a future consumer
  that wants to resolve these paths.
- **Whether a long path is now truncated differently.** `MAX_WITHHELD_PATHS` is
  16 paths and the byte budget measures the section, so a dotted path is one to
  three bytes shorter per index than a bracketed one. I did not measure whether
  that changes any section's drop order; it can only make a section smaller.
- **Other workers were editing Core throughout.** `runtime/llm/`,
  `runtime/flow-bootstrap/`, `runtime/service/`, `recovery/context.ts` and
  `repair-context/` are all modified or new in the working tree by others. My
  runs were clean, but every figure above came from a tree they were also writing
  to, and the audit's FAIL count moved from 0 to 2 under me for reasons that were
  not mine.

## Open questions or contradictions found

1. **The two bracketed minters that are not screened yet are the next instance of
   this bug, and they are cheap to close now.**
   `runtime/llm/deepseek/request-shape.ts:161` and
   `model/recording-domain.ts:282` each mint `[${index}]`. Neither passes the
   locator screen today, so neither is broken — but the whole finding is that the
   two facts "Core minted this path" and "this path is screened" get connected
   later, by somebody who is not thinking about notation. Changing both to a
   dotted index costs one character each and removes the trap. I did not, because
   both files are outside this brief and one of them is in `runtime/llm/`.
2. **The notation is now a rule held by two files that agree by hand.** t154 got
   it right by hand and `parameter-screen.ts` got it wrong by hand, which is how
   the defect existed at all. The mechanical fix is a `repair-context/withheld-path.ts`
   owning the spelling and imported by both screens, with one test asserting that
   nothing it mints is locator-shaped. I did not take it: it needs a new file, an
   edit to `authored-state-screen.ts` a day after t154 wrote it, and a barrel
   change, and the brief asked me to justify any edit there. It is a supervisor's
   call and worth making before a third screen appears.
3. **The brief's map of the pinned test was wrong, and that cost real time.** The
   pinned assertion was in `recovery/tests/authored-state-screen.test.ts`, not in
   `runtime/tests/refuted-result/tests/repair-context.test.ts`. t154's report says
   so in the sentence that describes the pin. A brief written from a report's
   *conclusion* rather than from its "Changed" list will keep doing this while
   several workers are in the same directory.
4. **`request-locator-shapes.test.ts` asserts the invariant and could also have
   caught this, and did not.** It walks the whole request for strings that are
   still locator-shaped *after* screening, which a mangled path is not. An
   assertion that no string in the request *was altered* except inside the two
   sections that carry domain prose would have failed the day
   `parametersWithheld` started carrying nested paths. That is a stronger
   invariant than the one it holds, and it is the shape of check that would catch
   the next one.
5. **A repair now reads `extractList.where.0.matches.0` and has never been told
   what that notation means.** The name arrives; whether the model resolves it to
   the first condition's first pattern is untested, and the prompt that describes
   `step_parameters` does not say the list holds positions in the authored
   parameters. That is a prompt question rather than a screen question, and it is
   the last step between "the name exists" and "the repair uses it".
