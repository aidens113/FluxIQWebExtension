# l1-d2-controls: control places and states (downstream)

## Outcome

Done. Every visible stateful control now has an opaque `place` and `state`. The press declaration and the step
diff's spot carry them. Start-state answers carry `controls`, and the step diff carries `controls: { page, before,
after }`. In the photo-social markup, the post's own Like has the same place in the grid's dialog and on the post's
own page. A comment's Like has a different place whenever the comment is a record.

## What changed and why

`LE/` = `domain/src/runtime/llm-evidence/`.

- New, one export each, in `LE/control-spot/`:
  - `role.ts`: `webControlRole`, the first word of `role ?? implicitRole`.
  - `stateful.ts`: `isWebStatefulControl`. It accepts a control that is not `hidden` and has a stateful role
    (button, checkbox, switch, radio, menuitemcheckbox, menuitemradio, option, tab) or any `aria-pressed`,
    `aria-checked` or `aria-selected` attribute.
  - `place.ts`: `webControlPlace(page, handle)`. The token is
    `webControlSpotToken("scope", resource\0location\0control\0role\0R)`, where `control` is a literal that keeps it
    apart from the page-scope and list-group tokens. It is undefined when the page has no `resetResource` or
    evidence, or the handle is not a visible stateful control. A per-capture handle index is cached in a WeakMap.
  - `state.ts`: `webControlState(element)` is `scope("state\0" + JSON.stringify([name, aria-pressed,
    checked ?? aria-checked, aria-selected]))`.
  - `states.ts`: `webControlStates(page)` returns `{ [place]: { [state]: count } }`. It returns `{}` above 2,000
    places, Core's `controlsOf` limit, because Core would drop the whole answer.
- **One change from the brief's key (R):** a control in `page.records` gets `R = "record\0" + (subject ?? "")`, and
  a control in no record gets `R = ""`.
  - With the brief's literal key (`subject` if in a record, else `""`), a comment row the page does not title
    distinctly gets subject `""`. That gives it the post's own place.
  - The fixture check below shows this case (the same author commenting twice).
  - With the marker, every row control stays apart from the page-level controls.
- `LE/control-spot/target.ts`: `webTargetSpot` adds `place` and `state` for a stateful handle; `WebTargetSpot` type
  extended.
- `LE/control-spot/index.ts`: exports the five new functions.
- `LE/index.ts`: also exports `webControlPlace`, `webControlState` and `webControlStates`.
- `LE/permission.ts`: the `control` input accepts `place` and `state` and passes them to Core's declaration.
- `LE/node-run/run.ts`: not changed. It already spreads the whole spot (`control: { ...control, ...spot }`), and
  the new declared test shows both tokens reach Core.
- `LE/start-state/observe.ts`: the answer has `controls: webControlStates(captured)`, left out when empty. The
  answer type is extended.
- `domain/src/runtime/state-diff/places/diff.ts`:
  - When the spot has `place`, both pages exist and the document did not change, the diff adds
    `controls: { page, before, after }`.
  - `page` is `scope(resetResource\0evidence.location)`, the same token `observe.ts` writes as `scope`.
    `before` and `after` are the counts at that place, `{}` when there are none.
  - `snapshot.ts` (not mine) puts a handle in `handles` only for elements in a record or dialog, or with a subject.
    So a toggle with none of these got no spot. `spotOf` now falls back to finding a visible stateful control by
    its frame and selector key.

### Fixture verification

I checked this by reading the source and by running the extension's own `identity/record.ts` (`recordIdentity`,
`recordSubject`) on a stub-DOM copy of `pages/article.ts` markup. The copy covered two hosts:

- the grid's dialog: `div[role=dialog]` holding Close, Go back, Next and the article, over a profile grid;
- the post page: `main` holding the article and the "More posts" grid.

`grid-script.ts` pushes `/p/<code>/`, so both hosts share one location and the same tab resource. The scratch
script was bundled with esbuild into the scratchpad. It was not added to the repo.

| Case | Post's Like | Comment Likes |
| --- | --- | --- |
| two authors | no record, subject `kiln.theory`, dialog = page | record, subject = author |
| same author twice | same | record, **no subject** |
| post author comments | same | record, subject `kiln.theory` |
| one comment | same | **no record**, subject `ana` |
| liked or not | unchanged | unchanged |

What this means:

- **The post's Like is at one place in the dialog and on the page.** The `article` has no sibling of its tag, so
  it is no record in either host. The place's location, role and `R = ""` are equal, and the dialog token is not
  part of the place. Its state changes Like to Unlike while its place stays.
- **A comment's Like is at a different place** whenever its `li` is a record, which is the case with at least two
  comments or a "Load more" row. This holds even when the comment's author is the post's author (both subjects
  `kiln.theory`), or when no subject is known (the `"record\0"` marker).

## Commands run and observed results

All tests ran from `domain` as `DOMAIN_TEST_BUILD_LABEL=l1d2 node scripts/test-domain.mjs <paths>`.

| Check | Result |
| --- | --- |
| `src/runtime/llm-evidence/control-spot/tests` | `# pass 21 # fail 0` (final run). An earlier run had 2 failures in `collection.test.ts`, which is D1's file and was in flux. |
| `src/runtime/llm-evidence/start-state/tests` | `# pass 16 # fail 0` |
| `src/runtime/state-diff` | `# pass 18 # fail 0` |
| `src/runtime/llm-evidence/tests` | `# tests 212 # pass 212 # fail 0` |
| `src/runtime/llm-evidence/node-run/tests src/runtime/llm-evidence/plan-resolution/tests` | `# tests 414 # pass 414 # fail 0` |
| `npx tsc -p domain/tsconfig.json --noEmit` | exit 0 |
| `node scripts/structure-audit.mjs` | exit 1, one violation, not mine: `[contract-spread] control-spot/tests/collection.test.ts` lines 62 and 70 (D1's file). My one violation (a conditional spread in `controls.test.ts`) is fixed. |

New tests:

- `control-spot/tests/controls.test.ts`, 4 tests:
  - only visible stateful controls get a place, and there is none without a trusted resource;
  - a toggle's state changes while its place stays, including a checkbox;
  - the dialog and page versions share a place, while another URL or another tab does not;
  - each titled row has its own place, untitled rows share one, and none shares the page's place.
- `control-spot/tests/declared.test.ts`, +1 end-to-end test through the runtime: pressing and pressing back declare
  the same `place` with different `state`s, and `startState.controls` matches.
- `start-state/tests/start-state.test.ts`, +1 test: `controls` is in the answer, stays at the same place after a
  toggle, and is left out on a page with no stateful control.
- `state-diff/places/tests/places.test.ts`, +1 test:
  - the diff's `controls.page` equals the start-state scope;
  - `before` and `after` equal `webControlStates` at the place, and the share button sharing the place is counted;
  - there are no `controls` across a document change or for a control with no state.

## Not verified

- No browser check. The optional provider-free run on the photo-social site was not done. The fixture check used
  the stub DOM, not a real capture.
- The fixture's real comment data for the r2 post (how many comments it has) was not checked.
- Core's settlement over these tokens is C1's work and was not exercised.

## Open questions or contradictions found

1. **A lone comment shares the post's place.** With exactly one comment and no "Load more" row, the comment `li` is
   no record, so its Like is at the post's place.
   - The domain cannot tell it from the post without re-deriving the extension's record-shape rule.
   - Using the subject outside records is unsafe (point 3).
   - Counts and state still tell them apart: Core's toggle-back admission refuses a control at the place that is
     already in the before state.
2. **Native buttons need `implicitRole`.** A `<button>` is recognized only through the capture's `implicitRole`
   (or `role`). The extension sends one. Hand-built fixtures without it, like the start-state cart, have no
   stateful buttons.
3. **A row's place can move when its control's name changes.** This affects rows found only by
   `controlRowIdentity` (no record-shaped markup, a row marked out by alike controls).
   - The record there depends on an alike twin control with the same name. Pressing one row's "Save" so it reads
     "Saved" can drop its record, and that moves its place.
   - The toggle witness then fails closed (the act stays open), not open.
   - Subjects for controls in no record have the same name dependency (`soleAncestors` twin), which is why
     non-record controls use `R = ""`.
