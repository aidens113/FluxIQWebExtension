# t195-w7 — full debugs of r3, r4, r5 (lane D)

Worker t195-w7, 2026-09-30. Read-only except the four files below. No Lab or browser run, no
git, no lab-slots or build-slots.

## Outcome

Done. Three debugs filled from the run-debug template, every field filled or marked
`NO EVIDENCE:`, and the lead's reading confirmed or corrected with the file and field for each
point.

## What changed and why

- `docs/working/language-driven-flow-loop-plan/debugs/run-munnyvbr-11c28a0f.md` (r3)
- `docs/working/language-driven-flow-loop-plan/debugs/run-munoa86g-150fb0d9.md` (r4)
- `docs/working/language-driven-flow-loop-plan/debugs/run-munovwp3-d898de74.md` (r5)
- this report.

**Line numbers.** Six Core sources were rewritten after these runs by other lanes
(`flow-draft/amendment.ts`, `flow-bootstrap/authoring/draft-routing.ts`, `assemble.ts`,
`flow-draft/entry.ts`, `llm/evidence-loop-decision.ts`, `nodes/control-flow/for-each.ts`).
Every run used Core sources no newer than 05:17:56Z (Lab prelude `core-build.newest`), so for
those six files I cite the compiled `packages/fluxiq/dist/…/*.js` of 05:17:51Z, marked `dist`.
The facility's `lane-rules/built-flow.ts` and the extension's `blocking-dialog.ts` /
`interference/*` also changed after the runs; this is said wherever they are cited.

## The lead's reading, confirmed or corrected

### r3 `run-munnyvbr-11c28a0f` — confirmed, with additions

- **Span through Withdraw only: confirmed.** Nodes s5 Merge / s6 For Each / s7 = d15 `Withdraw`
  (last in the body, returns to s5) / s8 exit Merge / s9 = d16 the dialog's `Withdraw` after the
  loop (`flow-lane.json` `authoredNodes` + playback `actions` s7 → s5 → s6 → s7). Shape is what
  `draft-routing.js` dist `:140-190` emits for `repeat` on d15 with `through` = d15.
  `through` defaults to the step itself (`amendment.js` dist `:187`) and the schema tells the
  model "Leave it out to repeat this step alone" (`:72`).
- **Which amendment set it:** iteration **22** (1 applied, 1 refused, kept 6) by elimination —
  18–21 toggled d15/d16 in and out (kept 6→4→6→4→6) and 23–24 were refused. The change words
  are NO EVIDENCE (`progress-trace.ts` prints none).
- **Extraction: confirmed** — 10 rows, no `where`, `paginate {loadMore, maxPages: 1}`,
  `pagesRead: 1`. Added: the first ten rows are 0–13 days old
  (`scenarios/professional-network/data/invitations.ts:16-25`), so **no stale request is
  reachable** from this read; every loop pass would withdraw a fresh one.
- **Show more / Retry stall: never met.** No step in build or playback names Show more or
  Retry; two extraction attempts timed out `fewer_records_than_required` (11.4 s each) and
  were answered by asking for fewer rows. The People filter was never pressed (t1–t3 show All).
- **Pass 2 `blocked_by_dialog`: confirmed** (s7 attempt 9, 1822 ms, 4 attempts).
- **Exploration withdrew the newest request: confirmed** — d15 + d16 on row 0 (sent 0 days
  ago); screenshot t3 shows it gone. Dry run 2 replayed the same pair against live state, so a
  second fresh request was most likely withdrawn (no screenshot).
- The dry run replays each step once (`flow-draft/dry-run.ts:147`), so a two-step span that
  cannot loop replays clean.
- Repair: target override refused `target_indistinguishable`
  (`domain/src/runtime/llm-evidence/target/equivalence.ts:80` → `target/override.ts:115`); the
  plan allowed only override and wait-retry (`recovery/plan.ts:97`), neither of which can move s9
  into the span.

### r4 `run-munoa86g-150fb0d9` — one correction

- **46 build calls, never reached checkout: confirmed** (45 decisions + 1 derivation; no control
  name in 170 declarations is a checkout, guest, slot, contact, payment or Place order control;
  the Flow's last press is the header cart link showing 0 items).
- **"Completion accepted with move_money/create_new undeclared (the instructed-acts check)":
  corrected.** Two different checks:
  - `undeclared` is the **consequence cross-check** (`runtime/action-permissions/cross-check.ts:94-105`),
    which refuses nothing by design (`runtime/flow-bootstrap/adaptation.ts:129-134`; the build
    only says it aloud, `flow-bootstrap/action-permissions.ts:215`).
  - The **instructed-acts check** derived two acts, `a1 submit:order` and `a2 submit:check out`
    (recomputed with the run's compiled `instruction-acts.js`). It refused 40, 42, 43 and
    accepted 45 **on an unchanged draft** (3,999 B, 22 steps), so the model's claims alone
    satisfied `runtime/flow-bootstrap/instructed-acts/check.ts:80-86` (kept + mutating +
    unclaimed; the file admits the gap at `:7-8`). Which steps were claimed: NO EVIDENCE.
- **Playback died at node 2 under the consent dialog: confirmed** (`main.s2` `web.dom.type`
  `Search`, `blocked_by_dialog`, 4 attempts; t10 shows the dialog). Cause chain: dry run 1 found
  the consent click d3 `unreproducible` (6,449 ms) because the navigate-only reset kept the
  consent; the model then **dropped d3 at iteration 15** (6 applied, kept 5); later dry runs
  never met the dialog; playback started fresh and did. The domain's dialog rung also
  described the consent overlay as having "no control to press".
- **Repair `temporary_action_sequence` `runtime_patch.preflight_rejected`: the code is a Lab
  mislabel.** Core refused it as **unplanned**, not at preflight:
  `runtime/recovery/annotation/patches.ts:139-141` → `unplannedPatchAttempt` `:421-435`, issue
  "The recovery plan allows no action sequence for this failure." (`:433`), because the
  diagnosis chose `action_target_override`, whose plan allows only override and wait-retry
  (`runtime/recovery/plan.ts:97`). Evidence: the attempt has no `permissionOutcome`, which the
  planned path always writes. The Lab's reader turns any unrecognised sentence into
  `preflight_rejected` (`packages/test-runner/src/existing-fluxiq-control.ts:740-746`). What it
  proposed: kind `temporary_action_sequence` only; contents NO EVIDENCE. The repair's own
  exploration had pressed the consent (`gather.press.accept`, succeeded) — the refused patch
  was the right kind of fix.
- **Added:** r4's derived authority read `move_money` as instructed ("pay at pickup"), so had the
  build reached `Place order` the gate would have permitted it without asking
  (`runtime/action-permissions/gate.ts:258-260`). See r5.
- **Added:** the build never opened the towels listing — the full-name search returned nothing,
  and composed product addresses rendered a napkins listing (t3, t5); the one `Add to cart`
  was the waking press (`pageState: unchanged`, cart 0 items in t6). A "Robot or human?"
  interstitial appeared during dry run 1 (t4).

### r5 `run-munovwp3-d898de74` — confirmed, with additions

- **Reached Pay at pickup, pressed Place order, `permission_required` after 120,210 ms:
  confirmed** (iteration 46, 05:57:52.749Z → 05:59:52.959Z; `permission-ask.ts:39`
  `AUTOMATION_STUDIO_PERMISSION_ASK_TIMEOUT_MS = 120_000`, `onTimeout: "deny"` `:86`).
- **Ended `permission_required` at the declared point (seq 3), failed by
  `lane-rules/built-flow.ts`: confirmed** (seq 4 `environment.missing`; the run's version of
  `:23-24` had no `stoppedToAsk` exemption; the lead's fix is in the file now).
- **Per-iteration table and where the 48 calls went**: in the debug. 47 decisions + 1 derivation.
  Largest single sink: **Pay at pickup, 7 decisions** (four `target_not_a_handle` refusals on one
  radio). Finding the product: 10.
- **Any other control refused for permission: no.** 189 declarations, exactly one refused
  (`Place order`, missing `move_money`). `Add to cart` and `Save for later` declared
  `modify_existing` (not destructive, `destructive.ts:87-88`). The rule held.
- **Panel during the 120 s ask (t9–t12):** checkout with `Pay at pickup` selected; panel "Done —
  Last step: Looked at the page", then "Nothing running". **No question visible** in the visible
  panel area, no overlay. Whether the conversation card below the fold held it: NO EVIDENCE.
- **Added — the right ending on a wrong order.** The draft never opens the towels listing
  (napkins at a composed address, t3/t13), presses `Add to cart` once (cart 0 items in t8),
  picks **`3pm–4pm` while `2pm–3pm` was open** (t7; expected `2pm–3pm`,
  `manifest/expected-values.ts:51-55`), and lacks `Continue without an account` (d23 reported
  `action_failed` but changed the page; not kept; the site kept guest state across the dry-run
  reset, t5). The ask was correct; what it would have authorised was not the instructed order.
- **Added — the ask is not deterministic.** Same instruction: r5 derived `send_or_publish`,
  `modify_existing`, `create_new`; r4 derived `move_money`, `modify_existing`, `create_new`. The
  ask at `Place order` exists only because r5's derivation omitted `move_money`
  (`gate.ts:258-260`, `:292-300`; `service.ts:1540-1542`).

## Causes with file:line (all three runs)

| Run | # | Cause | File:line |
| --- | --- | --- | --- |
| r3 | 1 | `repeat` span is d15 alone; the dialog confirm is after the loop | Core `flow-draft/amendment.ts` (dist `amendment.js:72`, `:187`); `flow-bootstrap/authoring/draft-routing.ts` (dist `draft-routing.js:150`, `:181-190`) |
| r3 | 2 | Dry run replays a repeated span once, linearly | Core `runtime/flow-draft/dry-run.ts:147` |
| r3 | 3 | First-page, unfiltered extraction; no stale row reachable | facility `domain/src/actions/extraction/request.ts:146-152`, `:324`; fixture `professional-network/data/invitations.ts:16-25` |
| r3 | 4 | Show more / Retry stall never met; timeouts answered by asking for fewer | build trace it 5, 14; `request.ts:146-152` |
| r3 | 5 | Exploration and dry run withdrew fresh requests | build d15/d16, dry run 2; Core `action-permissions/gate.ts:258-260` |
| r3 | 6 | Withdrawal declared `modify_existing`; `undeclared` delete refuses nothing; an uninstructed withdrawal would not be asked | Core `action-permissions/cross-check.ts:94-105`, `flow-bootstrap/adaptation.ts:129-134`, `action-permissions/destructive.ts:87-88`; facility `domain/src/runtime/llm-evidence/harness-options/options.ts:84` |
| r3 | 7 | Repair could only re-point a click; override refused `target_indistinguishable` | Core `recovery/plan.ts:97`; facility `domain/src/runtime/llm-evidence/target/equivalence.ts:80`, `target/override.ts:115` |
| r3 | 8 | Repair context dropped parameters and recent nodes | Core `recovery/context.ts:243`, `:322-329` |
| r4 | 1 | Consent click dropped after navigate-only dry-run reset called it unreproducible | Core `runtime/flow-draft/dry-run.ts:120-122`, `:203`; build it 15 |
| r4 | 2 | Dialog rung saw "no control to press" on a consent dialog | facility `apps/extension/src/content/action-runtime/blocking-dialog.ts`, `interference/*` (changed after the run; run-time lines NO EVIDENCE) |
| r4 | 3 | Instructed-acts check accepted `order` / `check out` on an unchanged draft | Core `flow-bootstrap/instructed-acts/check.ts:80-86` (`:7-8`) |
| r4 | 4 | `undeclared` `create_new`/`move_money` refuses nothing | Core `action-permissions/cross-check.ts:94-105`; `flow-bootstrap/adaptation.ts:129-134` |
| r4 | 5–6 | Wrong product (composed addresses → napkins); one waking `Add to cart` | build it 7–16, 23, 26–27 |
| r4 | 7 | Correct patch kind refused as unplanned | Core `recovery/plan.ts:97`; `recovery/annotation/patches.ts:139-141`, `:421-435` |
| r4 | 8 | Lab labels it `preflight_rejected` | facility `packages/test-runner/src/existing-fluxiq-control.ts:740-746` |
| r4 | 9 | Derived authority covered `move_money`: Place order would not have asked | Core `action-permissions/gate.ts:258-260`, `:292-300`; `service.ts:1540-1542` |
| r5 | 1 | Lab failed the declared-point ending | facility `packages/test-runner/src/lane-rules/built-flow.ts:23-24` (fixed by the lead) |
| r5 | 2 | 120 s ask nobody in the Lab answers | Core `runtime/parking/permission-ask.ts:39`, `:65-110` |
| r5 | 3 | Panel shows Done / Nothing running during the ask | facility `apps/extension/src/panel/simple/now-copy.ts:52-54` |
| r5 | 4 | Whether Place order asks depends on a model's reading | as r4 #9 |
| r5 | 5–7 | Wrong product, empty cart, later slot, guest step missing | build it 5–22, 35; `manifest/expected-values.ts:51-55`; `dry-run.ts:120-122` |
| r5 | 8 | `target_not_a_handle` ×5 counted as progress | facility `domain/src/runtime/llm-evidence/node-run/run.ts:258-262` |
| r5 | 9 | Instructed-acts check accepted after Place order was refused | Core `instructed-acts/check.ts:80-86` |

## Commands run and observed results

All reads; no builds, tests, Lab or browser runs.

- `node -e` readers over each bundle's `flow-lane.json`, `decision-trace.json`,
  `live-llm.json`, `evaluation.json`, `run.json`: observed the counts, codes and nodes quoted in
  the debugs (e.g. r3 `decisionCount 25`, `toolCallCount 16`; r4 `45` / `37`, `calls 46`,
  `maxCalls 48`; r5 `47` / `43`, `calls 48`, `maxCalls 64`; r5 declarations 189, one refused).
- `grep` of `[FluxIQ build-trace]` in each `logs/core.log`: observed the iteration timings, the
  completion-check lines and the dry-run replays quoted (e.g. r5 `tool end ms=120210
  resultCode=web.action.rejected.permission_required`).
- `node` importing the run's compiled
  `packages/fluxiq/dist/…/instructed-acts/instruction-acts.js` with the two instructions from
  `live-tasks.ts`: printed `pickup 651 a1:submit:order a2:submit:check out` and
  `withdraw 251 a1:submit:withdraw` (lengths match the bundles' `instruction.characters`).
  Script: scratchpad `t195w7-acts.mjs`.
- `ls -l` / `find -newermt` on Core and facility sources: established which cited files changed
  after the runs (listed above).
- Viewed all 28 screenshots `t195-shots/*-r3-*`, `*-r4-*`, `*-r5-*`.

## Not verified

- The amendment change words (which decision wrote r3's `repeat`, r4/r5's `optional`) — inferred
  from graph shape and kept counts; the trace does not record them.
- The claims that satisfied each accepted completion.
- The contents of r4's `temporary_action_sequence` and r3's target override.
- The store after r3 (whether dry run 2 withdrew a second request) — no store diff in the bundle.
- Whether the r5 panel's conversation card showed the ask (screenshots never scroll the panel).
- Whether the pickup-times stall occurred during r5's build.
- Run-time line numbers of the extension's blocking-dialog code (rewritten after the run).

## Open questions or contradictions found

1. **The Place-order ask is nondeterministic** (r4 derived `move_money` as instructed, r5 did
   not). If the rule is "ask before moving money", `move_money` should never be authorised by a
   derived reading. This is a product decision for the lead.
2. **r3's sibling consequential task** (`live-tasks.ts:40-41`, "describes the problem and never
   asks for a withdrawal") depends on a withdrawal being gated; with Withdraw declared
   `modify_existing`, the gate would not ask there either.
3. The dry-run reset navigates only; site state (consent, guest checkout, withdrawals) persists
   across it. Three of the findings here (r4 consent dropped, r5 guest step missing, r3 dry-run
   withdrawal) come from that one fact.
4. Another lane rewrote the repeat/draft files after these runs; whether that work already
   changes the `through` default (r3 cause 1) I did not check beyond noting the files changed.
