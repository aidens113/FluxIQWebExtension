# Scripted round diagnosis: company-website saturday-certificate and apprentices

Worker report for `briefs/scripted-round-diagnosis.md`. Diagnosis only. The only edit is this report.
Paths are in the lane `C:/Users/osrs_/FluxStuff/fxwork/t1015-paid-bigbox` (L) or the shared Core
`C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ/packages/fluxiq/src` (C) unless written in full. The run folders are
`L/test-runs/instances/paid-bigbox/attempts/<run>`.

## Outcome

Both causes are found, and neither one is the page diffs (W1), native decisions (W2) or W3's drafting.

1. **saturday-certificate (`run-mwwwr1ty-d36c4ce1`) is a Lab defect.** The booking widget is a cross-origin frame
   served by the Scenario Lab's second (frame) server. The Lab's network guard blocked that frame, because its origin
   proof compares the frame server's health against a memoized copy of the primary's health. That copy was taken
   before the site's state changed. The page never held a Wrenfield control, and the page channel delivered the page
   correctly. I reproduced the block offline. One link is not in the recording: the attempt lane never reads the
   guard's violation list.
2. **apprentices (`run-mwwwf7pb-c646fefb`) is a product defect, in Core's result-verification trail, with the
   finding code from the web domain's projector.** Attempt 2 did run the saved Flow from start to end, and the judge
   said yes. Core then held that yes as unsure. The Flow's three sometimes-present cover steps were passed over, as
   designed, and each one was projected as `web_judge.evidence_unrecognized`. Every later check carries the same
   gaps, so the attempt could not end and spent decisions until the script's cap (request 25).

## Failure 1: saturday-certificate, request 3 refused (no Wrenfield control)

### Cause

The booking widget's frame load was refused by the Lab's deterministic network guard. Three things combine:

1. **The memoized reference.** `L/packages/test-runner/src/lab-control/frame-origin-proof.ts:29` computes
   `const reference = await (expected ??= health(primary));`, which memoizes the primary server's `/__control/health`
   body. Line 31 then requires `await health(origin.origin) === reference` for every later candidate origin. That body
   carries the store's moving counters: `provenance: { ownerEpoch, resetGeneration, mutationSequence }`
   (`L/apps/scenario-lab/src/control.ts:23`, `L/apps/scenario-lab/src/state-store.ts:20-21`). Once the store mutates
   after the memo, every new scenario origin fails its proof.
2. **What triggers the memo early.** The attempt lane opens the extension's panel before telling the extension its
   addresses: `L/packages/test-runner/src/attempt-lane/live/attempt/session.ts:82` calls `openChromeChatSession`
   without `addresses`, and `open-chrome-session.ts:57` opens the panel page.
   - While disconnected, the panel's reachability reader probes the product default `http://127.0.0.1:3000`
     (`L/apps/extension/src/panel/getting-started/reachability/reader.ts:55-57`, `shared/constants.ts:2`).
   - That is a loopback origin outside the policy, so the guard asks the proof (`network-guard.ts:109-117`). The proof
     memoizes the primary's health at session open, and 3000 fails.
   - `docs/working/usable-client-plan/reports/proof-network-order.md` records this probe and fixes it for the chat
     check only: "`addresses` is optional so the other callers (attempt lane, perturbations) are unchanged".
3. **The state change before /book.** The script's `accept-cookies` press (step 0004, `t115 button "Accept all"`)
   runs `mutate('set-consent', ...)` (`L/apps/scenario-lab/src/scenarios/company-website/client/shell-script.ts:45`),
   which advances `mutationSequence`. At step 0006 the /book page loads its widget from the frame server
   (`pages/book.ts:17,21`). The proof compares that server's current health with the stale reference, the request is
   aborted `blockedbyclient`, and the frame shows Chrome's error page. `network-guard.ts:114` also caches the failed
   proof for that origin for the rest of the session.

The extension's capture then names the unanswered frame (`FRAMES 4 did not answer`). The view has no Wrenfield line,
and `pressOf` throws (`scripts/evidence.ts:79`).

### Class

Lab defect, in the test-runner network guard's origin proof. Its trigger is the attempt lane opening an unconfigured
panel. This is not a product, page-diff or script defect.

### Evidence

- `steps/0006-tool-core.run_node/page.txt`, the look after "Book a service": `URL ~/book`, `FRAMES 4 did not answer`.
  The page holds only the site shell (`t137 h1 "Book a service online"` ... `t168 clickable "Chat"`). No branch,
  service or slot line appears.
- `steps/0006-tool-core.run_node/meta.json`: `"status": "ok"`, `"resultCode": "web.action.succeeded"`. The click
  worked. `look.after` took 93 ms, so this was not a capture timeout.
- The page channel is not at fault. In `model/evidence_tool_decision-003.request.json` the deliveries are: home
  `whole`; home `changes` (after accept-cookies); then `/book` as a **whole** delivery. A scratch reader
  (`<scratchpad>/diag-extract-whole.mjs`) printed: `last whole equals step page.txt: true contains Wrenfield: false`.
  No diff was applied to /book, so `applyPageChanges` and the D1/D2 keys play no part.
- `stopped.jpg` shows `127.0.0.1:50299/scenarios/company-website/book` with the widget area grey and Chrome's
  broken-document icon. That is a failed frame load, not a widget still drawing.
- The Lab log `scripted-round/company-website-saturday-certificate.log` has no guard line. The attempt lane never
  calls `guard.violations()`; only `audit-asked-changes.ts:85` and `run-chat-check.ts:206` do. This is the one link
  the recording cannot show.
- An offline proof uses the lane's built `network-guard.js`, `frame-origin-proof.js` and Scenario Lab
  `.lab-instances/paid-bigbox/dist/server.js`, with headless Chromium and no extension or model
  (`<scratchpad>/diag-widget-frame-probe-stale.mjs`). It runs a guarded context, opens the home page, makes a
  navigation to `http://127.0.0.1:3000` (the panel's probe), then opens /book:

  ```
  mutateBetween=false ... widget has Wrenfield: true   violations [{"...127.0.0.1:3000/api/health"...}]
  consent mutation 200 {"status":"changed"}
  mutateBetween=true  frames ["http://127.0.0.1:51006/scenarios/company-website/book","chrome-error://chromewebdata/"]
    widget has Wrenfield: false
    violations [{"kind":"request","destination":"http://127.0.0.1:3000/api/health",...},
                {"kind":"request","destination":"http://127.0.0.1:51005/scenarios/company-website/booking-widget","resourceType":"document"}]
  ```

  Without the early probe, the frame loads either way (`<scratchpad>/diag-widget-frame-probe.mjs`: `fresh` and
  `after-consent-mutation` both `widget has Wrenfield: true`, `violations []`). The fixture and the guard policy are
  sound. The memoized reference is the defect.

`<scratchpad>` is `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1bda39b1-1940-4a03-9ca6-eeeb61191390/scratchpad`.

### Proposed fix (smallest general)

In `frame-origin-proof.ts`, prove the candidate is the same Scenario Lab by its stable identity, not by the whole
health body. Read `provenance.ownerEpoch` (a random UUID per store, `state-store.ts:12`) from each server and compare
it, with no memo of a moving body. One test should cover: the reference taken, then a mutation, then a new candidate,
which must still be proven.

Two further changes remove the trigger and make the next failure visible. Neither replaces the fix above:
- In `session.ts:82`, pass `addresses` as `run-chat-check.ts:130` does, so the panel never probes `127.0.0.1:3000`.
- Have the attempt lane write `guard.violations()` into the attempt report. A blocked frame then names itself.

### Will it hit the other scripted tasks?

It hits only tasks that need content from the Lab's frame origin after the site's state changed in the same browser
session.
- **crossborder-marketplace, everything-store, professional-network:** these scenarios never use `alternateOrigin`.
  Not affected.
- **local-classifieds:** its map frame comes from the frame origin.
- **social-network-feed:** its video embeds come from the frame origin.
- For those two, the blocked frames would show as `FRAMES n did not answer` and guard violations. Neither task needs
  those frames. Not verified by a run.
- **Other realistic tasks that do need the frame origin** would break the same way: bigbox checkout's card frame,
  job-board's apply frame and auction's description frame.

## Failure 2: apprentices, attempt 2 did not end on the saved Flow

### What attempt 1 saved, and why it is "unproven"

- Attempt 1 explored with 12 decisions and completed. Its judge (step 0026) said yes, with
  `"evidenceProjection":{"version":1,"missing":[]`.
- It saved an 11-node Flow. `attempt-report.txt`: `flow ... unproven`, `0 whole-Flow runs from step 1`.
- Under Answer First that is expected. No judged whole run of this Flow exists yet, so the next replay is that run.
  `C/framework/automation-service/service/answer-first/completion/replay-stands.ts:12,67` (`flow_not_proven`, "this
  run is that run").
- "Unproven" is not the defect.

### What attempt 2 did

- **It took the run of the saved Flow.** Steps 0027-0040 are the Flow's own steps:
  - navigate, then 0028 `dom-click ended` (`main.s2`)
  - 0030 click, 0031 scroll, 0032 `dom-click ended` (`main.s6`), 0034 `dom-click ended` (`main.s8`)
  - scroll, wait, click, wait, and 0040 `dom-extract_list succeeded`
- The attempt note in `steps/0044-decide/request.txt` (line 60) says: `"happened":"The saved Flow ran from its start
  to its end, and that was not accepted as the result yet."`
- For steps 2, 5 and 6 it says: `"What stood in front of the page when this was saved was not there this time, so
  there was nothing to answer."`
- These are the three cover dismissals (Accept all, the chat greeting's Close, the newsletter's "No thanks"). Attempt
  1 had already cleared them on the site.
- Step 0041 (note): `The saved Flow's replay was judged, because it deviated from the accepted run: flow_not_proven.`
- Step 0042 (judge) said yes: `"answersRequest": "yes"`, 4 rows checked (Rhian Taverner, James Whitlock, Ollie
  Pratchett, Megan Ashdown), `"defects": []`.
- **Core held that yes as unsure.** The same attempt note says: `"lastCheck":{"verdict":"unsure","reason":"The check
  said yes, but Core held it unconfirmed: Some required evidence was not available, so the result remains
  unconfirmed. The evidence Core could not read: n:2 (web_judge.evidence_unrecognized); n:6
  (web_judge.evidence_unrecognized); n:8 (web_judge.evidence_unrecognized)."}`
- The attempt then went back to deciding (0043 onward), and Core refused each completion:
  - 0049 judge yes, then 0050 `refused answer_first.judged_unsure`
  - 0053 `refused answer_first.same_evidence`
  - loop steers at 0052, 0055, 0062 and 0069
- It ran until the script's 24-decision cap: `model/calls.jsonl`, ordinal 25 `"refused":"The script for
  company-website-apprentices expects no request 25 of kind evidence_tool_decision"`.

### Cause

A sometimes-present step that the replay passed over is projected as missing judge evidence. Any such gap makes Core
hold the judge's yes as unsure:

1. **Core projects every Flow step, passed over or not.** `C/runtime/result-verification/run-trail/of/attempts.ts:96-109`
   (`stepOf`) builds `evidence: attempt.outputs ?? {}` for every step and sends it through the host projector. That
   includes a step the engine passed over, whose outputs are empty.
2. **The web projector calls empty evidence unrecognized.** `L/domain/src/runtime/llm-evidence/judge-evidence/project.ts:105-107`
   finds no data, action, state or page in that empty evidence and pushes `web_judge.evidence_unrecognized`.
3. **Any gap holds the yes.** `C/runtime/result-verification/verdict/result-verdict.ts:46-50` turns any non-empty
   `evidenceProjection.missing` into `unsure` / `core.result.semantic_evidence_missing`. This happens whatever the
   judge said.

Core's own rule says these steps are no deviation (`replay-stands.ts:23-26`: "a sometimes-present step whose control
was not there"). The trail still turns them into required-evidence gaps.

The gaps stay in the trail for the rest of the attempt: judge 0049 carries the same three. So no later completion can
be accepted, and the attempt cannot end except on its budget. This breaks "a task ends only with its final result or
with its budget gone".

### Class

Product defect. The fix belongs in Core (the run trail decides what to project; the framework knows the step was
passed over). The code is emitted by the domain projector, which cannot see the framework's `skipped` facts: the
projector's input holds no framework object, which is passed to `automationStudioResultTrailSemanticStep` separately.

The answer is not at fault: the oracle rows were right in both attempts. Nor are W3's drafting, the result read or the
continuation proof at fault. Attempt 2 took the run as it should.

### Evidence

- The judge request after the replay, `steps/0042-judge/request.txt`:
  - line 160: `{"n":2,"did":"web.output.dom-click","on":"Accept all","outcome":"succeeded, route skipped, passed
    over","found":{"role":"action","evidence":{"source":{...main.s2...}},"missing":["web_judge.evidence_unrecognized"]},"framework":{"status":"succeeded","route":"skipped","consequences":[],"skipped":{"reason":"target_absent","code":"executor.ready_state.not_shown","notDone":true}}}`
  - lines 172 and 178 show the same for `n:6` ("Close") and `n:8` ("No thanks, I will pay full price")
  - `"evidenceProjection":{"version":1,"missing":[{"source":"n:2","codes":["web_judge.evidence_unrecognized"]},{"source":"n:6",...},{"source":"n:8",...}]}`
- Attempt 1's judge, `steps/0026-judge/request.txt`: `"evidenceProjection":{"version":1,"missing":[]`.
- `steps/0028`, `0032` and `0034` `meta.json`: `"status": "ended"`, nodes `main.s2`, `main.s6` and `main.s8`.

### Comparison with bigbox (`run-mwwvelrb-46358790`)

- Bigbox's attempt-2 replay also deviated with `flow_not_proven` (step 0043) and was judged (0044), and that yes
  stood. Attempts 3 and 4 then "stood on its record" (0063).
- Every one of its replay steps `succeeded`; there is not a single `ended` Flow step. So no step was passed over and
  no gap was raised.
- The reason: its script takes the first-visit detours out of the draft (`scripts/bigbox-retail-rated-delivery-towels.ts:12-13,114-115`,
  `DETOURS` and `amend_draft`). The apprentices script keeps them, which is a fair thing for a model to do.

### Proposed fix (smallest general)

- In Core's `run-trail/of/attempts.ts` `stepOf`, do not send a step the engine passed over through the host projector
  when it has no outputs (`attempt.skipped` set, `route: "skipped"`). It produced no evidence, and its `framework`
  facts already say what happened, so it gets no `judgeEvidence` gap.
- Keep the domain projector strict for steps that ran.
- Add a Core test: a trail with a passed-over step yields `evidenceProjection.missing: []`, and a judge's yes over it
  stands.

A secondary script change would make the next failure name itself at once: give the apprentices script the
attempt-note guard that `company-website-saturday-certificate.ts:94-95` has, so a decision after the Flow's run is
refused at request 13 instead of the cap. It is not the cause.

### Will it hit the other scripted tasks?

It hits any task whose saved Flow keeps a cover step that a later attempt passes over because the site remembers it
was cleared. Whether a cover comes back on attempt 2 depends on site state, which I did not check per scenario.
- **crossborder-marketplace:** likely. It has `COVERS` (welcome offer, cookies, notifications) and no draft edit drops
  them.
- **everything-store:** likely. It has "Not now" and "Accept" presses and no drop.
- **local-classifieds:** likely. It keeps the "Allow all cookies" step on purpose (lines 187-191: "the cookies step
  the site may ask again").
- **professional-network:** likely. It has "Not now" and cookie "Accept" presses; its amendments only make the result
  and repeat the accept.
- **social-network-feed:** probably not. Its script presses no cover.
- **company-website saturday-certificate:** likely, once failure 1 is fixed. It has the same covers and no drop.

## Commands run and observed results

- Read the run folders, step files, model requests, the Lab logs and `stopped.jpg` with Read, Grep and shell tools.
- `node <scratchpad>/diag-extract-whole.mjs <run>/model/evidence_tool_decision-003.request.json <run>/steps/0006-tool-core.run_node/page.txt`
  printed the three deliveries (home `whole`, home `changes`, `/book` `whole`) and
  `last whole equals step page.txt: true contains Wrenfield: false`.
- `node <scratchpad>/diag-widget-frame-probe.mjs`, with no early probe, printed `widget has Wrenfield: true` and
  `violations []`, both fresh and after a consent mutation.
- `node <scratchpad>/diag-widget-frame-probe-stale.mjs` (the output is quoted above):
  - First version: the 3000 probe was a page `fetch` that the page's CSP stopped before the guard, so it proved
    nothing.
  - Corrected: the probe is a navigation and the mutation uses the real consent choice `all`. Without a mutation the
    widget loads. With one, the frame is `chrome-error://chromewebdata/` and the widget request is a violation.
- I did not re-run the Lab task. The brief allows one re-run, but the lead's scripted round was still running on the
  same `paid-bigbox` instance (everything-store waiting for a heavy slot at 18:30). A concurrent run would have
  collided with it. The attempt lane's missing violation log means a re-run would not have shown the guard verdict
  anyway.

## Not verified

- **The guard's verdict on frame 4 in this run.** The attempt lane does not record it, nor any browser network log,
  so the 127.0.0.1:3000 probe in this session is inferred, not quoted. The inference rests on three things: the
  documented always-on panel probe in the attempt lane, the error-page frame in `stopped.jpg`, and the offline
  reproduction.
- **Whether earlier saturday runs met the same block.** For example, run-mwov0vf8-41ab862a on 2026-11-20 is after
  the reader landed on 2026-11-16. Its attempts 2-4 found `main.s5` "gone" on a complete look (t995 report). That
  fits a blocked widget frame, but I did not check it.
- **The fix proposals.** They are not implemented or tested.
- **Per-scenario site state.** I did not check whether each scenario's covers come back on a later attempt.

## Open questions or contradictions

- `proof-network-order.md` (t915 follow-up) knowingly left the attempt lane unconfigured. AGENTS.md says the guard
  must stay strict, and that is right. The defect is the proof's memoized body, not the strictness.
- The apprentices script cap at 24 decisions counts attempts 1 and 2 together (12 + 12). That is why the refusal
  came at request 25 and not when the replay's result was held.
