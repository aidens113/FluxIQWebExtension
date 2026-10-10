# t403 committing press, two stale specs, matrix Flow selectors — worker report (revised after main's decision)

## Outcome

**Done, as revised by main.**

- **Item 1.** The run files show the click verb made **no** second press in t399's 13a run. The committing-press change I
  built broke 10 content rows that depend on the intended second press after an ignored first press. On main's
  decision it is **reverted**: the click verb and `ignored-press/` are dev's again.
- **Item 2.** Both stale specs are fixed on the spec side.
- **Item 3.** The matrix Flows' overlay selectors are fixed.
- **13a without the click change.** It passed 5/5 more times. So the 10/10 13a passes come from t401's clearing change
  plus the Flow fix, not from any click change.
- **Still open.** The extra Confirm press in t399's run is an open finding (below). Forwarding step declarations to the
  extension is its own future task and was not started.

## What changed and why

### Item 1: what the run files show (`fxwork/t399/!FluxIQWebExtension/test-runs/persistent-isolated/rmx-13a-c1932c59/fluxiq-root/.fluxiq/artifacts/runtime/command-attempts/*/attempt.json`)

Times are seconds from the first command.

- **The click verb did not press twice.**
  - Amara's confirm ran 24.3–25.8 s and Jonas's ran 27.7–31.3 s. Each result says only "the point … landed on the
    target".
  - The bundle t399 ran contains the "so it was pressed once more" mark (`fxwork/t399/.../dist/*/content/index.js`).
    So a second press would have been marked.
  - Neither result carries a recovery sentence, so each command made one attempt.
  - Lin's press (32.4–38.3 s) was refused at the first press, and `rate_limited` is never retried in-command
    (`recovery/fault.ts`, `ABSORBED_ELSEWHERE`).
- **Change built, then reverted.** I built the committing-press rule as briefed:
  - Every click commits by the domain's `webAutomationActionCommits`, so a press is never pressed twice.
  - A press with no answer was reported as `output_not_observed`, effect unknown.
  - It broke 10 content-harness rows: 9 auction-marketplace kestrel rows at the sort button, which ignores its first
    press on purpose, and everything-store's buy-box row.
  - Main decided to revert. All five files are restored from `HEAD`.

### Item 2: the two specs (both spec-side; the product changes were deliberate)

- **`own-layer/tests/company-website-layers.spec.ts:100`**
  - ba9fea58 (t193, 2026-10-03) deliberately moved the gate's `hidden` refusal to `web.target.not_shown`, so that Core
    finds the current step by state. It updated four specs and missed this one, written 10-01.
  - Fixed the expectation, keeping the spec's point that this is not a dialog refusal.
- **`dialog-refusal.spec.ts:96`**
  - f8135495 (lane D, 2026-09-29) deliberately made a consent banner that can be declined a clearable layer
    (`blocking-dialog.ts`: "declining gives nothing away").
  - modal-flows' banner offers "Essential only". The defence now declines it (`clearedLayers [{consent, "Necessary
    only"}]`, consent `essential-only`), and the publish lands.
  - 2294dd16 (10-01) only renamed this row's code. Its own commit message records this row already failing.
  - Split into two rows:
    - The declinable banner is declined, never accepted, and the hidden invite dialog is untouched.
    - The same banner with its decline removed stays a `covered` / `web.target.not_actionable` refusal, which keeps the
      original coverage.

### Item 3: matrix Flows

- The feed's `hydrate()` (`apps/scenario-lab/.../social-network-feed/client/shell-script.ts`) turns every `data-lb`
  into `aria-labelledby` and drops it. So **both** overlay selectors never matched: cookies
  (`[data-lb="consent-title"]`) and "Not now" (`[data-lb="dlg-t"]`).
- New `flows/confirm/opening.ts` (`CONFIRM_OPENING`) holds the shared overlay and navigation steps. `qualifying.ts` and
  `then-stop.ts` use it, and `with-checkpoint` inherits it. The opening had been copied twice, which is how the bad
  selector was duplicated.
- Both prompts are `role="dialog"` with `aria-modal="true"`. Only the notifications prompt has a `Close` control:
  - cookies: `[role="dialog"][aria-modal="true"]:not(:has([aria-label="Close"])) > div:last-child > [role="button"]:last-child`
  - not now: `[role="dialog"][aria-modal="true"]:has([aria-label="Close"]) > div:last-child > [role="button"]:first-child`
- New `flows/confirm/tests/opening.test.ts` checks three things: every confirm Flow carries the opening, no selector
  names `data-lb`, `data-uid` or `data-db`, and the two selectors are as above.
- `at "<locator>"` was not needed. The web domain reads a locator as CSS, the same as a step's `selector:`.

## Commands run and observed results

- `EXTENSION_TEST_BUILD_LABEL=t403 node scripts/test-extension.mjs ignored-press content/actions`, after the revert:
  `tests 183, pass 183, fail 0`.
- `node scripts/test-content.mjs press-answers kestrel-auctions dialog-refusal company-website-layers`, after the
  revert: **28 passed**.
  - Before any change, `dialog-refusal` and `company-website-layers` had 2 failures, the two rows above.
  - With the reverted click change, `press-answers` and `kestrel-auctions` had 10 failures.
- Extension `pnpm build`: exit 0.
- Temporary probe spec on the real feed page, deleted after use:
  - The cookie selector matched `["Allow all cookies"]`; the press succeeded with no clearing, and consent became
    `all`.
  - The not-now selector matched `["Not now"]`; the press succeeded with no clearing, and the prompt became
    `dismissed`.
- test-runner `npx tsc --noEmit`: exit 0. `node --test` on `opening.test.js`, `matrix-rows.test.js` and
  `compile-flow-script.test.js`: **18 pass**. The three confirm Flows compile through Core.
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 13a`: 10 launches, all **passed**. The Lab never
  refused: the shared Core was current, and no override was used. Every run had the same counts:
  - `confirmed` = rq_7a95b3, rq_8b41c7, rq_c7a0e5, rq_e24f90; `rateLimited 1`; `confirmations 4`; 1 retry.
  - s12 (Freya, the fourth) was refused as `rate_limited`, and its retry succeeded.
  - 0 true failures, 0 duplicated acts, 0 model calls.
  - Launches 1–5, with the click change: `rmx-2026-10-10T03-19-09-115Z-942edf`, `03-23-02-203Z-9efafc`,
    `03-24-19-287Z-650bca`, `03-25-38-349Z-59b0d9`, `03-26-54-988Z-7a6483`.
  - Launches 6–10, dev's click code: `03-38-56-836Z-378c88`, `03-40-19-267Z-33532d`, `03-41-42-768Z-890704`,
    `03-43-36-942Z-5c9238`, `03-45-31-360Z-48f325`. The Lab reused the extension build made from dev's click code.
- `--case 13b`, once: **passed**.
  - `confirmed` rq_8b41c7, rq_c7a0e5, rq_e24f90; `rateLimited 0`.
  - The check step timed out four times (first try plus 3 retries), then went to the authored stop. 0 model calls.
  - Run: `rmx-2026-10-10T03-28-37-738Z-ed4be1`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (185 warning(s), 651 baselined)`.

## Not verified

- What made t399's extra Confirm press (open finding below). None of the 10 launches reproduced it.
- Firefox, full suites, other matrix rows. Not run. No paid runs.

## Open questions or contradictions found

1. **Open finding: an unknown extra Confirm in t399's 13a run.**
   - Evidence: the attempt records above, and the case bundle
     `fxwork/t399/!FluxIQWebExtension/test-runs/recovery-matrix/rmx-2026-10-10T01-50-32-352Z-2b9a44/case-13a.json`
     (site: `confirmed` Amara, Jonas, Lin; `rateLimited 1`; `confirmations 3`).
   - **(a) One press too many before Lin's.** The site allows 3 confirms in 15 s, counted client-side per document
     (`requests-script.ts`, `confirmedAt`). Only Amara and Jonas were pressed by commands on that page, yet Lin's
     third press was refused as over the limit. So one more Confirm press was counted.
   - **(b) Lin was confirmed before Core's retry.** Lin's press was refused at 32.4–38.3 s, and Lin ended up confirmed
     with no command running.
     - Core's retry at 45.6 s read `target_absent` on its **first** attempt.
     - Target resolution ignores modals (`resolve-target.ts`, `isVisibleForResolution`). A Confirm still under the
       notice would have read as `covered`.
     - So Lin's buttons were gone between 38.3 and 45.6 s.
   - **Ruled out:**
     - The click verb's second press: no "pressed once more" mark on any result, though the bundle has the phrase.
     - In-command retries: there is no recovery sentence on Amara or Jonas, and `rate_limited` is never retried.
     - The clearing pressing "Try again": the retry's first attempt was already `target_absent`.
       - t401's argument from the account's order is invalid. The sentence lists faults, then appends the dismissal
         total (`recovery/account.ts`).
       - The conclusion stands for the resolution reason above.
     - The background resending a command: there is no resend path in `background/`.
     - Two content-script instances: `content/instance.ts` makes older copies fall silent.
     - Other press paths: the remaining `.click()` calls are in extraction, which this Flow never runs. The feed's
       Confirm answers only `click`, and its `onPress` keyboard path is on the notice's buttons only.
   - **Unexplained clue:** the verb's own time was 3.3 s for Jonas and 5.8 s for Lin. Lin's notice came 9 ms after the
     press, and Amara took 1.5 s.
   - **Next probe:** log every press the content script dispatches, with command id and time, and the feed's
     `confirmedAt` pushes, in a retained 13a run.
2. **Forwarding step declarations to the extension** (so a committing press never blindly re-presses, while
   `consequences: none` presses keep the second press) is main's next task. It was not started. The reverted design
   would apply unchanged once the command carries the declaration.
3. **The 13b check step is retried three times** (4 × 3 s) before its authored failed port. That fits the
   every-node-retries rule, but it costs 12 s on a planned fail.
