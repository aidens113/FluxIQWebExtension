# t285 fixtures-fulfilment: worker report

## Outcome

Done. All 17 named tests pass again. No instruction text, assertion or source file changed.

## What changed and why

Both files are under Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests/`. Each new choice is claimed through the step's own `acts` (`["a2.fulfilment"]` and the like) on a press with `words: { target: "Pickup" }`. No fulfilment is named on an add press, and no act id (a1/a2/a3) is named on a Pickup press. Because the claims sit on the steps, the result-claim lists, and so every exact `missing` list, are unchanged.

### check.test.ts

- **`RUN_28_DRAFT` (6 tests: "refuses run 28's Flow ...", "refuses the add press named ...", "refuses the arrival ...", "accepts a Flow that chooses each size ...", "accepts choices named in words ...", "lets the add step answer a choice ...").** I added a `pickup(position, choice)` helper in the fixture's own press shape and two presses: `pickup(11, "a2.fulfilment")`, before the towels' add d12 on p/1, and `pickup(13, "a3.fulfilment")`, before the napkins' add d15. Both are free positions. The run 28 positions s1–s15 in the comment are unchanged, and a comment above the draft says why the Pickup presses are there. Every `missing` list stays as written.
- **"accepts Place order, declared move_money, ...".** There is no free integer between the size step (d2) and Place order (d3), so I added `step(3, { words: { target: "Pickup" }, acts: ["a1.fulfilment"] })` and `step(4, { words: { target: "2pm–3pm" }, acts: ["a1.time"] })` and moved Place order to d5. The result claim `a1` now names `d5`, and `a1.size` stays on `d2`. The assertion is `.ok === true` and names no position. A comment explains the two steps.

### object-binding.test.ts

- **New fixtures.** A `pickup(position, page, choice)` helper built with the file's own `web()` recorder: a "Pickup" control, `words.target` "Pickup", `acts: [choice]`, and `replay.from` set to the product's own page. I made two from it: `towelsPickup = pickup(24, TOWELS_PAGE, "a2.fulfilment")` and `napkinsPickup = pickup(23, NAPKINS_PAGE, "a3.fulfilment")`. Each binds to its product through the page it was on, which is source 2 in `object-binding.ts`. 24 and 23 are the free positions before each add: 26–29 and 32–36 are taken back to back, and 31 is used by `towelsAdd(31)` in "refuses presses of the add that are not the count". A comment above the helper says why the steps are there and why they have those numbers.
- **`RUN_40` ("refuses run 40's completion ...").** Both pickups added, so the exact list stays `[a2.quantity quantity_is_a_repeat 28, a3 step_acts_on_another_object 26 a2, a3.size no_step_named]`.
- **"accepts the napkins claimed on the napkins' own Add to cart ..." and "refuses a size claimed on the other product's swatch ...".** Both pickups added to each draft, with a comment. The second still refuses only `a3.size` `step_acts_on_another_object` `a2`.
- **"accepts as before a step whose record names no object at all".** In the recorded draft I added both pickups. The unrecorded draft gains `plain(8)` and `plain(9)`, claimed `a2.fulfilment` and `a3.fulfilment` in the result claims. That draft has no free position before its adds (d3, d4), and its existing choices (d5–d7) already come after them, so the two new choices follow the same pattern. Its subject is steps that carry no record, not choice order. A comment says so.
- **`SIZED` (6 "a quantity is set, not repeated" tests).** Both pickups added, with a comment. Every `reasons(...)` list is unchanged.

## Commands run and observed results

All `npx vitest` commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t285/!FluxIQ/packages/fluxiq`.

1. Baseline, before any edit: `npx vitest run .../tests/check.test.ts .../tests/object-binding.test.ts` printed `Tests 17 failed | 69 passed (86)`. The 17 failures are the ones the brief names, for example `expected [ [ 'a2.fulfilment', …(1) ], …(1) ] to deeply equal []`.
2. After the edit, run 1 of the two files: `Tests 86 passed (86)`.
3. Run 2 of the two files: `Test Files 2 passed (2)`, `Tests 86 passed (86)`.
4. `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests`: `Test Files 9 passed (9)`, `Tests 312 passed (312)`.
5. At the Core root, `node scripts/build-cache/cli.mjs fluxiq:check`: `exit=0`. The last line was `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; ...","ms":59475,"source":"command"}`.
6. `git status --short` on the tests directory: of the files changed there, I edited only `check.test.ts` and `object-binding.test.ts`. `checklist.test.ts`, `choice-order.test.ts`, `instruction-acts.test.ts`, `instruction-choices.test.ts` and the untracked `act-evidence.test.ts` were already changed before I started, and I did not touch them. `git diff --stat` for my two files: 36 insertions, 10 deletions.

## Not verified

- I did not assert that the verdicts leave `choicesAfterAct` empty in the changed fixtures. Every added choice step is positioned before its act's step (11<12, 13<15, 3,4<5, 24<29, 23<36), except the unrecorded draft noted above, which already had choices after its acts.
- No Lab, browser or provider run, as the brief requires.

## Open questions or contradictions found

- In object-binding.test.ts, positions 24 and 23 come before the towels' search (25–27) in draft order, while their `replay.from` is each product's page. No integer position is free between each product page's arrival and its add without renumbering steps the assertions name (26, 28, 29, 35, 36, 30/31). The checks bind by place and order by position, so both rules hold. The draft is still not literally chronological. If that matters, the fixture positions would need renumbering, which would change the step numbers in the assertions' expected values.
- check.test.ts Place order: the order step moved from d3 to d5, and its claim moved with it. No assertion names that position.
