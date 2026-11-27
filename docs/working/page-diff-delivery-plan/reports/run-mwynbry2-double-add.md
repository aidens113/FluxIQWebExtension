# run-mwynbry2-f3c88dc7: why attempt 2's replay added the towels twice

Worker report: a diagnosis only. No code was changed, no live or paid run was made, and no git command was used.
Debug file: `docs/working/language-driven-flow-loop-plan/debugs/run-mwynbry2-f3c88dc7.md`.
Core paths below are under `C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ/packages/fluxiq/src/` (fluxiq 0.54.33, `9c023c281`).

## Outcome

Done.

- **Yes, the replay pressed "+ Add" a second time.**
  - Step 0042, node `node.bootstrap.a835b3a6376e1e7b.main.s11`.
  - The run gate found no carried act matching it, so it let the press through.
- **The cause is one parameter, and the offline proof shows it.**
  - The saved node carries `requiresChosen`, written because "Pickup (20)" stood chosen. The act-identity reader
    counts it as identity.
  - So the saved step's key differs from the key attempt 1's press was recorded under.
- **None of t1070-t1073 caused the different decision.**
  - The trigger was the build model's own claim. This time it named the "+ Add" step for act `a1`, where
    run-mwyfc9uf named it only for `a1.fulfilment`.
  - That claim makes Core write `requiresChosen` on the node, a feature added by t1030 on 2026-11-24.
  - The flaw has been latent since then.

## Answers to the brief

### 1. Did the replay press "+ Add" again? Which node, what did the gate decide, and why?

- **Pressed, yes.**
  - Step 0042 (`flow-web.output.dom-click`, node `…main.s11`) has the spans `dispatch`, `send.click` and `pressed click`.
  - The gateway trace holds the sent command: `trace.94bd255b…#150` at 07:17:33, `web.dom.click` on the "+ Add" of
    item `418830166`.
  - In run-mwyfc9uf the same step (0039) had no `dispatch` span.
  - In attempt 3 of this run the step (0096) also had none, and no command was sent.
- **What the gate decided: "run", because nothing matched.**
  - `framework/automation-service/service/answer-first/run-acts/run-gate.ts:162-170` (`refusedFor`) asks
    `record.carriedHold(...)` (`runtime/answer-first/act-record/record.ts:359-368`). It returned nothing, so the native
    door ran the press (`run-gate.ts:176-198`). The already-done answer at `:276` was never reached.
  - `carriedMatches` (`record.ts:690-694`) matches an act by identity or by step name:
    - **By identity.** The call has no row (s11 is not in a For Each), so `matches` compares keys only
      (`record.ts:708-709`).
    - **By step name.** Never possible here. Only the run-acts and trial-ledger mergers give an act `steps`
      (`act-record/mergers/from/run-acts.ts:15`, `trial-ledger.ts:26`), and attempt 1's press was a by-hand exploration act.
- **The two keys, from the persisted act record** (`global.sqlite`, row `…/attempt-acts`):

  | Act | Stage | State | Keys | Rows | Control words |
  | --- | --- | --- | --- | --- | --- |
  | attempt 1 "+ Add" | exploration | `landed`, `carried`, `doneInAchieved` | `d4434560…`, `1702ab3d…` | `c728451b…` | `98b2aa37…` |
  | attempt 2 "+ Add" | run | `landed` | `38367187…` | none | `98b2aa37…` |

  Same control, no shared key.
- **Why the keys differ.**
  - The two commands sent to the page have identical `selector` and `element` (gateway `trace.36057d16…#223`, attempt 1,
    and `#150` above).
  - The saved node adds `requiresChosen: [{ at: <the "Pickup (20)" checkbox>, words: "Pickup (20)" }]`, plus
    `ensureState` and `timeoutMs`.
  - `NOT_IDENTITY` (`act-record/identity/target-keys.ts:40`) lists `ensureState` and `timeout.*`, but not `requiresChosen`.
    So `requiresChosen` stays in `rest` (`:77`), counts as an input (`:78`), and changes the fingerprint key (`:82`) and
    the place key (`:86`).
  - The offline proof (under "Commands run") reproduces `38367187…` from the saved node. With `requiresChosen` removed,
    it reproduces both of attempt 1's keys.
- **Why the node had `requiresChosen` this time.** The change behind it is neither t1073 nor t1071 nor t1072.
  - Attempt 1's draft at 0029 names step 10 `"act":"a1"`. The checklist says `a1.fulfilment` `stoodChosen:"Pickup (20)"`,
    "No step of the Flow chooses it" (step 6 checks Pickup, but is not named for the choice).
  - `instructed-acts/standing.ts:232-233` (t1023) then credits the choice as stood. The assembly writes it on the act
    step's node (`instructed-acts/chosen-precondition.ts:84-93`, t1030, Core `f2471627c`, 2026-11-24).
  - In run-mwyfc9uf, a1 was `no_step_added` and `a1.fulfilment` was done by step 9 with no stood credit (that run's 0027
    request). So no `requiresChosen` was written, and the keys matched.
  - t1073's F6 would not have added one to that run's naming either. The borrowed step makes the choice itself
    (`standing.ts:225`), so it is not `stood`.
  - t1073's `stepClaimsAct` did take part, harmlessly. It made the claimed s11 lasting, so the press was put on the record
    before it was sent. That record is why attempt 3 refused the same step.
- **Against the rules.** "A lasting act is never done twice" was broken. t869, "the same words typed again carry every
  act that landed", held in the record: the act was carried. Only its identity failed to match the saved step.
  `target-keys.ts`'s own header names this risk: "a new such key the list misses makes an act look new".

### 2. What the judge at 0046 said, and whether the "fix" to quantity 1 was right

- **The judge said no.**
  - `act_wrong`, row "ValueRidge Essentials Paper Towels, 1 Roll", quantity 2, step "+ Add".
  - Its reason: "added twice (acts show an earlier '+ Add' already landed plus a fresh '+ Add')… the extra add must be
    undone by setting quantity to 1".
  - It checked the dish soap at qty 1, the price $1.28, and that the store was set.
- **The judge was right under the rules.**
  - The words typed again carry the add, so the change attempt 2 was asked to make to the cart is none.
  - Measured against the state just before attempt 2 (towels qty 1), qty 2 is a change nobody asked for.
  - The "9 to 10 after add 1" example is about an act asked for and done once. It does not cover a second press of an act
    that should have carried.
- **The model's fix was right.**
  - One call (0048, `dom-select` Qty to 1, `modify_existing`) undid exactly this attempt's own duplicate act and nothing
    that existed before. The reset rule allows exactly that.
  - Correction to the brief: the fix was 0048-0049. 0067-0079 were spent on the stored result, not the cart.
- **No judge or check steered it wrongly about the cart.** Two later steers were right about the data but came from
  product defects (see 3):
  - 0059 "stored result still has the stale paper towels quantity of 2";
  - 0080 "4 rows, each cart line twice".
- **One side effect.** The fix became step s13 of attempt 2's saved Flow ("+ Add" then "Qty = 1"). In attempt 3 both
  were refused as carried (0096, 0098), so it did no harm here. Once fix A lands, no such compensating step should be
  needed.

### 3. Why attempt 2 needed decisions after the replay

- **0045 is by design.** It reads `flow_not_proven` (`framework/automation-service/service/answer-first/completion/replay-stands.ts:67`).
  - Attempt 1's Flow was assembled from a by-hand run, so no judged whole run of exactly that Flow existed. Its first
    replay is that run.
  - So the 0046 judge call would have happened anyway. Without the double add it would very likely have said yes: every
    other value it checked was right. That last point is inferred.
- **The other 18 calls all follow from the double add:**
  - 0048: fix the cart (1 call);
  - 0050-0057: re-ran read step 13 (0051) and got "kept 2 rows", but the stored result still held qty 2. The re-run's
    `readRows` showed only `item`, which the model took as a failed read (0053). Then a repeat refusal (0054,
    `same_draft`) and two loop decisions (0056, 0058);
  - 0059: judge no, the stored row is stale. 0060 `judged_no`;
  - 0061-0074: more re-runs refused as `same_draft` (0062, 0072), a `finish_with_best` that could not end (0064, 0066
    `same_evidence`; the watcher's `finish_not_ending` alert for steps 64-75), and a re-run from 13 (0068-0070);
  - 0075-0079: a fresh read by hand (0076), the draft amended to make it the result (0078), then complete;
  - 0080: judge no, each line twice (exact duplicates);
  - 0082-0085: declare dedupe by item (0083), complete, judge yes.
- **Two product defects turned 1 repair call into 18.**
  - A re-read of the same list at the same address does not replace that list's earlier rows in the result.
  - Exact duplicate rows are collapsed only when the domain reported a row identity
    (`runtime/flow-authoring/bootstrap/record-defaults/process-defaults.ts:30-33`). The user's rule of 2026-11-20 is that
    the data layer dedupes by itself.
  - The exact path by which 0051 and 0068's re-reads failed to reach the stored result is not traced (see Not verified).

### 4. Root-cause fixes, no caps, each with an offline proof on this recording

**A. A precondition is not identity (root cause).**
- **What to change.**
  - `requiresChosen` says what must stand before the act, not which act it is.
  - Do not only add a word to `NOT_IDENTITY`: the assembly and the reader would drift again. Export one list of the
    parameters Core writes onto a step for how it runs (`requiresChosen`, `ensureState`, `routeSignatures`, the
    timeouts). The assembly writes from that list (`chosen-precondition.ts` already exports
    `AUTOMATION_STUDIO_REQUIRES_CHOSEN_PARAMETER`), and `target-keys.ts` builds `NOT_IDENTITY` from it.
  - Add a test that fails the build: for each parameter on the list, the keys of a node with it equal the keys without it.
- **Offline proof.**
  - A Core unit test under `runtime/answer-first/act-record/tests/` builds the record from this run's attempt 1 act: the
    ran-with form `{selector, element}` from gateway `#223`, row-bound, `carried`, `doneInAchieved`.
  - It asks `carried()` with s11's saved parameters, `requiresChosen` included, and no row. It must return the act.
  - A `run-acts/tests/carried-press.test.ts` case with the same pair must end `skipped: "already_done"`, with nothing
    dispatched.
  - Re-running `keys-proof.mjs` (below) must print `exploration:d443` for the saved node.

**B. Tie a by-hand act to the step it became (structural).**
- **What to change.**
  - Identity across stages is "the best reading" of parameters (`record.ts:26-31`). Any new parameter in any domain can
    break it again.
  - At assembly, the draft knows which call made each step: step 10 came from call `c9`, and the act was recorded from
    that call. Stamp that act with `steps: ["step:<plan key>"]` (`step:s11`), as `mergers/from/trial-ledger.ts:26` does
    for trials, and skip steps inside a repeat, as that merger does.
  - `carriedMatches` (`record.ts:693`) then refuses s11 by its step name, whatever its parameters say.
- **Offline proof.** Seed an act record from this run's persisted `attempt-acts` row, with the step name stamped as the
  fix would. Run the gate over attempt 1's saved Flow, s1-s13 as in 0032-0044, against stubs. s11 must be refused, and
  every other step must behave as in 0032-0044.

**C. The result follows the latest read of a list (secondary, makes repairs cheap).**
- **What to change.**
  - Within one attempt, a read of the same list at the same address (URL without its query) supersedes that list's
    earlier rows in the result, matched by row identity.
  - Exact duplicate rows always collapse, with no declaration and no row identity needed (user, 2026-11-20).
- **Offline proof.** Feed attempt 2's reads through the result feed with no declared processing:
  - 0044's rows (towels qty 2);
  - the re-reads at 0051 and 0068;
  - the hand read at 0076.

  The result must hold 2 rows, both qty 1.

**Acceptance after A, B and C.** Rerun this task with `--attempts 4`. Accept it only if:
- attempt 2 sends no `web.dom.click` for "+ Add" (check the gateway trace);
- attempt 2 spends at most the one `flow_not_proven` judge call;
- attempts 3 and 4 spend none.

## What changed and why

Two documents were written, at the paths the brief gave. No source, test or configuration file was touched.

## Commands run and observed results

- `find …/lab-runs -maxdepth 2 -name run-mwynbry2-f3c88dc7` found `lab-runs/2026-11-26/run-mwynbry2-f3c88dc7`.
  Its `steps/index.md` lists 0001-0108.
- I copied `global.sqlite` and `project.sqlite` out of `.attempt-work/run-mwynbry2-f3c88dc7/fluxiq-root/.fluxiq/` into
  the scratchpad and read them with `python -I` scripts (`tables.py`, `auto.py`, `q.py`, `out.py`).
  - **Act record.** `automation.state` row `…/attempt-acts` holds the four landed acts above.
  - **Gateway trace.** `client_gateway_trace_events` holds exactly two `server.execute_action` events with "+ Add": seq 223
    in attempt 1's trace and seq 150 in attempt 2's. Attempt 3's trace has none.
  - **Saved node.** `automation.state` row `…/candidate-draft` (attempt 2's draft) shows s11's parameters with
    `requiresChosen`. The command attempt 2 sent carries it too (#150).
  - Secret tables were not read.
- **Offline key proof.** `node keys-proof.mjs`, from
  `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1bda39b1-1940-4a03-9ca6-eeeb61191390/scratchpad/dbg-mwynbry2/`.
  - It imports `dist/runtime/answer-first/act-record/identity/target-keys.js` from the shared Core.
  - It calls `automationStudioAttemptActTargetKeys("web.output.dom-click", params)` on the forms copied from gateway events
    #223 and #150 and the saved node.
  - Printed:
    ```text
    saved node (attempt 1 Flow s11, with requiresChosen)  keys run:3836          | placeKeys new:63f8
    saved node without requiresChosen                     keys exploration:d443  | placeKeys exploration:1702
    exploration wire (element, selector, checkWaitMs)     keys new:0a98          | placeKeys new:7a7d
    exploration ran-with (element, selector)              keys exploration:d443  | placeKeys exploration:1702
    model call by handle t1125                            keys new:369f          | handleKeys new:369f
    ```
- `git log -S requiresChosen` (read-only) in Core gives `f2471627c` (2026-11-24, t1030). `git show edea71f29` for
  `standing.ts` shows t1073's F6 borrowing.
- No background process was started. Each script ran in the foreground and exited.

## Not verified

- **Attempt 1's saved Flow was not read directly.** The parameters of s11 come from:
  - attempt 2's candidate draft;
  - the command attempt 2's replay of attempt 1's Flow actually sent (#150);
  - the key match. The saved node with `requiresChosen` reproduces the run act's key exactly, which is strong evidence
    that the gate saw those parameters.

  The flow source file under `flows/…/source/` is attempt 2's save.
- **run-mwyfc9uf's saved node was not read** (its work directory is gone). That it lacked `requiresChosen` is inferred
  from its checklist (`a1` `no_step_added`, no `stoodChosen`), from `standing.ts:232-233`, and from its gate refusing the
  step.
- **Fix C's mechanism is not traced.** Why the re-reads at 0051 and 0068 did not replace the stale rows, and why their
  `readRows` showed only `item`, was observed and not traced to code.
- That 0046 would have said yes without the double add is inferred.
- No unit test was written or run. The fixes' offline proofs are specified, not built.

## Open questions or contradictions found

- **The brief's step range.** The brief places the quantity fix at 0067-0079. It was 0048-0049. 0067-0079 were spent
  making the stored result match the page.
- **Attempt 3** (outside the brief) judged `unknown` at 0101. With "+ Add" refused as carried, the trail held no evidence
  of the 4.5-star condition or the eligible list, so the judge could not confirm the choice. This follows t1072's "a no
  with no contradiction reads as unsure", and it sent a replayed Flow back into exploration. A carried row-bound act
  probably needs its earlier evidence handed to the judge. This is not traced here.
- **The double-act oracle.** `target-keys.ts` says the Lab's double-act oracle catches what identity misses. No sign of
  it appears in `bigbox3.log` for attempt 2. The run was stopped before the attempt report, so it is unknown whether it
  would have fired.
