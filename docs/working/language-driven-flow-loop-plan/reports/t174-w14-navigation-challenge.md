# t174-w14: a navigation that lands on a robot check says a person is needed

Worker report. Branch `task/t174-live-lane`, tree `fxwork/t174/!FluxIQWebExtension`. Nothing committed.

## Outcome

Done. `web.browser.navigate` onto a robot check now fails with `web.intervention.required`, and its `actual` begins with the closed word `captcha:`. It is never reported as a success. The page reading also had to be widened, because the brief's page mode (headings and labels only) cannot see crossborder's check: that page has no heading and no label. Details are under Contradictions.

## What changed and why

The navigate result is built in the background worker (`runtime/action-runner.ts` `navigationResult`), which has no document. The landed page's top frame is now asked instead.

| File | Change |
| --- | --- |
| `apps/extension/src/content/action-runtime/challenge-evidence.ts` | Page mode reads headings and labels as before. It now also reads all painted text, whitespace collapsed, when the page holds at most 1,000 characters (`INTERSTITIAL_TEXT_LIMIT`): a bare interstitial. Length is measured after collapsing, over the whole text. `renderedText` takes a limit. |
| `apps/extension/src/content/action-runtime/index.ts` | Barrel exports `challengeIn`. |
| `apps/extension/src/content/action-runtime/results.ts` | Doc comment only: the page read now covers interstitials, and the worker asks the same question. |
| `apps/extension/src/shared/page-challenge-message.ts` (new) | `PAGE_CHALLENGE_MESSAGE = "fluxiq.pageChallenge"` and `PageChallengeResponse = { challenge: "captcha" \| "credential" \| null }`. |
| `apps/extension/src/content/message-handler.ts` | Answers `fluxiq.pageChallenge` from the top frame only, synchronously, with `challengeIn(document.body, "page")`. It returns one closed word and never quotes the page. |
| `apps/extension/src/runtime/landed-challenge.ts` (new) | `readLandedPage(tabId, send)` asks frame 0 and waits at most 1,000 ms. It returns `robot_check`, `no_robot_check`, or `unread` with the reason. The sender is passed in because `background/index.ts` is the worker entry, not a barrel. |
| `apps/extension/src/runtime/action-results.ts` | `navigationChallengeFailure(expected)` builds a `USER_INTERVENTION_REQUIRED` record. `actual` is `captcha: the page the browser landed on is a robot check, which only a person can answer`. The landed URL is not quoted, because challenge redirects carry return paths. The result's `url` still says where the tab is. |
| `apps/extension/src/runtime/action-runner.ts` | A page that loaded is read before the verdict. `robot_check` takes precedence over the URL comparison and the movement check. `unread` leaves the result as it was and appends `whether the page is a robot check went unread: <why>` to the passed validation. A page that failed to load is not asked. |
| `apps/extension/src/runtime/tests/navigate-action.test.ts` (new) | The navigate section moved here from `action-runner.test.ts`, which had reached 840 lines against the 800-line limit. It has 6 new rows. |
| `apps/extension/src/runtime/tests/action-runner.test.ts` | Navigate section removed; header points to the new file; unused `automation-tab` import removed. |
| `apps/extension/src/content/action-runtime/tests/challenge-evidence.test.ts` (new) | 4 rows run against a hand-built page. |

Only `captcha` is judged at arrival. The page reading also returns `credential` for a code prompt, but only from its headings. "Two-factor authentication" heads ordinary account settings pages, so treating it at arrival would stop legitimate navigations. A code prompt is still reported through `results.ts` when an action's target is then missing.

## Commands run and observed results

- Failing first. Command: `EXTENSION_TEST_BUILD_LABEL=t174-w14 bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w14" pnpm --filter @fluxiq-web-extension/extension test`. Result: exit 1, `# tests 1228 # pass 1225 # fail 3`:
  - `not ok 432 - a bare interstitial ... is a robot check, though it has no heading`: `+ undefined - 'captcha'`
  - `not ok 1082 - a navigation that lands on a robot check says a person is needed, never that it succeeded`: `the landed page's top frame was asked`, `+ []`
  - `not ok 1083 - a navigation redirected onto a robot check ...`: `+ 'web.navigation.unexpected' - 'web.intervention.required'`
- The same command after the change: exit 0, `# tests 1228 # pass 1228 # fail 0 # cancelled 0`. All 10 new rows are `ok` (432-435, 1082-1087). The smoke test runs first in that script and passed.
- `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json` in `apps/extension`: both exit 0 with no output.
- `node scripts/structure-audit.mjs` (DS):
  - First run: 3 violations in my change, all fixed. They were `failure-as-empty` (a `.catch(() => undefined)`), `imports` (reaching into `../background/tabs`) and `file-lines` (the 840-line test file).
  - Final run: `structure-audit: passed (123 warning(s), 120 baselined)`. Warnings on touched files: `action-runner.ts` at 478 lines (it was 452, already past the 400-line advisory) and `action-runner.test.ts` at 593.
- Domain was not touched, so the domain test was not run.

## Trace: what Core and the Lab do with the code (read only, nothing changed)

1. **Domain to model.** The build runs a navigate as a node (`domain/src/runtime/llm-evidence/node-run/run.ts:306-321`). A non-succeeded result becomes `webActionFailureRefusal(result)`, and `action-failure/refusal.ts:45` maps `web.intervention.required` to `needs_person`. That refusal is returned as an ordinary tool result carrying a sanitized packet of the current page (`pageRefusal`). The model reads "what stands in the way is for a person alone to answer ... Do not try to get past it" (`tool-rejection.ts:96`). Because the navigate did not succeed, `arrivals.arrive` is not called, so the start location is not marked reached.
2. **Core build loop.** It does not stop for this. Core has no `needs_person` handling in `runtime/llm` or `runtime/flow-bootstrap`. `classifyRefusal` is used only by recovery exploration (`recovery/runtime-exploration.ts`, `recovery/annotation/exploration.ts`), and the domain's classifier (`harness-options/exploration-terms.ts:72`) stops only on `out_of_scope` and `cross_origin`. So `needs_person` is feedback charged to the budget. **The build does not end by asking the person.** It ends when the model completes or gives up, on the no-progress or repeat guards (`repeated-refusal.ts` only annotates repeats), or on the budget. No build failure code (`flow-bootstrap/generation-failure/codes.ts`) names a person-needed stop. Core's `user_intervention_required` category is acted on only in replay and recovery (`adaptive-orchestrator.ts`, `recovery/deterministic-diagnosis.ts`, `structured-diagnosis.ts`), where it is never offered to a model.
3. **Lab.** `packages/test-runner/src/flow-lane/creation/lane.ts:264-286` treats `permission_required` as the only non-proposal ending that can pass. Every other ending throws `RunnerFailure("runtime.behavior", "FluxIQ did not build a Flow from the task's instruction (<code>)")`. **So a build that stops for a robot check is judged a product failure (`runtime.behavior`).** There is no person-needed verdict, and nothing in the Lab answers the check for the person. The expected change on runs like 15 and 17: the model is told `needs_person` instead of success on each navigation onto the check. That should stop the blind re-navigation. It does not give the build a way to finish while the check stands.

## Not verified

- No live browser or Lab run (the brief forbids them), so these are unproven on a real page:
  - the frame's answer arriving on the real crossborder check;
  - `innerText` on real layout;
  - the 1,000-character threshold against real sites' ordinary small pages;
  - Firefox.
- `pnpm build` and `pnpm check` were not run.
- The content half of the round trip is proved only by a stubbed `chrome.tabs.sendMessage` and a hand-built page, not by `test:content`.
- The 1,000 ms deadline applies only to a frame that is silent. In production `attachTabForRecording` runs `ensureContentScript` first (`background/connection/content-attachment.ts:26`, read); on a real page the answer should come in milliseconds, but that was not measured.

## Open questions or contradictions found

1. **The brief's page mode cannot see crossborder's check.** `markup/verify.ts` has no heading or label: its words are in `<p>` and `<span>`, and `<title>Security check</title>` matches no pattern. As written, the brief's step 2 would change nothing for runs 15 and 17. I widened page mode to read a bare interstitial of 1,000 characters or fewer in full. This also widens `results.ts` `challengeGateFailure`, which is intended.
2. **Crossborder's reference script presses the robot check** (`crossborder-marketplace/manifest/steps.ts:88-89`, `pass-check` clicks `text="I'm not a robot"`). The product rule says FluxIQ must never do that. Under the rule, any hub-to-cart build that trips the check (every third search load) cannot reach a Flow without a person. Since the Lab judges that `runtime.behavior`, the supervisor needs to decide one of these:
   - the Lab plays the person and answers the check when FluxIQ reports `needs_person`;
   - the task counts a stop for a person as an expected ending, the way buy-hub counts `permission_required`;
   - Core's build loop ends on `needs_person` with a person-needed diagnostic the Lab can read.
   All three are outside this brief.
3. **Bigbox-retail's check is still not recognised.** Its heading "Robot or human?" and its text "confirm that you're human" match no `CAPTCHA_WORDS` pattern, and its manifest expects waiting it out (`pickup-towels-workflow.ts:35`). My change leaves bigbox unchanged.
4. **Domain doc drift, not edited:** `domain/src/runtime/failure/codes.ts:50-62` says `USER_INTERVENTION_REQUIRED` has "three producers". The worker's navigate is now a fourth.
5. **Documentation:** `fluxiq.pageChallenge` is a new content-script message. AGENTS.md asks for wire changes to be reflected in architecture docs, which I did not own or touch.
