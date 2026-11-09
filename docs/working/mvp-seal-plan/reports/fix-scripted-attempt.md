# Fix: scripted two-attempt proof on integration round 2

## Outcome

Done. The scripted-model script forms now answer the judge the way Core's judge schema asks since t875. The proof passes both attempts again. No Core change was needed.

## Cause

The cause is not a product regression. Lane A (t875, Core `4785728ae`, then `bd81a0452`) made the judge of an attempt with no Flow (`metadata.source: answerFirstJudge`) require `diagnosis.checked` and `diagnosis.answerRecords` (`runtime/llm/verification-checked/reply-required.ts`). A yes over rows must also stand on them (`result-verification/cited-yes/records-yes.ts`): it cites the stored rows and says how many records the site shows. Lane A updated Core's own scripted judge (`answer-first/tests/fake-library.ts`, `judgedYes`) but not this repository's attempt-lane scripts. These still replied `{answersRequest: "yes", defects: []}`.

How far the failed run got (run-mw9tqkp0-228b64e4): attempt 1 explored, saved the three tables, read the 5 saved items, and ran its Flow forward. At step 57 it said complete. Judge step 0058 came back `llm.provider_output_invalid` (`content_off_shape`, missing `response.diagnosis.checked` and `response.diagnosis.answerRecords`). Core asked the judge again at 0061 and 0064, with the same reply each time. The 4th ask (0067) hit the script's three-reply limit ("expects no request 4 of kind loop_verification"). Attempt 2 never started. Asking again after an off-schema reply is the right behaviour, since a task ends only with its result or its budget. The script's reply was the defect.

## What changed (packages/test-runner/src/attempt-lane/scripted-model/scripts/)

- New `judgement.ts`: `scriptedJudgement(request, said)` builds the diagnosis with `checked` and `answerRecords`.
  - A yes cites every held sample row by Core's label rule (the first of its set's columns that holds text). A no or unknown cites none.
  - `answerRecords` is `{asked: true, siteShows}`, because every scripted task asks for a table. `siteShows` defaults to the rows held, which is what a judge that believes what it is given would say.
- `local-classifieds-save-dining-tables.ts`: the credulous `answersRequest` (plain forms and again-press) goes through the helper. `answersFromTheRows` (again-check and run-again) still checks that the three tables are in the rows. Its yes now reads `siteShows` off the judge's `endView` saved-items page: the site's own "N saved items", or failing that the item links it lists. If the end view is not the saved page, it throws instead of guessing. Its no now carries both keys.
- `company-website-apprentices.ts`, `crossborder-marketplace-free-hubs-under-ten.ts`, `everything-store-batteries-and-descaler.ts`, `professional-network-accept-messaged-invitations.ts`: their bare yes/no replies go through the helper. Each task asks for a table. They would fail the same way.
- `tests/local-classifieds-save-dining-tables.test.ts`: the judge helper now passes an end view. New assertions cover the cited rows, the count read from the page (5 with two items saved earlier, 4 from the item links when there is no count line), the refusal when the end view is off the saved page, and the again-press zero-row yes.

The intent of each form is unchanged: again-check still judges from the real rows (and now also from the page's count), and again-press still says yes to whatever it is shown. No oracle and no product guidance was touched.

## Commands run and observed results

- `node ../../scripts/check/core-build.mjs && node scripts/domain-dist.mjs && node ../../scripts/build-cache/cli.mjs test-runner:build` (packages/test-runner): Core build current, test-runner build stored, no tsc errors. The domain step noted "inputs changed while it ran", which is the other worker editing domain.
- `node --test "dist/attempt-lane/**/*.test.js"` (packages/test-runner): `# tests 118 # pass 118 # fail 0`.
- `node scripts/structure-audit.mjs` (extension): `structure-audit: passed (244 warning(s), 552 baselined)`. The only warning on a touched file is the dining script at 468 lines; it was already 448, past the 400-line advisory.
- Free memory was 1.92 GB, then 2.75 GB before launch (waited).
- `FLUXIQ_ATTEMPT_SCRIPT_FORM=again-check pnpm lab attempt local-classifieds --task local-classifieds-save-dining-tables --authoring-mode answer-first --scripted-model --attempts 2` -> `exit 0`, `{"status":"passed",...,"attempts":[{"attempt":1,"answerVerdict":"right","ended":"achieved","path":"explore","calls":25},{"attempt":2,"answerVerdict":"right","ended":"achieved","path":"run_flow","calls":1}],"secondStartedFromFirst":true}`. One judge request per attempt (`loop_verification 1`, `2`). Evidence: test-runs/attempts/run-mw9utsl4-d6c55eea.

## Not verified

- The other four tasks' scripted runs and the other dining forms were not run in the browser. Only their unit tests ran.
- `scriptedJudgement` counts every record set as held. A run that stores a working set Core sets aside would be cited and counted wrongly. None of these honest paths store one.
- Core vitest and Core's structure audit were not run, because Core was not changed.

## Open questions or contradictions

- Lane A's commit message said the extension-side scripted judges would need the same move. It was not done when the lanes merged. Any other provider-free harness that scripts a Flow-less judge outside packages/test-runner was not searched for.
