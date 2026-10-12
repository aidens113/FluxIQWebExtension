# Run debug — run-muylu4pp-f9cb2121 (lane A baseline round 2, t342-slot-2)

Written as `run-pending-t342-slot-2-a-r2.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-07 ~21:13 UTC, off-peak).

## Header

Lane A baseline, round 2 of t342. Round 1 (`run-muyj5f0b-02fcd351`) was refused at $0 by the Lab's Core identity
gate (cause B1, fixed and merged in t344). Task `crossborder-marketplace-hub-to-cart` (scenario
`crossborder-marketplace`, judged by playback goal `hub-in-cart`). Instance `t342-slot-2`, slot 2 (claimed
19:54:21 UTC, kept), persistent workspace `t342-a` (holds no Flow: round 1 never reached project setup). Tree
`fxwork/t342/!FluxIQWebExtension` at d0f0b7ea (contains dev 706d2dfb; local `dev` ac50dd85 is two documentation
commits ahead, allowed), Core `fxwork/t342/!FluxIQ` at 93c059b0 (= Core dev). Both trees clean. Authoring mode
`legacy`. No `STOP-balance`, no override files. Core libraries, domain, extension and test-runner rebuilt or
restored to current inputs at 21:11 UTC (`pnpm build` exit 0).

## Expectations (written before launch)

Instruction, verbatim (219 characters, sha256 `2e6f5e7d...a405`, same as round 4):

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the
> 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything.

Acts the reader must give: `a1` put with choices `a1.quantity` three, `a1.colour` Space Grey, `a1.version` 7-in-1,
`a1.origin` Spain; `a2` collect.

Command (the campaign's; `--max-attempts 1`, so no second paid attempt):

```text
FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 --authoring-mode legacy -- --target persistent-isolated --workspace t342-a
```

Dry-runs (21:11-21:12 UTC): the campaign printed the same one spawned command as round 1 (`--authoring-mode legacy
--llm-max-calls 48 --target persistent-isolated --workspace t342-a`); that command with `--dry-run` exited 0:
`status ready`, `providerCallCount 0`, created-flow, chat entry, persistent-isolated, deepseek-flash
(`coreDefaultModel` deepseek-flash), `coreAuthoringMode` legacy, maxCalls 48, $0.10 (= total), permittedConsequences
[], key `DEEPSEEK_API_KEY` from `.env.local`, instruction 219 characters sha256 `2e6f5e7d...a405`, `coreWeb` key
`7baf48d254a78aa0866a74bf` not cached (the run builds the panel first). Prelude rebuilt domain host and extension.

Actions a correct Flow takes, in order:

1. Navigate to the Farbazaar start page.
2. Dismiss the welcome popup and the consent layer (optional steps).
3. Search for the Voltbay USB-C hub and open the Voltbay Official Store item.
4. Space Grey is preselected: no press in the Flow (a press un-chooses it), or only one that leaves it chosen from a
   fresh page.
5. 7-in-1 (claims `a1.version`) and Spain (claims `a1.origin`), each performed in the build test.
6. Collect the store coupon (`a2`).
7. Quantity 3 (`a1.quantity`), a real performed setting (typed or set, not a check).
8. Add to cart (`a1`), once, after the choices; never Buy now, never checkout.

Exact oracle facts (playback goal `hub-in-cart` plus final state `NOTHING_BOUGHT`):

| Fact | Subject | Expected |
| --- | --- | --- |
| cart-line | mini-cart-line text | Voltbay hub line: Voltbay Official Store, Space Grey, 7-in-1, ships from Spain, × 3 |
| store-coupons | coupon flyout text | Voltbay Official Store coupon collected |
| cart-count | mini-cart-count | `Cart (3)` |
| orders-shipped | orders summary | `Orders to be shipped (0)` |

Wrong plausible answers: China origin; coupon but empty cart; wrong store, colour, version or quantity; Buy now
pressed; an unfinished draft called a saved Flow; a candidate draft (t330 behaviour) where legacy should apply.

New on this source since round 4, each to be checked in the debug:

- R5-1 legacy authoring (t338): chat create-here builds, judges, applies and says the automation is ready on a pass.
  **Must be seen:** `coreAuthoringMode: legacy` in `snapshots/live-llm.json`; never "Saved a candidate draft".
- R5-2 acceptance fence (t296): the build is accepted only on a confirmed second affirmative judge verdict;
  unsupported held-repair shapes are refused before applying.
- R5-3 running identities (t297, t302, t305, t310): `snapshots/running-{core,host,server-adapter,build}-identity.json`
  verified before the chat send.
- R5-4 current extension background (R4-1 fix): the Lab forgot the cached worker; Next-page-era background code runs.
- R5-5 typed browser fixes (t301, t303, t306, t315, t319, t321): the quantity typing is observed live and settles;
  navigation outcomes are recognised; no typing-liveness failure.
- R5-6 Stop control (t298) shown in the chat during the build (UI).
- R5-7 command binding (t311, t327): no result settles a command from the wrong session; no such error in
  `logs/core.log`.
- R5-8 requests OFF (t324): no direct-request step.
- R5-9 round-4 fixes in the baseline (Core `e9b7d691`): input rewrites refused (`settings_rewrite_run`), checked
  reruns keep their control (C2b), no row words without records, settled endings stay settled.
- Open from round 4, to watch: C1b (a choice claim on a step that acts on another object stands).
- R6-1 t344: the staged panel runs Core's stamped `dist` (no `src` paths); `running-core-identity.json` verified
  before the chat send. **Must be seen:** all four `running-*-identity.json` written before the first provider call.
- R6-2 t347: the Flow's playback starts on the Flow's own tab (no stray exploration tabs used for playback).
- R6-3 t345: only the ten realistic scenarios are admitted (this one is one of them).
- R6-4 candidate-mode work merged since round 1 (t340, t346) must not change legacy: no "candidate", "draft" or
  "trial" wording in the chat; the build applies and says the automation is ready on a pass.

Cost: under $0.10 per build; at most 48 build calls.

UI checkpoints (round-4 set):

- U1 start: the instruction as a user turn in the new project's chat; composer at the bottom; no previous thread.
- U2 mid-build: one assistant message per step with its reason; action cards with icon, target and outcome; edit
  cards say what changed; repeated refusals folded; a Stop control.
- U3 overlay: shown from the send; visible whenever FluxIQ works; text matching the panel; never "Couldn't fix your
  Flow" on a creation build.
- U4 words: no step numbers, "the judge", page-view syntax (`quantity field ="1"`), "made a value ... vary", rerun
  lines without a control name; no quote cut inside a word; no "no rows would be stored" on a cart task.
- U5 ending: whole and plain; a pass says the Flow is saved and ready; a failure never overstates.
- U6 playback: run status, each step's card, Add to cart done, result shown.

Replays (only on a pass): one `lab replay` on `t342-a` with the build's project and Flow ids (from
`snapshots/creation-context.json`), no provider key in the environment: zero provider calls, zero interventions, zero
harness activations, unchanged Flow hash, goal held. Then a second independent live creation run on the same pair.
If the first run fails: debug and stop, no further paid run.

## Result (written by the t342 lane lead from the run folder, 2026-10-07 ~21:45 UTC)

**Failed honestly**, `runtime.behavior` (`lab.chat_build_failed`). No Flow was saved and the oracle was not measured,
because there was nothing to play back.

- Launched 21:13:20 UTC (guard `admitted`, fingerprint `sha256:70b3bd4a...`). Chat send 21:15:11. The build ended at
  21:19:00 with `flow_bootstrap.build_not_finished` and `llm_evidence_loop.repeat_refused`.
- 38 provider calls, $0.056718 in total: chat $0.000172 (1 call), exploration $0.042911 (28 decisions), judges
  $0.001649 (2), repair $0.011986 (7).
- The build spent $0.056546 of its $0.10 ceiling and 37 of its 48 calls. Ledger `finish` recorded. No Lab process was
  left running (checked).

Phases:

1. Exploration, 0002-0080, ending in "complete" at 0080.
2. Build test, 0081-0091.
3. Judges, 0092-0093: both no.
4. Repair round 1, 0094-0141. It ended after its 7th decision, on three same-kind refusals in a row.
5. Repair test, 0142-0152, including a robot check the Lab's person completed at 0145.
6. No judges after that: no more acts had steps than before, so the build stopped.

Checks from Expectations:

- R5-1 legacy: seen. `snapshots/live-llm.json` says legacy, the ending is legacy's unfinished-build text, and there is
  no candidate wording.
- R5-2 and R5-9, judges: both refuted correctly (0092, 0093: no Add to cart, quantity 2, Space Grey un-chosen). With no
  yes, nothing was applied.
- Judge versus oracle: all four oracle facts would fail on the test's end view. There is no hub line, the `1 Cart`
  comes from exploration only, Space Grey is off and the quantity is 2. The judges agree with that. Their advice for
  Space Grey ("select it rather than toggling it off", "ensure it is applied"), however, steered the repair towards
  pressing it again.
- R5-3 and R6-1, identities: seen. All four `running-*-identity.json` files were verified at 21:15:02-07, before the
  first provider call at 21:15:11.9. The Core digest `6563fb6a...` equals the expected one; host, server adapter and
  both extension parts match.
- R5-4 background, R5-7 binding, R5-8 requests: no stale-background symptom, no command-binding error in
  `logs/core.log`, and only `core.run_node` tools.
- R5-5 typing: not exercised as typing. The quantity "typing" was a click with a `text` parameter (C4).
- R5-6 Stop: "Stop build" shows from moment 3 as plain text and is absent during "Starting…" (UI review D9).
- R6-2 own tab: not exercised (no playback). R6-3: admitted. R6-4: no candidate wording. C1b (round 4): not seen.

### Causes

**C1: an `act` on a rerun is dropped without a word, and rerunning a step that is not in the Flow leaves it out. This
decided the run.**

- 0073 sent `{"step":15,"change":"rerun","input":{"target":{"handle":"t1008"}},"act":"a1"}`, that is, run Add to cart
  again and name it a1. 0074 answered `applied` (`draft_rerun`, keptStepCount 10).
- The press worked (0075 "Added to cart!"). But the draft at 0076 shows step 15 as `disposition: taken`, with no act.
- In Core, `runtime/llm/evidence-loop/rerun-request.ts:108-170` builds the rerun from `step` and `input` only. It never
  reads or refuses `act`. `flow-draft/amendment/apply.ts:113-116` hands reruns to the loop before any act handling.
- The model completed at 0080 believing Add to cart was in the Flow.
- Fix: refuse a rerun that carries `act`, naming the way out (add the step with `{change: add, act}` once the rerun
  worked), or carry it out as a rerun followed by an add with the act judged. In both cases the rerun's answer must say
  when the step is still not in the Flow. Write the failing test first, beside `rerun-request.ts`.

**C2: a choice the page arrives with has no "already chosen" state, and a re-added toggle half stands.**

- Space Grey is `marked` on every fresh item page (0012), and every press un-chooses it (0020, 0039, 0052, 0058, 0066,
  0094, 0119, 0128, 0139).
- The acts checklist still lists `a1.colour` as `todo: no_step_added`, with no way to count a preset choice. The prompt
  says the opposite: "An option already marked ... is chosen: leave it".
- At 0070 Core took the step 19 press out ("it pressed back the control step 18 pressed ... The control was already
  chosen before step 18").
- At 0071 the model re-added it with `act a1.colour`. `cancels` exempts a re-added half from every later reversal
  (`flow-draft/reversal.ts:63`). The build test then un-chose the colour.
- Fixes:
  - Count a preset choice as done on the checklist: a new rule under `flow-bootstrap/instructed-acts/` (worker design
    in `reports/t342-r2-toggle-trace.md`).
  - Make `partnerOf` (`reversal.ts:86-95`) skip rerun receipts (`replacedBy`), so dropping step 9 takes step 19 out.
    The worker's scratch run against Core dist shows this; it is not a repository test.
  - Decide whether "the model has the last word" should hold for a half that un-chooses what the page arrived with.

**C3: a quantity choice is accepted on a press that sets the wrong number.**

- Step 13 (one "+", 1 to 2) was accepted as `a1.quantity` = three and shown done.
- `instructed-acts/claim-verdict.ts:50` judges only top-level act ids (`/^a[0-9]+$/`). `instructed-acts/quantity-fault.ts`
  accepts any stepper, field or select press without checking its value, as its own header says.
- Fix: compare the field's resulting value with the requested quantity (`quantity_value_differs`). The worker reports
  that the domain's page-change statements drop field value changes, so those must be stated first. The lead did not
  verify that part.

**C4: the repair round reached for edits the edit language does not have.**

- Four times the model sent `{"step":11,"change":"add","act":"a1"}`, meaning "insert an Add to cart step". Step 11 was
  the round's opening snapshot.
- Each was refused `not_a_kept_step` with the right advice (run it as a new call with add true). The model never took
  it, although a run call was offered.
- It also reran the "+" step onto the quantity field with `text: "3"` (0131, 0140). A rerun keeps the node, so it stayed
  a click and the `text` was ignored (0102, 0110 and 0139 succeeded; the quantity stayed 1). This is round 4's C2b
  shape.
- Fix: refuse a rerun input key the node does not take ("a click takes no text: to type, run the type node on the field
  as a new call with add true"). Owner not traced: either the rerun input merge (`llm/evidence-loop/rerun-input.ts`) or
  the click node's parameter validation.

**C5: as a consequence, the repeat guard ended the repair round.** The identical Space Grey rerun was refused
`changes_nothing` in three decisions in a row (0130, 0132, 0141), which closed the round. The repair test showed no new
act done, so the build stopped without judges. This worked as designed; the trap is C2.

### Other findings

- **F1: the build's instruction is the chat model's paraphrase.** At 0001 the interpreter passed `flow.createHere` "add
  three ... to my cart ... while on the item page". Round 4's interpreter passed the user's words verbatim. Core
  `conversations/commands/create-here.ts:49` saves the interpreter's `instruction` argument. Proposal: save the
  person's own message when create-here starts from their turn. It was not a cause here (the acts read the same).
- **F2: completion with an undone act is accepted by design.** `llm/harness-options/bootstrap-completion.ts` leaves
  acts to "the test's and the judge's, never this check's". Had it refused with "a1 has no step in the Flow; step 15 ran
  Add to cart but is not in it", the model could have added step 15 during exploration. This is a design question, not
  a defect.
- **UI** (worker review; the lead checked two pictures): `reports/t342-r2-ui-review.md`.
  - Pass: U1 and U3.
  - Fixed since round 4: "Couldn't fix your Flow" on a creation build, and the missing "Starting…".
  - Still open: rerun lines without a control name.
  - New: a repair heading with a step number and "judged" (09); edit cards with step numbers or contradicting
    themselves (07, 10, 11); click cards without targets; "Get…" cut short in the overlay; replayed steps repeated as
    full cards (09-13); identical refusals not folded (05); "Stop build" as plain text and absent during "Starting…";
    an ending that never says why it stopped; overlay height jumps.

Not run: the replay and the second creation run (no pass). No relaunch.

