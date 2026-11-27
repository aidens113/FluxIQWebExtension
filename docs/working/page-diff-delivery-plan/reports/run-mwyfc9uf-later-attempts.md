# Later attempts that did not just run the saved Flow: run-mwyfc9uf-215bbd84 (bigbox), with run-mwyfoz8o-507c92f6 (job-board)

Diagnosis only. No code was changed, and no live, paid or git command was run.

**Sources:**
- step files under `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/<run>/steps/`;
- the attempt bundles;
- the Lab log `bigbox2.log`;
- the code at fluxiq 0.54.32: the shared Core `fxwork/!FluxIQ` and the lane `fxwork/t1015-paid-bigbox`.

**Path prefixes:**
- Core paths are under `packages/fluxiq/src/`.
- Domain paths are under `domain/src/`.
- Extension paths are under `apps/extension/src/`.
- Lab paths are under `packages/test-runner/src/`.

**Debug files:** `docs/working/language-driven-flow-loop-plan/debugs/run-mwyfc9uf-215bbd84.md` and
`…/run-mwyfoz8o-507c92f6.md`.

## Outcome

- **bigbox.** Every later attempt stopped on the same saved step: step 10, the click on the header cart link.
  - The link was saved by words that are the cart's state ("🛒 1 $3.97"), and playback refuses a control whose
    words disagree.
  - The model then clicked the same handle by hand, and the attempt was right. But the hand-repaired draft could not
    be assembled (`web.handle.ambiguous`), so attempt 2 saved nothing.
  - So attempts 3 and 4 started from attempt 1's Flow, hit the same step, and were refused the continuation proof.
- **The already-done act was handled correctly.** Step 9, "+ Add", was not pressed again, and no model call was spent
  on it.
- **job-board.** Nothing stopped. A judge said no to a right answer because it could not see the sort key. That cost
  attempt 2 a repair and attempt 3 one judge call.

## Answers to the brief

### 1. Which step stopped attempt 2, and why

- **The step.** Saved step 10, plan node `node.bootstrap.76ae87bea1550e0d.main.s12`, `web.output.dom-click` on the
  cart link. It failed 4 times with `web.target.not_found` (steps 0040-0043, note 0044). Attempts 3 and 4 failed on
  it the same way (0074-0078, 0100-0104).
- **Which case it is.** Of the brief's three cases, it is **a control whose words changed**. It is not a stale
  target, not a route problem, and not an act done twice.
  - The element is the same: same handle t380, same `href="/scenarios/bigbox-retail/cart"`.
  - Attempt 1 saw it as `"🛒 1 $3.97"` (`0018-tool-core.run_node/page.txt:16`). The header had not yet counted the
    roll added at 0018.
  - Attempt 2 sees `"🛒 2 $5.25"` (`0045-tool-core.run_node/page.txt:15`).
  - Markup: `apps/scenario-lab/src/scenarios/bigbox-retail/shell/shell.ts:52`.
- **The veto.** It acts on a match only when a distinguishing signal agrees exactly
  (`content/identity/corroboration.ts:60`). The text and the name both changed, and `href` is not on the list.
- **The stable-name reading cannot help.**
  - It allows exactly one changed text run, and the kept part must hold 3 or more letters
    (`content/identity/stable-name.ts:28-29`, `:75`, `:136-146`).
  - It also needs the name and the visible text to agree (`:124-129`). The `aria-hidden` glyph makes them differ.
- **Not a stale target.** The rule for a target found again from the step that found it does not apply: the cart
  link came from no earlier step.
- **Not a route.** State routing ran on each try (the `state-route` span in 0040-0043) and found no way on. See 2.

### 2. What the product should do

- **The rules held where they apply.**
  - *Reset as rarely as possible:* the attempts ran against the changed site, and the judge accepted the change.
  - *A lasting act is never done twice:* step 9 was refused by the act record's gate, with nothing sent
    (`framework/automation-service/service/answer-first/run-acts/run-gate.ts:170-206`, result at `:275`). 0039 has
    no `dispatch` span.
  - *Every node retries:* 1 try and 3 retries.
  - *Runtime routes by state:* steps 2 and 4 were passed over as absent (0030, 0033).
- **Should a step whose asked act is already done be skipped with no model call?** Yes, and it was.
  - Core decides it in the run gate, which reads the attempt's act record. The chat line "Already done" is
    `told` in `run-gate.ts`.
  - The model was not called because of step 9.
- **Why the model was called.**
  - Step 10 is a plain navigation click that **must run**: the read at step 12 needs the cart page.
  - It could not be resolved (cause F1). State routing had nothing to offer, and after the retries the run stopped.
  - Answer-first then hands the page to the model (`answer-first/attempt/flow-stage.ts:153`, path
    `run_flow_then_repair`).
- **What the product should do here.** Resolve the same link by what does not change, and run it. Then attempts 2-4
  make 0 decision calls.
- **A latent defect, F2.** The state-routing rule written for a follow-on step after an act already done never
  passes over a web click, because every click counts as a lasting act. It did not decide this run, but it will
  decide Flows whose follow-on control appears only after an Add, such as a drawer's "View cart".

### 3. Why attempt 3 ran "another flow" and saved nothing, and the cause behind each refusal code

- **Attempt 2's draft was refused at assembly** (note 0062): `flow_bootstrap.evidence_completion_parameters_unresolved`,
  `web.handle.ambiguous` at `plan.subflows.0.nodes.11.parameters`.
- **So attempt 2 saved `notes_only`, `why: not_assembled`, with no `flowId` or digest** (`attempt.json:447-452`).
- **Attempt 3 therefore began from attempt 1's saved work** (`startedFrom.attemptId` = attempt 1, digest `761eb715…`,
  `attempt.json:824-829`).
  - It hit step 10 again, the model repaired it by hand again, and the draft was refused again (0088).
  - Attempt 4 repeated the same (0115).
- **Each refusal code** (`attempt-lane/continuation.ts`; the digests are read in `attempt-lane/live/live-driver.ts:81`, `:86`):
  - `first_saved_nothing` (`:20`): attempt N saved no `flowId`.
  - `second_found_something_else` (`:22`): attempt N saved no digest, and N+1 found attempt 1's.
  - `second_ran_another_flow` (`:24`): N+1 ran `flow.ed7f1cd4…` against N's missing `flowId`.

  All three are one cause, the assembly refusal (F3). The Lab reads them correctly.
- **Path labels** (`answer-first/attempt/path.ts:37`, `:48-60`).
  - Attempt 3 and attempt 4 are `run_flow_then_explore` rather than `…_repair` because the broken saved step 10 and
    the unreached step 12 still stood in their drafts.
  - Attempt 2's model had dropped them (0052).

### 4. Specific to Flows that change the site, or would read-only Flows stray too?

**The stop (F1) needs a saved control whose words differ between attempts.**
- *Read-only Flows:* an attempt leaves the site as it found it, so its saved words come back the same, and its
  replay does not stop for this reason.
- *Evidence:* job-board, read-only, the same build: attempts 3 and 4 ran the saved Flow, and attempt 4 made
  0 calls.

**The assembly refusal (F3) arises only when a later attempt must save a changed draft.**
- That happens after a repair whose step targets a control shown identically on two or more pages. A clean
  replay never re-assembles.

**Which tasks may run before the fixes:**
- **Run now:**
  - read-only scraping tasks;
  - tasks whose Flow changes the site but whose later steps never click a control whose words show that change.
- **Expected cost per read-only task:** one judge call in attempt 2, which the rule requires (*One live
  exploration*: the judged whole run moves to the next attempt). Plus whatever a wrong judge "no" costs (F4,
  job-board).
- **Hold until F1 is fixed:** tasks whose Flow, after a lasting act, clicks a control whose words carry state.
  - Counts, totals, a chosen value, or a toggled label: a cart badge, "Following" or "Requested", "Saved (n)",
    a notification count.
  - They will stop on that step in attempt 2, as bigbox did.
  - Likely examples among the ten scenarios: add-to-cart tasks on everything-store, bigbox-retail and
    crossborder-marketplace that then open the cart from the header badge. Follow, connect or request tasks on
    social-network-feed, photo-social and professional-network that then navigate by a count.
  - These examples are inferred from the cause, not from runs.
- **Hold until F3 is fixed, if the series must prove continuation:** any of those, because their repair cannot be
  saved.

## Findings, ranked

### F1 (critical, stopped attempts 2-4). A saved control is matched on words that are page state

- **Cause.**
  - The saved identity of the cart link carries its visible text and name, which are the cart's count and total.
  - Playback acts on a match only when a distinguishing signal agrees exactly
    (`content/identity/corroboration.ts:60`; `identity/veto.ts`; Level 2 in `content/action-runtime/resolve-target.ts`,
    failure at `:665`).
  - The stable-name fallback covers one changed run with a word-bearing kept part (`identity/stable-name.ts:28-29`,
    `:75`, `:124-146`, used at `resolve-target.ts:583-589`).
  - A link's destination is never a corroborating signal.
- **Evidence:** 0018 `page.txt:16` against 0045 `page.txt:15`; 0040-0043 fail; 0047, a live click by handle t380,
  succeeds.
- **Class:** target identity (extension resolver and the recorded fingerprint).
- **Root-cause fix (no caps).**
  - (a) Record what stays the same.
    - The build already sees this link's words change under its own act: 0018 shows "1 $3.97", and 0020's cart page
      shows "2 $5.25". The domain keeps self-changing names (`runtime/llm-evidence/plan-resolution/self-changing/`).
    - A saved step's identity should mark the text runs the build saw change as state, so the recording names the
      control by its stable signals (role, landmark, destination) and not by the count.
  - (b) Let a same-document link's destination corroborate exactly.
    - The destination is its `href` path, excluding action links (`identity/action-link.ts:16-21`).
    - It counts only when it is unique among the visible candidates in the recorded scope.
    - It is a Core matcher signal (`fluxiq/automation/fingerprinting`), so Core scores it and the veto reads it as
      it reads an id.
  - Both are general. Neither is a bigbox special case. (b) alone would have resolved this step: one cart link per
    header.
- **Offline proof:** an extension resolver test built from 0018's link capture, resolving against 0045's page. It
  must resolve to the link, and must still refuse a different link with the same words.

### F2 (high, latent; decides any Flow with a follow-on control after an Add). The "state never arose" rule cannot pass over a web click

- **Cause.**
  - `state-routing/decision.ts:112-113` takes the not-arisen way on only when `!doesAct(input)`.
  - `doesAct` reads the action-effect floor (`decision.ts:173-181`, `step-skip/act-not-done.ts:30-31`), and every
    `web.dom.click` is floored `commit` (`domain/src/actions/action-effect/table.ts:20`).
  - So `not-arisen.ts` never applies to a click, though its header names a click as its case: the "View cart" of the
    drawer an Add opens.
  - The run gate, by contrast, holds a press as lasting only by the act record: declared, claimed, or answered as
    lasting (`run-gate.ts:22-28`).
- **Evidence.** The 0040-0043 `state-route` spans each include a page capture. That only happens past
  `decision.ts:113`, at the observation on `:123`.
  - So the not-arisen way on was not taken, even though step 9 succeeded with `skipped: "already_done"`
    (`run-gate.ts:275`) and `didNotAct` reads exactly that (`not-arisen.ts:83-88`).
- **Class:** state routing, act classification.
- **Root-cause fix.** Ask whether the follow-on step itself lasts the way the run gate and the act record ask it:
  declared or claimed consequences, or an earlier answer that it changed something that stays. Do not use the verb
  floor, which exists to stop a press being repeated after a lost acknowledgement. A plain navigation click with
  `consequences: []` is not a lasting act.
- **Offline proof:** a Core state-routing test where an Add is skipped as already done, followed by a click with no
  declared consequence whose control is absent. It must route `declared` with `executor.state.not_arisen`.

### F3 (high, broke saving and continuation in attempts 2-4). The target store outlives the attempt, so a later attempt's draft is refused as ambiguous

- **Cause.**
  - The domain's targets, views and act witnesses are keyed by `projectId\0flowId` (`plan-resolution/target-packets.ts:797-799`).
    Every attempt of a task explores under the same `flowId`.
  - The store keeps only a handle's first act (`target-packets.ts:396`).
  - At assembly, an absolute target that matches captures on two or more pages needs a witness whose intent agrees
    (`control-intents/absolute.ts:56-74`, reached from `resolve-plan-node.ts:605-608`, issue path `parameters`).
  - In attempt 2 the cart link read `"🛒 2 $5.25"` on both the search page and the cart page. Its only witness is
    attempt 1's act as `"🛒 1 $3.97"`, which does not name it. That leaves no witness, so `ambiguous`.
  - Attempt 1 escaped only because the label differed between its two pages.
- **Evidence.**
  - The handles persist across attempts for the same elements: t380 the cart link, t1295 "+ Add", t1586 the cart
    page's link (0045, 0047 against 0018, 0020).
  - The refusal is at node 11 in attempts 2, 3 and 4 (0062, 0088, 0115). Node 11 is the cart-link click, counting
    the two joins `draft-routing.ts` adds for the optional steps 2 and 4.
- **Not proven:**
  - which of `absolute.ts:53`, `:69` or `:73-74` returns;
  - why the carried step 10 is also refused in attempts 3 and 4, where it stands at node 11 with attempt 1's words.

  A cross-attempt conflict on t380 (`intentConflict`, `crossPageIntentConflict`) would explain both. That is a
  hypothesis.
- **Class:** plan resolution, run-scoped state.
- **Root-cause fix.**
  - Scope the evidence the domain keeps (views, printed handles, act witnesses) to the attempt's run, as the page-diff
    rule scopes page delivery: run-specific, nothing kept between runs.
  - Or, at minimum, record an attempt's own act as its witness: `acted` keyed per attempt and run.
  - Then also accept the step's own recorded pre-act view as its witness. The step's `ranWith` carries it.
- **Offline proof:** a domain test that replays 0018/0020's captures and acts, then 0045/0047/0051's, and assembles
  attempt 2's draft (steps 1-9, 14, 16). It must resolve. Run it first with today's code to confirm which line
  refuses.

### F4 (medium, job-board attempt 2: 6 decisions plus 1 judge; attempt 3: 1 judge). The judge cannot see the sort key it is told was applied, and its "no" without a contradiction is accepted

- **Cause.**
  - The judge's result evidence gives the processing's declaration and counts (`runtime/result-verification/flow-less/question.ts:16`).
    The kept rows are shown in the asked columns only: title, company, salary, link.
  - So `posted`, the declared sort key, is absent from the final rows. Only page 1's raw rows carry it; pages 2 and 3
    are labels only.
  - The judge (0101, fresh request) said no "only because the sort cannot be confirmed". Its instruction allows "no"
    only on a concrete contradiction (`question.ts:31`), and the verdict was accepted anyway.
  - The model had no tool to show `posted` for the final rows (0103-0119).
  - Because that whole run was answered no, the Flow stayed unproven (`attempt/remember.ts:69-71`,
    `task-memory/better-flow.ts:34`), so attempt 3 had to judge again (`completion/replay-stands.ts:67`).
- **Class:** completion check, judge evidence.
- **Root-cause fix.**
  - Show each kept row's values for every field the processing declaration uses (sort and filter keys) beside the
    asked columns. That is the 2026-11-20 rule that extraction keeps every column and the asked columns are a view.
  - Read a "no" that names no row, value or act contradicted as `unknown` for the named part. The framework, not the
    model, then supplies that part.
- **Offline proof:** 0101's request rebuilt with `posted` on the 7 rows must not be "no" for order. And a "no" shaped
  like 0101's must read as `unknown`.

### F5 (low, job-board, every replay about 20 s slower). A superseded paging loop stays in the Flow

- **Cause.**
  - The model looped read 5, later moved the result and the loop to read 9, and never dropped loop 5-7 or the
    navigate (step 8).
  - The draft drops a read that is not the result only when the framework placed it. This one was the model's own
    repeat span.
- **Class:** draft authoring.
- **Fix.** A repeat span whose read is not the result and feeds no later step is waste. The draft should drop it, or
  the checklist should name it as to do, so the Flow pages once.

### F6 (low, bigbox attempt 2: 3 calls). The checklist shows an act as missing when its step claims only the act's choice

- **Cause.** Step 9 claims `a1.fulfilment`, the choice, and not `a1`, so `a1` shows `no_step_added`
  (`runtime/flow-authoring/bootstrap/instructed-acts/checklist.ts:251-270`). The model re-sent amendments
  (0054, 0056, `already_so`) and was steered for `same_fix` (0058-0060).
- **Fix.** A step that makes an act's choice and does the act's verb stands for the act: it is marked done on both.
  Or the framework draft tags the act together with its choice.

### F7 (reporting). The Lab's wording

- "Repaired the step that stopped it" is printed for every `run_flow_then_repair`, including job-board's attempt 2,
  where nothing stopped.
- The continuation line could name `saved.why` (`not_assembled`) beside the three codes, which all come from it.

## Addendum: run-mwyfoz8o-507c92f6 (job-board-remote-rust-roles)

- **Which saved step stopped attempt 2.** None. The saved Flow ran to its end (0069-0099), and the run was judged by
  rule, `flow_not_proven`. The judge said no (0101, F4), and that is what sent the attempt into a repair.
  - It does **not** share bigbox's cause.
  - What the two share is only that one defect in attempt 2 is paid again later. In bigbox, every attempt pays,
    because nothing could be saved. Here, attempt 3 pays one judge call.
- **Why attempt 1 saved a Flow that could not replay.** It could replay: attempts 3 and 4 ran it unchanged, digest
  `514e2de6…`. It is only wasteful, because it pages the list twice (F5).
- **Why attempt 3 still paid one judge call.** Attempt 2's whole run was answered no, so the Flow was saved
  `partly_works`, not proven. Attempt 3's replay was therefore `flow_not_proven` and judged; that judge said yes,
  which saved `ready`. Attempt 4 stood on its record with 0 calls.

## Not verified

- **No code was run.**
  - The F1 resolution path is read from the resolver and veto code, and the step files carry no strategy record.
  - Which line of `absolute.ts` refuses in F3 is not proven, nor why the carried step 10 is refused in attempts 3
    and 4.
- **The second judge call in bigbox attempt 4** (0113 and 0114, both yes, both `continues_the_decider`) is not
  traced.
- **The F4 effect on attempt 3 is inferred** from `remember.ts` and the saved states in `attempt.json`, not from a
  trace of that code path.
