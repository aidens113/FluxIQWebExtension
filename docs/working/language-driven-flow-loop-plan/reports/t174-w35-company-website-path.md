# t174-w35: company-website-quote-request, path audit

Worker t174-w35, 2026-10-01. Read-only audit of downstream `task/t174-live-lane` (`a15a465e` plus the
lane's uncommitted work) and Core `task/t174-live-lane`. I changed only this report and the probe spec
`apps/extension/e2e/content/tests/lane-a-probes/t174-w35.spec.ts`. No Lab, no provider. Privacy: the report
uses codes, counts, booleans and the fixture's own control labels only.

## Outcome

Done. Every extension verb the honest path needs works when nothing covers it, and so does the hand-off at
Send. The probe shows that the extension drives the whole form to a received page that passes all six goal
facts. One unowned extension defect, **W35-D1**, blocks this task:

- **What W35-D1 does:** the interference defence closes the very layer that holds the action's target.
- **Effects on this task:**
  - The build's d4 pattern: consent is answered inside a refused call, so the Flow has no consent step.
  - On a fresh visitor, playback closes the quote drawer under the chat greeting card.
  - The same happens under the newsletter offer.
- **Proof:** four T2 probe rows reproduce it on every run (3 of 3).
- **Fix route:** a fix in the extension also removes this site's trigger for the debug's cause 1, without
  touching the domain's `node-run/run.ts` (t223).

## 1. Reference path (a passing Flow)

Sources: the task (`live-tasks.ts`: instruction, `permissionPoint` "Send request" as `send_or_publish`,
`personCheck` with `person: completes`, `required: false`), the recording script (`manifest.ts:19-26, 43-63`),
the honest-path test (`tests/honest-path.test.ts:31-40`, which expects `consent: "all"`), and the site source.

| # | Page | Control or input | Expected effect |
| --- | --- | --- | --- |
| 1 | home `/scenarios/company-website/` | navigate | Home page under the consent wall: a host with `position:fixed; inset:0`, a declared dialog in an open shadow root (`pages/shell.ts:143-171`). The chat greeting card opens 1.8 s after **every** load until it is dismissed, bottom-right at about x 868-1264, y 552-704 (`client/shell-script.ts:13, 272, 281`). |
| 2 | home | Chat greeting's Close (`title="Close"`). Conditional. | The card goes and `chat.greetingDismissed` is set. Needed because the card covers the wall's buttons and the drawer's Continue. |
| 3 | home | Consent: "Accept all" (or "Reject non-essential") | The wall is removed, and the newsletter offer is scheduled 4 s after the save (`shell-script.ts:213-234`). |
| 4 | home | Newsletter: "No thanks, I will pay full price" or the close glyph. Conditional: it appears once per visitor, 4 s after consent. | `newsletter.dismissed`; no subscriber. |
| 5 | home | Header "Get a free quote" (`data-open-quote`) | The drawer opens on step 1. It is a painted `aria-modal` dialog with its own close glyph (`pages/quote-drawer.ts:51-54`). |
| 6-9 | drawer step 1 | Type full name, email, phone, postcode | The fields hold the values. The offscreen honeypot `companyWebsite` stays empty. |
| 10 | drawer footer | Continue (about x 1100-1260, y 664-704, under the greeting card) | Step 1 is checked and step 2 shown (`client/quote-script.ts:134-147`). |
| 11 | step 2 | The div list "Choose a service" | The list opens. |
| 12 | step 2 | The option "Combi boiler replacement" | The hidden `service` input is set. |
| 13 | step 2 | Details textarea ("2009 floor-standing...") | Text entered. |
| 14 | step 2 | Radio `contactBy` = Email (starts on Phone) | Email checked. |
| 15 | drawer footer | Continue | Step 3 shown. |
| 16 | step 3 | Marketing box: untick (starts ticked) | Unchecked. |
| 17 | step 3 | Privacy box: tick | Checked. |
| 18 | drawer footer | "Send request" (`testid quote-submit`). The `send_or_publish` permission point. | "Checking you are human", then after 2.2 s the "Confirm you are human" box (`quote-script.ts:163-172`). |
| 19 | drawer | "Confirm you are human". The person's check (`person-check.ts`); FluxIQ never presses it. | `submit-quote` with `verified:true`, then navigation to `/quote/received?ref=…` (`quote-script.ts:173-183`). |
| 20 | received page | none | The goal facts hold: reference, service, contact Email, marketing "No", postcode, details containing 2009 (`manifest.ts:34-41`). |

## 2. Per step: product path and verdict

"Probe" means `t174-w35.spec.ts`, run three times (logs in the session scratchpad: `w35-probe-{1,2,3}.log`).

| # | Product path | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | extension `runtime/action-runner.ts:100` (navigate; landing judged by F7 and F14) | **works** (not re-probed: T2 has no background worker) | debug run 22: `main.s1` succeeded in 2192 ms, `matched` |
| 2 | Authored press: `actions/click.ts:133`, shadow scope `resolve-target.ts:250-275`. Unauthored: R1's corner probe `interference/probe-points.ts:179-194` | **works** | Existing row `shadow-roots/tests/shadow-root-targets.spec.ts:121` (replayed Close, `greetingDismissed:true`). Probe: every defence row leaves `greetingDismissed:true`, so the card is found. |
| 3 | Authored press while the greeting covers the wall: `results.ts:213` → `blocking-dialog.ts:66-75` → `overlays.ts:56-60` lists the wall's own dialog (which holds the target) and the chat host. Then `recovery/attempt.ts:110` → `interference/clear.ts:311-323` presses every overlay that `overlays.ts:71-80` returns, painted modals first. | **defect W35-D1** | Probe "d4 pattern": `web.target.not_found` in 3987-4019 ms, "absorbing blocking_dialog, target_absent, target_absent, target_absent, target_absent, closing 2 dialogs the page had put in the way, waiting 3650 ms". The fixture then holds `consent:"essential"` and `wallGone:true`: the defence declined consent itself and Accept all vanished. This is the debug's d4 (5133 ms, consent answered inside a refused call). |
| 3' | Unauthored (fresh-visitor playback, no consent step): `recovery/fault.ts:197-199`, `interference/presence.ts:27-33` (R2) | **works** | Probe "R2" (below): the wall is declined, never accepted. |
| 4 | Click `[data-act="decline"]` on a fresh visitor: R2 clears the wall on `target_absent`. The ladder is 250+500+1000+2000 ms inside 5 s (`recovery/budget.ts:45, 64`). | **works**, but needs Core's node retry | Probe "R2", attempt 1: `web.target.not_found` in 4075-4182 ms ("5 attempts after absorbing target_absent ×5, closing 2 dialogs… waiting 3750 ms"; `consent:"essential"`). Attempt 2, the same command after 250 ms as `retry_node` sends it: **succeeded** in 252-321 ms; `newsletter.dismissed:true`, 0 subscribers. One in-page attempt cannot outlast the 4 s offer delay plus the consent save. |
| 5 | `actions/click.ts:133` | **works** | Probe honest `open-quote`: succeeded in 700 ms, "the page prevented the click's default action" |
| 6-9 | `actions/type.ts:40` | **works** when nothing is over the drawer. **defect W35-D1** when the newsletter opens over it. | Honest rows succeeded in 121-180 ms ("the field holds …"). Probe "newsletter over the open drawer": `web.action.rejected`, "hidden: the element has a zero-size box … closing 2 dialogs"; afterwards `drawerOpen:false`, `typed:false`, `newsletterDismissed:true`. The defence pressed the drawer's own close glyph, because the drawer is the first painted modal in document order. On a fresh visitor this timing is normal: the offer opens about 4 s after consent, while a quick Flow is in the drawer. |
| 10, 15 | `actions/click.ts:133`; when covered, as row 3 | **works** uncovered. **defect W35-D1** under the greeting card. | Control row: succeeded in 724-734 ms ("the point 1180,682 landed on the target"). Probe "Continue under the chat greeting card": `web.action.rejected` hidden after "closing 2 dialogs", then `drawerOpen:false`, `stepTwoVisible:false`. Debug cause 5 (no corner probe) is fixed by R1, and that fix now exposes W35-D1. |
| 11-12 | `actions/click.ts:133` | **works**. **defect W35-D1** if the option is pressed with its list closed. | Honest rows succeeded (638 and 635 ms); `service` = "Combi boiler replacement". Probe "list closed": a hidden target inside the open modal is put down to the modal (`blocking-dialog.ts:28-30` admits this), so it is reported `blocked_by_dialog` and the defence closes the drawer: "closing 1 dialog", `drawerOpen:false`. |
| 13 | `actions/type.ts:40` | **works** | succeeded in 110 ms |
| 14, 16, 17 | `actions/check.ts:35` | **works** | "the radio is checked" (107 ms), "the checkbox is unchecked" (92 ms), "the checkbox is checked" (96 ms) |
| 18 | Extension: `actions/click.ts` with `robot-check/robot-check-watch.ts`. Domain: `node-run/run.ts:484-486` (`personNeeded`) and `:565-577` (`personDraft` keeps the press as the step). Core: every send is asked (F10, `action-permissions/gate.ts:292-300`). | **works** (extension, probed). Domain and Core read, not exercised. | Probe: `web.intervention.required`, "captcha: the press was made, and 4-5 ms after it the page put up a robot check that only a person can answer" (2372-2396 ms). `quotes:0` at that point: nothing was sent before the person answered. |
| 19 | The person's check | **owned elsewhere: t197** | In the probe, the person's press led to the received page. |
| 20 | The playback goal; Core's completion check (`flow-bootstrap/instructed-acts/check.ts`) | **works** (page). The completion check is **owned elsewhere: t196** (act-object binding). | Probe `honest.received`: `{"service":"Combi boiler replacement","contact":"Email","marketing":"No","postcode":"KL6 2RN","details2009":true,"quotes":1,"discarded":{honeypot 0, unverified 0, invalid 0},"drafts":0}`. Run 22's completion accepted a press on the drawer opener that was declared `send_or_publish` (debug cause 6); binding a declared act to its object is t196's. |

### The debug's causes against current code

| # | Debug cause | Now | Evidence |
| --- | --- | --- | --- |
| 1 | A refused step's page change is dropped | **Still present.** Domain `node-run/run.ts:506-533` reports every refusal `effectApplied:false` with no replay (t223's file). Core `flow-draft/step.ts:201-203` admits only `effectApplied !== false` (t196). **This site's trigger is W35-D1**, proved by the d4 row. | See "Fixable here" for the narrowest route. |
| 2 | No clearing on `target_absent` | **Fixed** (R2 on dev); proved on the real wall | Probe "R2", attempts 1 and 2 |
| 3 | A node's retries withdraw its failed route | **Fixed** in Core: `executor/recovery-budget.ts:5-20` excludes ladder rungs and cites `run-munv53gt-a0e6f545` | read only |
| 4 | The dry-run reset keeps scenario state | **Owned elsewhere: t196** (replays from the start; the D1 decision) | not re-checked |
| 5 | The next-step button under the greeting card, missed by the probes | **Probe gap fixed (R1)**; it now falls to W35-D1 | Probe "Continue under …" |
| 6 | Accepted with the instructed act unmet | **Owned elsewhere: t196** (act-object binding) | not re-checked |
| 7 | Recovery found the fix and could not add a step | The debug routed it to t193; not re-checked here. With W35-D1 fixed, playback should not need it. | — |
| 8 | Diagnosis context lost for `byte_budget` | **Still absent from this Core:** no `byte_budget` or `context-budget` under `runtime/recovery/` (t194's F4) | grep |
| 9 | Privacy in the bundle | Lab export (t174); out of scope under the STOP | — |
| 10 | A send pressed without asking | **Fixed** (F10): `action-permissions/gate.ts:293-300` | read |
| 11 | Decision efficiency | **Owned elsewhere: t196** (evidence loop) | — |

## 3. Fixable here

### W35-D1: the interference defence clears the layer that holds the action's own target

- **Cause.** `clearInterference()` (`apps/extension/src/content/action-runtime/interference/clear.ts:303-323`)
  and `clearableLayerOverPage()` (`interference/presence.ts:27-33`) are not given the target.
  `overlaysOverPage()` (`interference/overlays.ts:71-80`) returns every painted `aria-modal` first, in
  document order. So a form drawer or a consent wall that **contains** the target gets its way out pressed:
  - the drawer's close glyph;
  - the wall's "Reject non-essential".

  The classifier makes the same mistake. `blocking-dialog.ts:66-75` reads `overlaysAt()`
  (`overlays.ts:56-60`) and names the target's own modal as the blocker. A `hidden` target inside an open
  modal then becomes `blocked_by_dialog`, so the defence acts on it.
- **Effect on this task.**
  - Playback of a correct Flow on a fresh visitor loses the drawer whenever:
    - the greeting card covers Continue (it reopens 1.8 s after every load until dismissed); or
    - the newsletter offer opens over the drawer.
  - The build's consent press under the greeting becomes a refused call that answered consent. That is
    debug cause 1, and why run 22's Flow had no consent step.
- **Fix (proposal).** Spare any overlay that contains the action's resolved target, using composed
  containment across shadow roots. Sibling layers (the greeting card, the newsletter) are still cleared.
  - **Classifier:** pass the target element alongside `blockedAt` from the actionability evidence into
    `blockingDialog`, and exclude containing modals in `overlaysAt`.
  - **Defence:** in `actions/execute.ts:133`, give `runWithRecovery` intervention and layer-probe closures
    bound to the action. They re-resolve its target leniently (`resolveTarget`, `resolve-target.ts:250`; no
    element means nothing is spared) and pass it to `clearInterference(spare)` and
    `clearableLayerOverPage(spare)`.
  - **`target_absent` keeps today's behaviour,** which R2 needs. Residual risk: a press on a truly absent
    target while a form modal is open could still close that modal. On this site's path, step 2 and step 3
    controls exist hidden (`hidden`, not absent), so it does not arise.
- **Files a fix would edit:**
  - `apps/extension/src/content/action-runtime/interference/{overlays.ts, clear.ts, presence.ts}`
  - `apps/extension/src/content/action-runtime/blocking-dialog.ts`
  - `apps/extension/src/content/action-runtime/results.ts`: the evidence carries the target element.
  - `apps/extension/src/content/action-runtime/actionability.ts`: where `reject("covered" | "hidden", …)`
    is built.
  - `apps/extension/src/content/actions/execute.ts`
  - `recovery/attempt.ts`, only if the intervention signature changes instead of using bound closures.

  The interference area was t195's; this brief names no current owner for it. None of these files is
  w31's (`runtime/click-landing.ts`, `runtime/action-runner.ts`).
- **Tests that prove it (failing first):**
  - **T2:** the four `test.fail` rows in `e2e/content/tests/lane-a-probes/t174-w35.spec.ts`. Each states the
    right behaviour and fails on HEAD today, in 3 of 3 runs:
    - "d4 pattern": the press succeeds and consent is `all`;
    - "Continue under the chat greeting card": the drawer stays open and step 2 shows;
    - "the newsletter offer opens over the open drawer": the drawer stays open and the field holds the name;
    - "the service option with its list closed": refused, and the drawer stays open.

    A fix removes `test.fail` from each.
  - **Unit:** in `interference/tests/`, an overlay that holds the target is neither named as the blocker nor
    pressed, while a sibling overlay still is.
  - **Unit:** in `action-runtime/tests/`, `blockingDialog` gives no dialog for a hidden target inside its
    own modal.
- **Size:** medium. About six source files and 60-100 lines, plus two unit test files.

### Debug cause 1 (refused attempt with a page change): the narrowest route avoids `node-run/run.ts`

Once W35-D1 is fixed, the consent press under the greeting closes only the greeting and lands. It becomes an
ordinary successful step, and so a draft step and a Flow step. No domain or Core change is needed for this
site. Playback without a consent step also holds up, because the defence declines the wall again (probe "R2").

The general residual is a refused attempt during which the defence cleared some **other** layer. Recording
that as a step needs two things:

1. **A structured dismissal count on the wire.** Today it is only prose in `failure.actual`
   (`recovery/record.ts:20-33`), which the domain does not read. Adding a field to the action result type in
   `domain/src/actions/types.ts` and to `recovery/record.ts` is a wire change.
2. **`refusal()` in `node-run/run.ts:506-533` (t223's file)** returning that clearing as an optional,
   replayable statement.

I am naming this only. It is not needed for this task.

## What changed and why

- New: `apps/extension/e2e/content/tests/lane-a-probes/t174-w35.spec.ts`. Seven rows:
  - R2 on the real wall;
  - the d4 pattern;
  - Continue under the greeting card, plus a control row with the greeting dismissed;
  - the newsletter over the open drawer;
  - an option with its list closed;
  - the honest path through the extension's own verbs, with the human check pressed as the person.

  The four W35-D1 rows assert the right behaviour under `test.fail(true, "W35-D1: …")`. The suite stays
  green, and a fix makes them flip.
- New: this report.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w35 probe" pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/lane-a-probes/t174-w35.spec.ts`
  - **Run 1** (plain assertions): `3 failed`, `4 passed (1.1m)`. The three failures were the drawer rows,
    on `drawerOpen:false`.
  - **Run 2** (those three as `test.fail`): rc 0, `7 passed (45.7s)`.
  - **Run 3** (the d4 row also as `test.fail`): rc 0, `7 passed (34.6s)`, four of them as expected failures.
  - The `PROBE` lines are quoted in section 2.
- `heavy.sh "t174 w35 tsc" node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit`, in
  `apps/extension`, to typecheck the spec (`tsconfig.test.json` includes `e2e/**`): **not completed**. All
  four build slots were held by t194 workers (w24-w27) when I handed back, so the run never started. The
  spec was compiled and run by Playwright's transform in all three runs above, but that is not a tsc check.

## Not verified

- **Lab:** none ran (STOP). No live playback or build.
- **Domain and Core:** their paths were read, not run. That covers `personNeeded`, the F10 ask, the
  retry-budget fix and the completion check.
- **Step 1 (navigate):** not probed in T2.
- **Core's node retry for R2:** simulated by a second `executeAction` 250 ms later.
- **Not probed:**
  - a consent press before the greeting opens (under 1.8 s);
  - the honeypot. It is offscreen, so I infer it is refused `hidden` and, with the drawer open, would also
    meet W35-D1.
  - viewports other than 1280×720.
- **The fix's effect:** inferred from the probes, not built.

## Open questions or contradictions found

- **The brief asked whether R2 covers this site's wall.** It does, but only from Core's second node attempt.
  One in-page attempt (3750 ms) ends before the offer opens (4 s after the consent save). That is acceptable
  while `retry_node` stays at `maxAttempts:3`.
- **When the defence answers the wall, consent ends `essential`.** A Flow whose step chose Accept all ends
  `all`. The playback goal does not check consent; the honest-path test expects `all`.
- **Run 22's d11 was `target_not_actionable`** under the greeting card. Today the same press is
  `blocked_by_dialog`, and its clearing closes the drawer (W35-D1). R1 changed the failure, not the outcome.
