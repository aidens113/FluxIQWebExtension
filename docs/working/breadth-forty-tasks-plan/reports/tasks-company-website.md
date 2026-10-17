# Report: tasks-company-website (t704)

## Outcome

Done. Four new live tasks on company-website, each with its own workflow, a literal oracle, browser proof that the recording passes it and that a plausible wrong path fails it, and an accepted provider-free dry run. The full scenario-lab suite fails only on shared-list assertions outside this brief's ownership (listed below), plus one job-board browser timeout that passes when run alone.

## Tasks

| id | kind | judgeBy | permissionPoint | what a correct run does |
| --- | --- | --- | --- | --- |
| `company-website-apprentices` (a) | navigate-and-extract | expected-dataset `extract-apprentices` | none | Reads the team grid to its last batch, pressing "Show more people" twice because the first press only shows a spinner. Keeps the 4 apprentices with name, role and branch, including the Sallowmere James Whitlock rather than the Eastmoor one. |
| `company-website-newsletter-signup` (b) | navigate-and-extract | expected-dataset `extract-newsletter-subscription` | none | Signs `ada.synthetic@example.test` up once, then reads its row (email, code `KL10-38450`) on the Offers & reminders page. The final account is subscriberCount 1 and nothing else. |
| `company-website-saturday-certificate` (c) | navigate-and-extract | expected-dataset `extract-saturday-certificate-slots` (count 0, records []) | none | Opens Corve Bridge, CP12 in the booking widget, and checks all three calendar weeks. Every Saturday reads "No online slots", so the answer is an empty table. Nothing is booked or paid. |
| `company-website-heat-pump-quote` (d) | navigate-and-extract | expected-dataset `extract-heat-pump-quote` | `send_or_publish` / `Send request` (personCheck: the human check, `completes`, not required) | Finds Sallowmere on Branches as the heat pump centre, then sends a heat pump installation quote naming Sallowmere, with contact by Text message and marketing unticked. Reads reference `KQ-72474`, service, contactBy and offers ("No") from the confirmation. |

None has a `variantId`. Every dataset column is named in its instruction.

## Exact entries for the shared tests (supervisor)

`scenarios/tests/realistic-site-live-tasks.test.ts`, additions list, sorted:
```
"company-website-apprentices",
"company-website-heat-pump-quote",
"company-website-newsletter-signup",
"company-website-saturday-certificate",
```
The length assertion goes up by 4 for this site (68 -> 72 if this site alone is merged).

`scenarios/tests/live-instructions.test.ts`, permission map:
```
"company-website-heat-pump-quote": { consequence: "send_or_publish", control: "Send request" },
```
ASKS_NOTHING:
```
"company-website-apprentices": "a read",
"company-website-newsletter-signup": "signs the person's own address up to the newsletter they asked for",
"company-website-saturday-certificate": "a read that books and pays nothing",
```
Hand-off map (test "every task that expects a hand-off is on a scenario whose person module knows its check", line ~237):
```
"company-website-heat-pump-quote": "completes:false",
```
A third shared file, not named in the brief: `apps/scenario-lab/src/tests/recording-descriptions.test.ts`, line 20, `assert.equal(count, 42)`. It counts every realistic-site workflow, and this site adds 4, so 42 -> 46 for this site alone.

## What changed and why

Fixture additions, all inside `company-website/`:
- `data/newsletter.ts` (new) and `data/index.ts`: `newsletterCode(email)` builds a `KL10-NNNNN` code derived from the address.
- `pages/newsletter.ts` (new), `client/newsletter-script.ts` (new), `route.ts` (`newsletter` route), `pages/index.ts`, `client/index.ts`: the "Offers & reminders" page. It has a sign-up form and lists the subscribed addresses with their codes and an Unsubscribe button. Unsubscribe gives the build a site control to reset its own act before re-running.
- `pages/shell.ts`: footer link "Offers & reminders" in the Help column, on every page.
- `state.ts`: `subscribe-newsletter` keeps an address only once, so a repeated sign-up is idempotent. New `unsubscribe-newsletter` operation.

Tasks and oracles:
- `live-tasks.ts`: 4 instructions, 4 rows and a doc note.
- `manifest.ts`: 4 workflows added, doc comment updated.
- `qualification/first-visit.ts` (new; shared chat/consent/newsletter opening steps).
- `qualification/{apprentices,newsletter-signup,saturday-certificate,heat-pump-quote}/{workflow,expected,index}.ts` (new). The literal `expected` files follow the existing `companyReviewExpected` pattern: initial account fact, final account fact plus path/details facts, and the records.
- `qualification/index.ts`: exports the new modules.

Tests:
- `qualification/tests/breadth-expected.test.ts` (new): checks each literal against the fixture data. Apprentices come from TEAM by role, and the grid places match TEAM indices. The code matches `newsletterCode`. Corve Bridge has no Saturday slots while Wrenfield does. The quote reference matches `normaliseQuote`. Each honest act yields the declared account, and wrong acts (a second address, the Phone default, the ticked marketing box) yield a different one.
- `tests/breadth-paths.test.ts` (new): browser proof. Honest recordings pass every oracle. Wrong paths fail it:
  - apprentices: stopping at the automatic batches, or taking the Eastmoor James Whitlock.
  - newsletter: a second address; a repeat of the same address stays one subscription, and Unsubscribe restores the initial account.
  - saturday: Wrenfield as the wrong branch.
  - heat pump: naming head office, or leaving the defaults.
- `tests/scenario.test.ts`: workflow list and task kinds list updated.

## Commands run and observed results

- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: passed (tsc, no errors).
- `node --test dist/scenarios/company-website/qualification/tests/*.test.js dist/scenarios/company-website/tests/scenario.test.js dist/scenarios/company-website/tests/breadth-paths.test.js`: all ok (5 + 3 unit, 4 honest, 7 wrong-path, 9 scenario).
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab test`: `# tests 718, # pass 712, # fail 5, # cancelled 1`. The failures:
  - `not ok 578 - every consequential task declares its permission point, ...` (shared permission map)
  - `not ok 580 - every realistic-site task either declares its permission point or is recorded as asking nothing` (shared ASKS_NOTHING)
  - `not ok 581 - every task that expects a hand-off is on a scenario whose person module knows its check` (shared hand-off map; adds `company-website-heat-pump-quote: 'completes:false'`)
  - `not ok 594 - qualification additions preserve the complete ordered original 57 tasks` (shared additions list)
  - `not ok 598 - all realistic workflow recordings have separate authored demonstration descriptions`: `46 !== 42` (shared count in `src/tests/recording-descriptions.test.ts`)
  - `not ok 292 - the job board in a browser`: one subtest was cancelled after 120 s during the full parallel run. Rerun alone (`node --test dist/scenarios/job-board/tests/browser-paths.test.js`): `# pass 11 # fail 0`. This change does not touch job-board.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (202 warning(s), 639 baselined)`, with no warning on a company-website file.
- Dry runs, with `FLUXIQ_TEST_TARGET=persistent-isolated` and the brief's command. Each exited 0, and each result line begins `{"status":"ready","providerCallCount":0,"lane":"created-flow","buildEntry":"chat","target":"persistent-isolated",...}` with:
  - `company-website-apprentices`: workflowId `apprentices`, judgement `{"judgeBy":"expected-dataset","stepId":"extract-apprentices","stepIndex":14}`
  - `company-website-newsletter-signup`: workflowId `newsletter-signup`, `stepId":"extract-newsletter-subscription","stepIndex":9`
  - `company-website-saturday-certificate`: workflowId `saturday-certificate`, `stepId":"extract-saturday-certificate-slots","stepIndex":15`
  - `company-website-heat-pump-quote`: workflowId `heat-pump-quote`, `stepId":"extract-heat-pump-quote","stepIndex":24`

## Not verified

- No live run. Whether the live judge also enforces `finalState` account facts for expected-dataset rows comes from the existing pattern (review/job-board), not from tracing the lane.
- The empty-answer judging of `saturday-certificate` relies on `minItems: 0` (D4), which the manifest validator required.
- The full scenario-lab suite with the shared lists updated was not run (those files are not mine).

## Open questions or contradictions found

- The brief names two shared test files. A third, `apps/scenario-lab/src/tests/recording-descriptions.test.ts` (workflow count 42), also has to change; the other site workers will hit it too.
- The new footer link and newsletter page appear on every company-website page, which other company-website live tasks now see too. Existing tests are unchanged and pass.
- In one debug run, the newsletter offer's scrim intercepted the footer click for more than 10 s after "No thanks". It did not reproduce in the test runs. If live runs show it, it would be a pre-existing race in the offer.
