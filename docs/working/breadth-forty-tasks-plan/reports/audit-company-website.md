# Audit: company-website (t716)

## Outcome

Done. All 11 company-website rows in `REALISTIC_SITE_LIVE_TASKS` now have a verdict. Eight are ok as written.
Three had wording that could let a correct reader give a value the exact, position-by-position oracle rejects,
and are reworded. No oracle, fixture or recording changed.

## What changed and why

Files:
- `apps/scenario-lab/src/scenarios/company-website/live-tasks.ts`: three instructions reworded.
- `apps/scenario-lab/src/scenarios/company-website/qualification/tests/expected.test.ts`: one new test. It pins
  the review's price oracle to the whole Price line and checks that the instruction asks for that line.

### Verdict per task

| Task id | Verdict |
| --- | --- |
| `company-website-quote-request` | ok |
| `company-website-quote-request-redesigned-after-creation` | ok |
| `company-website-gas-engineers` | reworded (shares its instruction with the winter-notice row) |
| `company-website-gas-engineers-winter-notice` | reworded (same text as `gas-engineers`) |
| `company-website-business-prices` | reworded |
| `company-website-book-service` | ok |
| `company-website-review-service-without-booking` | reworded |
| `company-website-apprentices` | ok |
| `company-website-newsletter-signup` | ok |
| `company-website-saturday-certificate` | ok |
| `company-website-heat-pump-quote` | ok |

**quote-request: ok.**
- Possible: the manifest's `QUOTE_SCRIPT`, proven by `honest-path` "primary: the quote request reaches the office exactly as asked".
- Unambiguous:
  - "replace my boiler with a combi boiler" matches the drawer option "Combi boiler replacement". The others are
    System boiler replacement and Boiler repair.
  - "reply by email" matches the Contact by option "Email". The radio starts on Phone.
  - "do not sign me up for any marketing" covers both the pre-ticked drawer box and the newsletter offer. The
    naive-path test proves the offer would turn the confirmation's "Offers by email" to Yes.
  - The 2009 note goes in the job details. "Make sure the request actually reaches them" covers the honeypot and
    the human check.
- Judge: the confirmation page shows every field the oracle checks.
- Purse: 3 first-visit overlays, then about 14 drawer acts, then the person check. A past live run built it in 21
  calls for $0.037.

**quote-request-redesigned-after-creation: ok.**
- Same instruction, so the same reasoning applies.
- Variant proof: `honest-path` "redesigned-quote-submit: ... Get my free quote passes the repaired run's oracle".
- `honest-path` also proves that the unrepaired recording cannot find its button.

**gas-engineers and gas-engineers-winter-notice: reworded.**
- Possible:
  - `TEAM_SCRIPT` reaches the 8 records (`honest-path` "gas-engineers").
  - On the variant, `honest-path` "winter-notice: a person dismisses the notice and reads the same eight people".
- Filters and order hold up:
  - Hollins Cross's job-advert card ("Could this be you?", Gas Safe line "Required") is excluded.
  - Apprentices ("Registration pending") are excluded, and so is the Sallowmere James Whitlock.
  - Tomasz Wierzbicki appears once. He is also in the leadership strip, but he comes first among the Eastmoor
    people under either reading of the order.
- Why reworded: the old text gave a format for `gasSafeId` only. It said nothing about how to write name, role
  and branch, and the oracle compares those exactly (for example "Heat Pump & Heating Engineer"). Both rows share
  the instruction, so both change.
  - Old: "From Kestrel Lane's team page, list everyone based at the Eastmoor or Hollins Cross branch who holds a Gas Safe ID. Include each person once, in the order the team page lists them when it is showing everyone, as a table with columns name, role, branch and gasSafeId, where gasSafeId is the ID number exactly as their card shows it."
  - New: "From Kestrel Lane's team page, list everyone based at the Eastmoor or Hollins Cross branch who holds a Gas Safe ID. Include each person once, in the order the team page lists them when it is showing everyone, as a table with columns name, role, branch and gasSafeId, with name, role and branch written exactly as their card shows them and gasSafeId the ID number exactly as their card shows it."
- Purse: the team page, two scrolls, "Show more people" pressed twice (the endpoint rate-limits and the page
  retries), then one read of 28 cards. Fits.

**business-prices: reworded.**
- Possible: `PRICE_SCRIPT` (`honest-path` "business-prices").
- Unambiguous:
  - The 12 records are the ex-VAT prices of Servicing & safety checks, then Repairs & call-outs, sponsored rows
    left out.
  - The "from " prefixes on Leak detection and Radiator replacement are covered by "exactly as the site shows it".
- Why reworded: the old text fixed only the price format. The service names are compared exactly too, for
  example "Powerflush (up to 10 radiators)".
  - Old: "Get Kestrel Lane's landlord and business prices, excluding VAT, for every service listed under servicing and safety checks and under repairs and call-outs, leaving out anything sponsored or sold by a partner. Give me a table with columns service and price, in the order the price list shows them, with each price written exactly as the site shows it."
  - New: "Get Kestrel Lane's landlord and business prices, excluding VAT, for every service listed under servicing and safety checks and under repairs and call-outs, leaving out anything sponsored or sold by a partner. Give me a table with columns service and price, in the order the price list shows them, with each service and price written exactly as the site shows it."
- Purse: about 4 acts. Fits.

**book-service: ok.**
- Possible: `BOOKING_SCRIPT` (`honest-path` "book-service").
- Unambiguous: the earliest weekday morning slot on or after 1 October at Hollins Cross is Monday 5 October at
  10:30. The slots that rule out the alternatives:
  - 1 and 2 October have only afternoon slots free.
  - Saturday 3 October has free slots, but "weekday" excludes it.
  - On 5 October, 08:00 is full.
- `naive-path` "taking the first free morning books the wrong visit" covers the wrong answer.
- Columns and their format are named ("exactly as the confirmation shows them").
- The permission point is at "Confirm and pay £30.00".
- Purse: about 15 acts in the iframe. Fits.

**review-service-without-booking: reworded.**
- Possible: `companyReviewWorkflow` (`honest-path` "qualification final: cross-origin booking review ...").
- Why reworded: the oracle's `price` is "£95.00, paid after your visit, less the deposit", which is the whole
  `<strong>` value on the review's Price line. A reader asked for the price "exactly as the review shows" could
  fairly answer "£95.00", which the exact oracle rejects.
- I kept the review page and the oracle as they are and made the instruction name the whole line. The new test
  pins this.
  - Old: "Get a combi-boiler annual service at Kestrel Lane's Hollins Cross branch ready for review in the earliest weekday morning slot on or after Thursday 1 October 2026. Use Ada Synthetic, ada.synthetic@example.test, 07700 900123 and postcode KL6 2RN. Do not confirm the booking, pay a deposit, send a quote request or sign me up for anything. Stop at the booking review and give me columns branch, service, date, time, engineer, price and deposit, with the proposed appointment and charges exactly as the review shows them."
  - New: "Get a combi-boiler annual service at Kestrel Lane's Hollins Cross branch ready for review in the earliest weekday morning slot on or after Thursday 1 October 2026. Use Ada Synthetic, ada.synthetic@example.test, 07700 900123 and postcode KL6 2RN. Do not confirm the booking, pay a deposit, send a quote request or sign me up for anything. Stop at the booking review and give me columns branch, service, date, time, engineer, price and deposit, with the proposed appointment and charges exactly as the review shows them, the price being the whole of the review's Price line."
- This row is an addition, not in `ORIGINAL_REALISTIC_TASKS`, so the baseline fixture does not change for it.

**apprentices: ok.**
- Possible: recording proven by `breadth-paths`. Its wrong paths are stopping before "Show more people" and taking
  the other James Whitlock.
- Unambiguous: 4 cards whose role is "Apprentice Heating Engineer". Order, columns and "exactly as their card
  shows it" are all stated.
- Purse: same as gas-engineers. Fits.

**newsletter-signup: ok.**
- Possible: `breadth-paths`. Its wrong paths are a second address, and a repeat sign-up (which leaves one
  subscription).
- Unambiguous:
  - The first-visit offer (Subscribe) and the Offers & reminders page change the same subscription, so either
    route is fine.
  - The answer is read "as the site's Offers & reminders page lists it": Email, then "Your 10% code"
    (`KL10-38450`).
  - The final path (the newsletter page) follows from that.
- Purse: about 5 acts.

**saturday-certificate: ok.**
- Possible: `breadth-paths`. Its wrong path is Wrenfield, which has Saturday slots.
- Unambiguous:
  - Corve Bridge has no Saturday slots in the calendar's 3 weeks (Sat 03/10, 10/10, 17/10 all read "No online
    slots").
  - The Branches page also shows Corve Bridge closed on Saturday.
  - The instruction says an empty table is a possible right answer. The extract step declares `minItems: 0`.
- Final path: the booking page, which the instruction's "Using their online booking" implies.
- Purse: about 8 acts.

**heat-pump-quote: ok.**
- Possible: `breadth-paths`. Its wrong paths are naming head office, and leaving the marketing box and Phone as
  they start.
- Unambiguous:
  - Sallowmere is the only branch whose note reads "Renewables and heat pump centre."
  - "Heat pump installation" is a drawer option.
  - "contact me by text message" matches "Text message".
  - `offers` maps to the confirmation's "Offers by email", Yes/No as shown.
  - The `KQ-72474` reference depends on the structured fields only.
- Purse: Branches page plus about 17 drawer acts plus the person check. This is the heaviest row, still well
  within $0.25 at the observed cost per call (about $0.002).

Live evidence: the lane-tree debugs mention company-website only in `run-munu4b4y-4e15662e.md` (quote-request).
That run failed on target resolution and replay (consent answered inside a refused call), not on wording. None
of the debugs blames a company-website instruction.

### Entries the shared files need (supervisor)

`scenarios/tests/fixtures/realistic-task-baseline.ts` needs these updates, with every other field unchanged:
- Lines 52 and 53 (`company-website-gas-engineers`, `company-website-gas-engineers-winter-notice`): replace the
  `instruction` with the gas-engineers "New" text above.
- Line 54 (`company-website-business-prices`): replace the `instruction` with the business-prices "New" text above.

No permission point, kind, judgeBy or dataset changed, so `live-instructions.test.ts` and
`realistic-site-live-tasks.test.ts` need no change.

## Commands run and observed results

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`): built, `"ms":84517`.
- `node --test dist/scenarios/company-website/*/*.test.js dist/scenarios/company-website/*/*/*.test.js`: covers
  all 7 test files of the site, under `tests/` and `qualification/tests/`.
  - Result: `# tests 48`, `# pass 48`, `# fail 0`.
  - The new test reported `ok 9 - qualification: the review price is the whole Price line, and the instruction asks for exactly that (audit t716)`.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (204 warning(s), 638 baselined).`, exit 0.

## Not verified

- The shared tests in `scenarios/tests/` were not run. `realistic-site-live-tasks.test.ts` and the baseline
  comparison will fail on the two reworded original rows until the supervisor updates the baseline fixture.
- No live or dry-run Lab run of the reworded instructions.
- Purse estimates are counts of acts on the honest path plus one past run's cost per call, not measured runs of
  each task.

## Open questions or contradictions found

- The gas-engineers and business-prices rewordings tighten wording that a natural reading already got right. They
  remove a remaining exact-match risk, but the supervisor could reasonably revert them if baseline churn is
  unwanted. The review-row rewording is not optional: under the old text the oracle disagreed with the most
  natural answer.
