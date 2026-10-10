# t421: R4a chat and overlay wording

## Outcome

Done for all six findings. One Core test outside this brief's ownership now fails
because of the intended wording change (see Open questions). Nothing committed.

## What changed and why

Evidence: R4a `run-mv2nlh9l-52e476da` (UI review JSON, command attempts, `snapshots/live-llm.json`) and the
debug report's UI section.

1. **"it wasn't on the page" for a box in plain sight.** Source: Core `ui/activity-action/failure-reason.ts`
   read `web.target.not_found` (the type step's code; its attempt shows "No target resolved from selector
   #fb1l6ufkg ... 3 control(s) of the same family are on the page") as a page miss. Split the rule:
   `not_found|no_match` now say "FluxIQ couldn't find it where it was saved" (a list read: "FluxIQ couldn't
   find the list where it was saved"); `missing|absent|gone` keep "it wasn't on the page". Core codes still
   never read as page misses (the filter now excludes both entries). Extension `shared/activity/wording.ts`
   `toolOutcome` said "couldn't find it on the page" for the same codes and now takes Core's words for
   `not_found|no_match`, so the status line and the card agree.
2. **"Clear field: the step wasn't accepted".** The code was `web.action.rejected.output_not_observed`; no
   rule matched its last segment, so the `rejected` segment gave "the step wasn't accepted". Added an
   `output_not_observed|not_observed|state_mismatch` reason: "it ran, but the site set the box back" for a
   typing or clearing step (kind `type`), "it ran, but didn't find the rows it should have" for a read, and
   "it ran, but the page didn't change the way it should have" otherwise.
3. **"handle" / "resubmitting" in the chat.** The model's reason passes through Core
   `runtime/activity/wording/person-words.ts` (via `reason-text.ts`). Added: "<control word> handle" ->
   the control ("quantity field"), "the/a/fresh/current... handle" -> "... control", "handle id" ->
   "control", "resubmit[s|ted|ting] [the Flow|it]" -> "send[s|sent|sending] <it|the Flow> again",
   "resubmission" -> "sending it again"/"Flow sent again". "to handle the popup" (verb) is left alone. The
   R4a sentence now reads "The quantity field failed in the trial; I will re-read the item page to find
   the current quantity input before sending it again."
4. **Start card said the model key was missing.** Cause: the panel reads key readiness once, when the empty
   latest chat first shows (`panel/chat/chat-panel.ts`), from Core's `secret-keys snapshot`. In a Lab run
   the panel opens before the Lab installs its key (`packages/test-runner/src/live-llm/secret-key.ts`:
   "created ... tells a caller its session predates it"), so the panel read "missing" correctly at that
   moment and never looked again; a person who adds a key in FluxIQ hits the same stale line. Fix: the
   panel's existing 4 s poll (visible panel only) re-asks readiness while it reads "missing" and the empty
   latest chat is on screen; it stops once a key is enabled. One chat panel serves the Chrome side panel
   and the Firefox popup (`panel/shell/mount-panel.ts`), so both get it.
5. **"Tick" for colour swatches.** All three R4a `web.dom.check` calls targeted `div`s (Space Grey, Spain,
   7-in-1) with no role or input type. Core `runtime/activity/wording/action.ts` now says a check whose
   element is a radio/option/menuitemradio/tab by role or input type, or says neither, as
   "Choosing “X”"; a checkbox/switch/menuitemcheckbox by role or input type, or a step with no element,
   is still "Ticking". `ui/activity-action/action-of.ts` lets a "Choosing" title override the `check`
   node id's verb, so the card reads "Choose · Space Grey" and the overlay "Choosing “Space Grey”".
   (Tag name is not read: Core's web-vocabulary audit forbids it.)
6. **Overlay "Build failed" with no reason.** R4a's build threw an
   `AutomationStudioFlowBootstrapGenerationError` (`flow_bootstrap.evidence_repeat_without_progress`) with
   no `ending`, so Core `runtime/activity/build.ts` emitted the bare title "Build failed", and the
   extension's detail line dropped it as an echo of the headline. Now, for a build's own error with no
   ending, build.ts asks the chat's own cause function (`automationStudioConversationCallCause("the build",
   ...)`, via the conversations commands barrel and the generation-failure barrel, loaded by dynamic
   import at failure time so activity gains no static edge upward) and emits label/title "Build failed:
   it kept trying without getting any further, so it was stopped" and text "It kept trying ... stopped.".
   The overlay shows "Build failed" over that line (the pacer's and overlay view's existing
   "Build failed: no list was found" path). Stopped builds and builds with an ending are unchanged.

Tests added or updated beside each: Core `failure-reason.test.ts`, `action-of.test.ts`,
`wording/tests/action.test.ts`, new `wording/tests/person-words.test.ts`, `activity/tests/scope.test.ts`;
extension `panel/chat/tests/chat-panel.test.ts` (new poll test, confirmed failing without the fix),
`shared/activity/tests/wording.test.ts`, and two chat expectations
(`stream/step/tests/messages.test.ts`, `view/tests/action-card-view.test.ts`) that pinned the old words.

## Commands run and observed results

- Core `npx vitest run src/ui/activity-action src/programs/automation-studio/runtime/activity` ->
  `Test Files 47 passed (47)`, `Tests 532 passed (532)`.
- Core `pnpm run check` (packages/fluxiq, tsc --noEmit) -> completed, no errors.
- Core `pnpm run build` (packages/fluxiq) -> built; dist carries the new words (extension consumes dist).
- Core `node scripts/structure-audit.mjs` -> `structure-audit: passed (322 warning(s), 1160 baselined).`
  (first run failed on a non-barrel test import and on `tagName` in action.ts; both fixed).
- Core apps/web `npx vitest run src/features/automation-studio/conversation/activity/steps` ->
  `Tests 1 failed | 23 passed`: `messages.test.ts:80` expects "it wasn't on the page" for
  `web.target.not_found` (outside this brief's ownership; see below).
- Extension `EXTENSION_TEST_BUILD_LABEL=t421 node scripts/test-extension.mjs panel/chat shared/activity
  content/activity-overlay` (from apps/extension) -> `# tests 446`, `# pass 446`, `# fail 0`.
- Extension chat-panel test with the poll line disabled -> `not ok 10 - a key added after the chat read it
  missing lifts the line on the next poll` (fix restored afterwards, then 11/11 pass).
- Extension `pnpm run build` (apps/extension; tsc --noEmit + bundles) -> chrome, firefox, e2e-chromium
  "verified 22 files".
- Extension `node scripts/structure-audit.mjs` -> `structure-audit: passed (184 warning(s), 651 baselined).`
  (first run failed on two packed `await settle(); await settle();` lines in the new test; fixed).

## Not verified

- No live browser run and no paid run: the overlay and chat words were checked through unit tests, not on a
  page. The poll re-ask was tested under a fake DOM with mocked timers, not in a real side panel or popup.
- Whether a real checkbox's element identity always carries `inputType` or `role`: a box the page draws as
  a plain element with neither now reads "Choosing".
- Long build-failure causes (refused-submission wording) on the overlay are cut by the pacer's bound; not
  looked at on screen.

## Open questions or contradictions found

- **Core `apps/web/src/features/automation-studio/conversation/activity/steps/tests/messages.test.ts:80`**
  now fails: expected `why: "it wasn't on the page"`, gets "FluxIQ couldn't find it where it was saved". It
  is the intended new wording; the line needs that one string updated (not in this brief's ownership).
- Finding 7's other half ("so the test follows what the Flow says to do when this step fails" when the Flow
  says nothing) lives in Core `runtime/activity/wording/recovery-choice.ts`, but saying it honestly needs
  the executor to pass whether the Flow has a failure route, and `executor/tests/failed-step-reason.test.ts`
  pins the words. Left unchanged; needs a brief that owns the executor.
- `apps/extension/src/panel/copy/step-copy.ts` still says "Ticking" for `web.dom.check` in recorder copy;
  outside this brief.
