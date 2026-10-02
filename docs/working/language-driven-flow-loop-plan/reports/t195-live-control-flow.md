# t195 live lane D: control flow and consequential acts

Lane lead t195 (`lead-xhigh` brief from the supervisor, 2026-09-30). Trees:
`C:\Users\osrs_\FluxStuff\fxwork\t195\!FluxIQWebExtension` and `...\fxwork\t195\!FluxIQ`, both on
`task/t195-live-control-flow`. Slot `lab-slots/slot-4`, instance `t195-slot-4`, headed, deepseek-flash,
production profile, 48k in / 8k out / 56k per call, $0.25 cap. Launcher: scratchpad `live-run-d.sh`
(t174's `live-run.sh` with slot-4, the t195 instance and tree, and a full log per run). From run 5 it passes
`--llm-max-calls 64`, as t174's L1 does, because Core ignores the configured call limit (t193's cause B).

## Session 4 (2026-10-01): fixes that need no Lab, before live runs resume

Brief (supervisor): trees fast-forwarded to local dev (downstream `a15a465e`, Core `f3778a8e`, round 5 with P1-P2).
Every Lab is stopped until t223 lands. Tasks: confirm-requests and pickup-order first, then withdraw-stale-requests,
apply-quillmark and moon-jar. Fix every cause provable without a Lab (unit and fixture-level tests from the scenarios'
own markup and state, provider-free, no browser), so the first live run of each can pass. Not to be edited: t223's
page serialization (`domain/src/runtime/llm-evidence/{elements, capture, page-evidence, present, attributes, tools,
sanitize, stable-handles, page-view/, page-find/, node-run/run.ts, tool-rejection.ts}`) and lane B's
`recovery/runtime-exploration.ts`.

Plan: round 1, five read-only `worker-high` audits, one per task (w19a-e), each tracing the chain a correct build takes
on its site through dev's code and ranking the causes that would fail the first live run, with a fix spec by file and a
provider-free test. Round 2, fixes partitioned by file from those audits.

**Round 1 findings (audits `reports/t195-w19{a..e}-audit-*.md`).** The Lab resets the site before the judged playback
(`flow-lane/creation/lane.ts:318-320` -> `/__control/reset`), so exploration's lasting acts never reach the verdict.
Causes that block a first pass, by task:
- confirm-requests (w19a): B1 a kept consent/"Not now" press is `unreproducible` in every dry run (the site remembers
  it); B2 a kept step between the listing and the act refuses the loop (`draft-routing.ts:199`); V1 the judge scores the
  Flow's FIRST extraction (`creation/judgement.ts:50`), which here is the pre-act listing (false pass).
- pickup-order (w19b): #1/#2 the dry run runs after the real order on remembered state (empty cart, guest checkout), and
  first-visit steps (sign-in wall link, slot Retry) can never replay; #3 the same judge defect (a cart read first fails a
  right Flow); #4 F20's press scope stops at `<main>`, so bigbox's load-time changes hide a swallowed Add to cart.
  Risks: #5 `check out` read as a second act; #6 decline pin; #7 the gate stops recording shown names at 4 MB, so Place
  order would be asked unnamed and denied; #9 cart lines are not records.
- withdraw-stale-requests (w19c): B1 the For Each row gate cannot see the shadow-root age (`identity/record.ts`
  `rowContents`), so pass 1 finds no Withdraw at playback; B2 a repeat that stops at the row press (run 3) is accepted
  while the dialog's confirm runs once after the loop. Risks: R1 a hidden "Show more" is not the list's end (10 s per
  read, "incomplete"); R2 a withdrawal declared `modify_existing` is never asked, so the lane refuses `not_asked`.
- apply-quillmark (w19d): C1 steps built inside the ATS frame carry a frame id but no frame path; C2 detection inside a
  cross-origin frame throws (origin check); C3 the `<dl>` receipt cannot be read as one record; C4 the dry run refuses
  every step after the withheld Submit; C5 (likely) "I'm a person" is disabled 3 s and a gate `disabled` is not waited.
- moon-jar (w19e): 1 no single-record read (the reply card has no siblings; detection answers the inbox's thread rows).

**Round 2 partition (each worker owns only its files).** w20a-w20g ran and are Ready to commit (fix log F23-F29).
w20h, w20i and w20k were refused at dispatch by the session's concurrent-agent limit and never started; with w20j they
are the next step (see "Next" under Ready to commit).

| Worker | Fixes | Owns |
| --- | --- | --- |
| w20a | V1/#3: the judge pairs the expected step with the latest dataset carrying its keys | test-runner `flow-lane/creation/judgement.ts` + tests |
| w20b | B1, #1, #2, C4: the dry run answers `remembered` / `reanchored`, and excuses steps after a withheld gated step | Core `flow-draft/{dry-run,verify-only}.ts`, `llm/node-tools/{replay-draft,dry-run-gate,replay}.ts`; domain `node-run/{replay,replay-answer,verify}.ts` + tests |
| w20c | B2 (w19a): a repeat with steps between the listing and the act; R3 the F7 graph-run test | Core `flow-bootstrap/authoring/draft-routing.ts` + tests |
| w20d | B2 (w19c) `span_stops_short`; R2 `act_consequence_undeclared`; #5 check-out act | Core `flow-bootstrap/instructed-acts/*`, `unfinished-build/not-done.ts`, `llm/harness-options/repeat-suggestion.ts`, `flow-draft/amendment.ts` + tests |
| w20e | B1 (w19c) shadow-root row values; #9 rows that are not records | extension `content/identity/record.ts` + tests |
| w20f | R1 hidden Show more; #4 press scope at `main` | extension `content/extraction/pagination.ts`, `action-runtime/ignored-press/press-scope.ts` + tests |
| w20g | #7 shown-names cap; #6 decline pin and `instead` | Core `action-permissions/gate.ts` + tests; domain `llm-evidence/press.ts` + tests |
| w20h | C1 frame path on built nodes + frame wait; C2 frame origin | domain `plan-resolution/{target-packets,resolve-plan-node,extraction/slot}.ts`, `structure/{handles,detect}.ts`; extension `runtime/{frame-address,action-runner}.ts` + tests |
| w20i | C3 + moon-jar 1, extension half: key-value and lone-record proposals | extension `content/extraction/{key-value-record,lone-record-level,lone-record (new), infer-list, detect-structure, index}.ts`; domain `extraction/structure-detection.ts` + tests |
| w20k | C5: a gate-level `disabled` is waited out | extension `content/actions/{click,type,select,check}.ts`, `action-runtime/{results.ts, recovery/fault.ts}` + tests |
| w20j (after w20h, w20i) | C3 + moon-jar 1, domain half: a `record` handle and packet | domain `structure/{detect,handles,packet}.ts` + tests |

Decisions taken here (supervisor may override): the dry-run area is t196's (D1), but t196 is merged and idle, so lane D
takes it (w20b). `instructed-acts/check.ts` was t174's claim; lane D takes B2, R2 and #5 there (w20d) because they block
this lane's tasks. C4's Core-only rule (excuse every non-replayed step after a verified step that declared
`move_money`, `delete` or `send_or_publish`) is taken, because the frame half needs t223's `node-run/run.ts`. Not
taken: w19a R1 (`rerun_of_loop_source` would also refuse F15's advised rerun with a `where`); the browser e2e proof of
the lone-record DOM walk (no browser runs).

## Session 3 (2026-10-01, from ~05:00Z): live after round 3 + t210

Trees fast-forwarded to pushed dev (downstream `58fd0cd3`, Core `e5b8f015`); dev carries L1, F20, R1+R2, F21, F22
and t196's fix for run 33's orphaned `over` (`rerun-replacement.ts`, audit A1). Rule now on dev
(`lane-rules/built-flow.ts`): a permission stop is `stopped_for_permission` and never a pass; F3's exemption is gone.

Launcher (session `58ff9269` scratchpad `live-run-d.sh`): one run per invocation, no loop; refuses on `STOP-balance` or
an owned slot-4; writes and clears `slot-4/owner` with the reason (the fix under test). Command, from this tree:
`FLUXIQ_LAB_INSTANCE=t195-slot-4 FLUXIQ_BUILD_PROGRESS_TRACE=1 FLUXIQ_LAB_KEEP_RUN_STATE=1
FLUXIQ_BUILD_DECISION_DUMP=<tree>/test-runs/instances/t195-slot-4/decision-dumps node scripts/lab/run-lab.mjs run
<scenario> --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow
--instruction-task <task> --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000
--llm-max-calls 64 --llm-max-cost-usd 0.25 --evidence events`. The token limits follow t210 and the campaign's
`CREATE_LIMITS` (the old 48k input cap made a whole page undescribable); `--evidence events` turns on t193's window
captures.

**Stage 1, confirm-requests (written before run 34).** Instruction: confirm every friend request with at least five
mutual friends, leave the rest, then table every request the list shows as accepted, in list order, `name` and
`mutualFriends` as written. Seed (`content/requests.ts`): Tom Becker 1, Amara Osei 23, Priya Nair 4, Jonas Weber "Aisha
Khan and 4 other mutual friends" (5), Diego Alvarez (no line, 0), Lin Zhao 11, Freya Holm 5, Marta Kowalczyk 3. Expected
dataset: Amara Osei / "23 mutual friends", Jonas Weber / "Aisha Khan and 4 other mutual friends", Lin Zhao / "11 mutual
friends", Freya Holm / "5 mutual friends". Chain: (1) open Friends, then "See all" to `friends/requests/` (the Friends home
shows only 4); (2) a list read of the request cards with name and mutual line, `where` mutual >= 5 (F8 reads "X and 4
other" as 5); (3) a For Each over the kept rows whose body presses that row's Confirm; the fourth confirm meets "You're
going too fast" and is pressed again after the countdown (F7); (4) a list read of the accepted cards (`name`,
`mutualFriends`). A wrong answer that looks right: Tom Becker or Priya Nair confirmed (an act before the filter), Jonas
Weber dropped (his line has no leading number), or Freya Holm missing (the rate limit swallowed her confirm).

**Stage 1, pickup-order (written 2026-10-01, before any chat-driven pickup run; from w19b's chain).** Permission point
`move_money` at "Place order"; the Lab's person answers it in the chat (t227's `answerInChat`, to be verified live).
Expected `extract-order`: `{order: "2000958-40713", item: "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double
Rolls", quantity: "1", total: "$9.62", pickup: "Mon, Sep 21, 2pm–3pm"}`. The final state is an empty mini cart and
"Saved for later: 1 item".

The chain:
1. Answer consent and the "$10 off" offer.
2. Search "select-a-size paper towels".
3. Open listing `418830127` (not the sponsored copy). 6 Double Rolls is already chosen, and "Val" is closed with its ×.
4. Add to cart. The first press after a load is swallowed; F20/F28 press again.
5. In the cart, press the **soap's** "Save for later" (`L1`), never the towels'.
6. "Continue to checkout" (`[]`).
7. "Continue without an account".
8. The slots' Retry, after the 429.
9. **2pm–3pm** today: 11am–2pm are full, and the labels repeat under "Tomorrow".
10. Contact: Dana / Whitfield / dana.whitfield@example.com / 555-014-2290. Never the hidden `company_website`.
11. Pay at pickup.
12. "Place order" `[move_money]`: ask, grant.
13. Read the confirmation as one record.

Wrong answers that look right: the towels saved instead of the soap; 3pm–4pm chosen; qty 2 from a kept second press;
money declared on "Continue to checkout"; the cart read judged instead of the order (F23 fixes the judge).

**Run 34 (killed before it started) and the supervisor's HOLD and STOP (2026-10-01 ~05:20Z).**
- First Core rebuilt (contracts, fluxiq, client-gateway-websocket via `heavy.sh`): exit 0 (fluxiq built in 216 s; queued
  ~10 min behind four other lanes' heavy jobs).
- Run 34, confirm-requests, launched 05:15:50Z: the guards admitted it (fingerprint `sha256:ab782e93...`); the prelude
  rebuilt scenario-lab, the domain host, the domain and the three extension bundles; then the Lab exited 1 with no message
  (05:19-05:20Z). No ledger `start` line, so no run id, no model call, **$0**. This matches the supervisor's kill of every
  Lab process. Nothing to debug beyond the launcher log (scratchpad `runs/20261001T051550Z-...confirm-requests.log`).
- **HOLD, then STOP (user's direct order via the supervisor):** no Lab of any kind, live or provider-free, until the
  supervisor lifts it. Task t223 (compact page view plus page search) lands first. This lane does not edit
  `domain/src/runtime/llm-evidence/` page serialization (elements, capture, page-evidence, present, attributes, tools):
  t223 owns it. Only non-Lab work continues: debugs, workers, unit tests.

**Cause P1, recorded first here (2026-10-01, from dev code; fits runs 19, 20, 25, 30, 32 and top cause 5): the first
declined ask blocks every later ask in the build, including the one at the task's declared point.**
- Core `runtime/flow-bootstrap/action-permissions.ts:166-184`: `asked` is build-wide, set at the first ask "whatever they
  answer". Every later refusal returns without asking.
- Core `runtime/action-permissions/gate.ts:165-166`: `settle("refused")` keeps `raised`, and `checkFor` (`if (this.raised)
  return ... requestId: this.raised.requestId`) refuses every later gated action with that first request's id. No new
  request is ever raised.
- `parking/permission-ask.ts:106` returns only `answer?.kind === "grant"`, so a person's "no" and a timeout look the same.
- Effect: on pickup-order, a `move_money` declared on "Continue to checkout" (runs 20, 25, 30) or on an unnamed control
  (runs 19, 32) is denied by the Lab (L1, correctly). After that, "Place order", the declared point, can never be asked
  about, so the task cannot pass. The model keeps pressing and is told `consequences_not_granted`, "the request now in
  front of the person", which is false after a decline (top cause 5: 8-21 wasted decisions).
- Rule kept: a build nobody answers still costs one wait. Rule changed: after a person's decline, a different control is
  a new question and is asked; the same control and classes are refused without asking again.
- Related wording (top cause 6): the `core.run_node` example says a filter press is `[]`. It gains "or opens checkout":
  the description is 1,972 of its 2,000 characters, and 1,990 after.
- Worker t195-w18 (`worker-high`), report `reports/t195-w18-declined-ask-not-final.md`.

**Hand-back, 2026-10-01 (under the STOP).** Nothing is in progress: no worker is running, no Lab, slot-4 has no owner, and
there is no `STOP-balance`. P1 and P2 are validated and Ready to commit (fix log).
- w18's open question, whether a declined request should hold a proposal, is settled by the lead's adjustment. It is
  carried only while a Flow step needs it.
- Open, routed:
  - `recovery/runtime-exploration.ts` still settles a person's no as silence, so a repair's first decline blocks its
    later asks. It is t193's recovery area: hand it to t193, or to t195 once t193 is not editing it.
  - Top cause 9 (a lasting act on a non-qualifying row during exploration) needs a run on the three-phase build before
    any fix.
- Next live step, once the supervisor lifts the STOP after t223: confirm-requests with P1 and P2, from Stage 1 above. Then
  pickup-order, which P1 targets directly.

## Session 2 status (2026-09-30, ~19:45Z): stopped by the supervisor's order

No Lab run is in flight and none will be started: the supervisor stopped all Lab runs (the user's order) for a cross-lane
audit. `lab-slots/slot-4/owner` is empty. The honest pass count is **0** on every task. The 12 overnight "passes" on
pickup-order were permission stops with `flowCreated: false`, and two of them (`run-munzbfbj`, `run-muo2fscr`) stopped on an
unnamed control, not even at the declared point. Every real run of instance `t195-slot-4` now has a debug file: runs 11-33
were written this session by t195-w15 and w17a/b/c, and the 346 empty-balance runs share
`debugs/t195-slot-4-balance-failures-2026-09-30.md`.

Launcher this session: scratchpad `live-run-d.sh` (session `be617e0f`). It makes one run per invocation, with no loop:
`FLUXIQ_LAB_INSTANCE=t195-slot-4 FLUXIQ_BUILD_PROGRESS_TRACE=1 node scripts/lab/run-lab.mjs run <scenario> --live-llm
--llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task <task>
--llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-calls 64
--llm-max-cost-usd 0.25`. The browser is headed. The owner file is written at launch and cleared at exit.

**Owning the overnight waste.** The lane's keeper (`t195-queue2.sh`) kept relaunching pickup-order after this lane's agent
had ended: 16 real runs that nobody debugged ($1.66), then 346 instant empty-balance failures. That was this lane's defect.
This session used no keeper, no loop and no background relauncher.

## Fix log

Protocol (supervisor, 2026-09-30): loop continuously, fix in this branch, validate, re-run; hand back only at
"Integration round N".

| # | Fix | Files | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| F0 | t174's committed fixes (network-guard start crash, draft-shown throw, gateway open timeout, source-mapped Core frames, build progress trace) applied as a working-tree patch. **Owned by t174; needs t174 merged into dev at the next round.** Hunks are byte-identical to `git diff dev...task/t174-live-lane`. | downstream 23 paths, Core 20 paths (t174's) | run 1 `run-munnetuw-1bba61e6` | Core build (contracts, fluxiq, client-gateway-websocket) exit 0; runs 2-5 paired cleanly | applied (t174's) |
| F1 | A replayed Flow gets past a cookie consent wall: the interference defence presses the control that **declines** optional cookies, on a layer whose own text is about cookies or consent, and never one that accepts. Classification follows, so a consent wall over a target is `blocked_by_dialog` and cleared. | extension `content/action-runtime/interference/{vocabulary.ts, way-out.ts, clear.ts (comment)}`, `blocking-dialog.ts` (comment), `interference/tests/vocabulary.test.ts` | run 4 `run-munoa86g-150fb0d9` (playback died at step 2 under "Your privacy choices") | vocabulary tests 9/9 (esbuild + `node --test`); live proof pending (a permitted bigbox run replays through the wall) | validated (unit), live pending |
| F2 | The model is told how to do one act to every listed item: run the listing step, act on one item, `amend_draft repeat` over it. The decision instruction no longer forbids a drafting build from running its steps or reads as "act on one row only"; the draft telling keeps the per-item sentence at all three lengths (full telling kept at 1,019 characters, under its 1,100 bound). | Core `runtime/llm/evidence-loop-decision.ts`, `runtime/flow-draft/{entry.ts, amendment.ts}`, tests `flow-draft/tests/{entry-budget.test.ts (new case), entry.test.ts (boundary 1_711 -> 1_678)}` | run 2 `run-munnop9n-5475d593` (never said repeat; one Confirm of four) | `vitest` flow-draft + llm/evidence-loop + evidence-loop-provider + evidence-loop-draft-shown: 19 files, 149/149 | validated (unit), live pending |
| F3 | A consequential task run without permission passes when the build stops to ask at the task's declared permission point: `assertFlowLaneBuiltFlow` no longer fails that run for having built no Flow. | test-runner `lane-rules/built-flow.ts`, `run-scenario.ts` (+1 line, `stoppedToAsk`), `lane-rules/tests/built-flow.test.ts` | run 5 `run-munovwp3-d898de74` (asked at Place order, then `environment.missing`) | test-runner build exit 0; `built-flow.test.js` 3/3 | validated (unit), live pending |
| F4 | A repeat over a list hands each pass's row to the steps it repeats: For Each `item` (now `multiple`) is wired to every span step whose node declares input `item`; an unnamed branch never falls into a `role: "data"` input. | Core `authoring/draft-routing.ts`, `authoring/assemble.ts`, `nodes/control-flow/for-each.ts`, tests `authoring/tests/{draft-routing.test.ts, assemble.test.ts (new)}`, `control-flow/tests/for-each.test.ts`; Core `docs/architecture/automation-studio.md` | runs 2, 3 | w4: 88/88, each new test fails with its source reverted; `tsc` 0; Core audit passed | validated (unit), live pending |
| F5 | A web element step inside such a loop acts on the current row's own control: element-target nodes declare input `item`; the row's values replace the element's record (`record.values`); the extension's record gate requires every value in the candidate's record. Lead additions: a built node's handle element carries `listPosition` and never `record` (`plan-resolution/element-identity.ts:51,69`), so either now triggers the scoping; and the row gate is applied before the 60-candidate cap (`identity/candidates.ts` `admits`, from `resolve-target.ts` `scoreFamily`), so a row past the sixtieth same-family control is weighed. | domain `output-nodes/{definitions.ts, native-runtime.ts, targets/targets.ts}`, `actions/types.ts`; extension `shared/protocol.ts`, `content/identity/{record.ts, candidates.ts}`, `action-runtime/resolve-target.ts` + tests; `docs/architecture/page-evidence.md` | runs 2, 3 | w5: domain 917/917, domain check 0, extension 1228/1228, audit passed. Lead: native-runtime 20/20 (new listPosition case); extension `tsc` clean for these files (only error is w8's in-progress `failure/codes.ts`); extension units 1229/1230 (the one failure is w8's in-progress fault word) | validated (unit), live pending |
| F6 | A load-more that fails and offers a Retry beside its control has the Retry pressed (at most twice, closed whole-label list, scope = the control's parent and grandparent), so the read gets every page. | extension `content/extraction/{load-retry.ts (new), pagination.ts}`, `extraction/tests/load-retry.test.ts` (new) | run 3 (10 of 28 requests read; Guildline's first Show more only answers with Retry) | load-retry + pagination tests 8/8 (esbuild + `node --test`); extension `tsc` pending until w5/w8 finish | validated (unit), live pending |
| F7 | A press the site refuses as "too fast" fails `web.action.rate_limited` (`action_failed`, retryable, `effect: "unacted"`, `retryAfterMs` = N s + 500 ms read from the notice in document order); Core repeats it on a mutating node after the hinted wait (Core caps one wait at 30 s); the notice's OK/Got it closes it on a rate-limit layer only; "Try again" is never pressed by the page defence. New Core contract fields: `AutomationStudioFailureRecord.effect`, `.retryAfterMs` (supervisor to confirm). | Core `packages/contracts/src/failure/{record.ts, parse-record.ts}` + test, `executor/defensive/assess.ts` + test; domain `runtime/failure/codes.ts` + test; extension `actions/{click.ts, types.ts}`, `action-runtime/{rate-limit-notice.ts (new), results.ts, execute-action.ts, index.ts}`, `interference/{layer-text.ts (new), vocabulary.ts, way-out.ts, index.ts}`, `recovery/{fault.ts, record.ts}` + tests; `docs/architecture/failure-taxonomy.md` | run 6 (detector fired live; the wait was unread until the document-order fix) | w8: revert checks fail without each change. Lead re-run: extension units 1254/1254, domain 921/921, Core contracts failure 9/9, Core suites below 580/580, fluxiq + contracts + apps/web `tsc` 0, both audits passed | validated (unit); the waited retry is live-unproven |
| F8 | A count written "Aisha Khan and 4 other mutual friends" reads as 5 in an extraction's numeric `where` (and sort): someone named, no digit before, then "and N other(s)" = N + 1. | domain `actions/extraction/condition-match.ts`, `tests/condition-match.test.ts` | confirm-requests Stage 1 (Jonas Weber's five is written this way; "at least five" would drop him) | condition-match tests 10/10 (esbuild + `node --test`) | validated (unit), live pending |
| F9 | A native node is handed only the inputs an edge brings, so a step after a loop that declares `item` no longer receives the loop's last row through the bare `values.item` key (w4's probe: the click after the loop got row 3). Traces and parameter bindings keep the merged view. | Core `runtime/executor/{node-inputs.ts (collectWiredNodeInputs), node-execution.ts}`, `authoring/tests/draft-routing.test.ts` (post-loop click) | w4's probe | authoring + control-flow + executor vitest 27 files 369/369; the new expectation fails with the call reverted (1 failed) and passes restored; Core build exit 0; extension+domain `tsc` 0 | validated (unit), live pending |
| F10 | **Moving money, deleting, and sending or publishing ask a person every time, even when the instruction asked for them** (supervisor's decision, 2026-09-30, from `docs/working/mvp-today-plan.md:150`). `send_or_publish` is gated again; the gate no longer lets an instructed class through (`gate.ts`); the instruction's reading still travels in the request's `authority.instructed` and the cross-check; a request whose missing class was instructed is no longer malformed (`request.ts`); the request sentence says "A person has to allow that each time, even when the instruction asks for it". **Effect on other lanes:** a task whose instruction sends or publishes (group post, quote request, application) now stops at `permission_required` unless run with `--llm-permit send_or_publish`, and the Lab passes such a stop only at a declared `permissionPoint` (F3). | Core `action-permissions/{destructive.ts, gate.ts, request.ts}`; tests `action-permissions/tests/{destructive, gate, instructed}.test.ts`, `action-permissions/client/tests/index.test.ts`, `tests/permission-defaults.test.ts`, `recovery/annotation/tests/{patches, permissions, recovery-permissions}.test.ts`, `recovery/tests/runtime-exploration-permission.test.ts`; Core docs `architecture/automation-studio.md`, `architecture/automation-studio/llm-flow-bootstrap.md`. Downstream `domain/src/runtime/llm-evidence/permission.ts` (comment); domain tests `plan-resolution/tests/plan-step-permission.test.ts`, `tests/press.test.ts`, `tests/tool-rejection-detail.test.ts`; test-runner `run-evaluation/tests/runner-wiring.test.ts` (F3's pinned call) | supervisor decision (3), runs 4-5 | Core `vitest` over action-permissions, recovery, tests/, conversations, executor, llm/harness(-options), node-tools, parking, flow-bootstrap, panel-capabilities, service/flow-bootstrap-commands: 131 files 1871/1872, the one failure a 15.7 s load timeout that passes alone 7/7; Core web conversation tests 25/25; `tsc` fluxiq 0, apps/web 0; Core audit passed. Domain 939/939; extension 1327/1327; test-runner 1644/1649 then runner-wiring + built-flow + permission-point + lane 51/52 -- the 5 failures are none of this lane's (runner-wiring #11/#43 redaction pin is t174's recorded stale pin; extension-control-page, clone-cache, demo-workspace) | validated (unit), live pending |
| F11 | (a) The dry run no longer blocks on steps of a repeating span: they run once per row (or while a check holds), and the row the build acted on is already done, so replaying them unconditionally failed or was unreproducible every time. (b) The `repeat` wording tells the model to rerun the listing with a `where` that keeps only the items to act on first, and to drop other steps that do the same act to a single row. | Core `flow-draft/{routing.ts (conditional set + repeatedSpan), amendment.ts}`, `flow-draft/tests/routing.test.ts` (new case) | run 6 (9 of 10 completions refused by the dry run; no `where`; leftover single Confirms) | `vitest` flow-draft, llm/evidence-loop, flow-bootstrap/authoring, evidence-loop-provider: 26 files 219/219; Core build 0 | validated (unit), live in run 7 |
| F12 | A list extraction reads text a row draws inside an open shadow root (bounded, document order, slots followed, sensitive controls and style tags skipped), and structure detection offers such text as a column. Guildline's request ages ("1 month ago" ... "8 months ago") live only in `gl-time-ago`'s shadow root, so a `where` on age read "" before. A month or more is then `matches: "month|year"` (keeps 33 days and up, drops "4 weeks"). | extension `content/extraction/{field-reader.ts, infer-fields.ts}`, tests `extraction/tests/{field-reader.test.ts (new), fake-shadow-dom.ts (new, test support), infer-fields.test.ts}` | withdraw task prep (w9, `reports/t195-w9-row-age-in-shadow.md`) | w9: 14/14 on its tests, 7 fail against HEAD; lead: extension units 1336/1336, extension `tsc` 0 | validated (unit), live pending |
| F13 | The build progress trace says what each amendment changed (`amend=step:change(over=,through=,to=,check=)`), what a completion claimed (`acts=act>step`), and why an instructed act was missing (`missing=a1:act_needs_repeat`) -- numbers and closed words only. Runs 7 and 8 could not be debugged past "4 refused completions" and "6 refused amendments". | Core `llm/evidence-loop/progress-trace.ts`, `llm/evidence-loop/tests/progress-trace.test.ts` (new case) | runs 7, 8 | progress-trace tests 5/5 | validated (unit), live from run 10 |
| F14 | The per-item wording says to act on one item **the listing kept**, never on one it leaves out. Runs 7 and 8's exploration confirmed Tom Becker (1 mutual friend), the first card, before any filter: a real act on the wrong request during the build. | Core `flow-draft/{entry.ts, amendment.ts}` (full telling 1,051 characters, under 1,100) | run 8 screenshot `080234-r8-t3-0.png` | flow-draft + llm/evidence-loop + evidence-loop-draft-shown: 18 files 143/143 | validated (unit), live from run 10 |
| F15 | A completion refused `act_needs_repeat` is told the exact amendment: `missingActs.repeatWith = {step: <first kept step after the listing>, change: "repeat", over: <nearest earlier kept step whose node lists rows>, through: <claimed>}` -- the whole span, since the act is often the last of several done to a row (Withdraw, then the dialog's confirm) -- a sentence to send it, and that an unfiltered listing is acted on row by row (so rerun it with a `where` first). Nothing is changed for the model. | Core `llm/harness-options/{repeat-suggestion.ts (new), bootstrap-completion.ts (wiring), index.ts}`, test `harness-options/tests/repeat-suggestion.test.ts` (new) | run 9 (eight `act_needs_repeat` refusals, the amendment never written, iteration limit at 52 calls) | harness-options vitest 7 files 99/99, then the span revision 3/3; fluxiq `tsc` 0; Core audit passed | validated (unit), live from run 12 |
| F16 | A `repeat` put on the listing (or any step at or after its `over`) is refused `over_not_before`, whose feedback says repeat goes on the act done to each row and `over` names the earlier listing, with the shape to send; before, it was `no_such_position` ("no position to move a step to"). The Lab's copy of the refusal reasons gains it and the three it had fallen behind on (`did_not_work`, `already_in_flow`, `already_out`), so a step reporting any of them is no longer dropped whole. | Core `flow-draft/amendment.ts`, `llm/draft-amendment-feedback.ts`, `flow-bootstrap/evidence-loop-steps.ts`, `flow-draft/tests/routing.test.ts` (new case); downstream `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts` | run 10 (`15:repeat(over=15)`) | Core flow-draft + llm/tests + llm/evidence-loop + flow-bootstrap/tests: 49 files 520/520; test-runner check pending the next build | validated (Core unit); Lab list build pending |
| F17 | A press that landed and left the page unchanged tells the model, beside `pageChanged: false`, that some pages take the first press after loading only as a wake-up: press the same control once more before anything else, and keep both presses for the Flow. | domain `runtime/llm-evidence/node-run/run.ts` (`unchangedPress`), `tests/press.test.ts` | run 11 (forty decisions of press-unchanged / navigate-away on bigbox's Add to cart, never two presses in a row) | domain 939/939; extension + domain `tsc` 0 | validated (unit), live in run 13 |
| F18 | The dry-run gate replays an unchanged refused draft at most twice (a step can fail once on a page still settling), then judges its refusal again from those replays' outcomes, with the current asked and conditional sets, instead of replaying it for every completion. Run 9 completed one unchanged draft fourteen times; the replays took 401 of its 537 s and the build hit its 540 s deadline (w11). | Core `llm/node-tools/dry-run-gate.ts`, `llm/node-tools/tests/dry-run-gate.test.ts` (new); `llm/tests/draft-amendment-feedback.test.ts` (F16's reason in the exhaustive record) | run 9 (w11's debug) | Core llm + flow-draft + flow-bootstrap vitest 118 files 1504/1504; fluxiq `tsc` 0 | validated (unit), live from run 14 |
| F19 | The click node's catalog description says, in its first 80 characters, "If nothing happens, click it again before leaving the page": some pages ignore the first click after loading, and reloading resets that. F17's hint alone missed bigbox: the "Val" assistant opens on a timer, so the page changed after the swallowed press and `pageChanged` read true. | domain `actions/schemas.ts` (`web.dom.click` description, 156 characters) | runs 13, 14 (`add.paper.towels` / `add.to.cart` / `open.cart` loops) | domain 939/939; extension + domain `tsc` 0 | validated (unit); **live: no effect in run 15** -- the runtime fix is next (planned F20: a press that caused no request, no change in its own section and no navigation is pressed once more; one that sent anything never is) |
| F21 | Both withdrawal tasks declare `permissionPoint: { consequence: "delete", control: "Withdraw" }` (supervisor, 2026-09-30: delete asks every time, even when named; not `--llm-permit delete`, which would hide the ask). The task comment is corrected to the rule. | `apps/scenario-lab/src/scenarios/professional-network/live-tasks.ts`; `apps/scenario-lab/src/scenarios/tests/live-instructions.test.ts`, `packages/test-runner/src/flow-lane/creation/tests/permission-point.test.ts` (pins) | supervisor decisions (2), (3) | test-runner build 0; `permission-point.test.js` 10/10; `live-instructions.test.js` 11/11 | validated (unit) |
| F20 | A press the page ignored (no fetch/XHR/beacon begun, no mutation inside the control's own section within four ancestors, no navigation, no focus move, within 800 ms) is pressed once more, once per command, never on a link; any request, a rate-limit notice or a robot check forbids it. `actual` says so. | extension `content/action-runtime/ignored-press/{ignored-press-watch, page-press-listener, press-again, press-scope, index}.ts` + 4 tests (new), `actions/{click.ts, types.ts}` + `click.test.ts`, `action-runtime/{execute-action.ts, index.ts}`; `docs/architecture/web-capabilities.md` (Click row) | runs 13-15 | lead, 2026-09-30 session 2: extension units 1500/1500, extension + domain `tsc` 0 | validated (unit), live pending |
| R1+R2 | (lane A's) The interference probes include the four viewport corners, inset 6% (bigbox's support-chat card); recovery clears a covering layer on `target_absent` when a clearable layer stands over the page (company-website s2 behind consent). | extension `content/action-runtime/interference/{probe-points.ts (new), presence.ts (new), pressable-way-out.ts (new), overlays.ts, clear.ts, index.ts}`, `recovery/{attempt.ts, fault.ts, index.ts}` + `interference/tests/probe-points.test.ts` (new), `recovery/tests/attempt.test.ts` | lane A runs 20, 22, 26, 31 | w13 (`reports/t195-w13-probes-and-walls.md`): each test fails with its change reverted. Lead: extension units 1500/1500, `tsc` 0 | validated (unit), live pending |
| F22 | The permission sentence a person reads in the panel's chat is plainer: "The Flow would press \"Place order\" (button) each time it runs. That would spend, refund or move money, and that always needs your permission, even when your instruction asks for it." (run 16's UI review). | Core `action-permissions/request.ts`; tests `action-permissions/tests/{destructive, gate}.test.ts`, `recovery/annotation/tests/{patches, recovery-permissions}.test.ts` (the last a stale pin fixed this session); domain `plan-resolution/tests/plan-step-permission.test.ts` | run 16 UI | Core vitest action-permissions + recovery + parking + permission-defaults 43 files 557/557; Core build 0; domain 976/976 | validated (unit) |
| L1 | **The Lab plays the person at a permission ask.** A pending `kind: "permission"` ask on the build's or run's thread is answered `grant` only at the task's declared point on the **named** control (class in `missing`, label equal). It is answered `deny` elsewhere, on a control Core left unnamed, or when no point is declared; the lead added the unnamed rule after `run-munzbfbj` and `run-muo2fscr` asked for money on unnamed controls on the cart and home pages. An `askFirst` task's ask is left for Core's timeout. Answers are recorded as `permissionAnswers`, apart from the hand-offs. The lane then applies a consequential task's Flow only if Core's own record on the Flow's thread shows a grant at the point on the named control (otherwise `permissionPoint: "not_asked"`), unless the operator permitted the class. Finding: a saved Flow replays with no permission gate (Core `adaptation.ts:344-346`); only a repair's exploration is gated, and it parks on the run's thread and is answered by the same rule. | test-runner `person-simulation/{asks, simulation, lab-person, hand-off-record, index, permission-answer (new)}.ts` + `tests/{asks, simulation}.test.ts`; `run-scenario.ts` (the creation-branch `startLabPerson` call); `flow-lane/creation/{lane, permission-point, index}.ts` + `tests/{lane, permission-point}.test.ts`, `tests/fake-creation-core.ts`; `docs/architecture/testing-facility.md` | honest verdict (dev `f2f80024`): every consequential task stopped, so none could pass | w14 (`reports/t195-w14-lab-answers-permission.md`): each new test fails with its change reverted. Lead: test-runner `tsc --noEmit` 0. Private build, `node --test` over person-simulation, flow-lane/creation, lane-rules and run-evaluation: 207/208; the one failure is runner-wiring's redaction pin, t174's recorded stale pin. With the unnamed rule reverted in the compiled JS: 2 failures (lane.test #22, simulation.test #28). Structure audit passed | validated (unit); live unproven |
| P1 | **A person's decline no longer blocks every later ask in the build.** Nobody answering stays as before: one wait, then every gated action is refused with that request. A decline is remembered per question (control name, kind, classes): that question is refused unasked with `declined: true`, and a different control is a new request that is asked. The domain tells the model `consequences_declined` ("the person declined this press; do it another way or finish without it") instead of "a request in front of the person". A declined request rides on the build only while a Flow step needs it (lead's adjustment: otherwise a stalled round ended as that question and a Flow without the control was unapprovable). `core.run_node`'s example now says the press that "opens checkout" is `[]` (1,990 of 2,000 characters). **Compatibility:** `AutomationStudioActionPermissionVerdict` gains optional `declined?: true`; `gate.settle` accepts `declined`/`unanswered` beside `granted`/`refused` (repair path unchanged); new export `automationStudioPermissionAskOutcome`; `gate.request` is the latest refusal's request, not the first raised. | Core `runtime/action-permissions/{gate.ts, declaration.ts, tests/gate.test.ts}`, `runtime/flow-bootstrap/{action-permissions.ts, tests/action-permissions.test.ts (new)}`, `runtime/parking/{permission-ask.ts, index.ts}`, `runtime/llm/node-tools/{run-node.ts, tests/run-node.test.ts}`, `runtime/tests/service-bootstrap/tests/permission-ask.test.ts`, `docs/architecture/automation-studio/llm-flow-bootstrap.md`. Downstream domain `runtime/llm-evidence/{permission.ts, press.ts, tool-rejection.ts, node-run/run.ts (reason line), node-run/replay-answer.ts (lead)}`, tests `llm-evidence/tests/{press, tool-rejection-detail}.test.ts`, `node-run/tests/replay-permission-reason.test.ts (new, lead)` | dev code (Session 3 "Cause P1"); runs 19, 20, 25, 30, 32; top causes 5, 6 | w18 (`reports/t195-w18-declined-ask-not-final.md`); lead re-ran after its adjustment, see Ready to commit | validated (unit); live pending (Lab stopped) |
| P2 | The `flow_draft.repeat_span_unknown` refusal names the reference that is wrong. `over` not in the Flow, `through` not in the Flow, and `through` before the step were one sentence that blamed `through`. Each case now gets its own message: it says the step was dropped or never added and which `amend_draft repeat` to resend, or that a `reorder` comes first. The code is unchanged, so no list of codes moves. This is the remainder of top cause 7; t196 fixed the rerun that orphaned `over`. | Core `runtime/flow-bootstrap/authoring/draft-routing.ts`, `authoring/tests/draft-routing.test.ts` (new case) | run 33 `run-muog33va` (nine refusals that blamed `through`) | Lead: draft-routing 16/16; dev's file restored -> `Tests 1 failed / 15 passed`; Core vitest over flow-bootstrap, flow-draft, llm/evidence-loop, llm/tests, action-permissions, parking, tests/service-bootstrap -> `Test Files 120 passed (120)`, `Tests 1466 passed (1466)`; `tsc-exit=0`; Core build `build-exit=0`; Core audit: only dev's `service.ts` violation | validated (unit); live pending |
| T1 | Core's service-bootstrap permission test stated the pre-F10 rule (an instructed refund goes ahead unasked) and failed on dev. F10 changed that behaviour on purpose, so the test was wrong. It is now two cases: "still asks before moving money with nothing permitted, carrying what the instruction asked for on the request", and "keeps what the instruction asked for with the proposal and the Flow once the person permits the money". | Core `runtime/tests/service-bootstrap/tests/permission.test.ts` | supervisor, 2026-09-30 | w16 (`reports/t195-w16-permission-test.md`). Lead: `vitest run` over permission.test.ts and recovery/annotation, 10 files 122/122 | validated |

| F23 | The created-Flow judge pairs each expected step with the latest-run dataset whose records carry every non-optional expected key, then the rest in first-run order (was: the first extraction that ran, so confirm-requests' pre-act listing passed falsely and pickup's cart read failed a right Flow). | test-runner `flow-lane/creation/judgement.ts`, `creation/tests/judgement.test.ts` | w19a V1, w19b #3 | w20a: new cases fail reverted (4 of 8). Lead: test-runner build 0, `judgement.test.js` 8/8 | validated (unit) |
| F24 | The dry run and remembered site state: a pressed step whose target is gone on its own page answers `core.replay.remembered` (does not block, stays in the Flow); a step missing on another page right after a step that was not done again is re-anchored once to its own `replay.from` (`core.replay.reanchored`); after a verified `move_money`/`delete`/`send_or_publish` step, every later non-replayed step is excused; the dry-run instruction never advises dropping a remembered step. Not done: making a layer-pressed step `optional` (no host records the target's layer yet). | Core `flow-draft/{site-memory.ts (new), dry-run.ts, verify-only.ts, index.ts}`, `llm/node-tools/{replay.ts, replay-draft.ts}` + tests `flow-draft/tests/site-memory.test.ts` (new), `llm/node-tools/tests/{replay-draft.test.ts (new), dry-run-gate.test.ts}`; domain `node-run/{missing-target.ts (new), replay.ts, replay-answer.ts, verify.ts}`, `node-run/tests/replay-remembered.test.ts` (new) | w19a B1, w19b #1-#2, w19d C4, w19e risk 2 | w20b: 14/14 new Core cases fail reverted. Lead: see Ready to commit | validated (unit) |
| F25 | A `repeat` builds when kept steps sit between the listing and the act (they run once, before the loop); the refusal no longer advises "repeat with no over". Graph-run test of F7's waited retry: pass 4 retried once on its own row after exactly 11,500 ms. | Core `flow-bootstrap/authoring/draft-routing.ts`, `authoring/tests/repeat-loop.test.ts` (new) | w19a B2, R3 | w20c: 5 of 6 fail reverted (F7 needs no change) | validated (unit) |
| F26 | Instructed acts: `span_stops_short` (a repeat that ends before an unclaimed lasting confirmation; F15's suggestion repeats through it); `act_consequence_undeclared` (withdraw/delete/remove -> delete, order/buy/purchase/pay -> move_money, send/post/publish/submit/apply -> send_or_publish must be declared on the claimed span); a check-out after an order is not a second act. Sweep of the ten scenarios: 7 tasks changed, each matching its own `permissionPoint`. **Takes `check.ts` from t174's claim.** | Core `flow-bootstrap/instructed-acts/{check, checklist, contracts, index, instruction-acts}.ts`, `span.ts` + `act-consequence.ts` (new), tests `{check, instruction-acts}.test.ts`; `unfinished-build/not-done.ts`; `llm/harness-options/repeat-suggestion.ts` + test; `flow-draft/amendment.ts` (`through` wording) | w19c B2, R2; w19b #5 | w20d: 17 cases fail reverted | validated (unit) |
| F27 | The row gate reads what a row draws: `rowContents` walks open shadow roots (Guildline's age); a candidate in no record is checked against its own row (the child of the first ancestor holding a second alike control), so the soap's "Save for later" is told from the towels'. | extension `content/identity/record.ts`, `identity/tests/record.test.ts` | w19c B1, w19b #9 | w20e: 3 new cases fail reverted | validated (unit) |
| F28 | A hidden "Show more" (after a 1 s grace) ends the list as `control_absent`, never clicked and never "truncated"; F20's press scope treats `main` like `body`, so bigbox's load-time changes in `<main>` no longer hide a swallowed Add to cart. | extension `content/extraction/pagination.ts` + `tests/pagination.test.ts`; `action-runtime/ignored-press/press-scope.ts` + `tests/{press-scope.test.ts, swallowed-press.test.ts (new)}` | w19c R1, w19b #4 | w20f: 6 new cases fail at HEAD | validated (unit) |
| F29 | The gate keeps the names it was shown: shown strings deduplicated, oldest evicted past 4,000,000 characters (Place order shown late is still named); a declined press's refusal carries `instead` ("declare only what this press itself does; [] for a press that only opens a page or a form") from `press.ts`. **Needs t223:** `node-run/run.ts` must pass it (`instead: permission.declined ? WEB_DECLINED_PRESS_INSTEAD : undefined`), and `tool-rejection.ts`'s `consequences_declined` line. | Core `action-permissions/gate.ts` + `tests/gate.test.ts`; domain `llm-evidence/press.ts` + `tests/press.test.ts` | w19b #6, #7 | w20g: new cases fail reverted | validated (unit); `run_node` path pending t223 |

Owned elsewhere (recorded by another lane first, taken at the next round):
- Core ignores the Flow's configured call limit: **t193** (its cause B).
- The instructed-acts check accepts a Flow that lacks the act (t174 run 13 cause B): **t174**. This lane adds, for
  the same file `runtime/flow-bootstrap/instructed-acts/check.ts:74-87`, that one step satisfies a plural act
  ("confirm everyone with five or more") and that an `optional` step satisfies an act (run 2). Not fixed here, to
  avoid two lanes editing `check.ts`; t174 please take both, or tell the supervisor to hand it to t195.
- `resultReauthor` refused `not_a_wrong_answer` because `result-verification/verify.ts:121-122` settles on
  `required_values_missing` first (run 2): the judge lane, **t194**, to confirm ownership.
- The panel's "Done" mid-build and "Add an AI model key: To do" during a live build, and no on-page overlay in
  any screenshot of runs 2-5: **t191** (UI evidence: scratchpad `t195-shots/*-r2-*.png` .. `*-r5-*.png`).

**Ready to commit (session 4, F23-F29).** Exactly the dirty files of both trees (`git status` on each, 2026-10-01
after the round-2 workers): Core 20 modified + 6 new under `packages/fluxiq/src/programs/automation-studio/runtime/`
(F24-F26, F29); downstream 13 modified + 3 new source/test files (F23, F24, F27-F29), this report, and reports
`t195-w19{a..e}-audit-*.md`, `t195-w20{a..g}-*.md`. Lead's own runs after the last edit:
- Core `npx vitest run` over `runtime/{action-permissions, flow-draft, llm/node-tools, flow-bootstrap/authoring,
  flow-bootstrap/instructed-acts, flow-bootstrap/unfinished-build, llm/harness-options}` -> `Test Files 42 passed (42)`,
  `Tests 557 passed (557)`.
- Core `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq, heavy.sh) -> `core-tsc-exit=0`.
- Core `node scripts/structure-audit.mjs` -> `passed (206 warning(s), 353 baselined)`.
- Downstream `pnpm --filter ... domain check` -> exit 0; `... extension check` -> exit 0; `... test-runner check` (rebuilds
  the stale domain dist; the TS2305 a worker saw on `screenWebBuildRefusalDiagnostic` was that dist) -> exit 0.
- Domain tests `node-run/tests` + `llm-evidence/tests/press.test.ts` (scratchpad `run-dir-tests.mjs`) -> 103/103.
- Extension tests `identity/tests`, `extraction/tests/{pagination,load-retry}.test.ts`, `ignored-press/tests`,
  `action-runtime/tests` -> 240/240.
- test-runner build -> exit 0; `node --test dist/flow-lane/creation/tests/judgement.test.js` -> `# tests 8 # pass 8`.
- Downstream `node scripts/structure-audit.mjs` -> `passed (140 warning(s), 118 baselined)`.
- Not re-run by the lead: the workers' revert checks (each reported its new cases failing with the source reverted).

**After commit (F23-F29: Core `43d4ec30`, downstream `fb20c051`) and the supervisor's dev merge.**
- Core merge conflicts resolved and staged (not committed), so both behaviours hold. Lane B's T2 (`sometimes-present.ts`)
  makes a blocking `unreproducible` step optional; F24's `remembered` never blocks.
  - `flow-draft/dry-run.ts`: the outcome keeps both `reanchored?` and `madeOptional?`. The instruction keeps F24's sentence
    and lane B's, which now reads "An unreproducible step that does none of the acts ...".
  - `flow-draft/index.ts`: both barrels are exported.
  - `llm/node-tools/tests/dry-run-gate.test.ts`: both describe blocks are kept.
  - Validation: `npx vitest run runtime/flow-draft runtime/llm/node-tools` -> `Test Files 14 passed (14)`, `Tests 125 passed
    (125)`; Core `tsc --noEmit` -> `core-tsc-exit=0`; Core audit `passed (209 warning(s), 349 baselined)`.
- **Ready to commit (downstream), F29's last part.** Now that t223 has landed, `domain/src/runtime/llm-evidence/node-run/run.ts`
  imports `WEB_DECLINED_PRESS_INSTEAD` from `../press` and sets `instead: permission.declined ? WEB_DECLINED_PRESS_INSTEAD
  : undefined` on the `run_node` permission refusal. `tests/tool-rejection-detail.test.ts`'s declined case now expects
  the `instead`.
  - Validation: domain check -> `domain-check-exit=0`; domain tests `tool-rejection-detail`, `press`, `node-run/tests` ->
    116/116; downstream audit `passed (145 warning(s), 118 baselined)`.

**Live, 2026-10-01 ~20:50Z (Lab stop lifted for lane D; trees at dev: downstream `97efda59`, Core `3a52a587`).**
- Core libraries were rebuilt first (`heavy.sh`: contracts reused, fluxiq rebuilt in 54 s, client-gateway-websocket
  reused) -> `build-exit=0`.
- **Run 35 (killed in the prelude; no run id; $0).** confirm-requests was launched 20:52:39Z, reason "first run after
  F23-F29, the t223 compact view and lane B's B1". The guard admitted it (`sha256:9307fb9c...`). The prelude rebuilt
  scenario-lab, the domain host, the domain and the extension; then the process exited 1 with no failure line. Every
  `run-lab.mjs` exit path writes one, and there was no ledger `start`, so the process was killed from outside. That
  coincides with the user's new rule, relayed by the coordinator: a live test must start the build by typing the
  instruction into the real extension chat, never through the direct `generate-flow-bootstrap-adaptation` request.
  t227 is building that launcher. No new direct-API run is launched until it is merged. Log: scratchpad
  `runs/20261001T205239Z-social-network-feed-confirm-requests.log`. The coordinator later confirmed the supervisor
  killed it, because DeepSeek was in an outage (requests accepted, never answered; every decide timed out at 45 s).
  Nothing was left to debug. No Lab until the supervisor says the provider answers again.

**Ready to commit (session 4b, F30-F32, downstream only; Core is clean).** These fixes clear the blockers that stopped
apply-quillmark and moon-jar.
- **F30 (w20h), apply C1 + C2.**
  - LLM-built target and extract nodes inside a frame carry `browserFrameUrlPath` (the pathname of the frame URL the
    element was shown in).
  - The extension waits up to 5 s for a frame at that path before `TARGET_NOT_FOUND`.
  - Detection inside a frame expects the frame's origin, not the top page's.
  - Files: domain `llm-evidence/plan-resolution/{target-packets, resolve-plan-node, extraction/slot}.ts` + new
    `tests/frame-path.test.ts`; `llm-evidence/structure/{handles, detect}.ts` + `tests/detect.test.ts`; extension
    `src/runtime/{frame-address, action-runner}.ts` + `tests/frame-address.test.ts`.
- **F31 (w20i + w20j), apply C3 + moon-jar cause 1: a one-record read.**
  - A `<dl>` of dt/dd pairs is a 1-item proposal labelled by its dt.
  - A lone record (the reply card) is answered beside the run found outward (never instead of it), or alone when there
    is none.
  - The domain issues it a second extraction handle and a packet line `record: {handle, itemCount: 1, fields, note}`.
  - The extract_list sentence says "a repeating list, table or one record".
  - `docs/architecture/page-evidence.md` gains "Detecting A List, Or One Record" (also F30's frame path and wait).
  - Files: extension `content/extraction/{infer-list, detect-structure}.ts` and new `content/extraction/single-record/`
    (`key-value-record`, `lone-record-level`, `lone-record`, `index` + tests); domain
    `extraction/structure-detection.ts` + test; `llm-evidence/structure/{packet.ts, tests/badge-column.test.ts}` and new
    `structure/tests/{record-detections.ts, record.test.ts}`, `plan-resolution/tests/one-record.test.ts`;
    `output-nodes/extract-list/catalog-text.ts` + test.
  - Not decided: a one-item handle does not force `maxItems: 1` (a second reply card would read 2 rows).
- **F32 (w20k + lead), apply C5: a gate-level `disabled` is waited out.**
  - The four actionability gates (click, type, select, check's first) mark the refusal with Core's existing
    `effect: "unacted"`; a new key would make Core drop the record.
  - Recovery absorbs it as the new fault `disabled_target`. The lead put it on the page's ladder (`budget.ts`), 3,750 ms,
    which outlasts the 3 s "Please wait".
  - w20k measured the veto: the recorded "I'm a person" scores 0.104 against "Please wait N" and is refused as
    `target_not_found`, which already waits. The new path covers a recording the veto cannot check.
  - Files: extension `content/actions/{click, type, select, check}.ts` + new `tests/gate-refusal.test.ts`;
    `content/action-runtime/{results.ts, recovery/fault.ts, recovery/budget.ts}` + `recovery/tests/{attempt,
    budget}.test.ts`.
- **Lead's validation, after the last edit:**
  - Domain tests `structure/tests`, `plan-resolution/tests`, `output-nodes/extract-list/tests` and `extraction/tests` ->
    129/129.
  - Extension tests `content/extraction/tests`, `content/extraction/single-record/tests`, `runtime/tests`,
    `action-runtime/recovery/tests` and `actions/tests/gate-refusal.test.ts` -> 478/478.
  - Budget pin: fails with the line reverted (`pass 8, fail 1`), passes restored (9/9).
  - Domain check -> `domain-check-exit=0`. Structure audit -> `passed (146 warning(s), 118 baselined)`.
  - Extension check -> exit 1, only 3 TS2610 errors in `src/panel/**/tests`. Those files are unchanged here; the errors
    come from dev's `cfecc984` (fake-dom `ownerDocument`), and dev has since edited those files.
- **Dev state at this tree's merge point, not this lane's:**
  - `action-runtime/tests/store-chooser-replay.test.ts` fails 15/15 on this tree but passes 15/15 on dev `8b323fb7`, which
    changed that test after the merge.
  - `click`, `execute` and `page-identity` tests cannot load in isolation (`window is not defined`); the same happens on
    dev.
  Both should clear with the next dev merge.

**Ready to commit (session 4c, F33-F34, downstream only), after F30-F32 merged (`f163c374`) and dev merged into this
tree (`36b0099e`).**
- **F33. A one-record handle reads one row** (supervisor's decision on F31's open question).
  - `WebLlmExtractionBinding` gains `oneRecord?: true` (`structure/handles.ts`, copied in `copyBinding`).
  - `structure/packet.ts` sets it on the record beside a run, and on a primary proposal of one item with no pagination,
    which by construction is only the `<dl>` receipt or a lone record.
  - `plan-resolution/extraction/slot.ts` writes `maxItems: 1` after the plan's own bound, so it always wins.
  - Tests:
    - `plan-resolution/tests/one-record.test.ts`: the record handle resolves with `maxItems: 1` and no bound written; the
      run beside it has none; a new case shows `{}`, `{maxItems: 5}` and `{maxItems: 1}` all resolve to 1.
    - `structure/tests/record.test.ts` pins `oneRecord: true` on the record binding and its absence on the run.
  - `docs/architecture/page-evidence.md` says so.
  - Revert check: slot line removed -> `one-record.test` pass 1, fail 2; restored -> pass.
- **F34. Every action test loads on its own.** `content/frame-geometry.ts` read `window` while it loaded, to seed the
  top frame's offset. So `actions/tests/{click, execute, page-identity}.test.ts` passed only after another test file had
  left a `window` on the global (lane A hit `click.test.ts` too).
  - Fix: the cache starts `undefined`. The top frame's offset is already computed per call in
    `currentFrameViewportOffset`, and a child frame's was already `undefined` until its parent answered, so behaviour is
    unchanged.
  - New `content/tests/frame-geometry.test.ts` loads the module with no `window` at all.
  - Revert check: the old seed restored -> `frame-geometry`, `click`, `execute` and `page-identity` each `pass 0, fail 1`
    alone. Restored -> click 30/30, execute 7/7, page-identity 6/6, each run alone.
- **Validation, after the last edit:**
  - Domain `structure/tests` + `plan-resolution/tests` -> 68/68.
  - Extension `content/tests/frame-geometry.test.ts` + `content/actions/tests` + `content/action-runtime/tests` -> 195/195,
    each file in its own process; this includes `store-chooser-replay`, now passing after the dev merge.
  - Domain check -> `domain-check-exit=0`. Extension check -> `ext-check-exit=0` (the panel TS2610 errors are gone with
    dev). Structure audit -> `passed (150 warning(s), 118 baselined)`.
- **To make the rule mechanical (supervisor's call; shared runner, and needs one full sweep, which I am not allowed to
  run):** `apps/extension/scripts/test-extension.mjs` and `domain/scripts/test-domain.mjs` import every test bundle into
  ONE process. That is why load-order dependence stayed hidden. Running each bundle in its own process (`node --test`
  over the bundle list) would fail any test that cannot run alone.

**Round 3 (from run 36's debug, w21), dispatched together, each worker owning only its files.**

| Worker | Fixes | Owns |
| --- | --- | --- |
| w22a | The check tries every kept step naming an act, as the checklist does; a read claimed for an act gets "step S only reads"; positions instead of ids; `not-done.ts` tells the true story | Core `flow-bootstrap/instructed-acts/*`, `unfinished-build/not-done.ts` |
| w22b | No act on a read (`act_on_a_read`) and no act named twice (`act_already_named`); `keep` never clears a `repeat`; the draft shows each step's act; reruns carry acts only onto a mutating rerun; the stall note says "run it" only when no step names the act; "never act on the items your listing left out" | Core `flow-draft/{amendment, entry}.ts`, `llm/evidence-loop/rerun-replacement.ts`, `llm/evidence-loop.ts` (the act-recording lines only), `llm/evidence-progress/stall-redirect.ts`; test-runner `publishable-step-value.ts` |
| w22c | The decision budget counts average, not worst-case, cost per remaining decision | Core `llm/loop-budget.ts` |
| w22d | A text filter that drops a row whose column reads as a number says "use atLeast" | domain `node-run/rejected-rows.ts` |
| w22e | A detected list whose own section links to more ("See all") says so in the packet | extension `content/extraction/` (detection), domain `extraction/structure-detection.ts`, `llm-evidence/structure/packet.ts` |
| w22f | `click.spec.ts:132`: a control that stays disabled fails promptly; one whose state is changing (countdown text, `aria-busy`) is waited out | extension `content/action-runtime/{results.ts, recovery/*}`, `content/actions/*` |

For lane B, not taken here: reruns reset the no-progress guard (w21 cause 6). A press for a plural act that already has a
kept press should be refused before it runs (`evidence-loop.ts` tool path). For t227: a failed chat build's spend reads $0
in the Lab ledger (`chat/build-from-chat.ts:165-170`). For t191: the UI defects in run 36's row.

**Ready to commit (session 4d, F35-F40).** Exactly the dirty files of both trees after round 3. Reports
`t195-w22{a..f}-*.md`; debug `debugs/run-muq3uozx-3153564b.md` and `reports/t195-w21-debug-run36.md`.
- **F35 (w22a).** The completion check and the checklist share one loop (`instructed-acts/standing.ts`, new; the per-step
  rule moves to `step-fault.ts`, new). It tries every kept step naming an act, draft claims before result claims. When
  only reads name an act, the refusal says "step S only reads". Feedback names positions, not ids. `not-done.ts` no
  longer says "changed nothing" or "without failing" when acts are left.
- **F36 (w22b + lead).**
  - `amendment.ts` refuses `act_on_a_read` and `act_already_named`; `keep` never clears a `repeat`.
  - `entry.ts` shows each step's act and adds "never act yourself on the items your listing left out".
  - `rerun-replacement.ts` carries acts only onto a mutating rerun. `evidence-loop.ts:212` records no act on a read.
  - The stall note names the step that already holds the act.
  - The Lab's copy of the refusal reasons gains the two new reasons and the missing `changes_nothing`.
  - Lead: the two reasons in `flow-bootstrap/evidence-loop-steps.ts`, and `acts` in `evidence-loop.ts` `facts()`, so
    the stall note gets the checklist.
- **F37 (w22c).** `llm/loop-budget.ts`: decisions left = `1 + floor((costLeft - worstCase) / average)`. Run 36's case
  gives 11, not 2.
- **F38 (w22d + lead).** A `matches`/`contains` filter that drops rows whose column reads as a number says so and
  suggests `atLeast`/`atMost` (`node-run/numeric-text-filter.ts`, new; `rejected-rows.ts`). Lead: `node-run/run.ts:414`
  passes `ran`.
- **F39 (w22e).** A detected run whose own section holds a closed "See all / View all / Show all / See more" link
  outside its items carries `continues` (label, path). The packet says the list may be partial. Files: extension
  `content/extraction/section-link/` (new) and `detect-structure.ts`; domain `extraction/structure-detection.ts`,
  `structure/packet.ts`.
- **F40 (w22f).** A gate-level `disabled` is waited out only while the control is busy or its text fingerprint changes
  (a countdown). A static disabled control gets one 1,100 ms look, then fails with the verb's own failure.
  `click.spec.ts:132` passes with the spec unchanged. Files: `action-runtime/{results.ts, recovery/{attempt, budget,
  fault, index, refused-control (new)}.ts}` + tests.
- **Lead's validation, after the last edit:**
  - Core `npx vitest run` over `flow-bootstrap/{instructed-acts, unfinished-build, tests}`, `flow-draft`,
    `llm/{evidence-loop, evidence-progress, harness-options}` and `llm/tests/{loop-budget, draft-amendment-feedback}` ->
    `Test Files 66 passed (66)`, `Tests 688 passed (688)`.
  - Core `tsc --noEmit` -> `core-tsc-exit=0`. Core libraries rebuilt -> `build-exit=0`.
  - Domain tests `node-run/tests`, `structure/tests` and `extraction/tests` -> 154/154.
  - Extension tests `extraction/tests`, `section-link/tests`, `single-record/tests`, `recovery/tests` and `actions/tests`
    -> 401/401.
  - Extension check -> 0. test-runner check -> 0. Both structure audits passed.
  - `test:content -- click.spec.ts` -> 16 passed, 1 failed. `:132` passes. `:119` ("a recording session records none of
    it") fails because lane A's rule (t174-w34, `6aa5fb35`) fails a twice-ignored press on a plain paragraph as
    `output_not_observed`. That is lane A's to settle.
  - Domain check -> exit 2 on ONE error, in dev's `node-run/tests/covered-press.test.ts:51` (`kind: undefined` in a
    `JsonObject`, from `46cf82c2`). The file is unchanged here; the error belongs to its lane.
- **User rule (2026-10-01): no new refusal of the model's actions; prefer information.** The lead converted F36's
  `act_on_a_read` from a refusal into information. The amendment is applied, the act is not recorded on the read (it
  cannot be done there), and the feedback says "the rest of your change to it was made, but the act was not recorded on
  it" (`flow-draft/amendment.ts`, `llm/draft-amendment-feedback.ts`, test `flow-draft/tests/amendment.test.ts`).
  - `act_already_named` stays: it relabels an existing no-op answer (`already_in_flow`), and nothing is refused that
    would otherwise have changed.
  - Validation: Core vitest `flow-draft`, `llm/evidence-loop`, `llm/tests/draft-amendment-feedback.test.ts` and
    `flow-bootstrap/tests` -> `Test Files 43 passed (43)`, `Tests 331 passed (331)`; Core `tsc` -> exit 0.
  - **For the supervisor and t228:** F26's completion-check reasons `span_stops_short` and `act_consequence_undeclared`
    (merged in round 5) refuse a completion. The second protects the permission ask (a delete declared `modify_existing`
    is never asked); the first is a correctness check. Convert them to checklist information if t228's rule covers
    completion checks.

**Round 4 (after F35-F40 merged: Core `43085660`, downstream `45c054c5`). Live runs PAUSED for t229 (the page view
hides icon-only buttons and placeholder-only search boxes).**
- **w24a: verify reads a target hidden in a closed panel.** Done; the lead has not validated it yet.
  - The check never found the shadow-root store chooser at all: `web.dom.assert` looked only in the light document.
    Now the assert looks inside the target's recorded shadow root.
  - A target hidden by a closed container reports `enclosed:`, and `verify.ts` answers `core.replay.failed` /
    `found: "hidden"`. A target hidden itself, or gone, on its own page stays `present`.
  - Limit: run 40's own state (Millbrook already chosen, its card shows "Your store" instead of the button) still reads
    `present`, which is right: the effect is in place. The missing chip press shows only on a fresh site. The test runs
    on remembered state (A2-5, open), so it cannot see that.
- **w24c: run 37's debug and fix.** Done; the lead has not validated it yet. Debug: `debugs/run-muq5v4zg-39182b58.md`.
  - Cause: the per-item telling never said which step gets the repeat, so the model put it on the listing.
  - The `over_not_before` refusal named no step. The schema said "first rerun the listing with a where" with no
    condition, so the model resent an identical rerun three times and RG ended the round.
  - Fixed in `flow-draft/{amendment, entry}.ts` and `llm/draft-amendment-feedback.ts`: positions, the exact repeat to
    send, and "a listing that already keeps the right rows is not run again".
  - For lane B: RG's count resets when an iteration is skipped. The repair's first look was refused
    `not_at_start_location`. `address_not_shown` refused a correct URL.
- **w24b: an act claim is bound to its object, and a quantity to a quantity step.** Done as refusals; **superseded**
  by the structural change below, so its reasons become checklist information.
- **Structural change (coordinator, replaces w24b's refusals; top priority).**
  - The instructed-act completion check stops REFUSING. A completion the model declares ready goes to phase 2: the
    test from the start, then a judge of the test's actual results against the instruction.
  - A wrong result goes to repair with the judge's reasons.
  - The checklist (including w24b's object and quantity findings and `span_stops_short`) is information for the model
    and context for the judge.
  - `act_consequence_undeclared` stays, because it is what makes a delete get asked.
  - A re-authored Flow is judged on its own test, never on claims carried from the earlier Flow (lane A run 41).
  - Cases to pin: lane B's `choice_is_the_act_step` ×6; run 36's 24 refusals with the checklist at done; lane A's
    napkins-on-towels claim, which the judge must catch from the result.
  - Step 1: w25 (read-only) maps the completion -> test -> judge -> repair path and partitions the change by file.
    Step 2: implementation workers.

**Ready to commit (session 4e, F41-F43).** Exactly the dirty files of both trees: downstream 6 modified + 2 new (F41);
Core 58 paths (F42, F43). Reports `t195-w24{a,b,c}-*.md`, `t195-w25-completion-judge-design.md`, `t195-w26{a..d}-*.md`,
`t195-w27-service-judge-tests.md`; debug `debugs/run-muq5v4zg-39182b58.md`.
- **F41 (w24a): the build's test no longer passes a target hidden in a closed panel.**
  - `web.dom.assert` looks the selector up inside the target's recorded shadow root (the bigbox store chooser lives in
    one).
  - A failed `visible` claim says `enclosed:` when a closed container hides it. `verify.ts` (`hidden-target.ts`, new)
    then answers `core.replay.failed` / `hidden`.
  - A target hidden itself, or gone, on its own page stays `present`. A target replaced because its effect is in place
    (Millbrook's card showing "Your store") stays `present` too, which is right; the missing chip press shows only on a
    fresh site (A2-5).
  - Files: extension `content/action-runtime/assertion-evaluation.ts`, `content/actions/assert.ts` + tests; domain
    `node-run/{verify, missing-target, hidden-target (new)}.ts` + `tests/replay-verify.test.ts`.
- **F42 (w24c): run 37's cause.**
  - The per-item telling and the schema name which step gets the repeat, and give the exact amendment to send.
  - `over_not_before` carries the step the model named. A refusal about a listing carries a `next` with positions.
  - "A listing that already keeps the right rows is not run again."
  - Files: Core `flow-draft/{amendment, entry}.ts`, `llm/draft-amendment-feedback.ts` + tests.
- **F43 (w25 design; w26a-d; w27; lead integration): the completion check is information; the test and the judge
  decide.**
  - W1 (`llm/node-tools/{replay-draft, dry-run-gate}.ts`, `loop-configuration.ts`, one line of `evidence-loop.ts`): the
    test keeps each step's observation and reports it on every pass.
  - W2 (`instructed-acts/*`, new `permission.ts`, `harness-options/{bootstrap-completion, draft-acts}.ts`): the
    completion refuses only `act_consequence_undeclared`. Everything else, including w24b's object and quantity
    findings and the repeat suggestion, is checklist information.
  - W3 (`unfinished-build/*`, `llm/evidence-loop/resume.ts`): a finished round is judged.
    - `yes` proposes.
    - `no` repairs with the judge's expected/observed/advice; "not doable" only when a repair hands back the same Flow.
    - `unknown`/`not_judged` proposes unverified, except a re-author with untested carried steps (run 41), which
      repairs.
  - W4 (new `result-verification/build-test/`, `contracts.ts`, `llm/diagnosis-instructions.ts`,
    `llm/harness/request-evidence-check.ts`): `verifyAutomationStudioRunResult` over a `buildTest` account. That is
    each step's own words, its claims as claims, the test's outcome and observation, and exploration's evidence for
    withheld steps.
  - w27: the service-bootstrap tests account for the judge's request. New `judged-build.test.ts` covers:
    - a build reaches the judge with the test's observations;
    - `no` repairs with the reasons;
    - `yes` after repair proposes;
    - no cost proposes "Flow not verified";
    - run 40's napkins-on-towels reaches the judge.
  - Lead:
    - new `service/flow-bootstrap-commands/build-judge.ts` holds the wiring, so `service.ts` keeps its 4,491 lines;
    - `service.ts` passes `observeTest`, `judge`, the unverified chat note, and `registry`/`resolution` for the
      checklist's repeat suggestion;
    - `incomplete-draft/parse.ts` accepts `judged_wrong`;
    - `draft-from-flow.ts` exports `automationStudioFlowDraftStepCarried`, which the summary uses;
    - the judge gives each of verify's two calls half of what is left, so it never overspends;
    - `EXPLORE_AGAIN_INSTRUCTION` says complete when the Flow does what is asked;
    - the `checklist.ts` comment is updated.
- **Lead's validation, after the last edit:**
  - Core `npx vitest run` over `flow-bootstrap/{instructed-acts, unfinished-build, incomplete-draft, tests}`,
    `llm/{harness-options, node-tools, evidence-loop, evidence-progress, harness, tests}`, `flow-draft`,
    `result-verification`, `tests/service-bootstrap` and `service/flow-bootstrap-commands` -> `Test Files 154 passed
    (154)`, `Tests 1540 passed (1540)`.
  - Core `tsc --noEmit` -> no errors. Core structure audit -> `passed (213 warning(s), 349 baselined)`. Core libraries
    rebuilt -> `build-exit=0`.
  - Downstream domain check -> 0; extension check -> 0 (dev's panel and `covered-press` errors are gone).
  - Domain `node-run/tests` -> 107/107. Extension `content/action-runtime/tests` + `content/actions/tests` -> 204/204.
  - `test:content -- check-assert.spec.ts` -> 14 passed. Downstream audit -> passed.
- **For the supervisor:**
  - Answerability and start-location still refuse completions; they were outside this change.
  - A build audit's `providerCallCount` leaves out the judge's calls, though `accounting` includes them
    (`service/flow-bootstrap-commands/evidence-trace.ts:232`).
  - A run-41-shaped Flow with untested carried steps and no budget left ends at the budget with the draft kept, not
    proposed.

**Next.**
- For t223 (its files): `tool-rejection.ts` rewords `consequences_declined`. F29's `run.ts` line is done. The frame URL is
  still reachable (w20h checked).
- Follow-ups outside lane files: `llm/evidence-loop/progress-trace.ts:87`, `activity/wording/tool-call.ts` and
  `activity/observer.ts:38` do not know F24's `dryrun.N.P.reanchor`/`.again` call ids or the `remembered` code (trace and
  chat wording); F24's `madeOptional` needs a press-time layer flag from the extension (`click.ts`/`results.ts`);
  F26's verb list lacks "place" and "book" (place-bid, book-service).
- Live order once the tree has t223: confirm-requests, then pickup-order (both have every blocker above fixed at unit
  level), then withdraw-stale-requests; apply-quillmark and moon-jar after w20h-w20k.

**Ready to commit (session 3, P1).** Exactly the dirty files of both trees, minus this report's other edits. Lead's own runs,
after the lead's gate adjustment:
- Core (`fxwork/t195/!FluxIQ`, `task/t195-live-control-flow`): the P1 files above.
  - `npx vitest run` (packages/fluxiq) over `runtime/{action-permissions, parking, flow-bootstrap, recovery,
    tests/service-bootstrap, tests/permission-defaults.test.ts, llm/node-tools}` -> `Test Files 118 passed (118)`,
    `Tests 1539 passed (1539)`.
  - `npx tsc --noEmit -p tsconfig.json` -> `tsc-exit=0`.
  - Core 3-package build -> all `Done`, exit 0.
  - Revert check: the lead's two `gate.ts` lines undone -> `Tests 2 failed | 23 passed`; restored byte-identical.
  - `node scripts/structure-audit.mjs` -> 1 violation, `runtime/service.ts` 4,506 lines against a 4,505 baseline. That
    file is unchanged here and is 4,506 lines at HEAD `e5b8f015`, so it is dev's, not this lane's.
- Downstream (`fxwork/t195/!FluxIQWebExtension`): the P1 domain files above.
  - `heavy.sh ... pnpm --filter @fluxiq-web-extension/domain test` -> `# tests 1066 # pass 1066 # fail 0`.
  - `... domain check` -> exit 0, 0 `error TS`.
  - `node scripts/structure-audit.mjs` -> `passed (135 warning(s), 119 baselined)`.
- Docs: this report and `reports/t195-w18-declined-ask-not-final.md`.

**Ready to commit (session 3, P2), Core:** `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/
{draft-routing.ts, tests/draft-routing.test.ts}`. Validation is in P2's fix-log row: Core vitest 120 files, 1466/1466; tsc 0;
build 0. Together with P1, these are all of the dirty files in Core.

**Session 2's list below is already on dev** (checked 2026-10-01: L1 `068613f4`, F20 in `c22646d0`, T1 merged with t196 in
`957a0226`); kept as the record, not to be taken again.

**Ready to commit (session 2).** Lead-validated this session. The Core `request.ts` change and the extension F20/R1/R2 changes are already
in the WIP commits `b6bf5eb0` and `c22646d0`; their validation is below.

- Ready to commit (Core, `task/t195-live-control-flow`): `packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/recovery-permissions.test.ts` (F22's stale pin) and `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/permission.test.ts` (T1). This also validates the WIP's F22 (`action-permissions/request.ts` and its test pins). Validation:
  - `npx vitest run src/programs/automation-studio/runtime/action-permissions src/programs/automation-studio/runtime/recovery src/programs/automation-studio/runtime/parking src/programs/automation-studio/runtime/tests/permission-defaults.test.ts` -> 43 files, 557/557.
  - `npx vitest run .../service-bootstrap/tests/permission.test.ts .../recovery/annotation` -> 10 files, 122/122.
  - `pnpm --filter fluxiq build` -> exit 0.
- Ready to commit (downstream, the content of WIP `c22646d0`: F20, R1+R2, F21, and F22's domain pin). Validation:
  - `node apps/extension/scripts/test-extension.mjs` -> 1500/1500.
  - `tsc -p apps/extension --noEmit` -> 0; `tsc -p domain --noEmit` -> 0.
  - `node domain/scripts/test-domain.mjs` -> 976/976.
  - `node scripts/structure-audit.mjs` -> passed (129 warnings, 120 baselined).
  - Live: run 33, built with the final F20, shows no click failures. F20's second press itself was not exercised live.
- Ready to commit (downstream, L1):
  - `packages/test-runner/src/person-simulation/{asks.ts, simulation.ts, lab-person.ts, hand-off-record.ts, index.ts, permission-answer.ts}`
  - `packages/test-runner/src/person-simulation/tests/{asks.test.ts, simulation.test.ts}`
  - `packages/test-runner/src/run-scenario.ts`
  - `packages/test-runner/src/flow-lane/creation/{lane.ts, permission-point.ts, index.ts}`
  - `packages/test-runner/src/flow-lane/creation/tests/{lane.test.ts, permission-point.test.ts, fake-creation-core.ts}`
  - `docs/architecture/testing-facility.md`
  - Validation: `npx tsc -p packages/test-runner/tsconfig.json --noEmit` -> 0. A private `--outDir` build with `node --test` over person-simulation, flow-lane/creation, lane-rules and run-evaluation -> 208 tests, 207 pass, 1 fail; the failure is the runner-wiring redaction pin, which predates this lane's work and is t174's. Structure audit passed.
  - **Merge note:** the supervisor's dev merge was refused on `lane.ts`, `permission-point.test.ts` and this report. Dev's side of `lane.ts` must be merged by hand, keeping `assertGrantedAtPermissionPoint` and the `authorize` wrapper.
- Ready to commit (docs; validation: docs only):
  - This report.
  - Reports `t195-w13-probes-and-walls.md`, `t195-w14-lab-answers-permission.md`, `t195-w15-debug-r17.md`, `t195-w16-permission-test.md`, `t195-w17a-debugs.md`, `t195-w17b-debugs.md`, `t195-w17c-debugs.md`.
  - Debugs `run-muog33va-96469cb2.md`, `run-munuxns5-833f4313.md`, `run-munvmg0n-12e4a3ce.md`, `run-munvz5x0-84fa6177.md`, `run-munwmfrs-b81bbc65.md`, `run-muny5y17-a927214b.md`, `run-munyqgjr-473ac9b8.md`, `run-munz227o-5119fa06.md`, `run-munzbfbj-2fb8947d.md`, `run-munzihwx-47ccdf7c.md`, `run-munzrj6r-6f754710.md`, `run-munzz9j1-f8c30ff5.md`, `run-muo07nnh-9c8f7e46.md`, `run-muo0g1ky-f3a866ba.md`, `run-muo0qepn-c0aa6dd0.md`, `run-muo0zggr-442f9107.md`, `run-muo1ch23-3de731fb.md`, `run-muo1ni63-3e0aa746.md`, `run-muo1rxmv-0c617136.md`, `run-muo1z05y-ad79d4c3.md`, `run-muo2825e-5f295f24.md`, `run-muo2fscr-7055485a.md`, and `t195-slot-4-balance-failures-2026-09-30.md`.

## Decided: which consequential acts ask

Supervisor, 2026-09-30 (from `docs/working/mvp-today-plan.md:150`): ask before **every** move-money, delete or
send/publish act, even when the instruction asked for it; the permission points agree. Implemented as F10. The lane's
earlier working rule (ask only when the instruction did not ask) is dropped. A stop to ask at a task's declared
permission point counts as a pass (F3).

## Integration round 2 (2026-09-30 ~09:45Z)

Nothing is in progress: no worker is running, the keeper is stopped (`t195-queue2.stop`), no run is in flight.
Lead validation after the last edit:
- Core `vitest` over action-permissions, recovery, tests/, flow-draft, llm, flow-bootstrap, executor, conversations, parking,
  panel-capabilities, nodes/control-flow, api llm-permission: 190 files, 2422/2422.
- Core `tsc --noEmit`: fluxiq 0, contracts 0, apps/web 0. Core structure audit passed (195 warnings, 354 baselined).
- Core build (contracts, fluxiq, client-gateway-websocket) 0.
- Extension units 1336/1336; domain 939/939; extension + domain `tsc` 0; downstream structure audit passed (125/120).
- test-runner build 0; runner-wiring + built-flow + permission-point + lane + existing-fluxiq-control tests 79/80, the one
  failure runner-wiring's redaction-attestation pin that t174 recorded as stale before this lane;
  `publishable-step-value.test.js` 17/17 after F16's test.
Files since round 1: Core `action-permissions/{destructive,gate,request}.ts` + tests (F10), `recovery/**` tests (F10),
`tests/permission-defaults.test.ts` (F10), `docs/architecture/{automation-studio.md, automation-studio/llm-flow-bootstrap.md}`
(F10), `flow-draft/{routing,amendment,entry}.ts` + tests (F11, F14, F16), `llm/evidence-loop/progress-trace.ts` + test
(F13), `llm/harness-options/{repeat-suggestion.ts (new), bootstrap-completion.ts, index.ts}` + test (F15),
`llm/draft-amendment-feedback.ts` + test, `flow-bootstrap/evidence-loop-steps.ts` (F16), `llm/node-tools/dry-run-gate.ts`
+ new test (F18). Downstream `domain/src/runtime/llm-evidence/{permission.ts, node-run/run.ts}` + tests (F10, F17),
`domain/src/actions/schemas.ts` (F19), domain tests `plan-resolution/tests/plan-step-permission.test.ts`,
`tests/press.test.ts`, `tests/tool-rejection-detail.test.ts` (F10), extension `content/extraction/{field-reader,
infer-fields}.ts` + `tests/{field-reader.test.ts, fake-shadow-dom.ts, infer-fields.test.ts}` (F12, w9), test-runner
`existing-fluxiq-control/publishable-step-value.ts` + test (F16), `run-evaluation/tests/runner-wiring.test.ts` (F3's pin),
this report, and debugs `run-munq51ik`, `run-munsxchc`, `run-muntfume`, `run-muntu7in`, `run-munuj2os` (w11) plus reports
`t195-w9-row-age-in-shadow.md`, `t195-w11-debugs-r7-r10.md`. No F0 (t174) copies remain: the merge made them t174's own.
Next after the merge: F20 (a runtime second press for an ignored press), then lane A's R1 and R2 in the interference area.

**Rule slip, 2026-09-30 ~10:05Z:** while validating F21 the lead ran the whole scenario-lab `pnpm test`, which includes
browser checks of fixtures outside the ten realistic scenarios; the user's rule allows browser runs only on those ten.
It will not be repeated: only the pure catalog test file is run for scenario-lab changes.

## Top causes for the audit

These are the causes that recur across lane D's 33 real runs (2026-09-30). Run numbers refer to the Runs table below. "R/"
is Core `packages/fluxiq/src/programs/automation-studio/runtime/`. Every run stopped at stage 2, the build. **No run has
reached stage 3 (a Flow) since run 6.**

1. **The build replays the draft from its first step and returns to the start location mid-build.**
   - Runs: every run from 7 on (7-33). In run 9 the replays took 401 of 537 s; in runs 17-32 they were about 18-64 s each.
   - Effect: the replays re-did lasting acts (napkins added to the cart twice in `munzbfbj`; items saved for later).
   - Status: **owned by t196.** F18 (t195) capped unchanged replays at two; that is only partial.
2. **The draft is a transcript of the steps taken, not an intelligent Flow.**
   - Runs: 11, 13, 14 and 15 (40-step trip loops), and 15 again, where the model dropped its whole draft and restarted.
   - Status: **owned by t196.**
3. **The draft shown to the model is capped at 4,000 bytes.** The instruction is cut from 1,051 to 177 bytes, and up to 44 steps
   are shown without their inputs or left out.
   - Runs: every run debugged, 11-33. `handle_not_in_packet` refusals (runs 18, 22, 33) may also be a cap.
   - Status: **owned by t200.**
4. **Nobody answered the permission ask, so no consequential task could pass.** The build waits 120 s and ends
   `permission_required`.
   - Runs: 5, 10, 16, 17, 21-24, 26, 27, 29 and 31.
   - Status: **fixed at unit level (L1), not live-proven.** With L1 the Lab grants at the declared point on a named control.
5. **After a refused ask, the build keeps pressing and claiming the refused act.** It wastes 8-21 decisions, up to the call
   ceiling, and reports `permission_required`, which hides why the loop ended.
   - Runs: 16, 17, 19, 23, 24, 26, 27, 29 and 31.
   - Status: **open (t195).** L1 removes the refusal at the point, but a refusal elsewhere must still end the build at once and
     say why.
6. **Money is declared on the wrong control, so the ask comes at the wrong place.** Core's gate trusts the model's declaration.
   - Runs: 20, 25 and 30 (`move_money` on "Continue to checkout"); 19 and 32 (money on an unnamed control, on the cart page and
     on the home page).
   - Status: **open (t195, F10's area).** The Lab no longer grants on an unnamed control (L1).
7. **Loops are authored wrongly, or Core breaks them.** In run 33, Core's `rerun` of the listing left the repeat's `over` on the
   dropped step (`R/llm/evidence-loop/rerun-replacement.ts:22-24`). The refusal then named the wrong field
   (`R/flow-bootstrap/authoring/draft-routing.ts:178-182`) and never suggested `reorder`.
   - Runs: 2, 6, 7, 8, 9, 10 and 33.
   - Status: F2, F4, F5, F11, F15 and F16 are fixed. **Rerun re-pointing and the three-way refusal are open (t195)**; they were
     first recorded in run 33, and the fix is proposed in `reports/t195-w15-debug-r17.md`.
8. **The build gives up while a way remains.** The no-progress guard or an unusable decision ends it with budget left: 25 calls
   and $0.19 in run 33. There is no repair path inside the build.
   - Runs: 8, 28 and 33.
   - Status: **open.** Lifecycle (c) was violated. First recorded by t195 in run 33; the audit should assign it (t195 or t196).
9. **Wrong lasting acts during exploration.**
   - A non-qualifying request was confirmed before any filter (Tom Becker): runs 8 and 33.
   - The towels were saved for later instead of the soap: runs 23, 25 and 30.
   - The 3pm-4pm slot was chosen while 2pm-3pm was open: runs 5, 17, 22-24, 27 and 29.
   - Place order was pressed with empty fields: runs 26 and 31.
   - Status: **open (t195).** F14's wording did not stop the Tom Becker case in run 33.
10. **Bigbox ignores the first press after a load, which causes trip loops.**
    - Runs: 11, 13, 14, 15 and 24.
    - Status: F17 and F19 had no live effect, and F19 was reverted. **F20, a runtime second press, is fixed at unit level and not
      yet live-proven.** Open trace: runs 16-32 show clicks `action_failed` with the page changed; those builds may have carried
      w12's half-made F20. Run 33, with the final F20, shows none.
11. **UI (t191).** Seen in every run:
    - raw `core.run_node` / `web.action.*` codes;
    - the Simple/Advanced toggle;
    - setup cards above the chat;
    - "Add an AI model key" shown during a build;
    - a permission stop shown as "Build failed", and "Flow ready" shown with no Flow;
    - "Worked for" times that disagree with the real duration;
    - no failure reason;
    - the overlay never says FluxIQ is waiting for an answer.

## Tasks and streaks

| Task | Passes in a row | Latest |
| --- | --- | --- |
| `social-network-feed-confirm-requests` | 0 | run 33 `run-muog33va`: the model set up the loop, Core's rerun broke its `over` (`rerun-replacement.ts:22-24`), and the no-progress guard ended the build at 39 of 64 calls |
| `professional-network-withdraw-stale-requests` | 0 | run 3: For Each with only the Withdraw in its body, pass 2 blocked by the dialog; the first page holds no stale row (w7) |
| `bigbox-retail-pickup-order` (must ask at Place order; the Lab now allows it there, L1) | **0**: the 12 overnight "passes" were `stopped_for_permission` with `flowCreated: false`, and two stopped on unnamed controls | runs 16-32 never made a Flow; the next run needs L1 live |
| `job-board-apply-quillmark` | 0 | not run |
| `photo-social-moon-jar-price` | 0 | not run |

UI review: the Lab bundle has no screenshots on this tree (`capture-unavailable`; t174's F4 UI review is uncommitted
in t174). Screenshots are taken of the lane's own headed Chromium window every 30 s with `PrintWindow` (scratchpad
`t195-shot.ps1`, `t195-shots/`), selected by the process command line.

## Runs

| # | Run | Task | Stage reached | Causes | Fix | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `run-munnetuw-1bba61e6` | confirm-requests | none (facility), 0 calls | Side panel `Page crashed` at start: the network guard's canary `fetch()` into the not-yet-ready worker (t174 F3), not on dev | F0 | run 2 paired |
| 2 | `run-munnop9n-5475d593` | confirm-requests | 6, 41 calls | The model never said `repeat` (routing told only in `amendment.ts:107`; `evidence-loop-decision.ts:44` forbids repeating a mutation); one `optional` Confirm pinned to the first card (a non-qualifying request) was accepted by `instructed-acts/check.ts:74-87` and the dry run (`dry-run.ts:163-165`); the final extraction had no `where` (8 rows for 4); 15 extraction reruns counted as progress (`decision-handlers/amendment.ts:86,95`); repair lost `step_parameters` to the byte budget (`recovery/context.ts:243`). Debug: `debugs/run-munnop9n-5475d593.md` (t195-w1, 13 causes) | F2, F4, F5; check.ts owned by t174 | - |
| 3 | `run-munnyvbr-11c28a0f` | withdraw-stale-requests | 6, For Each ran | The model did say `repeat`, over a 10-row extraction (no `where`, first page only) through the Withdraw click only; the dialog's confirm (s9) sat after the loop, so pass 2 was `web.action.blocked_by_dialog`; every pass targets the same fixed Withdraw. Exploration withdrew the newest request (sent today). | F2, F4, F5 | - |
| 4 | `run-munoa86g-150fb0d9` | pickup-order | 6, 46 build calls | The build never reached checkout and completion was accepted with move_money and create_new undeclared (t174's instructed-acts cause); playback died at node 2 under the consent dialog, which the defence would not answer (`interference/vocabulary.ts`). | F1; acts: t174 | - |
| 5 | `run-munovwp3-d898de74` | pickup-order | build asked at the declared point, 48 calls | Correct ending (move_money at "Place order", control matched), failed by `lane-rules/built-flow.ts:15-17`. The exploration press of Place order took 120,210 ms before `permission_required` (an unanswered permission prompt; to trace). | F3 | - |
| 6 | `run-munq51ik-a7ebd077` | confirm-requests | 6, 64 build calls | **The model built the loop** (For Each over the listing, Confirm as its body; F2) and passes 1-3 each confirmed a different row (F4/F5 live). But the listing was the Friends home (4 of 8) with no `where`, so Tom Becker and likely Priya Nair were confirmed (wrong acts); pass 4 was correctly `web.action.rate_limited` / `unacted` (w8), yet read no wait, so Core's retries fell inside the window; leftover single Confirms and the final read sat after the loop; 9 of 10 completions refused by the dry run. Debug: `debugs/run-munq51ik-a7ebd077.md` | F7 wait parse (w8, in progress); causes 2-5 open | - |
| 7 | `run-munsxchc-15523952` | confirm-requests | 2, 29 calls, no Flow | Four completions refused `bootstrap.instructed_act_missing` (t174's merged check: a plural act needs a repeated step; reason not in the trace, F13 adds it) and the build stopped on repeated unusable completions; 13 amendments of unknown content; dry runs refused the same steps each time (not a repeat span, so F11 did not apply). Debug: this row (pool full for a worker). | F13, F14 | - |
| 8 | `run-muntfume-7f7d97fb` | confirm-requests | 2, 24 calls, no Flow | On the right page (`friends/requests/`). Exploration confirmed Tom Becker (1 mutual) and Amara Osei before filtering; the model then wrote a `where` (F11 took) whose rerun kept nothing (`web.action.rejected.output_not_observed` / `conditions_kept_nothing`), then six refused amendments, and the no-progress guard ended it (`flow_bootstrap.evidence_repeat_without_progress`). UI: t191's on-page overlay ("Building your Flow / Deciding the next step") and chat panel now show. | F13, F14; the empty `where` needs run 10's trace | - |
| 9 | `run-muntu7in-e3dd1972` | confirm-requests | 2, 52 calls, no Flow | With F13's trace: the model claimed `a1>d21` (one Confirm right after the listing) at every completion from iteration 30 and was refused `missing=a1:act_needs_repeat` eight times; it never wrote `repeat`. Iterations 6-26 were extraction reruns and keep/drop churn. Ended `flow_bootstrap.evidence_iteration_limit`. | F15 | - |
| 10 | `run-munuj2os-c205ee3a` | withdraw-stale-requests | 2, no Flow | The model put `repeat` on the listing over itself (`15:repeat(over=15)`, refused as `no_such_position`; F16), then claimed the listing for the act (`missing=a1:step_changed_nothing`). Its exploration Withdraw was declared `delete`, so under F10 the gate asked, waited 122 s for an answer nobody gave, and the build ended `permission.required: delete` at `no_point_declared`. **Task contract conflict:** the task names the withdrawals and declares no permission point (its author's rule: an instructed withdrawal needs no ask), while F10 asks before every delete. The lane now runs it with `--llm-permit delete`, the person's permission. | F16; `--llm-permit delete` | - |
| 11 | `run-munuxns5-833f4313` | pickup-order | 2, 64 decisions, no Flow | Iterations 13-57: press Add to cart (succeeded, page unchanged), navigate back, press again -- bigbox's first press after a load only wakes the page, and the model never pressed twice in a row; it never reached checkout, so Place order was never asked about. Completions refused `cannot_answer_instruction` and `missing=a1:no_step_named,a2:step_only_arrives`. Ended `flow_bootstrap.evidence_iteration_limit`. | F17 | - |
| 12 | (bigbox, 08:54Z, no run id) | pickup-order | none (facility) | The Lab's domain build failed on the lead's half-made F17 edit (`present<WebNodeOutcome>` needs every optional field); 0 calls. Keeper v2 (scratchpad `t195-queue2.sh`) now holds launches while `t195-queue.pause` exists and typechecks extension + domain before each launch. | keeper v2 | - |
| 13 | `run-munvmg0n-12e4a3ce` | pickup-order | 2, 64 decisions, no Flow | 23 navigations and 13 clicks; never reached Place order; completions refused `missing=a2:step_claimed_twice`, then `a1:step_is_optional`; iteration limit. | F18, F19 | - |
| 14 | `run-munvz5x0-84fa6177` | pickup-order | 2, 64 decisions, no Flow | The model's call ids show the loop: `add.paper.towels` / `add.to.cart` / `open.cart` repeated from iteration 15 to 47 -- every trip to the product page reloads it, and bigbox swallows the first Add to cart after a load (`client/shell-script.ts:45` `vr.wake`), so it never added. It then reached guest checkout, pickup slot and contact (54-61), and the completion check passed at decision 64 with no decisions left. | F19 | - |
| 15 | `run-munwmfrs-b81bbc65` | pickup-order | 2, 64 decisions, no Flow | The same loop with F19's description in the catalog: `open.towels` / `add.towels` / `open.cart` ten times over, never two presses in a row; iteration limit. The model does not act on the sentence; the runtime has to. | F20 (planned) | - |
| 16 | `run-muny5y17-a927214b` | pickup-order | **stopped_for_permission** (the old Lab said passed), no Flow | The build reached checkout and pressed Place order; the gate raised `permission_required` for `move_money` at "Place order" (control matched) although the model read the instruction as asking for it (`instructed` includes move_money, "pay at pickup"): F10 live. Nothing was ordered. The Lab scored it as the declared stop (`FluxIQ stopped to ask at the task's declared permission point`, F3 live). 64 build calls, $0.12. UI (bundle `screenshots/00022-0e9735c507ec.jpg`): the ask is in the panel's chat with Allow / Don't allow and F10's sentence; for t191, the overlay and panel status read "Using core.run_node" and "Add an AI model key: To do" shows during a live build; the sentence (Core `action-permissions/request.ts`) could be friendlier. | F3, F10 live | not a pass (dev `f2f80024`); debug by w17a |
| 17-32 | `munyqgjr`, `munz227o`, `munzbfbj`, `munzihwx`, `munzrj6r`, `munzz9j1`, `muo07nnh`, `muo0g1ky`, `muo0qepn`, `muo0zggr`, `muo1ch23`, `muo1ni63`, `muo1rxmv`, `muo1z05y`, `muo2825e`, `muo2fscr` (each `run-<id>-*`) | pickup-order, launched by the unattended keeper | 2, no Flow in any. Endings: 9 `stopped_for_permission` at Place order; 3 stops at "Continue to checkout" (`move_money`); 2 stops on unnamed controls (cart and home page); 2 iteration-limit or no-progress endings | Nobody answered the ask for 120 s (L1). After the refusal, 8-21 decisions re-pressed and claimed the refused press. The 3pm-4pm slot was chosen while 2pm-3pm was open. The towels were saved for later instead of the soap. Place order was pressed with empty fields. Dry runs replayed from the start (t196). The draft shown was capped (t200). Details: `reports/t195-w17a/b/c-debugs.md`. $1.66 in total. | L1 (with the unnamed rule) | debugs written this session |
| - | 346 runs, `run-muo2nioi-e4a9bd18` .. `run-muodhgog-5be437d1` | pickup-order, launched by the keeper | none: the provider refused the first call for insufficient balance | the keeper went on relaunching after the balance ran out | dev's Lab guards | `debugs/t195-slot-4-balance-failures-2026-09-30.md` |
| 33 | `run-muog33va-96469cb2` | confirm-requests | 2, 39 of 64 calls, 142 s, $0.061, no Flow | The model set up the loop (`16:repeat(over=15)` on the Confirm), then sent `15:rerun` of the listing. Core appended the rerun as `d17`, dropped `d15`, and left `d16.over = d15` (`R/llm/evidence-loop/rerun-replacement.ts:22-24`). Every completion was then refused `flow_draft.repeat_span_unknown`. That refusal's message blames `through` when `over` is the missing step, and it offers no `reorder` (`R/flow-bootstrap/authoring/draft-routing.ts:178-182`). The model resent one completion until the no-progress guard (8) ended the build as `evidence_unusable_decision`, with 25 calls and $0.19 left, which violates lifecycle (c). Exploration again confirmed Tom Becker (1 mutual friend) before any filter. Two dry runs replayed the draft from the home feed, 18 s each (t196). The draft shown to the model was capped at 4,000 bytes (t200). No repair ran: there was never a Flow to test, and the build loop has no repair path for its own dead end. UI (t191): raw `core.run_node` codes, the Simple/Advanced toggle, "Build failed / Build failed", "Worked for 51s" for a 142 s build, and no reason given. Debug: `debugs/run-muog33va-96469cb2.md` (w15) | open: rerun re-pointing and the refusal wording (t195) | - |
| 35 | none (killed in the prelude) | confirm-requests | none, $0 | The supervisor killed it: the DeepSeek outage and the chat-launch rule | - | - |
| 36 | `run-muq3uozx-3153564b` | confirm-requests, **first chat-driven build (t227)** | 2: build failed `lab.chat_build_failed`, no Flow; exploration then one repair; 61 calls, 405 s; **$0.2157** by the dumps' usage (the Lab ledger recorded $0: a failed chat build leaves no accounting); input 16.8k-37.1k tokens per call, 61.8% cache hits | At E11 the model sent `10 add act a1` on a withdrawn rerun of the listing. Core accepted an act on a read step (`R/flow-draft/amendment.ts:194-197,217,229`), and reruns carried it onward (`rerun-replacement.ts:47-50`). The check judges only the FIRST step naming an act (`instructed-acts/check.ts:155-157,271-273,327-335`), so all 24 completions judged the listing: `step_changed_nothing` (`check.ts:289-291`). Meanwhile the checklist said `a1 done 16/17`. The draft never shows which step names which act (`flow-draft/entry.ts:81-111`). Wrong presses: Priya (E16) and Tom (E36), the latter right after the stall note said "run it and add it with act a1". The list was read from the Friends home (4 cards), never "See all", with a regex on "mutual" instead of `atLeast`, which drops Jonas. Worst-case cost counting withdrew the tools at $0.09 left (`llm/loop-budget.ts:122-123`). UI (t191/t227): cards read "Click · the page"; 24 "Test run" cards; the failure is posted twice and says "changed nothing"; the overlay sits under the panel. No permission ask (none declared), so `answerInChat` was not exercised. Debug: `debugs/run-muq3uozx-3153564b.md` (w21) | F35-F40 (below) | - |
| 37 | `run-muq5v4zg-39182b58` | confirm-requests, chat-driven, with F35-F40 and dev's RG | 2: build failed `lab.chat_build_failed`, no Flow; 33 calls (16 exploration + 17 repair), 114 s, **$0.0962** by the dumps (exploration $0.0507, repair $0.0455); input 16.8k-26.9k tokens per call | **Better:** F39 worked. The model pressed "See all" (#7, `t554`), read the full requests list and filtered `atLeast: 5` (#12). **But it never pressed a Confirm.** At #13 it amended `13 repeat over 13 through 13`, a repeat on the listing over itself. #14-#16 resent the same `rerun` of step 13, each refused `changes_nothing` (repeated), and RG's three refused repeats ended the round at 16 decisions with no completion check. The repair navigated to the same `friends/requests/` URL 8 times between `find_on_page`/detect calls. **RG did not catch that** (a navigation that succeeds is not "failed or no-effect"): evidence for lane B. Ended "nothing I tried did it ... (5 steps) ... does none of what you asked". Full debug: next | next: full debug (w23) | - |

## t174's fixes applied as a working-tree patch (owned by t174)

Dev, which this tree was built from, holds none of t174's commits. Both of its trees' code diffs were
applied here with `git diff dev...task/t174-live-lane` (downstream limited to `apps domain packages scripts`;
Core whole) and `git apply`, which touched no git history: downstream 23 paths, Core 20 paths
(`5903a1e7`, `259b0df2`, `631e3486` downstream; `befca2f`, `50eb684`, `e8d3bfc` Core). When the supervisor
merges t174, the hunks are identical on both sides. Core rebuilt (contracts, fluxiq,
client-gateway-websocket): exit 0.

## Round 1 file list

Nothing is in progress: every worker (w1, w4, w5, w7, w8) had handed back before the validation above.

**t195's own, downstream** (commit all):

- `apps/extension/src/content/action-runtime/blocking-dialog.ts`
- `apps/extension/src/content/action-runtime/execute-action.ts`
- `apps/extension/src/content/action-runtime/index.ts`
- `apps/extension/src/content/action-runtime/interference/clear.ts`
- `apps/extension/src/content/action-runtime/interference/index.ts`
- `apps/extension/src/content/action-runtime/interference/layer-text.ts`
- `apps/extension/src/content/action-runtime/interference/tests/vocabulary.test.ts`
- `apps/extension/src/content/action-runtime/interference/tests/way-out.test.ts`
- `apps/extension/src/content/action-runtime/interference/vocabulary.ts`
- `apps/extension/src/content/action-runtime/interference/way-out.ts`
- `apps/extension/src/content/action-runtime/rate-limit-notice.ts`
- `apps/extension/src/content/action-runtime/recovery/fault.ts`
- `apps/extension/src/content/action-runtime/recovery/record.ts`
- `apps/extension/src/content/action-runtime/recovery/tests/fault.test.ts`
- `apps/extension/src/content/action-runtime/resolve-target.ts`
- `apps/extension/src/content/action-runtime/results.ts`
- `apps/extension/src/content/action-runtime/tests/rate-limit-notice.test.ts`
- `apps/extension/src/content/actions/click.ts`
- `apps/extension/src/content/actions/tests/click.test.ts`
- `apps/extension/src/content/actions/types.ts`
- `apps/extension/src/content/extraction/load-retry.ts`
- `apps/extension/src/content/extraction/pagination.ts`
- `apps/extension/src/content/extraction/tests/load-retry.test.ts`
- `apps/extension/src/content/identity/candidates.ts`
- `apps/extension/src/content/identity/record.ts`
- `apps/extension/src/content/identity/tests/record.test.ts`
- `apps/extension/src/shared/protocol.ts`
- `docs/architecture/failure-taxonomy.md`
- `docs/architecture/page-evidence.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munnetuw-1bba61e6.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munnop9n-5475d593.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munnyvbr-11c28a0f.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munoa86g-150fb0d9.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munovwp3-d898de74.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-munq51ik-a7ebd077.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-live-control-flow.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w1-debug-run-munnop9n.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w4-loop-item-core.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w5-row-scoped-target.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w7-debugs-r3-r5.md`
- `docs/working/language-driven-flow-loop-plan/reports/t195-w8-rate-limited-press.md`
- `domain/src/actions/extraction/condition-match.ts`
- `domain/src/actions/extraction/tests/condition-match.test.ts`
- `domain/src/actions/types.ts`
- `domain/src/client/tests/gateway-mapping-identity.test.ts`
- `domain/src/output-nodes/definitions.ts`
- `domain/src/output-nodes/native-runtime.ts`
- `domain/src/output-nodes/targets/targets.ts`
- `domain/src/output-nodes/targets/tests/targets.test.ts`
- `domain/src/output-nodes/tests/definitions.test.ts`
- `domain/src/output-nodes/tests/native-runtime.test.ts`
- `domain/src/runtime/failure/codes.ts`
- `domain/src/runtime/failure/tests/codes.test.ts`
- `packages/test-runner/src/lane-rules/built-flow.ts`
- `packages/test-runner/src/lane-rules/tests/built-flow.test.ts`

**t195's own, Core** (commit all):

- `docs/architecture/automation-studio.md`
- `packages/contracts/src/failure/parse-record.ts`
- `packages/contracts/src/failure/record.ts`
- `packages/contracts/src/failure/tests/parse-record.test.ts`
- `packages/fluxiq/src/programs/automation-studio/nodes/control-flow/for-each.ts`
- `packages/fluxiq/src/programs/automation-studio/nodes/control-flow/tests/for-each.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/defensive/assess.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/defensive/tests/assess.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/node-execution.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/executor/node-inputs.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/assemble.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/draft-routing.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/assemble.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/draft-routing.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/amendment.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/entry.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry-budget.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/tests/entry.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts`

**F0 only (t174's hunks, byte-identical to `git diff dev...task/t174-live-lane`): take t174's version.** Downstream:

- `apps/extension/src/background/connection/gateway-session.ts`
- `apps/extension/src/background/connection/tests/gateway-session.test.ts`
- `domain/src/runtime/llm-evidence/node-run/replay.ts`
- `domain/src/runtime/llm-evidence/node-run/tests/replay-ambiguous-target.test.ts`
- `packages/test-runner/src/core-web-build/server-process.ts`
- `packages/test-runner/src/core-web-build/tests/server-process.test.ts`
- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`
- `packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts`
- `packages/test-runner/src/http-control/index.ts`
- `packages/test-runner/src/http-control/long-request.ts`
- `packages/test-runner/src/http-control/tests/long-request.test.ts`
- `packages/test-runner/src/network-guard.ts`
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
- `packages/test-runner/src/run-lifecycle/pair-extension.ts`
- `packages/test-runner/src/run-lifecycle/pairing-status-wait.ts`
- `packages/test-runner/src/run-lifecycle/tests/pair-extension.test.ts`
- `packages/test-runner/src/run-lifecycle/tests/pairing-status-wait.test.ts`
- `packages/test-runner/src/run-scenario/extension-control-page.ts`
- `packages/test-runner/src/run-scenario/extension-start-trace/extension-start-trace.ts`
- `packages/test-runner/src/run-scenario/extension-start-trace/index.ts`
- `packages/test-runner/src/run-scenario/extension-start-trace/tests/extension-start-trace.test.ts`
- `packages/test-runner/src/run-scenario/extension-start-trace/write-extension-start-sidecar.ts`
- `packages/test-runner/src/run-scenario/index.ts`
- `packages/test-runner/src/run-scenario/tests/extension-control-page.test.ts`
- `packages/test-runner/src/tests/network-guard.test.ts`

Core:

- `packages/client-gateway-websocket/src/index.ts`
- `packages/client-gateway-websocket/src/open-error.ts`
- `packages/client-gateway-websocket/src/tests/transport.test.ts`
- `packages/client-gateway-websocket/src/transport.ts`
- `packages/client-gateway-websocket/src/types.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/index.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/phase-failure.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/thrown-issue-codes.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/thrown-issue-codes.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/index.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/progress-trace.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/draft-shown.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/progress-trace.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/bootstrap-completion.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-draft-shown.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/catalog.test.ts`

**Mixed:** `packages/test-runner/src/run-scenario.ts` = t174's F0 hunks + t195 F3 (three lines: `let stoppedToAsk = false;` after `let verdict`, `{ stoppedToAsk = true; ... }` where the created lane returns `permissionStop`, and `stoppedToAsk` passed to `assertFlowLaneBuiltFlow`).
