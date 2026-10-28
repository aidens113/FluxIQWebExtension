# Debug: run-mvrj7qg9-b6dc94f6

- Instance: rr6-slot-2 (rerun round 6), lane tree `fxwork/t719`, task `job-board-save-quillmark-remote`, built from
  the real extension chat. Frozen source: downstream `55fe5c0e`, Core `4ae8444f` (dev with t751, t752, t757/t764,
  t762/t765 and t766). $0.25 purse.
- Verdict: **failed**, no Flow, 229 steps, $0.1336 (sum of `costUsd` over `steps/*/meta.json`), chat 03:12:57 to
  03:22:56 UTC.
- Read-only diagnosis. Evidence: `steps/` (decisions, calls, results), `summary.json`, `logs/core.log` (clean, ends
  `build end status=draft`, exit 1 = verdict), the UI review (`rr6-slot-2/run-mvrj7qg9-b6dc94f6.ui-review.local/`,
  32 moments), the fixture's save handler (`board/client-script.ts` `toggleSave`), and Core source at `4ae8444f`.
- **Furthest so far on this task: both subflows built and judged yes, and the Flow was assembled.** Round 5 never
  passed the save subflow's trial without sealing the build. Here the save trial saved exactly Quillmark's three remote
  UK rows (0179), the read trial returned exactly the oracle's five rows (0207), and the build stopped only at the reset
  before the whole-run test.

## How far it got

| Phase | Steps | What happened |
| --- | --- | --- |
| Plan | 0002 to 0008 | One look (`find_on_page` "saved jobs", 0 matches). The first plan was refused for a missing `lastingActs` (0006). Plan 2: `save_remote_jobs` (p1, `create_new`, outputs `savedJobs`) and then `read_saved_jobs` (p2, records `title, company, location`). It carried the warning "neither makes a lasting act nor hands anything on" on the read subflow (harmless). |
| Brief-1 (save) | 0011 to 0119 | It dismissed the consent, searched "Quillmark", read the 7-row list (0017) and described the wordless heart icons (0029 to 0039). **0041: the press on the detail pane's heart was refused `candidate.reset_witness_required`** (correct). It read My jobs, which issued `destination-1` (2 items) plus `retryRefused` (0043). **0045 resent the press "the same as before", with the stale handle, and got `target_unobserved`.** Then it drifted: navigation back and forth between My jobs and the results, and repeated reads, with `same_result`/`changed_nothing` repeat refusals at 0061, 0063, 0085, 0087 and 0091. 0098 tried to end blocked and was refused `subflow.ending_too_soon`. **0107 submitted a save loop whose press was never explored. 0109: `core.test_subflow` was refused `candidate.trial_step_unwitnessed` (step 5 "save the job"), unrun, with nothing sealed.** That is round 5's F1, now working. **0111: the witness press that refusal asks for was refused `llm_evidence_loop.not_offered` ("the build is in its last decisions").** 0113 (after an allowance top-up) sent it with the stale `t321` and got `target_unobserved`. Three navigations were refused as repeats (0115 to 0119), and the builder was stopped (`partial`, $0.0666, 54 calls). |
| Brief-2 (save, resent) | 0122 to 0183 | Same opening. 0158: the submission was refused, output `savedJobs` unbound. 0160: revision 1. **0162: `trial_step_unwitnessed` again. 0163: the builder made the witness press on the row's heart, naming `destination-1` (act-8).** 0166: refused, `resetDestination` is not a step parameter. **0168: revision 3 accepted, and Core attached the witness itself (`changedPaths: …resetWitness`).** 0170: the trial was refused `candidate.trial_reset_required` (act-8 in place, 0171 refuse). 0173: a look naming act-8. **0175: Unsave on My jobs (undo landed; the row stayed on the page, see cause 1).** 0177: a second unsave was refused `candidate.undo_already_done`, and its answer **listed act-8 under `actsUnsettleable` `gate_unsatisfiable` / `no_admissible_undo`**. The model tested anyway (0178). **Core's pre-trial look reloaded My jobs and admitted (0180, 11.7 s).** The trial read 7 rows and kept 3. Pass 1's `page_reported_failure` was absorbed and retried, and 3 saves landed (act-9 to act-11). It was **judged yes twice** (0181, 0182: "every stored row is one the request asks for and no qualifying row is missing"). Completed at 0183 ($0.0340, 31 calls). |
| Brief-3 (read) | 0186 to 0211 | It read My jobs (5 rows), then submitted a read with `recordOutput.columns` (0192). 0194: `trial_reset_required` for acts 9 to 11 (0195 refuse). 0197: target covered by the assistant layer. 0199: it closed the layer (act-12, possibly lasting). **0201, 0203, 0205: Unsave under `undoes` act-9, act-10, act-11, each admitted.** The rows stayed on the page and each answer carried a false `outsideBrief` note (cause 4). **0207: trial yes, 0208 admit.** Entry preparation re-ran `save_remote_jobs` on the reset site, leaving act-13 to act-15, and the read kept 5 rows: Senior Rust Engineer, Product Designer, Customer Success Manager, Senior Rust Engineer (Contract), Frontend Engineer. These are the oracle's five. **Judged yes twice** (0209, 0210). Completed ($0.0166, 13 calls). |
| Assembly | 0212 to 0213 | `project.assemble` gave revision 1 from brief-2 rev 3 + brief-3 rev 1, `main` calls them in order. |
| Whole-run test | 0214 to 0216 | **`core.test_candidate` was refused `project.trial_reset_required`** (acts 13 to 15 in place; 0216 refuse in 10 ms, no look). Correct: three saves really were on the site. **No whole run ever started.** |
| Reset brief-4 | 0217 to 0228 | `phaseStart` named acts 13 to 15 to undo (0219). It read My jobs, 5 rows (0221), and recalled (0223). **0225: Unsave act-13, landed.** As before, the row stayed on the page with only the heart repainted. **0226 sent act-14's Unsave with `consequences: []`. 0227: refused `candidate.undo_unproved`, `failed: undeclared_press`, `canMeet: this_page`, and the same answer listed act-13, act-14 and act-15 under `actsUnsettleable`, `gate_unsatisfiable` / `no_admissible_undo`.** 0228 completed with `cannotUndo: [act-13, act-14, act-15]`. The brief returned `blocked`, `terminalReason: gate_unsatisfiable`, "3 acts … can no longer be checked or put back" (0218, $0.0060, 5 calls). |
| End | 0229 | The supervisor ended `blocked`: "three of the jobs the automation saved during its trial run could not be found again afterwards". Core kept the candidate as a draft. |

**The build stopped going forward at 0227/0228.** One reset builder was told that two acts it had not yet tried could
never be undone, and it believed it. Core had admitted and settled the same undo three times for acts 9 to 11
(0201 to 0208).

### Every judge verdict

| Step | Trial | Verdict | Reason (judge's words, shortened) |
| --- | --- | --- | --- |
| 0181 | brief-2 save, rev 3 | yes (0.9) | "saved each of the three matching rows. The excluded rows (Quillmark Labs, Hybrid London, other companies) are correctly left out … the end view shows 'Job saved'" |
| 0182 | same, second ask | yes (0.9) | "keeping exactly the three qualifying jobs … Every stored row is one the request asks for and no qualifying row is missing" |
| 0209 | brief-3 read, rev 1 | yes (0.95) | "kept all 5 saved jobs with title, company and location. The end view's '5 saved jobs' and its five entries match the stored rows exactly" |
| 0210 | same, second ask | yes (0.9) | "read the list with no narrowing condition, keeping all 5 saved jobs … the table is what the request asked for" |

There was no whole-run judge. The candidate was never run.

## Why the ending says "judged unknown"

**No whole-run test ran, so nothing was judged unknown.** The words are the Lab's.

- `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts` `chatDraftVerdict` matches Core's draft sentence
  against `automationStudioConversationCandidateDraftSaid` for each verdict, and only for the untold form.
- Since t753, a build whose ending row already said how it ended gets `TOLD_DRAFT`: "I kept what I wrote as a draft,
  and nothing was put into the Flow. You can ask me to build it again." (Core
  `conversations/commands/build.ts`). That matches no template, so the Lab falls back to `unknown`.
- The truthful verdict is `not_tested`. That is Core's own word for this case ("It was never test-run from the
  start").

None of the brief's candidate mechanisms produced the ending:

- **t766 (act-grounded negatives):** never reached. All four judgements were yes, and there was no whole-run judge.
- **t757/t764 (requested-output gate):** never reached. It acts on a finished whole run. Brief-3's
  `recordOutput.columns` was accepted at 0192 and its read returned the requested columns.
- **t751 (reset admission/settlement)** did act, three times:
  - It refused the whole run while three trial saves were in place (0215). That was correct.
  - Its R2 reload look before a trial (`reset-settlement/judge.ts` `lookFirst`: "a site may draw the removal only on
    its next load, so a read in place can be stale") admitted brief-2 and brief-3 after their undos (0180, 0208).
    That was correct.
  - Through the ledger's `unmet` and the reach rule `site-reset/undo-reach.ts`, it listed every act `no_admissible_undo`
    from a read taken in place (0177 and 0227). That was wrong, and it was decisive.

## Reset refusals, one by one

| Step | What the build tried | What Core answered | Right? |
| --- | --- | --- | --- |
| 0041 | Press the heart (`modify_existing`), no ref | `reset_witness_required` (`no_witness`, `another_page`) | Yes. Nothing could witness it yet. |
| 0109, 0162 | `test_subflow` with an unexplored lasting step | `trial_step_unwitnessed`, unrun, nothing sealed | Yes. This is round 5's F1, and it now holds the trial door. |
| 0111 | The witness press 0109 asked for | `llm_evidence_loop.not_offered` (wrap-up) | **No.** The refusal's only route was an exploration press, and the wrap-up withheld it. |
| 0170 | `test_subflow` with act-8 (the witness press) in place | `trial_reset_required`, act-8 to undo on `destination-1` | Yes. |
| 0177 | A second undo of act-8 after the first landed | `undo_already_done` | Yes, but the same answer listed **act-8 `no_admissible_undo`. That was false**: Core's own reload settled it at 0180. |
| 0194 | `test_subflow` with acts 9 to 11 in place | `trial_reset_required` | Yes. |
| 0197 | Unsave under a layer | `target_covered` | Yes. |
| 0215 | `test_candidate` with acts 13 to 15 in place | `project.trial_reset_required`: send a reset brief | Yes. |
| 0227 | Unsave act-14 declaring `consequences: []` | `undo_unproved` (`undeclared_press`, `canMeet: this_page`) | The refusal is right, because an item-bound press that declares nothing proves no inverse. **The `actsUnsettleable` beside it was false** for act-14 and act-15, which had never been tried, and for act-13, which had just been undone. |

## Root cause

**A product defect (Core), decisive. Not task, oracle, fixture or environment.** The task is achievable and
unambiguous. The trials saved exactly m1, d12 and g5 and read exactly the oracle's five rows.

### 1. Decisive: the undo reach declares an act unsettleable from a list read in place after an undo landed

- **The site.** The fixture's Unsave on My jobs (`toggleSave`) commits the change on the server, repaints the hearts
  and shows "Removed from saved jobs". It leaves the row in the list until the next load. The qualification workflow
  itself reloads after unsaving (`qualification/workflow.ts`, `closed-refresh-list`), and plenty of real sites do the
  same. The failure screenshot shows the result: the unsaved row is still listed, with an empty heart
  (`32-failure-scenario.png`).
- **The reach rule.** `site-reset/undo-reach.ts` `noUndoReaches` reads the act's differing lists, as the ledger last
  saw them. After 0225, that was the page the Unsave answered with: 5 rows. Measured against the original 2, that
  leaves 3 "new" subjects to remove.
  - The acts that may still remove are those that are `claimable && !spent`. act-13 was spent by its landed undo, so
    only act-14 and act-15 qualify.
  - `everyRemoved` cannot match 3 removals to 2 acts, so each act is `no_admissible_undo`.
  - `ledger.ts` `unmet` turns that into `gate_unsatisfiable` and moves the acts out of `actsToUndo` into
    `actsUnsettleable`. The reset words say a reset builder may end over those acts.
  - The subject act-13 had already removed was still counted as a removal for the others. The read that showed it was
    one Core's own pre-trial look treats as possibly stale (t751 R2, `judge.ts` `lookFirst`, which reloads "once per
    landed undo").
- **The same false verdict, twice.**
  - **0177 (act-8):** harmless. The builder tested at once, and Core's reload settled it.
  - **0227 (acts 13 to 15):** decisive. It came beside a refusal whose own `canMeet` was `this_page`. The reset builder
    believed the list, wrote `cannotUndo` (0228), and the brief returned `gate_unsatisfiable`. The supervisor then had
    nothing left to do but end. Two presses ("Unsave job", declared `modify_existing`, under `undoes`) would have
    settled the site, exactly as 0201 to 0208 did.
- Inferred, not read: the ledger's act records are not in `steps/`. The matching explanation fits the code and both
  occurrences, but which act fields made `unruled` false for every claimable act (including the possibly lasting
  acts 1 to 7 and 12) was not traced.

### 2. Contributing: a reset builder's undeclared undo (model mistake the words did not stop)

0226 declared `consequences: []` on an Unsave under `undoes`, when 0224 had declared `modify_existing` for the same
kind of press. The refusal was right. But its `condition`/`canMeet` ("another call on this page can meet it") and its
`actsUnsettleable` ("no call this build may make can put back") contradicted each other, and the model followed the
second.

### 3. Contributing to cost only: brief-1 ($0.067, half the build) failed for round 4/5 reasons, plus one new contradiction

- **The stale-handle resend after `retryRefused` "the same as before"** (0043 to 0045) recurred unchanged. Round 5's
  F3 was not done. A stale handle came again at 0113.
- **The navigation ping-pong and repeat refusals** recurred (0061 to 0119). The last three (0115 to 0119) refused the
  one navigation the builder needed to get fresh handles for the witness press.
- **New: F1's refusal and the wrap-up contradict each other.** `trial_step_unwitnessed` (0109, `project-reset.ts`
  `WORDS.stepWitnessRequired`) says "press that control once while exploring with core.run_node". A candidate loop's
  wrap-up (`llm/loop-budget.ts` `automationStudioLlmEvidenceLoopWrapUp`) withholds every `core.run_node` except an
  undo under `undoes` (t741). So 0111 was refused `not_offered`. Brief-2 shows the route works when it is offered
  (0163 → 0168 → 0179).

### 4. Words: an undo in a build brief is told it is "outside this brief"

0201, 0203 and 0205 (Unsaves under `undoes` in the read brief) each carried `outsideBrief`: "It ran, and it stays on
the site as this build's act until a reset undoes it. Write no step of your subflow that does it, and do not do it
again." That is false. `service/project-build/brief-ports.ts` `told` exempts `undoes` calls only for
`role: "reset"`. A build brief's undo, which a trial refusal demands, gets the outside-brief note. Here the model
ignored it. A model that obeyed it would stop resetting halfway.

### Rounds 1 to 5: what recurred

| Earlier cause | In round 6 |
| --- | --- |
| R5 decisive: an unexplored lasting trial step lands with no witness, seals the baselines, and every later trial is refused (also R2 through the exploration door) | **Fixed.** `trial_step_unwitnessed` refused it unrun twice (0109, 0162). Brief-2 followed the route, Core attached the witness (0168), and nothing was sealed. |
| R5 F2: entry preparation re-runs lasting acts on an un-reset site | **Not recurred.** Brief-3's entry preparation ran only after its site check admitted (0208). |
| R5 F3: `retryRefused` "the same as before" → stale handle | **Recurred** (0045). It also came again at 0113. |
| R4/R5: navigation ping-pong ended by `same_result` repeats | **Recurred** (0061 to 0119), in brief-1 only. |
| R4: a press the page answers with its own failure counted as landed | **Still fixed.** Absorbed and retried (0179 step 8). |
| R5 UI: class token as a control's name, the ending stutter, the false "no read ever showed a change" | Mostly fixed (see UI). Entry preparation shown as "Testing your Flow" **recurred**. |
| R4/R5: false or contradictory reset verdicts reaching the model (`undo_unproved` hiding its reason, t743) | **Recurred in a new shape:** `no_admissible_undo` from a stale in-place read (cause 1). |

## UI review (32 moments, side panel + scenario tab)

The chat is a clean turn stream throughout:

- every step has a bold heading, a reason and a tool card;
- the reset brief appears as its own "Reset the site" card with its allowance (`31-mid-build-panel.png`);
- there is a status line above the composer, and the Stop button and composer are always present.

The overlay was present at every build moment except two navigation instants (22, 28). Its phases were "Building your
Flow", "Testing your Flow · Step N of M", "Putting the site back", and finally "Build failed | Build ended: no Flow was
built" (`32-failure-scenario.png`). Round 5's "Build failed | Build failed: … could not finish" stutter is gone. The
class token as a control's name is gone from the chat: it now says "Reading the details of a control"
(`05-mid-build-panel.png`).

Defects:

1. **The ending tells the person something false** (`32-failure-panel.png`). It opens with the supervisor's reason:
   "three of the jobs the automation saved during its trial run could not be found again afterwards". All three are
   in plain sight on My jobs. They could not be undone, and only because Core said so (cause 1). Core's paragraph says
   "The build ran the step 'save the job', but could not undo it, so it may still be on the site". It never names the
   three jobs, which the person would need to unsave by hand. Source: the reset return's reason ("can no longer be
   checked or put back", 0218), which inherits cause 1's verdict, and the supervisor model's paraphrase.
2. **Entry preparation is shown as testing**, as in round 5. During the read subflow's test the overlay says
   "Testing your Flow · Step 4 of 4 · Running step 4 of 4: Save the job (row 1)" (moments 28 and 29). That is the
   save subflow being re-run to set up the read.
3. **An absorbed retry is shown as a failure.** The overlay says "A step didn't work in the test", and the chat shows a
   red "Click · save the job · Didn't work" card, for the fixture's first-save failure that the retry absorbed at once
   (`29-mid-build-panel.png`, `29-mid-build-scenario.png`).
4. Minor:
   - The overlay shows a class token from the model's own `find_on_page` query: `Looking for "css-0732x7m" on the
     page` (moment 18).
   - "The AI model sent a version of this part's steps, but it was refused" is internal wording (moment 14).
   - The heading "Checking whether the Flow is finished — I am ending honestly with that reason." reads oddly.
   - The ending's "It also clicked 'Send'" is honest. 0019 pressed the assistant's Send while meaning to close the
     alert popup.

## Recommended fix

Everything below is generic: it names no site, task, saving, hearts or job boards.

**R1 (Core, decisive): no `no_admissible_undo` from a list read in place after an undo landed on it.** One rule,
held by the observations both judges read:

- A list read in place, without a load, after the latest landed undo on that list's location is **stale for
  settlement and reach**. Mark it in `reset-settlement/observations.ts`, beside the R2 reload bookkeeping that
  `judge.ts` `lookFirst` keeps privately (`reloaded`). Then `lookFirst`, `evaluate` and `undo-reach.ts` read one fact
  instead of two copies.
- In `site-reset/undo-reach.ts` `noUndoReaches`:
  - a differing group whose latest read is stale in this sense is not judged (return `false`, as for an unnamed
    group);
  - and in `differences`/`everyRemoved`, a subject a spent act's landed undo removed is assigned to that act, not left
    for the others to remove.
- While stale, the act stays in `actsToUndo` with the settle words "the page may show the removal only after it loads
  again: open that list's page again" (`judge.ts` `settle`).
- Optionally, Core makes that load itself before answering any refusal that would list an act unsettleable (the
  `lookFirst` look), so a verdict of "no call can" is never given on an in-place read.
- Files:
  - `flow-bootstrap/reset-settlement/observations.ts`;
  - `reset-settlement/judge.ts` (`lookFirst`, `settle`);
  - `site-reset/undo-reach.ts`;
  - `site-reset/ledger.ts` (`unmet` callers);
  - `site-reset/words.ts`.

**R2 (Core): one answer never says both "this page can" and "no call can".** In the undo refusal assembly, the
`undo_unproved`/`undo_already_done` answer must not list as `actsUnsettleable` an act its own `canMeet` leaves
meetable, or one with no undo tried yet. A closed check where `reset-answers/` builds the answer should keep the
two from disagreeing.

**R3 (Core): the wrap-up runs the witness press an unwitnessed-step refusal names.** In `llm/loop-budget.ts`
`withholds`, beside the t741 `undoes` exemption, let a `core.run_node` naming `resetDestination` on a control of a step
the latest `trial_step_unwitnessed` listed run. Otherwise that refusal's words in the wrap-up must say to end blocked
naming the step. Files: `loop-budget.ts`, `site-reset/project-reset.ts` (`stepWitnessRequired`).

**R4 (Core words):**

- `service/project-build/brief-ports.ts` `told`: a call under `undoes` is never "outside the brief", in any role.
- `site-reset/words.ts` `retryRefused` (round 5 F3, still open): "go back to that page, look again, and press the
  same control by its handle in the newest view, naming that list's ref". Never "the same as before".
- The reset return's reason and the ending name each unsettled act's item (its row's words), so the person can check
  it.
- Entry preparation gets its own status, not "Testing your Flow" (round 5 F4, still open).
- An absorbed retry is told as "retried", not "didn't work".

**R5 (downstream Lab):** `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts` `chatDraftVerdict` should
recognise the told draft (t753). It should read the verdict from the build's trial sessions (`readCandidateTrials`),
where none means `not_tested`, rather than report `unknown`.

**Tests that fail first:**

- **R1.** Core `site-reset/tests/undo-reach.test.ts`. Use a generic library: three "reserve" acts witnessed on a
  "My reservations" list read complete before them. One undo lands, and the in-place read still shows all three
  reserved rows. Today all three are `no_admissible_undo`. After R1, none is unsettleable. A load read showing the
  undone row gone settles that act `restored`, and the other two stay in `actsToUndo`.
- **R2.** Core `reset-answers` test: an `undo_unproved` with `canMeet: this_page` never lists its own act under
  `actsUnsettleable`.
- **R3.** Core `llm/tests/loop-budget.test.ts`: in the wrap-up, a `run_node` with `resetDestination` on a step a
  `trial_step_unwitnessed` named is not withheld. Any other `run_node` still is.
- **R4.** Core `service/project-build/tests/brief-ports.test.ts`: a build brief's call under `undoes` gets no
  `outsideBrief`.
- **R5.** Downstream `flow-lane/creation/tests/candidate-outcome.test.ts`: the told draft sentence with no trial
  sessions yields `not_tested`.

Not proposed: any change to the fixture. Its unsave that redraws on the next load is a realistic trait, and the
qualification workflow already reloads after it. Nor any change to the task, the oracle, or guidance naming any part of
this site.

## Not verified

- The exact ledger state behind both `no_admissible_undo` verdicts. The ledger's act records (`spot`, `spent`,
  `press`) are not in `steps/`. The 3-removals-to-2-acts explanation fits `undo-reach.ts` and both occurrences
  (0177: 1 removal, 0 unspent acts; 0227: 3 removals, 2 unspent). Why no claimable act, including the possibly lasting
  ones, had an `unruled` path was not traced.
- That brief-3's Unsaves (0201 to 0205) committed on the server. This is inferred from 0208's admit after Core's reload,
  and from the entry re-save then reading 5 rows rather than toggling them off.
- That two more declared Unsaves at 0227 would have let the whole run start, and that the whole run would have passed.
  Both subflows passed separately, and the assembled Flow is their concatenation. But the whole run, its judge and
  t757/t764's output gate were never exercised.
- Why 0112's identical `run_node` ran when 0110's was withheld. This is inferred from the allowance top-up (brief-1's
  return says it was topped up once) lifting the wrap-up. It was not traced.
- Why 0201 to 0205 carried no `resetSettlement` line, unlike 0173. Not traced.
- The UI points come only from screenshots and overlay samples. Nothing was exercised interactively.
