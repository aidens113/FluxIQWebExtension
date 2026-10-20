# t730-e1 job-board typing mode: report

## Outcome

Done. The job board has a new mode, `extended-application`, which you arm through the site's own `set-mode`. In that mode, Talentloom's application form adds a section called "A few more questions". The section holds every construct the blocked typing test needed.

The test "native numeric/date values survive sanitization; malformed and refused edits stay truthful" now runs on that form. It makes the same assertions as before and no longer starts its own HTTP server. The whole spec file passed headed, 3 of 3, in two separate runs.

All 62 job-board unit tests pass: the 57 that were there before, plus 5 new ones. The `in-place-filters` mode still passes its 4 tests.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs`.

- `apps/scenario-lab/src/scenarios/job-board/types.ts`: added `extended-application` to `jobBoardModes`, with a doc entry. It has no manifest variant, and no live task, repair task or person check changed. The form sends the same payload as before, so the state is the baseline's.
- New `.../job-board/ats/extended-questions.ts` (`extendedQuestions(posting)`): the markup for the section. It is prefilled "from your Talentloom profile" with synthetic values, and it carries its own `<style>` so the baseline markup stays byte-identical. The fields, with what each stands in for from the old page:
  - `requisition_number`: a read-only number field in light DOM, holding the posting's own digits (4471 for QM-4471). Replaces `#readonly`.
  - `years_experience`: number, `step=any`, value 7. Replaces `#number`.
  - `reports_count`: number, value 4. Its keydown refuses `.`, `,`, `e`, `+` and `-`. Replaces `#keycancelled`.
  - The native typed fields `start_date` (date, value 2026-09-01), `call_time` (time), `qualification_month` (month), `interview_week` (week) and `interview_slot` (datetime-local).
  - `hours_per_day`: number, value 8. Its input handler puts 8 back. Replaces `#revert`.
  - `assessment_day`: date, value 2026-09-01. Its `beforeinput` is cancelled. Replaces `#cancelled`.
  - `office_days`: number, value 3. On change it is replaced by a fresh node. Replaces `#detached-number`.
  - `preferred_name`: text, value "Sam". On input it is replaced by a fresh node. Replaces `#detached-text`.
  - `current_employer`: text. 10 ms after a change, a full-window dialog opens: "Hide this application from X?", with the buttons "Hide it from them" and "No thanks". Focus stays on the field. Replaces `#covered-after`.
  - `referral_code` (RF-58213): put back 10 ms after a change, with a note. Replaces `#delayed`.
  - `agency_reference` (AG-30418): put back in a microtask after a change, with a note. Replaces `#microtask`.
  - `account_password`: a password field. Replaces `#password`.

  The baseline form's own `first_name` replaces `#text`. The page text uses no test vocabulary and adds no test ids. The dialog uses `aria-labelledby` rather than an `aria-label` starting with "Close", which the site-wide test forbids.
- New `.../job-board/ats/extended-script.ts` (`extendedQuestionsScript()`): the behaviours listed above. It is appended after `formScript` and reuses that script's `field`. The fresh node is built with `cloneNode()` and then `value = defaultValue`. This matters because cloning an input copies its typed value. Each re-rendered node gets the handler again.
- `.../job-board/ats/embed-pages.ts`: `renderApplicationForm(context, posting, mode)` inserts the section before the two checkboxes and appends the script, but only when the mode is `extended-application`.
- `.../job-board/route.ts`: passes `state.mode` to `renderApplicationForm`, which `embed/job_app` serves.
- `.../job-board/ats/index.ts`: the barrel exports both new functions.
- New `.../job-board/ats/tests/extended-application.test.ts`, with five tests:
  - Arming the mode resets the board.
  - In every other mode, the form is byte-identical to the baseline. The extended form minus the section and the script is exactly the baseline. The native types and the read-only requisition are present, and the form has no test ids.
  - The route serves the extended form only once the mode is armed.
  - In a browser (headless Chromium, real keyboard), every behaviour holds:
    - The refused `.` key gives `15`.
    - The hours go back to 8.
    - A cancelable `beforeinput` on the assessment day is prevented.
    - The requisition field is `readOnly`.
    - Both codes settle back to their prefilled values, with their notes.
    - The typed-into nodes are detached and the live fields hold "Sam" and "3".
    - The employer dialog appears and "No thanks" closes it.
    - No page errors occur.
  - On baseline, the form has none of the extra fields.
- `apps/extension/e2e/runtime/tests/sanitized-field-typing.spec.ts`: the first test was rewritten.
  - It arms the mode with `mutate(lab, "job-board", "set-mode", …)` and opens `/scenarios/job-board/embed/job_app?for=quillmark&token=QM-4471` through the file's existing `openScenario`.
  - It opens Talentloom's own address at the top level rather than inside the careers page's frame, so the worker's selectors reach the form.
  - Every original assertion is kept with the new selectors and the site's values: 4, -3, 2026-10-07, 8, 2026-09-01, 4471, `["a","ab","abc"]`, the password not echoed, 0 submits. `detachProof` is now `{enters:0,text:"Sam",number:"3"}`.
  - `window.proof` is now filled by passive listeners the test attaches:
    - submit on the form;
    - input on `first_name` and `years_experience`;
    - Enter on `current_employer`;
    - Enter on the two re-rendered fields, on the original nodes (so an Enter sent to a detached node is still seen) and through a passive document capture listener.
  - The `node:http` server, the inline HTML and the `createServer` import are gone.
  - The test calls `test.setTimeout(150_000)`, with a comment giving the reason. The config's timeout is untouched.

## Commands run and observed results

- From `apps/scenario-lab`: `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"` → `"stored in the shared store (1096 file(s), …)"`, which means the TypeScript compiled.
- `node --test dist/scenarios/job-board/ats/tests/*.test.js` → `# tests 5 # pass 5 # fail 0`.
- `node --test dist/scenarios/job-board/tests/*.test.js dist/scenarios/job-board/board/tests/*.test.js dist/scenarios/job-board/ats/tests/*.test.js dist/scenarios/job-board/breadth/tests/*.test.js dist/scenarios/job-board/qualification/tests/*.test.js` → `# tests 62 # suites 4 # pass 62 # fail 0`.
- From the repo root: `pnpm --filter @fluxiq-web-extension/extension test:e2e:build` → `extension build: e2e-chromium: verified 22 files`. The cache said "inputs changed while it ran (apps/extension)", because another agent was editing in this tree.
- From `apps/extension`: `pnpm exec playwright test -c e2e/playwright.config.ts e2e/runtime/tests/sanitized-field-typing.spec.ts --headed --workers=2`, four runs:
  - Run 1: `3 passed (1.8m)`.
  - Run 2: `1 failed, 2 passed`. The password test failed inside `launchExtensionSession` (extension-context.ts:61) before its body ran.
  - Run 3: all 3 failed within 54–327 ms with `environment.missing: E2E extension artifact not found at …dist/e2e-chromium/manifest.json`. Another agent was rebuilding the extension dist in this checkout at the same time.
  - Run 4, after rebuilding (`verified 22 files`) and running straight away: `3 passed (1.2m)`. The rewritten test took 55.1s, the store test 52.7s and the password test 10.7s.
- From the repo root: `node scripts/structure-audit.mjs` → exit 1 with `1 violation(s) across 1 rule(s)`. The violation is `apps/scenario-lab/src/scenarios/professional-network/tests/in-place-paging.test.ts` importing `../search/in-place-paging-script.js`, which is another lane's file. No line names a job-board or `sanitized-field-typing` path. It also printed "1 baseline entries can be lowered", which is not mine to record.

## Not verified

- I did not run a standalone typecheck of the spec file; Playwright transpiled and ran it. The scenario-lab TypeScript compiled through its build.
- I ran no full suites and no Firefox run.
- The rewritten spec passed in 2 of 4 runs. The other 2 failed at extension launch with the artifact missing, before the test body ran. I attribute that to the concurrent rebuild, not to this change, but I did not prove run 2's cause beyond its stack trace.
- I did not check that the extended form still submits end to end with the extra fields filled in. The payload and validation are unchanged, and the baseline submission paths still pass in `browser-paths.test.ts`.

## Open questions or contradictions found

- The spec opens Talentloom's form at its own address (`embed/job_app`), not through the careers page's iframe. Real ATSs serve the same form at a hosted URL. If the supervisor wants it opened inside the frame instead, that needs frame targeting in the worker runner.
- Another agent rebuilt `apps/extension/dist` in this checkout while my Playwright runs were in progress. Under the AGENTS.md worktree rule, concurrent validation in one checkout reports false failures.
- The structure audit fails on the professional-network test import above, which is outside my paths.
