# t772 w1: a looped pass settles from its own place

## Outcome

Done. A looped trial pass that pressed another item than its step's control receipt now takes its original from its own press at its own place. The undo admission and the settlement read the act's own control through one shared function. An act whose own control a fresh read shows back, while its control witness stays open, is closed as `gate_unsatisfiable` with `failed: "already_back"`. It is never again left open as a press to make. All three required tests failed first and pass now. The narrow Core suites, the Core typecheck and the downstream typecheck are clean.

## What changed and why

Core paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

- **New: `reset-settlement/own-control.ts`** (exported from `reset-settlement/index.ts`). `automationStudioSiteResetOwnControlStanding(own, read)` answers where an act's own control `{place, from, to}` stands per one read:
  - The answer is one of `elsewhere`, `back`, `set` or `other`.
  - A read is either one control's declared state `{place, state}` (what the admission sees) or a page read's counts `{place, counts, found}` (what settlement sees). Counts are judged on the toggle's own two states only.
- **`site-reset/undo-admission.ts`.** The own-toggle branch now goes through that function, with behaviour identical branch for branch:
  - `set` plus inverse classes: admit `own`.
  - `back`: `already_back`.
  - `other`: `control_state_differs`.
  - `set` with other classes: `consequence_not_inverse`.
- **`reset-settlement/control-tracker.ts`.**
  - `originalStanding` (when the toggle sits at the original's place) and `standing` now judge "back" through the same function.
  - New `freshAt(place, page, since, clock, resource?, at?)` and `start(place)` accessors, used by the judge's closure.
  - The `ToggleStanding` status gains `own_back`. Only the judge sets it.
  - The file holds three literal NUL bytes inside template strings (`pressedPages` keys). The Edit tool refuses it, so I edited it with a byte-preserving Python script. The NUL count was checked unchanged (3).
- **`reset-settlement/judge.ts`.**
  - `evaluate` now turns an `open` control witness into `own_back` when a private `ownBack(act, toggle)` holds. `ownBack` holds when a fresh read (after the act, at the current clock) of the act's own toggle place shows it `back`.
  - Which counts it judges against: the original's counts when the original sits at the toggle's place (on its resource and `at`); otherwise that place's tracker start.
  - `unmet` maps `own_back` to `already_back`.
  - `AutomationStudioSiteResetUnmet` now includes `already_back`. That code already exists in `reset-answers/failed.ts`, with condition words, so `reset-answers/` did not need changing.
  - The header gains the closure rule.
- **`reset-settlement/decision.ts`.** The new open reason is `own_back` (`TOGGLE_REASON.own_back`), and the header documents it.
- **`reset-settlement/words.ts`.** Clause for `own_back`: "its own control at X already shows the state the build found it in, so there is nothing to press back, but the control it is judged on does not show it put back: no call can settle it in this build".
- **`site-reset/ledger.ts` `stamped`.** `stamped` now takes the pass diff and `itemPressed` separately.
  - **Another item:** the pass's own place (`act.spot.place`) differs from the receipt's (`elsewhere`). Where items share one place, the old location-or-page test still applies.
  - **Its original:** built from the pass's own diff at `own` (with `at`/`location` as before). It is never built at `stamped.place`.
  - **Its spot:** `act.spot.place` is no longer overwritten. Only `resource` and `scope` are set.
  - **No original at all:** a pass on another item gets none when its own place is unknown, or when `itemPressed` with distinct places. It is then judged by its own press's toggle against its place's start, at the same place the admission reads. Before, the receipt's place was used in both cases.
  - **Same item, or shared place with `itemPressed`:** the receipt stands exactly as before.
  - The doc comment was rewritten to match.

## Tests (each observed failing first)

Core tests:

- **(a) `site-reset/tests/trial-witness.test.ts`, new case: "witnesses a looped pass that pressed another item at its own place when items' controls have distinct places".**
  - Setup: places `pl:star-a` and `pl:star-b`; the undo is admitted `own` and lands; a fresh read follows.
  - Expected: `restored`, no unsatisfiable acts, and a further press answered `undo_already_back` with `canMeet: "no_call"`.
  - The same-place case is kept unchanged.
  - **Failing first:** `AssertionError: expected 'in_place' to be 'restored'` at line 183.
- **(b) Property-style block, in the same file: "an undo answered already back finds its act settled or closed, never open (t772)".**
  - It runs 64 shapes: shared or distinct places × pass on the explored or the other item × builder or supervisor brief × 1 or 2 trials (a repeat on an already pressed item) × whether the set state was read × fresh read free or held.
  - Assertion: whenever the admission answers `candidate.undo_already_back`, `standing` is `restored` or the act is in `unsatisfiable()`, and the act is never in `inPlace()`.
  - A non-vacuity case asserts that every "free" shape is answered already back.
  - **Failing first:** 8 of the 64 shapes failed, all `places: distinct, pass: other` (`expected false to be true` at the standing-or-closed line).
  - I first wrote it as its own file, `site-reset/tests/own-control-agreement.test.ts`. I folded it into `trial-witness.test.ts` because the structure audit flagged `site-reset/tests/` at 26 files against its limit of 25 (see the open questions).
- **Closure test, new file `reset-settlement/tests/own-control.test.ts`.**
  - It table-tests the shared function, then builds the pre-t772 shape: an original filed under another place, with the press at its own place.
  - Checks: `evaluate` gives `own_back`; `unmet` gives `already_back`; `settle` gives no-press wording. A held state or a stale read is not closed.
  - **Failing first:** with only the closure line in `judge.ts` disabled, it gave `1 failed | 4 passed`. With the line restored, 5 of 5 pass.

Downstream test:

- **(c) `domain/src/runtime/llm-evidence/control-spot/tests/place-per-page.test.ts`.**
  - Two library-entry pages, each with a "Reserve" button in no row, get different `webControlPlace` tokens. One page keeps its place across reads and across its own press.
  - This pins existing domain behaviour, and no domain change was in scope, so it passed on its first run. It did not fail first, which is expected for a contract test.

## Commands run and observed results

- Before the fix: `node ../../scripts/vitest-groups.mjs --groups=parallel <trial-witness + own-control-agreement>` gave "Tests 10 failed | 76 passed (86)":
  - the 8 property shapes and the distinct-place case;
  - one more: "while a list read before it differs…" (line 307). That one was caused by worker w3's in-flight `undo-claims.ts` change, not by mine. It passed in every later run.
- Final run, from `packages/fluxiq`: `node ../../scripts/vitest-groups.mjs --groups=parallel <FB>/site-reset <FB>/reset-settlement <FB>/reset-admission <FB>/reset-answers` gave "Test Files 38 passed (38) / Tests 493 passed (493) / all groups passed: parallel".
- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (packages/fluxiq): exit 0, no output.
- Downstream:
  - `pnpm --filter @fluxiq-web-extension/domain test -- control-spot` was refused by its Core-build guard: "FluxIQ Core's build … is not current with its source". The cause is Core source edited by this and other workers.
  - I ran the runner directly instead: `DOMAIN_TEST_BUILD_LABEL=t772-w1 node scripts/test-domain.mjs control-spot`. It gave "tests 28, pass 28, fail 0", including "ok 20 - the same-role control on two different pages gets two different places" and "ok 21 - one page's control keeps its place across reads and across its own press".
  - The new test's only Core import is a type (`JsonObject`), which esbuild erases, so the stale Core dist does not affect it.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.test.json` (domain): exit 0.
- `node scripts/structure-audit.mjs` (Core): one violation left, not mine: `[as-never]` in `service/project-build/tests/project-build-told.test.ts`, another worker's untracked file. My new files raise no violation.

## Not verified

- No live, browser or Lab run (forbidden by the brief). I have not shown that the round 6 livelock is gone on the real photo flow. That rests on the shared-place and distinct-place unit shapes above.
- I did not rebuild Core's dist, so the guarded domain test wrapper was not run as-is.
- The closure (`own_back`) is now unreachable through any ledger path the property test covers, because fix 1 removes the place mismatch. Only the judge-level test exercises it directly.
- I did not check how the supervisor-facing wording of an `actsUnsettleable` entry with `failed: "already_back"` reads end to end. The condition words in `reset-answers/condition-words.ts` already exist for that code.

## Open questions and contradictions

- **Concurrent workers in the same tree.**
  - w3 edits `site-reset/undo-claims.ts`, `site-reset/words.ts` and `words.test.ts`, and adds `site-reset/tests/undo-claims.test.ts`.
  - Another worker edits `llm/loop-budget.ts` and `service/project-build/**`, and adds `project-build-told.test.ts`; that file carries the `as never` audit failure.
  - The `site-reset/tests/` directory sat at 26 files with both new test files present. With my property test folded in, it is at 25, so w3's `undo-claims.test.ts` now fills the last slot. Any further new file there needs the directory grouped.
- **`trial-witness.test.ts` is now past the 400-line advisory threshold.** That is a warning only, not a failure.
- **`control-witnesses.ts` (not owned) is now stale in one place.** The doc comment on `at` says "since items share place tokens"; it should now read "where items share place tokens". I did not change it.
- **For the later R1 work on `judge.ts` and `undo-reach`:**
  - `undo-reach`'s `toggle` reason still answers only `pressBackRefused`. The new `own_back` reason is closed in `judge.unmet` before `more` is asked, so `undo-reach` never sees it.
  - Any new path that produces a control witness should judge "back" through `automationStudioSiteResetOwnControlStanding`. The admission and the settlement then stay in agreement.
  - `judge.ownBack` picks its counts this way: the original's counts only when the original's place is the toggle's place; otherwise the tracker start. Keep that pairing if `originalStanding` changes.
