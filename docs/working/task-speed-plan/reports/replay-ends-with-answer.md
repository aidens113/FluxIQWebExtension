# t897: a replay ends with its answer, and later attempts run the saved Flow

Worker: t897 (worker-heavy). Live run diagnosed: `run-mwb5cnxg-003415b4` (social-network-feed,
`social-network-feed-group-post`, Haiku, `--attempts 4`).

## Outcome

Partial. Both root causes were found and both have fixes that pass their tests:

- (a) The Lab misreported. Core did not end attempts 2 and 4 without an answer. The fix is in the Lab's
  attempt follower, which this brief owns because the Lab misreports. It is in the tree and tested.
- (b) The saved Flow's run passes over a carried press without saying the act was done. The fix is one
  rule in `answer-first/run-acts/run-gate.ts` (plus its header and `engine/.../not-arisen.ts`'s
  header). That file is outside the owned paths, so it is **not applied**. The exact patch is in
  the scratchpad (below). It was proven with the patched gate swapped in at test time. The reproduction test,
  which is in an owned path, fails until the patch is applied.

Neither live run happened. The Lab's live guard refused the run (rule `behind-dev`) before any
provider call. Both t897 trees are 4 commits behind their local `dev`, and `git merge dev` is a lead
operation. The first try also stopped before any call: I edited a Core test while the Lab was
building Core's web panel (`process.startup`, "Core's build inputs changed"). Nothing was spent: $0.

## What happened in the live run (from its own evidence)

The step log (`lab-runs/2026-11-10/run-mwb5cnxg-003415b4/steps`) shows that Core did the same thing in attempts 2, 3
and 4. The Lab's row says otherwise for 2 and 4 because the Lab stopped reading them early.

| Steps | Attempt | What Core did |
| --- | --- | --- |
| 0017-0024 | 2 | navigate, click group: passed; click "Write something...": **skipped, "already done earlier"** (no dispatch span in 0019); type: failed `web.target.not_found` x4; note "stopped at step 6" |
| 0025-0028 | 2 | round: inspect, decide `complete`, judge yes (citation of a row the result does not hold, refused), judge again yes |
| 0029-0039 | 3 | identical run, the same failure at step 6, then inspect, decide, judge yes, `achieved`, answer "Already done earlier: Post" |
| 0040-0049 | 4 | identical run and failure, then inspect; decide 0049 never finished, because the Lab had already shut down |

The flow-run note in 0026's request has steps 1 passed, 3 passed, 4 skipped (already done), 6 failed
and 7 not reached. The act record carried `"Write something..."` as `may_have_landed, undeclared,
carried`.

## Root cause (a): an attempt "ending" with no answer

**It was the Lab's follower, not Core.** `attempt-lane/live/follow-attempt.ts` stopped on
`waiting_for_person` whenever the scenario declares no person for checks (`playable: false` for
social-network-feed). Each saved Flow's run asks permission once before it starts (`flow-run/permission.ts`,
the Post's `send_or_publish`), so the attempt row reads `waiting_for_person` / `permission` until the
person answers. The Lab's own person answered every one of those questions in the chat: each attempt's
`person-hand-offs.json` has `permissionAnswers: grant via chat` after 1.3 s (attempt 2) and 1.1 s
(attempts 1, 3 and 4). When a 1 s poll landed inside that window, the follower took the wait as the
end. It happened in attempts 2 and 4 and missed in 1 and 3. The Lab then read the row at that moment, which explains every
odd field: `status: working`, `liveSteps: 1`, `spend.ms: 1334` (the row Core writes when the first step goes
out), `saved: notes_only / still_waiting`, `answer-turn.json: null` (read before Core drew it). Its
step-count window (`speed`) ended at step 0025, which fits too.

**Core ended attempt 2 with its answer.** The Lab's `send` waits up to 30 s for the chat
composer to be enabled, and the composer stays disabled while a turn runs (`extension-chat-check/panel-driver.ts:45`).
Attempt 3's message went in at 20:35:16. That is 0.9 s after attempt 2's last judge (0028, finished 20:35:15.445).
So attempt 2's turn had ended by then. Attempt 4 had no successor, and the Lab shut down mid-decision.

The bad continuation proof for 2 -> 3 (`first_saved_nothing, second_found_something_else,
second_ran_another_flow`) came from the same mid-run read of attempt 2's row.

**Did S9 (t895, Core merge 090ad7e0d) cause or expose it?** Neither. `git show 3178cee35` touches
only completion reads (`replay-of.ts`, `replay-stands.ts`, `read-shape.ts`, `check.ts`), the step
facts in `flow-run/steps-ran.ts` (skip reason, retries, `personCleared`), and the saved Flow's
`shape`. It writes no attempt status and adds no wait. In this run no S9 path even applied: the Flow
was never proven whole, so `replayOf` fell through to the judge. The permission question that opens
the window comes from the Flow run's permission step (D13), which predates S9. S6 (no model call to
read the instruction) shortened the time before the run, which may make the window easier to hit. It
is not the cause.

**The rule applied to how a replay ends** (the brief's question). The code already decides it, and
the user rules agree: a task ends only with its result or its budget, and the change is judged rather
than the absolute state. When the asked act is already on the site, the run:

1. does not press it again (the run gate, `already_done`);
2. passes over the steps written on the page that act would bring about (`not-arisen.ts`);
3. reaches the end.

It is then judged once against the change. The judge sees the act record ("Already done earlier: Post")
and the before and after views. The attempt ends `achieved` with a `done_on_site` answer, "nothing
changed this time". Once that run is the Flow's judged whole run (path `run_flow`, achieved: `ready` and
`provisional`), each later replay that runs the same way stands on its record with no call
(`replay-stands.ts`). S9 lists "an act already done" and "a step whose page never arose because the
act before it was already done" as passed over as saved. Core never ends silently. The only silent
ending in this run was the Lab's misreading.

## Root cause (b): the later attempts abandoned the saved Flow

Attempt 1 clicked "Write something..." to open the composer. The click declared no consequence, but
its answer said it changed something that stays (`changedState`, `act-record/gate/read-answer.ts:81`).
So `act-record/seed.ts` carried it to the next attempt and held it on repeat. In the replay,
`run-acts/run-gate.ts` matched that held act and did not press the step, correctly: the post was
already made. But it treated the step as a *plain* press: `skippedResult(..., lasting = act.classes.length > 0 ||
claimsAct || declaresAct)` gave `false`, so it said nothing of an act done. The header gives the reason:
"a banner's 'No thanks'... brings about no page of its own". `not-arisen.ts` passes over a follow-on
step only after a step that said `skipped: "already_done"`. So the step that types into the composer's
field, written on the form that press opens, failed four times on its missing control. The run stopped
at step 6, and every later attempt went on to explore (decide plus judge, about 40 s and $0.003 each).

The banner reasoning does not hold for anything this gate can refuse. `carried()` returns only entries
that `stands()`, and those are declared or claimed acts, or undeclared presses held on repeat. The
record holds an undeclared press on repeat only because its answer said it changed something that stays.
A press that only moved the view (a banner dismissal) is never carried, so it is pressed again as the
Flow says. So every act the gate refuses brought about a state of its own, and its follow-on steps are
exactly the `not_arisen` case.

**Fix (not applied, outside the owned paths):** the gate always says `skipped: "already_done"`
when it refuses a carried act. `skippedResult` loses its `lasting` argument, and `declaresAct` and
`DECLARED_CONSEQUENCES_METADATA` become unused and are removed. `claimsAct` is still used by settling. The
header of `run-gate.ts` and the "Why a lasting act" paragraph of `not-arisen.ts` are reworded to
match. The patch is:

`C:\Users\osrs_\AppData\Local\Temp\claude\bc302d3e1bd85154\1d7e40a9-22b4-41e1-ad74-ba7e457da62b\scratchpad\t897-gate\t897-run-gate.patch`
(112 lines, `diff -u` of `packages/fluxiq/src/framework/automation-service/service/answer-first/run-acts/run-gate.ts`
and `packages/fluxiq/src/engine/automation/state-routing/not-arisen.ts`, relative to Core's root,
written with LF endings; the working files are CRLF). The code changes are these lines:

```diff
-import { AUTOMATION_STUDIO_ALREADY_DONE_OUTPUT, AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY, type AutomationStudioGraphExecutionOptions } from "../../../executor/index.ts";
+import { AUTOMATION_STUDIO_ALREADY_DONE_OUTPUT, type AutomationStudioGraphExecutionOptions } from "../../../executor/index.ts";
-const DECLARED_CONSEQUENCES_METADATA = AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY;   (and its doc line)
-    return { result: skippedResult(label || act.what, act, settling !== undefined, act.classes.length > 0 || claimsAct(request.node) || declaresAct(request.node)) };
+    return { result: skippedResult(label || act.what, act, settling !== undefined) };
-    return skippedResult(act.what, act, settling !== undefined, act.classes.length > 0);
+    return skippedResult(act.what, act, settling !== undefined);
-function skippedResult(subject, act, inTheAttempt, lasting: boolean) ... outputs: lasting ? { skipped: AUTOMATION_STUDIO_ALREADY_DONE_OUTPUT } : {}
+function skippedResult(subject, act, inTheAttempt) ... outputs: { skipped: AUTOMATION_STUDIO_ALREADY_DONE_OUTPUT }
-function declaresAct(...) { ... }   (removed, now unused)
```

With it, attempt 2 runs the saved Flow to its end: the composer press not pressed again, the typing
step passed over as `not_arisen`, Post already done. It is judged once (path `run_flow`, achieved,
confirmed). Attempts 3 and 4 then stand on that record with **no model call**.

A related cause was left as it is: whether a composer-opening press should count as "changed something that stays"
at all (`read-answer.ts:81`: a `toggle`, or a `draft.changed` line that `reads` or `rose`). The live
artifacts do not keep the host's `draft.changed` lines, so which signal fired is not known. With the
fix above, a press held that way is harmless on replay, because its own state is passed over the same
way as a lasting act's. So the heuristic does not need to change for this task.

## What changed and why

Owned, applied:

- `packages/test-runner/src/attempt-lane/live/follow-attempt.ts` (extension): `stopsOn` reads what
  the attempt waits for. A `waiting_for_person` with `waitingFor: "permission"` is followed on when the
  run's person answers permission questions (new input `permissionsAnswered`). Any other wait is
  played as before (`personPlaying`). The header records the run and the cause.
- `.../live/attempt-person.ts`: the person says `answersPermissions` (true unless the task's permission
  point is `askFirst`, where the person leaves the question, `person-simulation/permission-answer.ts`).
- `.../live/live-driver.ts`: `LiveAttemptPerson.answersPermissions?`, passed to the follower.
- `.../live/tests/follow-attempt.test.ts`: three cases. A permission wait the person answers is followed
  to the ending. Answering permissions plays no other wait. A person that leaves permission questions
  still stops on one.
- Core `answer-first/flow-run/tests/replay-over-done-act.test.ts`: provider-free reproduction of (b)
  on the real service, engine and scripted model (`../../tests/later-attempts.ts`). Attempt 1 opens a
  form with an undeclared press whose answer reports a toggle, types a note on the form, and renews
  the card (lasting). Attempts 2-4 run on the page as left, with the form closed. Expected: path `run_flow`,
  no decision, acts "Already done earlier", confirmed; judge once on attempt 2 and 0 on 3 and 4 (on
  record); nothing done twice.

Not applied (outside owned paths): the run-gate patch above.

## Commands run and observed results

- Reproduction (b), unpatched gate:
  `npx vitest run src/.../flow-run/tests/replay-over-done-act.test.ts` -> 1 failed: `attempt 2:
  expected ... path: "run_flow"`, received `"run_flow_then_explore"`. A debug print showed the live
  shape exactly: step 2 skipped "already done earlier", step 3 failed "control was not found", step 4
  not reached.
- Reproduction (b), with the patched gate swapped in at test time (vitest `resolveId` plugin limited to
  importers under `answer-first/run-acts/`, config in the scratchpad `t897-gate/vitest.alias.config.ts`):
  1 passed; debug: attempt 2 one judge call, checkedWhat "already done earlier, against what was asked
  for."; attempts 3 and 4 zero judge calls, checkedWhat the on-record words.
- Patched gate against its neighbours, same config: `run-acts`, `engine/automation/state-routing`,
  `project-parts/run` and the reproduction -> `Test Files 29 passed (29)`, `Tests 293 passed (293)`.
  The first try used a plain alias and caught `service/instruction-led/run-gate.ts` too
  (`instructionBoundRunGate is not a function` in `double-act.test.ts`). That was a harness artefact,
  fixed by limiting the swap to its importer. Unpatched `double-act.test.ts` passed 6/6.
- Reproduction (a), before and after: a scratch script ran the new follower case against t896's
  compiled follower (the old code) -> `{"status":"waiting_for_person","waitingFor":"permission","liveSteps":2}`,
  and against t897's -> `{"status":"achieved","waitingFor":null,"liveSteps":7}`.
- `node --test dist/attempt-lane/live/tests/follow-attempt.test.js` (after `pnpm build`) -> 15 pass, 0 fail.
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build`
  in Core, then `pnpm build` in the extension -> exit 0 (test-runner built with the follower change).
- `NODE_OPTIONS=--max-old-space-size=6144 npx tsc -p tsconfig.json --noEmit` (packages/fluxiq) ->
  exit 0, after typing the test's draft helper (the first run reported TS2375 in the new test).
- `node scripts/structure-audit.mjs`: Core -> `passed (529 warning(s), 969 baselined)`; extension ->
  `passed (245 warning(s), 552 baselined)`.
- `npx vitest run src/framework/automation-service/service/answer-first src/runtime/conversations`
  (packages/fluxiq), unpatched gate -> `Test Files 1 failed | 164 passed (165)`, `Tests 1 failed |
  1192 passed (1193)`; the one failure is the new reproduction, as expected.
- The same, with the patched gate swapped in (`--config <scratchpad>/t897-gate/vitest.alias.config.ts`)
  -> `Test Files 165 passed (165)`, `Tests 1193 passed (1193)`.
- `pnpm lab attempt social-network-feed --task social-network-feed-group-post --authoring-mode answer-first --live-llm --llm-provider anthropic --llm-model claude-haiku-5-5 --llm-max-cost-usd 5 --attempts 4`
  (`FLUXIQ_LAB_INSTANCE=t897`): `--dry-run` -> ready (Haiku, $5 ceiling, key from `.env.local`).
  Try 1 -> `process.startup` before any call (my Core edit during the web build). Try 2 -> refused
  by `behind-dev`, `spentUsd: 0`.

## Not verified

- No live run: blocked by `behind-dev`. Live proof of (a) and (b) together still needs the lead to
  run `git merge dev` in both t897 trees (dev's 4 new commits each touch only `answer-first/rows/**`
  and a Lab script, with no overlap here), apply the run-gate patch, rebuild, and run the command above.
  Expected: attempt 1 explores; attempt 2 `run_flow` with 1 judge call; attempts 3 and 4 `run_flow` with 0
  calls; every attempt has an answer turn; all continuations held.
- The run-gate patch was never applied to the file itself. It was run swapped in at test time over
  answer-first, conversations, run-acts, state-routing and project-parts/run. Core's whole vitest run,
  and tsc with the patch applied, were not run.
- Which signal made attempt 1's composer press `changedState` (toggle, `reads` or `rose`) is unknown,
  because the host's `draft.changed` lines are not in the step log.
- A provider-free Lab script for this task was not written: the Core-level reproduction covered (b) more
  cheaply, and the follower case covered (a).

## Open questions or contradictions found

- The `run-gate.ts` header says a banner's "No thanks" can be carried and refused as a plain press,
  but `seed.ts` never carries an undeclared press that changed nothing that stays. The two headers
  disagreed, and the patch makes them agree.
- `docs/architecture/testing-facility.md` ("A real attempt from the chat", around line 2078) says the
  follower stops on `waiting_for_person`. It should add "except a wait for a permission answer the
  Lab's person gives". This is a shared doc, so it was left for the lead.
- This lane's trees are behind `dev`. The live guard will refuse every live run until they are merged.
