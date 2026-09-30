# Audit A2: the draft Flow and its execution (Full Debug Protocol stages 3 and 4)

Worker A2, 2026-09-30. This audit is read-only: it edited no code and ran no Lab.

Path prefixes:
- `R/` = Core `C:/Users/osrs_/FluxStuff/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`
- `D/` = downstream `domain/src/`
- `E/` = downstream `apps/extension/src/`

"dev" means downstream `9d3461a3` and Core `9d343d3b`. Every dev line below was read with `git show dev:<path>`.

## Evidence base

- **Debug files.** 54 `debugs/run-*.md`, taken as the union across the main checkout and the t174, t193, t194, t195, t196 and t200 trees. Where a lane had its own copy, that copy was used; five t195 copies were newer. 50 of the runs are from 2026-09-29/30. The four `muj*` runs and the three dated 09-24/25 files predate most of the current code, and they are cited only where they agree.
- **Lane reports.** `t174-live-lane`, `t193-live-self-repair`, `t194-live-judge-answer` and `t195-live-control-flow`. None of them has a "Top causes for the audit" section yet.
- **Worker reports.**
  - `t193-wJ-armed-target-resolution` covers 20 t193 runs, 13 of which have no debug file.
  - `t196-wR-unreproducible`.
  - The `t200-model-sees-whole-page` target design.
- **Runs with no debug file.** For these the lane Runs tables were used: t174 runs 23, 26, 31 and 32, and t195 runs 11 and 13-16.
- **Branch status.** Checked with `git diff dev...<branch>` and `git cat-file -e <branch>:<path>`. Each lane tree's uncommitted work was checked with `git status`.

"Killed" means that without this cause the run would have gone further: to a Flow, past the failing node, or to a goal it could meet. "Co" means the cause was present, but another cause alone would have killed the run.

## Ranked causes

| # | Cause | Runs killed (primary / co) | Earliest stage | Example runs | Root on dev | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A click whose reply is lost because its own navigation unloaded the page is reported `action_failed`. The domain then refuses it (`effectApplied: false`, no `replay`), so the switch, submit or continue it performed never enters the Flow, while the steps after it do. | 13 / 2 | 2 (draft); shows at 4 | t193: munymcpf, munzl2eh, muo00owc, muo06beo, muo18781, munzutb0, muo0wf2q, muo2690x, muo12lnk, muo2gyob (t193-wJ); `run-munutuvf-6a1c548a` (s9 "message channel closed"); co: `run-munovwp3-d898de74` (d23), `run-muncqlr0-3348202b` | `E/runtime/click-landing.ts:113-117` (catch → `throw error`); then `D/runtime/llm-evidence/node-run/run.ts:362-375`, `:531-546`; `R/flow-draft/step.ts:186` | **open** on dev and on every branch |
| 2 | The completion check accepts a Flow that does not do the instructed acts with their parameters. A claim is honoured when it names any kept, mutating, non-optional step. Nothing ties the claimed step to the act's object (which store, which product) or to its choices (size, quantity). | 13 accepted Flows that could not meet the goal | 3 | `run-munmmj5n-52d8a67d`, `run-munoeac4-33c17306`, `run-munnop9n-5475d593`, `run-munvvc3z-3eadc185`, `run-munv9eqy-1827b928`, `run-munwmt25-5e9f0f8c`, `run-munwdydi-cd5fe4b9`, `run-munutuvf-6a1c548a`, `run-munore4o-c84cfa29`, `run-munpwa5r-e7aefe04`, `run-muntmwvx-0d53884a`, `run-munu4b4y-4e15662e`, `run-munoa86g-150fb0d9` | `R/flow-bootstrap/instructed-acts/check.ts:117-131` (claim checks), `:210-225` (`assign`); `instruction-acts.ts:139-144` (object qualifiers kept as quote text only) | partly fixed on dev (F5 `step_only_arrives`, F6 `step_is_optional` / `act_needs_repeat`); quantity and size **fixed on branch `task/t174-live-lane`** (P1 B, Core); object binding **open** |
| 3 | A press that "succeeds" without doing anything. Bigbox swallows the first press after each load. The click reports success because it landed, the dry run answers `replayed` whatever the step did, and playback accepts it. | 4 playbacks + 7 builds | 2; shows at 4 | playback: `run-munvvc3z-3eadc185` (s12, s15), `run-munv9eqy-1827b928` (s13, s16), `run-munwmt25-5e9f0f8c` (s10), `run-munwdydi-cd5fe4b9` (s9); build: `run-munoa86g-150fb0d9`, `run-munovwp3-d898de74`, t195 r11/r13/r14/r15 (`munuxns5`, `munvmg0n`, `munvz5x0`, `munwmfrs`), `run-muntufao-7b7bc04a` | `E/content/actions/click.ts` (success = landed); `D/runtime/llm-evidence/node-run/replay.ts:234-247` | model hint F17 on dev (`run.ts:105`, `:418`); runtime re-press F20 **fixed on branch `task/t195-live-control-flow`**; effect check in the test **open** |
| 4 | Replay dies under a covering layer. Before t195 F1 the defence would not answer a consent wall. The interference probes miss the viewport corners (support chat card). On `target_absent` a covering wall is never cleared. | 7 playbacks | 4 | consent: `run-munoa86g-150fb0d9`, `run-munore4o-c84cfa29`, `run-munpwa5r-e7aefe04`; corner: `run-muntmwvx-0d53884a`; wall on target_absent: `run-munu4b4y-4e15662e`, `munvhy0t`, `munwk8ta` (runs 26 and 31 are "same as run 22"); build: `run-muoga8at-123533a4` | `E/content/action-runtime/interference/overlays.ts:50` (`PROBE_FRACTIONS`), `:78-85`; `E/content/action-runtime/recovery/fault.ts:159-177` | consent **fixed on dev** (F1); corners and target_absent **fixed on branch `task/t195-live-control-flow`** (R1+R2, unit only) |
| 5 | The Flow is tested against the build's own site state. The reset only navigates, so consent answered, the store chosen and cards dismissed all stay remembered. Steps whose targets are therefore gone read `unreproducible`, and the model is told to make them optional or drop them. It drops them, or withdraws them in an amendment. The test then passes a Flow that a fresh visitor cannot run. | 6 / 14 | 3 | `run-munoa86g-150fb0d9` (consent d3 dropped at 15), `run-munpwa5r-e7aefe04` (d3 dropped at 40), `run-munore4o-c84cfa29` (dropped at 41), `run-munutuvf-6a1c548a` and `run-munwdydi-cd5fe4b9` (store picks amended out, t193 I1), `run-munwmt25-5e9f0f8c` (towel step absent); co: the 13 of cause 1, `run-muntmwvx-0d53884a` | `D/runtime/llm-evidence/node-run/replay.ts:68`, `:114-135` (reset = navigate); `R/flow-draft/dry-run.ts:155-183` (verdict), `:203-214` (advice: "drop it only if…") | **open**. t196's in-flight change keeps this basis: its `dry-run.ts` header says "The reset is a navigation: it never clears site data" |
| 6 | Loops and branches authored wrong. (a) A `repeat` span stops before the dialog's confirm. (b) A `rerun` moves the listing after the act and leaves `over` dangling. (c) Single-row copies of the act, and the final read, are left after the loop. (d) The listing has no `where`, so every row is acted on. (e) The model never wrote `repeat`. | 7 | 3 | (a) `run-munnyvbr-11c28a0f`; (b) `run-muog33va-96469cb2`; (c)(d) `run-munq51ik-a7ebd077`, `run-munnyvbr-11c28a0f`; (e) `run-munnop9n-5475d593`, `run-munsxchc-15523952`, `run-muntu7in-e3dd1972` | (a) `R/flow-draft/amendment.ts:224` (`through` defaults to the step), `:113` schema text; (b) `R/llm/evidence-loop/rerun-replacement.ts:18-24`, called at `R/llm/evidence-loop.ts:700`; (c)(d) nothing checks them | (e) **fixed on dev** (F2, F15 `repeat-suggestion.ts`, F16); (a)-(d) **open** |
| 7 | An optional step's authored `failed` route is withdrawn by the step's own retries. Two `retry_node` retries spend `maxRecoveryAttemptsPerSubflow` (2), so the third miss stops the run instead of taking `failed -> merge`. | 3 (+1 co) | 4 | `run-munq5s8x-6d620cdf`, `run-munv53gt-a0e6f545`, `run-munw7ffn-fe1cecd2` (all re-runs); co `run-munu4b4y-4e15662e` | `R/executor/recovery-budget.ts:5-12` (`previousRecovery` counts ladder retries) | **fixed on branch `task/t194-live-judge-answer`** (Core, with the attempt-id fix `priorAttemptCount`) |
| 8 | The draft was never tested from the start on each completion attempt; the dry run replayed it from the start mid-build. This spent build time, hit the deadline, repeated real acts (a cart line moved, the cart count rose) and kept refusing on the same steps. | 0 alone / 14 co | 2-3 | `run-muntu7in-e3dd1972` (401 of 537 s, deadline), `run-muntc23v-7fcc4110` (10 `reset_failed`), `run-muntufao-7b7bc04a` (moved a kept cart line), `run-muogweml-0190212c` (restart mid-build), `run-munsxchc-15523952`, `run-munq51ik-a7ebd077`, `run-muntcsge-36c2663a` | `R/llm/evidence-loop/completion-attempt.ts` (dev runs the dry run on every attempt); `R/llm/node-tools/dry-run-gate.ts` | **in flight on `task/t196-state-digest-cost`, uncommitted** (tests only after the check accepts; no replay on resume) |
| 9 | The Flow went to an address the model composed, and the site routes by id, so it reached the wrong product. | 1 / 2 (+3 suspected) | 2 | `run-munvvc3z-3eadc185` (s9, s14 open P2 for P1); co `run-munoa86g-150fb0d9`, `run-munovwp3-d898de74`; suspected: navigations in `munwdydi`, `munv9eqy`, `munutuvf` | `D/runtime/llm-evidence/node-run/run.ts:345-351` (same origin, "run as written") | **fixed on branch `task/t174-live-lane`** (P1 A `node-run/shown-addresses.ts`; live in runs 34 and 35: 7 addresses refused) |
| 10 | A read replays short and still counts as success: a positional `paginate.next` stops on page 1 or visits pages out of order, each page's lazy tail is never read, and the dry run calls a one-page read `replayed`. | 3 | 4 | `run-munv53gt-a0e6f545`, `run-munw7ffn-fe1cecd2`, `run-munnhi5q-4867dabe` | `E/content/extraction/detect-pagination.ts:95` (`selectorFor`), `E/content/extraction/list-reader.ts:478-487`; `D/.../node-run/replay.ts:234-241` | the 429 read and condition counts are **fixed on dev** (t194 round 1: F5, F6); w12 and F13 **fixed on branch `task/t194-live-judge-answer`** (uncommitted in its tree); replay `changed` **open** |

**Structural note.** Causes 1, 2, 3 and 5 hide one another, which is why so many Flows were accepted that could not work. The test runs on the build's state (5). It never presses a lasting step for real under t196 (see Conflicts), and it counts any landed press as done (3). The completion check cannot see which object a step acted on (2). A step lost to a navigation never reaches the draft (1). Fixing any one of them alone will not produce a working bigbox or company-website Flow.

## Root cause and fix for each open cause

Fixes are partitioned by file. "Serial after" names the branch that must merge to dev first, because it edits the same files (see Conflicts).

### Cause 1: a click that navigated its own page is reported failed and dropped (open; 13 runs)

**Mechanism.**
- Bigbox's "Set as my store" awaits `mutate('set-store')` and then calls `location.reload()` (t193-wJ, scenario `client/shell-script.ts:105-108`). A search submit and "Continue without an account" navigate the same way.
- The content script answers `executeAction` asynchronously, so the unload closes the channel. `E/runtime/action-runner.ts:375` lists that as `NAVIGATING_PAGE_ERRORS`.
- For a click, `sendClickCheckingLanding` catches the rejection and judges the landing (`E/runtime/click-landing.ts:113-117`). When the landing is neither a robot check nor a 4xx, it **rethrows the original error** (`:117`), so the click reads `web.action.rejected.action_failed`. t193-wJ confirms this in all 8 store-switch runs from screenshots: "the failed click did land".
- The domain then takes any non-`succeeded` result as a refusal (`D/runtime/llm-evidence/node-run/run.ts:362-375`). The refusal is recorded with `effectApplied: false` and `replay: undefined` (`run.ts:531`, `:546`).
- Core admits only `effectApplied !== false` into the Flow (`R/flow-draft/step.ts:186`).
- The step that did the act is therefore gone. The model's next step (the chip, now under the new store's name) is kept. At playback, from the reset state, that step's recorded name contradicts the page.

**Fix (the extension, where the answer is lost).**
- `E/runtime/click-landing.ts`: in the `catch` at `:115-117`, when `metNavigatingPage(error)` holds and `watch.landing()` returned a commit, return a `succeeded` result built with `workerActionResult`. This applies only when the landing's verdict is not `failed`, and when it is `check_cleared` it is wrapped as `clickAfterClearedCheck` already does. Its `actual` says the click navigated its page before it could answer. Keep `throw error` when no navigation committed. `metNavigatingPage` is in `action-runner.ts`; move it to a shared helper in `E/runtime/` or export it, and keep it in one place.
- `E/runtime/tests/click-landing.test.ts`, three new cases:
  - (a) the send rejects with "message channel closed", the top frame commits at 200 and there is no check: `succeeded`;
  - (b) the same rejection with no navigation started within `NAVIGATION_START_GRACE_MS`: it rethrows;
  - (c) the same rejection with a 403 landing: `navigation_unexpected` (the existing path).
- `D/runtime/llm-evidence/node-run/tests/reload-click.test.ts`: one case where the gateway's click answers `succeeded` with the "navigated before answering" note and the look after meets the reload. The step is applied, `replay` is set, and `pageChanged: true`. `captureAfterAction` (`run.ts:394`) already waits out the new document.
- Instrumentation: the build trace should print the failure code of an `action_failed` call. t193-wJ could not confirm the code because `resultReason` is blank. File: `R/llm/evidence-loop/progress-trace.ts`, which t174 F12 and t195 F13 already touch; add the field there.

**Part 1b: consent answered inside a refused step** (`run-munu4b4y-4e15662e` d4). The in-page defence cleared the consent layer during a call that then failed `target_not_found`. The step is refused, so the answer is not in the Flow. At playback this is covered by cause 4's R2, which on `target_absent` clears a covering layer before re-resolving. No domain change is proposed.

**Serial after:** t200. `t200-w1` owns `E/**` outside the chat UI, and t197 last edited `click-landing.ts` on dev (`0faee6e6`).

### Cause 2: the completion check accepts a Flow whose steps do not do the acts (partly open; 13 runs)

On dev (`R/flow-bootstrap/instructed-acts/check.ts:117-131`) a claim passes when its step exists, is kept, is a mutation that applied, does not only arrive at the start location, is not optional, repeats when the act is plural, and is not claimed twice. `assign` (`:210-225`) matches a claim to an act by id, distinctive word, verb or kind, using the claim's own words. Nothing reads the step itself. That lets through:
- a chooser-opening chip click for "switch my store to Millbrook" (`munore4o`, `munwdydi`, and `munutuvf` via I1);
- napkins steps for the towels act (`munwmt25`);
- an opener-named button for "send" (`munu4b4y`);
- header cart and napkins steps for "order" (`munoa86g`);
- first-size, quantity-one presses for "two packs … in the 12 Double Rolls size" (`munvvc3z`, `munv9eqy`, `muntmwvx`).

**2a, merge P1 B from `task/t174-live-lane`.** It adds quantity and variant choices as requirements (`instruction-choices.ts`, `choice-evidence.ts`; `check.ts` reason `choice_is_the_act_step`), validated at unit level. It covers `munvvc3z`, `munv9eqy` and the missing quantity in `muntmwvx`.

**2b, bind each claim to the act's object (new).** Add a reason `step_not_about_object`, checked after `step_is_optional` in the `check.ts:125-131` chain.
- The act's object words are its distinctive words among the other acts (`distinctiveWords`, `check.ts:234`), plus, for a `set` act, the words after "to" in its quote (`instruction-acts.ts`).
- The claimed step, or a kept mutating step before it and after the previous claimed step, must carry at least one of those words in its own string values: `ranWith` and `input`, read exactly as `choice-evidence.ts` reads them (the element's accessible name or visible text, `context.record` values, typed text, a navigated URL path).
- For bigbox, Millbrook's "Set as my store" carries "Millbrook" in `context.record` (t193 F, live-confirmed in runs 20 and 28). The chip opener carries "Carden Falls" and fails, which is the right answer. The towels act claimed by a napkins step fails.
- Files: `R/flow-bootstrap/instructed-acts/{check.ts, contracts.ts (the reason), object-evidence.ts (new, beside choice-evidence.ts), index.ts}`.
- Tests: `instructed-acts/tests/check.test.ts`, one case per example run above. Build the draft steps from the Stage 3 tables in `run-munwdydi-cd5fe4b9` and `run-munwmt25-5e9f0f8c`.

**2c, refuse the drop of a claimed act's only step.** t193 I1: the model amended the failing store steps out, and the next completion passed on another step. 2b catches this, so no separate change is needed. Record it as covered by 2b.

**2d, a plural act with a stated condition.** For example "everyone with five or more", or "a month or more ago" (`munnop9n`, `munnyvbr`, `munq51ik`).
- `instruction-acts.ts` marks such an act `conditional: true` when a `plural` act's clause holds a condition ("with", "who", "that", "older than", "or more", "only").
- `check.ts` then refuses `act_needs_condition` unless the repeat's `over` step's own input carries a `where` (a string-value scan for the key `where`, which is domain-neutral in the same way).
- Tests go in `instructed-acts/tests/{instruction-acts,check}.test.ts`.

**Serial after:** t174 (2a lands first, on the same `check.ts`). This is Core outside `t200-w3`'s paths.

### Cause 3: a press that succeeded without doing anything (partly open; 11 runs)

- **3a, merge F20 from `task/t195-live-control-flow`.** It adds `E/content/action-runtime/ignored-press/**`, `E/content/actions/click.ts` and `execute-action.ts`. A press with no request, no mutation in its own section, no navigation and no focus move within 800 ms is pressed once more. This fixes the bigbox wake-up at playback, where F17's model hint cannot reach, and it applies inside the test's replays too.
- **3b, fail a press ignored twice (new).**
  - When F20's second press is also ignored, `E/content/actions/click.ts` fails with a new code, `web.action.no_effect`. Add it to the closed set in `D/runtime/failure/codes.ts` as `action_failed`, `effect: "unacted"`, not retryable.
  - The domain maps it to a refusal (`D/runtime/llm-evidence/action-failure/refusal.ts`), and the build model is told the press did nothing.
  - The playback executor fails the node instead of passing it, so a redesign or wrong page is detected, not absorbed. In `munwmt25` the armed variant was absorbed and repair never ran.
  - Tests: `E/content/actions/tests/click.test.ts` (both presses ignored → `no_effect`; the first ignored and the second answered → succeeded, as F20); `D/runtime/failure/tests/codes.test.ts`.
- **3c, the test's replay judges a press by its effect.** `D/runtime/llm-evidence/node-run/replay.ts:243-247` answers `replayed` for any step that ran. Answer `changed` ("the press did nothing") when the result carries 3b's `no_effect`. Test: `node-run/tests/replay-*.test.ts`.

**Serial after:** t195 (3a), then t200 (`t200-w1`/`w2` own `E/**` and `D/runtime/**`).

### Cause 4: replay dies under a covering layer (branch fix; 7 runs)

- Consent is **fixed on dev**: t195 F1 declines optional cookies in `interference/vocabulary.ts` and `way-out.ts`.
- Corners and a wall over an absent target: **merge R1+R2 from `task/t195-live-control-flow`**.
  - `E/content/action-runtime/interference/{probe-points.ts, presence.ts, pressable-way-out.ts}` (new), with `overlays.ts` and `clear.ts`.
  - `E/content/action-runtime/recovery/{attempt.ts, fault.ts}`.
  - Tests: `interference/tests/probe-points.test.ts` and `recovery/tests/attempt.test.ts`.
- Live proof is still owed. The Flow's own consent step passed the wall in runs 20 and 28, so F1 itself has not been exercised live.

### Cause 5: the Flow is tested on the build's site state (open; 6 primary, 14 co)

User decision D1 forbids clearing site data, so the fix cannot be a fresh-visitor reset. The Flow has to carry "sometimes there" steps as branches, which is the user's own rule.

- **5a.** In `R/flow-draft/dry-run.ts` (the verdict at `:155-183` on dev; t196 is rewriting it), an `unreproducible` outcome of a step that declared **no** consequence is added to the verdict's `conditional` set. Examples are a consent answer, a card close, or "Continue shopping". The step's routing is set to `optional` by Core, not by the model: apply `{step, change: "optional"}` through `applyAutomationStudioFlowDraftAmendments`, the same call `rerun-replacement.ts:24` uses. The feedback line says `madeOptional: true`, and the step no longer blocks.
  - A step that declared a consequence is t196's `verify-only` case: `present` passes, and the step is kept unconditional.
- **5b.** Remove "drop it only if the Flow does not need it at all" from `DRY_RUN_INSTRUCTION` (`dry-run.ts:212-213` on dev; the t196 copy says "is marked optional … or is dropped"). A step that does not replay should be kept and made optional, never dropped.
- **5c.** `R/flow-draft/amendment.ts`: `drop` or `exploratory` of a kept step whose run changed the page (`effectApplied: true` and `pageChanged: true` on its statement) is refused with a new reason, `later_step_ran_after_it`, when the next executed step is kept. The feedback names that step and suggests `optional`. This covers the card close d15 in `muntmwvx`, consent d3 and d4 in `munoa86g`, `munpwa5r` and `munore4o`, and the product link and size choice in `munpwa5r`. The model can still drop both steps together. Feedback text goes in `R/llm/draft-amendment-feedback.ts`.
- **Tests:**
  - `R/flow-draft/tests/dry-run.test.ts`: an unreproducible step that declared nothing becomes conditional; one that declared a consequence still goes through verify.
  - `R/flow-draft/tests/amendment.test.ts`: `later_step_ran_after_it` for drop and exploratory; dropping both is allowed.
- **Serial after:** t196 and t200. Both edit `R/flow-draft/**`: t196 changes `dry-run.ts`, `entry.ts` and `routing.ts`, and `t200-w3` owns `R/flow-draft/**`.

### Cause 6: loops and branches (a-d open; 7 runs)

- **6a, the span stops before the confirm.**
  - `R/flow-draft/amendment.ts:224` defaults `through` to the step. Change the default: when `through` is omitted, extend the span over the consecutive kept steps after `step` that ran right after it on the same page, meaning the same `replay.from.location` as the step's successor and no navigation or listing step between them.
  - Change the schema text at `:113` to: "a press and the confirmation it opens repeat together".
  - Test in `flow-draft/tests/routing.test.ts`: the munnyvbr shape (d13 listing, d15 Withdraw, d16 dialog Withdraw), where a `repeat` on d15 with no `through` spans d15-d16.
- **6b, a rerun loses its routing.**
  - `R/llm/evidence-loop/rerun-replacement.ts:18-24` appends the rerun at the end and drops the replaced step.
  - Instead, reorder the rerun into the replaced step's position, and rewrite every routing reference to the replaced id (`over`, `through`, `check`, `to`) to the rerun's id. Use a helper in `R/flow-draft/routing.ts`.
  - Test in `R/llm/evidence-loop/tests/`: the muog33va shape (`14:repeat(over=13)` then `13:rerun`); the loop still names the listing, and the listing stays before the act.
- **6c, leftover single-row acts.**
  - In `R/flow-bootstrap/authoring/draft-routing.ts`, or in completion, refuse `flow_draft.repeat_leftover` when a kept step after a loop has the same action id and the same element name as a step inside the loop body. The munq51ik shape is s9 and s11 Confirm after the loop body s6 Confirm.
  - Test: `authoring/tests/draft-routing.test.ts`.
- **6d, a plural act with a condition:** see 2d.
- **6e, done on dev:** F2 wording, F15 `R/llm/harness-options/repeat-suggestion.ts`, F16 `over_not_before`.

**Serial after:** t196 and t200 for `R/flow-draft/**`. `R/llm/evidence-loop/**` is also owned by `t200-w3`.

### Cause 7: an optional step's `failed` route withdrawn by retries (branch fix; 3 runs)

Merge from `task/t194-live-judge-answer` (Core):
- `R/executor/recovery-budget.ts` excludes `AUTOMATION_STUDIO_LADDER_RUNG_KINDS` from `recoveryAttemptsForSubflow`, with test `executor/tests/optional-failed-route.test.ts`;
- `R/executor/graph-run.ts` and `R/service/runtime-adaptation/repair-rerun.ts` add `priorAttemptCount`, so a re-run's attempt ids no longer collide.

The t194 tree also holds uncommitted `repair-rerun.ts` edits. Merge those only through t194's own commit.

### Cause 8: the dry run from the start on every completion (t196, in flight)

- In the t196 tree (uncommitted), `R/llm/evidence-loop/completion-attempt.ts` returns `refused` before `dryRun()` when the check refuses, and `R/llm/evidence-loop.ts` no longer replays on resume.
- `verify-only.ts` (untracked) verifies lasting steps rather than re-running them.
- Nothing more is proposed here, beyond cause 5's changes to the same files and the conflicts below.

### Cause 9: composed addresses (branch fix)

Merge P1 A from `task/t174-live-lane` (downstream): `D/runtime/llm-evidence/node-run/shown-addresses.ts` (new), with `run.ts`, `arrival.ts`, `tools.ts`, `tool-rejection.ts`, `sanitize.ts`, `capture.ts`, `stable-handles.ts` and `structure/detect.ts`. **Serial with t200:** `t200-w2` is rewriting `sanitize.ts`, `capture.ts` and `tools.ts` (uncommitted in `fxwork/t200`), so expect conflicts there.

### Cause 10: short reads replayed as success (mostly fixed; replay part open)

- Merge t194 w12 (`E/content/extraction/detect-pagination.ts` `nextControlOnPage`, `pagination.ts`) and F13 (`list-reader.ts` lazy-tail reveal, `list-wait.ts`). Both are uncommitted in `fxwork/t194`.
- Open: `D/runtime/llm-evidence/node-run/replay.ts:87-91` puts only `records` in `produced`.
  - Add `pagesRead` and `paginationStop` to it.
  - At `:234-241`, answer `changed` when a read that followed N pages now stops earlier, or stops `control_absent` on page 1.
  - Test: `node-run/tests/replay-*.test.ts`.

## Not causes

These were checked and ruled out.

- **`targetResolution: unresolved_no_candidates` on every playback step** (runs 16, 18, 20, 28). This is Core's diagnostic when it is given no candidates: `R/io-policy.ts:236-243` "left resolving the element to the output adapter". The extension then resolved each step itself, which is the "host resolution" figures. This is expected and is not a replay defect.
- **Add to cart resolved by `scored-candidate` at 0.566 or 0.643 with no cart change** (N6 in `munv9eqy`, `munwdydi`, `munwmt25`). t193-wJ reproduces the score. It is the moved buy-box button, correctly chosen, and Buy now scores -0.116. The cart did not change because the press was swallowed as a wake-up (cause 3), not because the wrong control was pressed.
- **Class names in recorded targets.** None of the 189 recorded element steps carry class names (t193-wJ). The redesign's class rename caused none of the 20 t193 failures.

## Conflicts with t196 and t200

1. **t196's test still runs on the build's state.** Its `R/flow-draft/dry-run.ts` header (uncommitted) says "The reset is a navigation: it never clears site data". Cause 5 therefore survives t196. Its instruction still offers "or is dropped" for a step that does not replay, which is the path that removed consent, card-close and store steps. Cause 5a-c must be applied on top of t196, and ideally by t196's owner.
2. **t196's `verify-only` never presses a step that declared a consequence.** An add to cart, a Confirm or a Withdraw is only checked as "actionable" or "effect present". The test therefore cannot catch:
   - a swallowed press (cause 3): the button is actionable, so it is `verified`;
   - a `repeat` span that breaks on pass 2 (cause 6a): pass 1's press never opens the dialog;
   - a press on the wrong product (cause 2).

   This is a deliberate trade-off (D1, no repeated lasting effects). It means causes 2, 3 and 6a must be caught by the completion check and the runtime, not by the test, which is why 2b, 3b and 6a are written that way.
3. **t196 and t200 both edit `R/flow-draft/**`.**
   - t196's tree has `entry.ts` (MM), `dry-run.ts`, `routing.ts`, `amendment.ts` and `index.ts` modified, and `verify-only.ts` new.
   - `t200-w3` owns all of `R/flow-draft/**` and `R/llm/evidence-loop/**`, to remove the 4,000-byte draft entry cap.
   - `entry.ts` will conflict. Merge one, then rebase the other; do not dispatch any fix in this report to those paths until both are on dev.
4. **t200 owns every downstream path the fixes here touch.** `t200-w1` owns `E/**` outside the chat UI, and `t200-w2` owns `D/runtime/**`. t200 is rewriting target-resolution text handling (`E/content/identity/{candidates,record,stable-name,context}.ts`: `boundedText` becomes `normalizedText`, and record text is no longer cut at 160). That changes how recorded targets match at replay. After t200 merges, re-run the replay-identity tests: `identity/tests/*`, `action-runtime/tests/store-chooser-replay.test.ts` and `D/runtime/llm-evidence/plan-resolution/tests/record-identity.test.ts`.
5. **`D/runtime/llm-evidence/node-run/run.ts` is edited by three lanes and t200.** t174 has an uncommitted `observed-control.ts` plus a `run.ts` edit. t194 has `rejected-rows` (+14 lines). t174 P1 A touches it, and `t200-w2` owns it. It is at 785 of 800 lines after F11. Cause 1's fix deliberately avoids `run.ts`, since `click-landing.ts` is the owner.

## Order for fix workers

Each item names its files, and none shares a file with an item that can run beside it.

1. **After t200 merges** (downstream `E/**`):
   - cause 1: `E/runtime/click-landing.ts`, `E/runtime/tests/click-landing.test.ts`, and `action-runner.ts` for the shared `metNavigatingPage`;
   - cause 1 test: `D/runtime/llm-evidence/node-run/tests/reload-click.test.ts`.
2. **After t195 merges:** cause 3b in `E/content/actions/click.ts` (+ test) and `D/runtime/failure/codes.ts` (+ test); cause 3c in `D/runtime/llm-evidence/node-run/replay.ts` (+ test). Cause 10's replay change goes in the same `replay.ts`, so give 3c and 10 to one worker.
3. **After t174 merges** (Core `instructed-acts/`): causes 2b and 2d in `R/flow-bootstrap/instructed-acts/{check.ts, contracts.ts, object-evidence.ts (new), instruction-acts.ts, index.ts}` + tests.
4. **After t196 and t200 merge** (Core `R/flow-draft/**` and `R/llm/**`):
   - one worker: cause 5 (`dry-run.ts`, `amendment.ts`, `R/llm/draft-amendment-feedback.ts`) and cause 6a (`amendment.ts`, `routing.ts` test);
   - a second worker: cause 6b (`R/llm/evidence-loop/rerun-replacement.ts`, plus a routing-rewrite helper that lives in `R/flow-draft/routing.ts`, so it runs serial with the first worker);
   - cause 6c: `R/flow-bootstrap/authoring/draft-routing.ts`, which can run in parallel.
5. **Merge only:** t195 R1+R2 and F20 (causes 3a and 4), t194's executor fixes (cause 7), t174 P1 A (cause 9), t194 w12 and F13 (cause 10).

## Outcome

Done. This file is the audit. The ranked causes are above, each with its dev file:line, its status, and file-partitioned fixes for the open ones.

## What changed and why

Only this file was created, together with its directory `audit-2026-09-30/`, which did not exist. No code was edited and no Lab was run.

## Commands run and observed results

- **Debug union.** Copied into scratch, lane copies winning. 57 files. Five t195 copies were newer than the main checkout's: `munq51ik`, `munsxchc`, `muntfume`, `muntu7in` and `munuj2os`.
- **Stages 3 and 4 plus Causes, extracted from every `run-mu[no]*` debug:** 251 KB, all read.
- **Merge state.** `git rev-list --count dev..<branch>` / `merge-base --is-ancestor`: t174, t193, t194 and t195 are not merged, in either repository. Core `task/t200-*` has no commits beyond dev; its work is uncommitted in `fxwork/t200`.
- **Files present on each branch** (`git cat-file -e`):
  - `probe-points.ts`, `pressable-way-out.ts` and `ignored-press/index.ts`: t195 only;
  - `shown-addresses.ts`: t174 only;
  - `repeat-suggestion.ts`: on dev;
  - `verify-only.ts`: not on dev (untracked in t196).
- **`git diff dev task/t194-live-judge-answer`:** the `recovery-budget.ts` ladder-rung exclusion and `priorAttemptCount` are present.
- **Dev lines quoted above,** read with `git show dev:`: `click-landing.ts:103-149`, `action-runner.ts:368-420`, `run.ts:340-440` and `:505-560`, `replay.ts` (whole, 354 lines), `dry-run.ts:155-216`, `check.ts:97-235`, `amendment.ts:59-233`, `rerun-replacement.ts`, `draft-routing.ts:100-135`, `continuation.ts:90-112`, and `io-policy.ts:215-260`.

## Not verified

- **Cause 1's exact error string.** For the bigbox store switch, `resultReason` is blank. The "message channel closed" text is observed only in `munutuvf` s9. The mechanism (`click-landing.ts:117` rethrow) is read from source and matches t193-wJ's screenshots, but it was not traced live.
- **The 8 t193 store-switch runs.** Their run ids come from t193-wJ in short form, and their bundles were not opened. Runs `munvhy0t` and `munwk8ta` rest on the lane table ("same as run 22") without debug files.
- **Cause 2b's word test** has not been run against the real draft steps' `ranWith` values. It is read from Stage 3 tables and t193's live-confirmed record words.
- **Cause 5a's auto-optional** assumes a consent or close click declares no consequence, which is the web binding's default for dismissals. That was not checked per run.
- **No fix here was implemented or tested.**

## Open questions or contradictions found

- **The Current State has t196 replacing lane A's `dry-run.ts` and `verify-only.ts`.** Core `4e42d7ef` on t174 removed w23's `verify-only.ts`, and t196's tree now holds an untracked `verify-only.ts` of its own. The supervisor should confirm that t196's copy is the one that stands.
- **t193-wJ's P1 targets `D/.../node-run/run.ts:357-375`.** This audit places the root one layer up, in `E/runtime/click-landing.ts:117`, where the reply is discarded. A fix in the domain alone would have to re-read the page for every failure. The extension fix keeps both the domain and Core unchanged.
- **The t193-wJ run table has no debug files** for 13 of its runs (the Full Debug Protocol requires one per run).
