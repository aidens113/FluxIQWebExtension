# t112 — a Flow must not be addressed through an identifier the page will draw again

Worktree `F:/fxwork/t112-volatile-selector-ids`, branch `task/t112-volatile-selector-ids`.
Nothing committed or pushed. No Lab run, campaign or provider call was started.

## Outcome

Done, with one correction to the brief's reading of the run and two findings it
did not ask for.

A generated identifier is no longer quoted in a selector or anchored on in an
xpath, so no Flow built from now on can carry one; and a Flow that already
carries one is no longer scored as though the page had named a different
control. Both halves are proven model-free in the content harness against the
everything store, on two renderings of the same fixture with different
generated ids, with the fixture untouched.

**The correction.** The two `#\:r13b8o\:` failures in the run were *not* caused
by the volatile id. They were the notifications modal not having opened yet, and
the retry ladder recovered on the third attempt. The look-alike recovery did not
fail either: it scored the six buttons the page actually held against a
recording of a button that was not on the page, and refused at −0.12, which is
the correct answer. The volatile id is nonetheless a real and serious defect —
it makes the Flow unreplayable on any *other* rendering of its own page — and
that is what is fixed. The evidence for both statements is below.

## The run, walked

`test-runs/run-muesyox4-930bef98`, `everything-store-first-page-plus-earbuds`,
`deepseek-flash`, 33 provider calls, $0.0387. Lane `created-flow`, flow
`flow.ec3d18de-c5c3-4cb6-a5da-941cf8586901`, 7 nodes, `ownPage {required: true,
navigationNodes: 1, reached: true}`, final status `failed`.

### What `:r13b8o:` is

`apps/scenario-lab/src/scenarios/everything-store/style/element-ids.ts` renders
the store's ids as `:r${hash.slice(0,5)}:` from the lab seed, with the comment
that this is "the way a component framework generates them … nothing about the
id says what the control is or survives a different seed". Recomputing that
function for the run's seed (241) gives the whole table; `notify` is
`:r13b8o:`. So the failing selector

```
#\:r13b8o\: > div > div:nth-of-type(2) > button:nth-of-type(1)
```

addresses the **"Not now" button of the notifications modal**, through the
modal's scrim. The button carries no id, no test id and no name of its own, so
`unique-selector.ts` climbed to the nearest ancestor that had an identifier —
and that ancestor's identifier was generated.

### Why the first two attempts failed

`client/timings.ts` sets `notifications: 4000`, and `client/shell-script.ts`
opens the modal on that delay after **every** page load. Against the run's own
timestamps:

| attempt | at | since page load | result |
| --- | --- | --- | --- |
| navigate | 00:41:10.924 (+2276 ms) | — | succeeded, page ready ≈ 00:41:13.20 |
| click 1 | 00:41:14.234 | ≈ 1.0 s | `target_not_found`, "6 control(s) of the same family", best −0.12 |
| click 2 | 00:41:15.574 | ≈ 2.4 s | same |
| click 3 | 00:41:17.636 | ≈ 4.4 s | **succeeded**, strategy `selector`, bestScore 0.643 |

The modal opens at 4.0 s. Attempts 1 and 2 landed before it existed; attempt 3
landed after it, and the same volatile selector resolved, because within one run
the seed does not change. The harness confirms the count the failure reported:
on the everything store's home page at seed 241 there are **6 buttons before the
modal opens and 8 after** — the failure's "6 control(s) of the same family are on
the page" is the page without the modal.

### Why −0.12 was the right answer

Scoring ran against those six buttons with the "Not now" recording. With Core's
default weights (`DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS`) and the signals
`comparableFingerprint` hands over, a same-family button that shares nothing but
its family scores:

```
visibleText   -0.55 x 24 = -13.2      accessibleName -0.55 x 24 = -13.2
role          +1.00 x 10 = +10.0      tagName        +1.00 x  7 =  +7.0
selector      -0.25 x 14 =  -3.5      classNames     -0.10 x  5 =  -0.5
visibility    +1.00 x  4 =  +4.0
total -9.4 over a compared weight of 88  ->  -0.107
```

which is the reported −0.12 to within the rounding of the real class and text
values. Nothing was close because the recorded control was not on the page. The
fingerprint carried enough (its words, its role, its tag); there was simply
nothing to match it to. **No change was made to the floor, the margin or the
corroboration rule.**

### What actually ended the run

Node `s6`, a different click, on `main > div:nth-of-type(2) > aside >
div:nth-of-type(1) > a`, with "nothing matched; **0** control(s) of the same
family are on the page". That is a purely structural address into a results-page
sidebar that the page did not hold, and it is a separate defect from this one.
The extraction step never ran (`judgement.dataset.steps[0].status: "not_run"`).

### Why the volatile id is still the defect worth fixing

The seed is the store's build. Rendered under another seed — which is what a
different build, a different deploy or React's own `useId` counter produces —
`:r13b8o:` becomes something else, and the address is dead. Measured in the
harness: seed 241 → `:r13b8o:`, seed 977 → `:r05rcq:`, and the recorded address
matches **0** elements on the second. The Flow was unreplayable the moment it was
written, exactly as the brief says; the run just happened to fail for a
different reason first.

## What changed and why

### The seam: authoring, not recovery

`apps/extension/src/content/selector/element-anchors.ts` is the one list of
identifiers a selector may quote, and every producer in the extension reaches it
through `selectorFor` — the wire descriptor, the snapshot, an extraction's
container, a plan's handle. Refusing a generated identifier there means no
producer can write one, now or later, without anybody remembering to. That is
why the rule went there rather than into the resolver.

New module `apps/extension/src/content/selector/volatile-identifier.ts`, with
two exports and a rule stated by **shape** rather than by a list of library
names, because the libraries are not the population — the generators are:

1. **A colon-delimited counter.** React's `useId` emits `:r<base32>:`, and
   Radix, Headless UI, React Aria, MUI and Ariakit all wrap it, so `radix-:r1:`
   and `headlessui-dialog-:r7:` are the same shape with a stem bolted on. Two
   narrow regexes rather than one wide one, so `form:email` — a colon separating
   two words an author chose — is not caught.
2. **An opaque token**: a UUID, a hex hash of eight or more characters, or a run
   at least a quarter digits with no four-letter run holding a vowel. It does
   not catch `section2`, `checkout2024`, `col-md-6`, `h2` or `step-1`.
3. **A named generator with a counter**: `mat-input-3`, `cdk-overlay-0`,
   `ember1234`. These have no shape a rule can see — a stem and a number is what
   an author writes too — so only here is a list the right instrument, and it is
   short and is named as a list in the module rather than dressed up as a rule.

Applied in three places:

- `element-anchors.ts` — a generated **id** is not an anchor and not a
  qualifier. Test ids and form names are untouched: both are authored by
  definition. The element keeps whatever is left, which for the store's search
  box is its real `input[name="k"]` and for the modal's button is a structural
  path.
- `element-finder.ts` `xpathFor` — the walk no longer stops on a generated id,
  for the same reason: `//*[@id=":r13b8o:"]` names nothing next time, and the
  steps it skipped were the only part that would still have been true.
- `identity/score.ts` `comparableFingerprint` — a generated id, and a selector
  addressed through one, are not handed to Core's matcher **unless a candidate
  in the pool still carries that very token**. Core has two answers for an
  identifier, +1 for agreement and −0.8 for contradiction, and it charges the
  second against weight 26; a token the page redrew is neither. The exception is
  what keeps the ordinary same-build replay exactly as it was, including the
  veto's, because there the token *is* on the page.

### What was deliberately not changed

- The floor (0.35), the margin (0.2), the veto floor (0) and
  `corroboration.ts`. The −0.12 was a correct refusal and nothing about it wants
  loosening.
- `describe-element.ts` still records `descriptor.id` for an element whose own
  id is generated. That id is a perfectly good **exact lookup** on the same
  build (`getElementById`), and Level 1 should keep it; it is only as a *scored*
  signal that it misleads, and that is where it is now dropped.
- `domain/src/runtime/llm-evidence/**` needed nothing. It carries the selector
  the extension authored and has no identifier rule of its own;
  `stable-handles.ts` keys a handle by that selector only within one authoring
  session, so it is unaffected.

### Files

| File | Change |
| --- | --- |
| `apps/extension/src/content/selector/volatile-identifier.ts` | New. The rule, and a reader for a selector already written down. |
| `apps/extension/src/content/selector/element-anchors.ts` | A generated id is not an anchor. |
| `apps/extension/src/content/selector/index.ts` | Barrel. |
| `apps/extension/src/content/element-finder.ts` | `xpathFor` walks past a generated id. |
| `apps/extension/src/content/identity/score.ts` | A generated id, and a selector addressed through one, are left out of the comparison unless a candidate still carries the token. |
| `apps/extension/src/content/selector/tests/volatile-identifier.test.ts` | New. 13 generated shapes and 10 authored ones, both enumerated. |
| `apps/extension/src/content/selector/tests/element-anchors.test.ts` | A row for the refusal, including that the other identifiers survive it. |
| `apps/extension/e2e/content/tests/selectors/tests/volatile-selector-replay.spec.ts` | New. Four rows, everything store, two seeds. |
| `apps/extension/e2e/content/tests/selectors/tests/unique-selectors.spec.ts` | Moved (from `tests/`), imports repathed. See below. |
| `apps/extension/src/content/tests/element-finder.test.ts` | Comment paths. |

**The move was forced by the audit, not chosen.** Adding a spec took
`e2e/content/tests/` to 26 files against the 25-file `directory-files` limit,
which `pnpm check` fails. The rule's remedy is to group by feature, so the two
specs about selector *authoring* — `unique-selectors.spec.ts` and the new one —
now sit in `selectors/tests/`, on the `shadow-roots/tests/` precedent already in
that directory. The parent is back to 24, so the next spec does not hit it again.

## Commands run and observed results

All in the worktree. Every number below was read off the command's own output.

| Command | Observed |
| --- | --- |
| `pnpm test:content -- selectors/tests/volatile-selector-replay.spec.ts --workers=2` | `4 passed (25.3s)` |
| `pnpm test:content -- --reporter=list --workers=4` (whole harness) | `365 passed (2.4m)` |
| `pnpm --filter @fluxiq-web-extension/extension test` | `# tests 746 / # pass 746 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/domain test` | `# tests 779 / # pass 779 / # fail 0` |
| `pnpm check` | `structure-audit: passed (99 warning(s), 121 baselined)`, then every package `check: Done`, exit 0 |
| `node scripts/structure-audit.mjs` (after the move) | `structure-audit: passed`, exit 0 |

The harness's four measurement annotations, verbatim from the JSON report:

```
- seed 241: scrim :r13b8o:; authored body > div:nth-of-type(5) > div >
  div:nth-of-type(2) > button:nth-of-type(1); was #\:r13b8o\: > div >
  div:nth-of-type(2) > button:nth-of-type(1); buttons on the page before the
  modal 6, after it 8
- seed 241 -> 977: scrim :r13b8o: -> :r05rcq:; old address matched 0;
  authored matched 1; click succeeded by selector
- after the banner was dismissed the authored selector matched 0; the click
  succeeded by fingerprint (best 0.739, candidates 1)
- pre-built address, generated token: succeeded (strategy fingerprint,
  best 0.926, candidates 1); same recording with an authored-looking token:
  succeeded (strategy fingerprint, best 0.659)
```

Read in order, those are: the authoring fix produces an address with no
generated token and it names the same button; on a re-rendered page the old
address is dead and the new one replays; a structural path is not stability on
its own and the fingerprint catches it when it moves; and a Flow that already
carries the old address is scored on what still means something.

Before the `pnpm check` failure was resolved, the audit reported
`FAIL [directory-files] apps/extension/e2e/content/tests/: 26 source files
exceeds the 25-file limit`; after the move it passes.

## Not verified

- **No live run of any kind.** The actual failing Flow
  (`flow.ec3d18de-c5c3-4cb6-a5da-941cf8586901`) was not replayed through Core's
  runtime, and no campaign, Lab run or provider call was started. Everything
  here is the content harness and the unit suites.
- **Firefox.** The content harness ran Chromium only
  (`playwright.content.config.ts`).
- **The run's terminal failure is untouched.** Node `s6`'s
  `main > div:nth-of-type(2) > aside > div:nth-of-type(1) > a` failing with 0
  same-family controls is a different defect and nothing here addresses it. The
  extraction step still would not have run.
- **The generator list is not exhaustive and cannot be.** Rule 3 names ten
  stems; a generator that writes a plain counter under a name not on that list
  is still treated as authored. Rules 1 and 2 are the general half.
- **Rule 2 has known false positives**, stated in the module: a segment such as
  `sha256sum` or `utf8mb4`, used as a whole id segment, would be called opaque.
  The cost is the element losing its id anchor and falling back to a structural
  path, not a wrong element.
- I did not measure whether refusing a generated id ever makes a selector
  **non-unique**. `selectorFor` checks uniqueness against the page on every
  form, so it cannot produce an ambiguous one; what it can produce is a longer
  and more positional one, which is the next item.

## Open questions and contradictions found

**1. A structural path is not stability, and this fix leaves the button on
one.** With the generated ancestor refused, the everything store's "Not now"
button is authored as `body > div:nth-of-type(5) > …`. Dismissing the store's
app banner — an ordinary thing a shopper does — removes a child of `body` and
that address matches nothing; the replay only survived because the fingerprint
caught it at 0.739. The honest next step is to let a selector quote a structural
qualifier that is not page text (`[role="dialog"]`, `[aria-modal="true"]`), so a
modal's controls are addressed *through the modal*. That changes the shape of
every selector and its uniqueness argument, so it wants its own task rather than
being smuggled in here. The spec's third row exists to keep the limit visible.

**2. A recorded structural selector is a signal no candidate can produce, and it
costs every scored candidate 0.187 of the scale.** `identity/candidates.ts`'s
`candidateSelector` emits only `#id`, `[data-testid="…"]` or `tag[name="…"]`,
while a recorded selector is usually a positional chain — so `comparePathSignal`
charges −0.25 × 14 and adds 14 to the denominator for **every** candidate on
**every** Level 2 resolution. Measured on the same button, same page, same
candidates: 0.926 with the selector left out, 0.739 with a structural one in.
`score.ts`'s own opening comment says it hands Core "only the ones a live
candidate can also produce" and warns that a signal no candidate can answer
"drags the whole pool under the floor" — this is the one signal that violates
its own rule. I did not fix it, because the floor (0.35) and the veto were
calibrated with it present (`reports/v-matcher-calibration.md`,
`reports/L-veto-recordings.md`) and removing it would move every measured number
in those reports. It should be a task with its own measurement.

**3. Should the `alike`/look-alike evidence say when a control is not on the
page *yet*?** The run's real loss was that a Flow built against a modal that
opens on a timer had no wait before the click, and only survived because the
retry ladder happened to be three attempts long over ~4 s. Nothing in the failure
record says "this control appears 4 s after load"; the model was given a page
that had it and built a Flow that assumes it. That is a Flow-authoring question
rather than a selector one, and it is the one I would look at next on this
fixture.
