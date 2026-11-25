# t1037 W3 phase 2, worker `text`: look phrasings removed from Core model text

## Outcome
Done. Remaining failures in the wider run are the parallel worker's files (evidence-loop, draft-amendment-feedback, repeat-policy, repair-exploration-tools, provider-throw), not mine.

## What changed and why (Core `packages/fluxiq/src/runtime/`)
- `flow-authoring/bootstrap/plan/flow-script-format.ts`: "are for looking" -> "are for reading the page"; "look first for the site's own filter" -> "first find the site's own filter".
- `flow-authoring/bootstrap/plan/issue-feedback.ts` (`EXTRACTION_FROM`, CRLF kept): "names a repeating structure ... that a detection of that structure found on the page you looked at: it exists only once you have detected the structure from one of its items" -> "... that the page view showed: it exists only once a list read has found the structure, from a handle in the view or its words"; "Detect the structure first and write the handle its answer gives" -> "Let the list read find its own list and write the handle its answer gives".
- `flow-authoring/bootstrap/candidate/submission/refusal.ts`: "look at that page (go there, then capture it) and copy the handle that view prints" -> "go to that page and copy the handle its changes or core.full_page print"; the three "Look at the page (again) ..." refusals (renumbered_by_reload, stale, not_unique) -> "Call core.full_page ..."; not_a_handle "look at the page the step runs on first" -> "call core.full_page on the page the step runs on first"; extraction_required "detect the list, then name it by the handle its view printed" -> "name it by the handle its view printed, or by its words".
- `flow-authoring/bootstrap/candidate/trial/view.ts` (NO_VIEW_NOTE, REFUSED_NO_VIEW_NOTE): "could not be looked at ... look at it again" -> "could not be read ... call core.full_page".
- `flow-authoring/bootstrap/site-reset/words.ts`: "a look that names" -> "a read that names" (x2), "Looking or navigating" -> "Reading or navigating", "make the look again" -> "make the read again", "Looking and navigating remain" -> "Reading and navigating remain".
- `flow-authoring/bootstrap/reset-settlement/words.ts`: "then look at the page" -> "then read the page again"; "on a look that names" -> "on a read that names".
- `llm/draft-amendment-feedback/did-not-work.ts`: "look at the page again" -> "read the page again with core.full_page".
- Tests updated to the new words: `plan/tests/issue-feedback.test.ts`, `candidate/tests/submission-refusal.test.ts`, `candidate/tests/trial-view.test.ts`, `plan/tests/flow-script-format.test.ts`, `reset-settlement/tests/value-settlement.test.ts`, `reset-settlement/tests/witnesses.test.ts`, `site-reset/tests/settlement-shapes.test.ts`, `site-reset/tests/trial-witness.test.ts`.
- Left alone: code comments, identifiers (`reason: "look"`, `lookAt`), `refusal.ts` text about "detection" in unknown-column/columns_changed advice (lines ~153-186, e.g. "Detect the list again ..."): still model-facing detection wording, not edited because it concerns stale columns; flag for review.

## Other look phrasings found, not edited (not owned)
- `runtime/project-agents/dispatch/reset/loop.ts:69` (ISSUED_WORDS, "on a look that names") and its test `project-agents/dispatch/tests/reset-loop.test.ts:10` (same sentence as site-reset words; should become "a read").
- `runtime/flow-authoring/bootstrap/action-permissions.ts:454` ("on a look that names this act under undoes", model-facing refusal).
- `runtime/automation-activity/wording/recovery-choice.ts:56` ("FluxIQ will look at the page and fix this step", person-facing activity text, with tests).
- `refusal.ts` header comments lines 13, 15 and `view.ts` header comments: comments only.

## Commands run and observed results
- `heavy-slot run t1037-text -- vitest-groups --groups=parallel,real-sql src/runtime/flow-authoring src/runtime/llm/draft-amendment-feedback src/runtime/llm/tests src/runtime/project-agents` -> parallel: "Test Files 1 failed | 478 passed | 1 skipped (480); Tests 1 failed | 5247 passed | 2 skipped"; real-sql: "Test Files 3 passed; Tests 32 passed". The failing test name was cut off by my `tail`; a rerun logging to `C:/Users/osrs_/AppData/Local/Temp/t1037-text-run2.log` was started (see Notes).
- Second run (parallel group, wider folders) had 15 failures: 14 in evidence-loop.test, draft-amendment-feedback.test, evidence-loop-tool-failure.test, evidence-loop-draft-shown.test, repeat-policy.test, repair-exploration-tools.test and provider-throw.test (core.run_flow tool lists, runAutomationStudioLlmHarness missing, draft row shape: the parallel worker's in-flight edits); 1 was mine (issue-feedback.test quoted the old EXTRACTION_FROM words), fixed. Then narrow rerun of bootstrap/plan, candidate, site-reset, reset-settlement -> "Test Files 96 passed (96); Tests 1195 passed (1195)".
- Core `node scripts/structure-audit.mjs` -> FAIL, all from the parallel worker's files: file-lines `runtime/llm/evidence-loop.ts` 802 and `evidence-loop-decision.ts` 801 (limit 800), and import-cycles through `framework/automation-service/service/candidate-failure/`. None are mine.
- Downstream `node scripts/check/model-text.mjs` -> "model-text: ok (203 scenario tokens, 568 model-facing Core files, 14457 string literals)".

## Not verified
Name/cause of the single failing parallel-group test; no typecheck (string-only edits).

## Open questions
Whether to also reword the "detection" language in refusal.ts unknown-column advice (W2 D13 may want it).

## Round 2 (sub-supervisor follow-up: amend_draft edits, `add`, detection, remaining looks)
Core `packages/fluxiq/src/runtime/`:
- `flow-authoring/bootstrap/instructed-acts/act/evidence.ts`: "name X there with amend_draft add on step N with act A" -> `with {"step": N, "change": "keep", "act": "A"}`; "run the press ... with add true and act A" -> "... with act A; a call that works is in the draft" (3 sites). Written as the JSON edit, not the words "amend_draft keep", because check.test.ts uses that phrase as the marker of the optional-step advice.
- `instructed-acts/check.ts` (~143): "say so with amend_draft add on that step and act set" -> keep the step with `{"step": <that step>, "change": "keep", "act": "<the act's id>"}`; "with add and act on the call" -> "with act on the call; a call that works is in the draft".
- `candidate/submission/refusal.ts` (~150-186): "detected/detection" -> "read" in the unknown-column and columns_changed advice; "Detect the list again ..." -> "Read the list again on the page as it is when the step runs, naming the list (the read finds its own list), and name the column by a key that read prints."
- `action-permissions.ts:454`, `project-agents/dispatch/reset/loop.ts:69` (ISSUED_WORDS): "a look that names" -> "a read that names"; "a look naming a ref" -> "a read naming a ref".
- `flow-authoring/bootstrap/authoring/draft-routing.ts:604`: "with add true as the span's last step" -> "so that it is the span's last step in the draft".
- Tests updated: instructed-acts/tests/{act-evidence,claim-verdict}.test.ts, candidate/tests/submission-refusal.test.ts, project-agents/dispatch/tests/reset-loop.test.ts.
- Left alone (person-facing): automation-activity/wording/recovery-choice.ts.

Found, not edited (out of my ownership; file only, not exhaustive per line): add-true / amend_draft-add advice in `llm/draft-amendment-feedback/{fallback.ts:51,way-out.ts:122,134}`, `llm/node-tools/rerun-check.ts:44,62,217-220`, `llm/decision-reading/own-keys-lifted.ts:5`, `flow-authoring/draft/amendment/said-numbers.ts:5` (comment), `flow-authoring/draft/entry.ts:89,108,117` (instruction constants; check for add wording).

Commands: vitest-groups parallel over `flow-authoring/bootstrap` + `project-agents` -> 2 failed (my tests quoting old words: submission-refusal columns_changed, check.test "amend_draft keep" marker), 4214 passed; after fixes, over instructed-acts + candidate + project-agents/dispatch -> "Test Files 82 passed (82); Tests 777 passed (777)". `node scripts/check/model-text.mjs` -> ok (569 Core files). Core structure-audit -> FAIL only on `runtime/llm/evidence-loop/` 26 files (limit 25), the llm worker's. No typecheck (strings and tests only).
