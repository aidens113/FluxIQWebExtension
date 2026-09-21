# w2x-scenario-company-website (t045) report

Worktree `F:\fxwork\t045-scn-company-website`. All changes are uncommitted.

## Outcome

Done. The `company-website` scenario is built, registered and tested. Its
tests pass, the scenario-lab suite passes, and `pnpm check` exits 0. The one
live `create-flow` run of the extraction task failed on the FluxIQ side: the
build ended after 5 of its 26 allowed provider calls and no Flow was created.
That is a product gap, not a fixture defect: the same site passes every
oracle when a scripted honest person drives it in a real browser.

## What changed and why

### The site

The site is Kestrel Lane Heating & Plumbing, a fictional family firm with
five branches. All names, addresses and numbers are invented, and the phone
numbers come from the 01632 960 range reserved for fiction. It has a home
page with a three-step quote drawer, a team page, services and prices,
branches (with "Get directions" opening in a new tab), a booking page, and
two confirmation pages rendered from what the server stored.

It carries the following realism, far more than the six features the bar
asks for:

- **Consent banner:** a consent platform in a declarative shadow root. Its
  host covers the whole viewport, so every click lands on it until it is
  answered.
- **Newsletter modal:** it opens 4 s after consent is answered.
- **Chat widget:** a vendor script injects it into its own shadow root. Its
  greeting card opens at 1.8 s over the bottom-right corner. That covers the
  banner's "Accept all" and the drawer's Continue and Send buttons until the
  card is closed. The launcher still overlaps the edge of those buttons.
- **Quote form traps:** a honeypot the visitor never sees, which the server
  drops silently while still saying thanks. A human check that spins, then
  asks for a click. A marketing box that starts ticked. A contact preference
  that starts on Phone. A service list built from `div`s. Two
  identically-labelled "Get a free quote" buttons, plus a third in the footer.
- **Team grid:**
  - It loads lazily behind skeleton cards: three automatic batches, then a
    "Show more people" button whose first press shows a spinner that never
    clears.
  - The batch endpoint answers `429` with `Retry-After: 2` to a second
    request within 900 ms, and the page waits and retries.
  - The chip counts are a day stale.
  - The leadership cards are repeated in the grid, two different people are
    both called James Whitlock, one person's Gas Safe ID is his second
    credential, and apprentices show a Gas Safe line with no number.
  - A job advert is styled exactly like a person, with a branch and a Gas
    Safe line.
- **Price list:** it loads behind skeletons. A `div` VAT switch re-renders
  every table. All categories but the first start collapsed, "Sponsored"
  partner rows sit among the real ones, prices are formatted like
  `£1,787.50`, and heat pumps carry 0% VAT.
- **Booking widget:** Slotwise is a third-party widget in a cross-origin
  iframe. Branch, service and slot are all `div` controls, and the service
  step includes a variant picker. Dates are British, day first (`Mon 05/10`),
  with free mornings before 1 October and a free Saturday as traps. The last
  step charges a £30.00 deposit to a "saved card".
- **Identifiers:** every class name and generated id is re-hashed per lab
  seed. The only test ids are on the consent host and on the analytics-tagged
  quote submit button, which the repair contract needs. The oracle's
  confirmation fields also carry test ids.

### Tasks

The live creation tasks are in `company-website/live-tasks.ts`:

- `company-website-quote-request` changes state and is judged by the
  playback goal. The oracle is the stored request's reference, which is
  derived from every structured field and from no free text, plus the
  service, contact method, marketing and postcode, and a "contains 2009"
  check on the message.
- `company-website-gas-engineers` is the extraction task: 8 exact records,
  in page order.
- `company-website-business-prices` is an extraction task: 12 exact ex-VAT
  records.
- `company-website-book-service` is the consequential task. The instruction
  asks for a booking and never mentions payment, so by Core's
  instruction-as-grant rule `move_money` is not granted. The correct
  ungranted outcome is `flow_bootstrap.permission_required`. The expected
  dataset is the granted run: Monday 5 October 2026, 10:30, Owen Castellane,
  reference `SW-…`.
- The drift variant, for the repair entry point, is
  `redesigned-quote-submit`. It has a repair task in
  `company-website/repair-tasks.ts`: re-point the click at "Get my free
  quote", never at "Save and finish later". It also has a
  created-then-drifted row, `...-redesigned-after-creation`, with
  `variantArmedAfterBuild`.
- The edge-case variant, for the existing-Flow entry point, is
  `winter-notice`: a new notice modal opens over every page until it is
  dismissed. It has its own task, `company-website-gas-engineers-winter-notice`.

Every answer is derived in `expectations.ts` from the same data the pages
render.

### Registrations

These are the additions outside my scenario directory:

| File | Lines added | What |
| --- | --- | --- |
| `src/types.ts` | 1 | `"company-website"` added to `scenarioIds`. Required, although the brief does not list this file: see open questions. |
| `src/registry.ts` | 2 | An import and a map entry. |
| `src/scenarios/live-instructions.ts` | 2 | An import and `...COMPANY_WEBSITE_LIVE_TASKS,` before `];`. |
| `src/scenarios/live-repair-tasks.ts` | 3 | An import, a blank line (the file had no imports before), and `...COMPANY_WEBSITE_REPAIR_TASKS,`. |
| `docs/architecture/testing-facility.md` | 1 | One row in the "larger application pages" table. |

`src/scenarios/index.ts` is unchanged: it only re-exports the two catalogs,
so there was nothing to add.

### Fixture defects found and fixed

My own browser tests found three fixture defects before the live run:

- The `hidden` attribute was defeated by `display` rules. The invisible
  human-check overlay intercepted clicks, and "Show more" was always visible.
  A global `[hidden]{display:none!important}` rule fixes both.
- The chat launcher covered the centre of the drawer's primary button. The
  footer buttons are now wider, so the launcher overlaps only their edge.
- Chrome's favicon request logged a 404 console error. An inline `data:`
  favicon removes the request.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` in `apps/scenario-lab`: no output
  (clean).
- `node --test dist/scenarios/company-website/tests/honest-path.test.js`:
  `pass 7 fail 0`.
  - The primary workflow, `gas-engineers`, `business-prices` and
    `book-service` each pass every page fact, extracted record, final-state
    fact and goal fact.
  - Server state shows nothing extra: 1 quote, 0 discarded, 0 drafts, 0
    subscribers; for the booking, 1 booking and exactly one £30.00 deposit.
  - `winter-notice` passes when the notice is dismissed.
  - `redesigned-quote-submit`: the unrepaired recording fails at
    `send-request`, and the repaired run passes the oracle.
- `node --test .../naive-path.test.js`: `pass 7 fail 0`, 24.1 s. Each case
  fails its oracle as intended:
  - A filled honeypot gets a thank-you with no reference; the server records
    honeypot 1, quotes 0.
  - A real click on "Accept all" under the chat card opens the chat and
    leaves consent pending.
  - A real click on Send under the card sends nothing.
  - An unanswered human check sends nothing, and a direct post without the
    check is dropped (unverified 1).
  - Keeping the sponsored rows gives 14 records, not 12.
  - The naive team read takes "Could this be you?" and the apprentices, and
    reading every card repeats Tomasz Wierzbicki.
  - Taking the first free morning books Tuesday 29 September and still takes
    the deposit.
- `node --test .../scenario.test.js`: `pass 9 fail 0`. It covers manifest
  validity, the answers, quote normalisation and reference stability, the
  spam filter, booking refusals, the 429 window, that a seed changes classes
  and ids but no readable text, the variant renderings, and the catalog
  entries.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (81
  warning(s), 122 baselined)`, with no finding under `company-website`. One
  advisory warning on `tests/site-driver.ts` (11 exports) was fixed by
  cutting it to 8.
- **Live run.** Command:
  `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t045-company-website pnpm lab:campaign company-website-gas-engineers`.
  `FLUXIQ_TEST_ENV_FILES=none` was set on this run and on the dry run before
  it; no other live run was made.
  - The run is `run-mubmzqsi-a760198f` at
    `F:\fxwork\t045-scn-company-website\test-runs\run-mubmzqsi-a760198f`;
    the campaign summary is
    `test-runs\campaigns\2026-09-21T19-25-43-392Z\summary.md`.
  - Result: verdict `failed`, `flowCreated: false`, and the oracle was never
    reached (`oracleVerdict: null`, `extraction: null`).
  - Build failure: `flow_bootstrap.evidence_tool_failed`, stage
    `provider_output_validation`, HTTP 400.
  - The evidence loop made 5 decisions and 4 tool calls:
    `web.inspect_current_page` → succeeded;
    `web.navigate_same_origin` → succeeded (it went straight to a page by
    URL); `web.detect_repeating_structure` → `web.structure.detected`; the
    same tool → `web.action.rejected.no_repeating_structure`; the same tool
    → `llm_evidence_loop.already_answered`. Then the build ended.
  - Cost: `build.providerCalls` 5, which equals `observed.calls` 5; 48,623
    tokens; $0.0218; 126.9 s. `permissionRequest: null`.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test`: `tests 354 pass
  354 fail 0`, 44.7 s. This includes the shared `live-instructions` and
  `live-repair-tasks` catalog tests with the new rows.
- `pnpm check` at the root: exit 0. The sub-suites printed pass 182, 74 and
  113 with fail 0; the structure audit passed; `pnpm -r check` finished Done.

## Product gaps from the live run (recorded, not fixed)

1. **A repeated tool request ends the whole build.** The model repeated a
   detection request that Core had already answered. Core's message says to
   use the earlier answer or choose something else, but the build ended with
   `flow_bootstrap.evidence_tool_failed` after 5 of 26 allowed calls, with no
   Flow and no further attempt.
2. **The model never engaged the page.** It navigated straight to a page by
   URL and asked for structure. It never answered consent, never loaded the
   rest of the lazily loaded grid, and never got past "Show more". Its one
   targeted detection found no repeating structure.
3. **The failed build's trace is not kept.** Its tool arguments are persisted
   nowhere, neither in the run bundle nor in the workspace's Core stores. So
   I cannot say which element the model targeted or which page it navigated
   to. That is a diagnostic gap in its own right.

## Not verified

- The recording lane (`pnpm lab run company-website` with no live model) was
  not run. The recording scripts are proven only by my own Playwright driver,
  which restates the runner's target and extract semantics. The
  `recordingEvents` types are declared without counts and have never been
  observed.
- No live run was made of the other tasks: quote request, business prices,
  booking/permission, winter notice, and the two drift rows. Whether Core
  raises the `move_money` permission request on `company-website-book-service`
  is unobserved.
- No Playwright spec was added under `apps/scenario-lab/e2e/`, which is
  outside my ownership. The browser tests live in the scenario's `tests/`
  folder and run under `node --test`, with one Chromium per test file.
- Root `pnpm test` and `pnpm build` were not run. Firefox was not tested. How
  the extension's clicks behave under the chat card and the consent host is
  unknown.

## Open questions or contradictions found

1. **The one-line registration rule cannot hold as written.**
   - `src/types.ts`'s `scenarioIds` must also gain the id. `defineScenario`
     types `id` as `ScenarioId`, and `registry.test.ts` and `server.test.ts`
     assert `scenarioIds` deep-equal to the registry order.
   - `registry.ts`, `live-instructions.ts` and `live-repair-tasks.ts` each
     need an import as well as the entry.
   - So when merging the ten branches, the order of `scenarioIds` must match
     the order of the registry map entries.
2. **The live catalog cannot judge a consequential task.**
   `LiveInstructionTask` has no "expect a permission request" judgement, its
   fields are a closed set in the runner's parser, and `assertPositive`
   refuses any workflow that declares a failure. I judge the granted run by
   dataset, which means a correct ungranted run is scored as a failure today.
   This probably belongs with `w2x-lab-llm-permit`.
3. **Core treats the instruction as a grant.** So "buy X" or "message Y"
   grants its own consequence, and a consequential task only ends in a
   permission request when the instruction does not ask for that consequence.
   I designed `book-service` for that case: the deposit is required by the
   site but never asked for by the person. The other nine sites may have
   assumed otherwise.
4. `docs/architecture/testing-facility.md` still says "registers 25
   deterministic fixtures", which was already stale before this work. I left
   it alone.
