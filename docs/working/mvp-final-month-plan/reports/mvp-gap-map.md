# mvp-gap-map

Worker report, 2026-10-05. Brief `mvp-gap-map` in `../../mvp-final-month-plan.md`.
Read-only: no build, test, Lab, browser, panel or provider call. The only file written is this report.

## Outcome

**Done.** Each of the 26 Final MVP Acceptance Test items, the Week 3 exit criterion and Week 4 phases 4.2-4.10
is mapped to evidence below. Summary: of the 26 items, **5 are proven live** on the current product line
(3, 6, 7, 8, 11, all from t262's A8 run on one scenario). **About 10 are proven only in older or provider-free
runs, or implemented but not proven live.** **The Adaptation block (12-20) and the Learning block (21-23) on an
instruction-built Flow are the largest unproven area.** Onboarding (item 2, phase 4.2) and run Pause (item 10)
are effectively missing. Firefox has only a build, with no browser proof. Every "proven live" below means proven
in a headed Lab run driven through the real extension chat, not by a person unfamiliar with FluxIQ, which
the acceptance test requires.

Status meanings: `proven live` = a cited live run on the current or near-current product passed it;
`implemented, not proven live` = source/unit evidence only, or live proof only on a superseded line (dated);
`partial` = part of the behavior exists or was proven; `missing` = no evidence the behavior exists.

## What changed and why

Only this report was written. Sources read are listed under "Commands run".

### Acceptance items 1-26

| # | Item | Status | Evidence | Work still needed |
| --- | --- | --- | --- | --- |
| 1 | Install FluxIQ | implemented, not proven live | `docs/architecture/release-packaging.md` (t183, 2026-09-29): Chrome/Edge and Firefox zips, icons, build stamp; `docs/user/install.md`, `quickstart.md`. Core runtime install not covered by an extension doc found here. | Install the packaged build plus Core on a clean machine or profile outside the dev environment (4.9/4.10). |
| 2 | Understand basic purpose | missing | `apps/extension/src/panel/getting-started/start-steps.ts` shows only connection steps (Open FluxIQ, Connect, Approve). No onboarding message and no three-option start (Describe / Show how / Extract) found. | Phase 4.2 onboarding: concept message plus the three entry options after connect. |
| 3 | Describe via natural language | proven live (1 scenario) | t262 A8 `run-mutepu6b-656f8882`: built from the extension chat, 10-node graph, 4/4 facts, 45 priced calls / $0.0566 (t262 continuation Current State). Earlier: 1002-M A `run-murwd8le-79e735a8` (live-loop Current State). B7 `run-muteqswo-eb98d55a` failed; C and D unproven live. | B binding affordances; C (13 records, all pages) and D (confirm requests, waypoints) live passes. Then the ten realistic scenarios, with two consecutive qualifying passes per rung (handoff live-history step 8). |
| 4 | Demonstrate (record) | implemented, not proven live (dated) | Recorder UI exists (`panel/recording/record-control.ts`, `recording/review`). Provider-free recorded Flows passed 3 of about 35 recording-lane runs, social-network-feed only (week2-exit-plan Current State, E1 2026-09-21). After that the user set scope (2026-09-22, defensive-runtime plan): "Recording-built Flows are not tested, measured, or reported as progress." | Decide whether demonstrate stays an MVP entry point (see Contradictions). If it does, prove a recorded multi-step automation on the current line, including replay. |
| 5 | Create a scraping automation | partial | Picker path proven live 2026-09-20 (t027) and on 2026-09-22 (t032 on dev): 8 rows, 7 fields, CSV/JSON, full-restart replay, zero calls (extraction plan Current State; `first-class-data-extraction-plan/reports/w2-integrated-extraction-ui-smoke.md`). Model-authored scraping: one-node extracts pass 9 of 19 stable (2026-09-24). Lane C round 1003 run 1 `run-musp39u8-9ac026ab` matched the oracle 13/13 rows and 52/52 fields, but the product verdict failed; run 2 `run-mustvzvg-99695308` read only one page. | Re-prove the picker path on the current dev (it is 2 weeks and many UI changes old). Fix C: paginate:true meaning (C1) and carried-row repair (C4). Then a live pass of a language-described multi-page scrape. Held UI items: extraction caret, preview-table semantics, preview feedback (t224, paused). |
| 6 | Generate a runnable automation | proven live (1 scenario) | A8 saved a 10-node graph that executed (t262). | Same as item 3: more scenarios. |
| 7 | Test it | proven live (build-time) | t252 build tests run the written Flow and repeat once per row; judges see each row (live-loop Current State). A8 creation judge "yes". There is no separate user-initiated "Test" control evidenced. | Confirm the person can trigger a test from the UI, if 4.2's flow (Create, Test, Save, Run) is kept literally. |
| 8 | Run it | proven live (Lab) | A8 runtime pass, 4 facts held; 2 provider-free reuses (t262 `reports/a8-provider-free-reuse.md`). | A run started by a person from the extension Automations tab, not only the Lab. |
| 9 | Understand execution progress | partial | Overlay, activity relay, chat cards built (live-activity-chat P1-P3, t191 rounds r2-r6). Its own P4 browser proof is "Not done". The Lab opens the real side panel; t257 UI review measures page loads; lane A lists unfixed UI gaps (bare "Run finished", late initial overlay, chat ending trace). | Run the live-activity P4 checklist (5 items) during a live run and close lane A/C UI defects (U-A..F, D6, D9). |
| 10 | Pause/stop execution | partial: Stop implemented, Pause missing | Stop: `apps/extension/src/background/panel/run-control.ts` cancels through Core `cancel-runtime-session`. Real Stop against running Core "not exercised" (other-history, PANEL-007). Recording has pause/resume; no run-level pause found in the extension (grep). Core not inspected for pause. | Live Stop proof mid-run, with work not continuing afterward. Decide and build run Pause/resume or explicitly redefine item 10 as Stop. Human takeover (4.3, 4.10 step 12): no takeover control found. |
| 11 | Re-run without AI each action | proven live (1 scenario) | A8: two unchanged provider-free reuses, zero calls and interventions, graph/router/subflow hash unchanged (t262). Recorded and extraction Flows: zero-call replay across restart (t032). | More scenarios, plus a re-run after browser/runtime restart for an instruction-built Flow. |
| 12 | Encounter unexpected state | implemented (fixtures) | Drift scenarios exist (`identity-drift-rename-redesigned-after-creation`); runtime routes by page state to the matching node (memory rule, not checked in source). | A live run of a saved instruction-built Flow against a drifted page variant. |
| 13 | Detect cannot continue | proven live (dated) | t049 `run-mubmrcyv-beaa2a6b` (2026-09-21): `target_not_found` detected on a created Flow (`week2-exit-plan/reports/w2x-created-flow-repair-lane.md`). | Re-prove on the current line. |
| 14 | Harness diagnoses | proven live (dated, unreliable) | Same run: two diagnoses. Core proposed a patch in 1 of 5 live runs; 2 runs had diagnosis fail validation (same report). | Reliability on the current line. |
| 15 | Harness explores a solution | partial | 2026-09-21 audit: recovery exploration could not press, type or navigate under the default policy (`harness-options/registry.ts:270-276`); it is unknown here whether this changed. | Confirm current Core policy; live repair that explores. |
| 16 | Recognize successful recovery | implemented, not proven live | Week 2 audit: Recover "cannot happen in production Core for any model-written repair" (`service.ts:3081`, `3224`, `3278`, `live-patch.ts:140-141`, as of 2026-09-21). Later t117 makes a false refutation trigger a real repair (defensive-runtime plan). | Re-audit those Core lines on current dev; live proof. |
| 17 | Convert recovery into reusable automation | partial | t049: one proposal-only `temporary_target_override` saved as an adaptation (2026-09-21). Lane C prepared carried-row repair, not proven; t262 C4 saved-row repair fixture in progress. | C4 fail-first fixture, then live repair that writes a corrected node. |
| 18 | Validate the adaptation | implemented, not proven live | 2.5 deterministic patch gate landed; "no run id anywhere shows an adaptation reaching `validated` on a created Flow" (status-survey-loop, 2026-09-24). Live loop rule: a repair finishes only after a whole-Flow judged run. | A live run showing `validated` before persist. |
| 19 | Persist the adaptation | partial | t049: Lab approve/apply (manual in the Lab, not automatic) 2026-09-21. t256 Adaptations view shows applied / held / waiting (Core `75e66057`), source only. t258 open case: store loss after `applied: true` still reads applied. | Automatic persistence on a live repair; visible in the Adaptations view. |
| 20 | Continue execution | missing (as of last evidence) | Resume (same run continues from the failed node) was blocked in production Core as of 2026-09-21 (week2-exit-plan); no later live proof found. | Re-audit; implement Resume or accept restart-from-start as "continue"; live proof. |
| 21 | Run again | proven live for creation reuse only | A8 reuse (t262). Never after a repair on the current line. | Re-run after a persisted repair. |
| 22 | Encounter learned situation | proven live (dated, single-node) | t049 key-less replay `replay-mubmxtvg-93979815` passed with 0 calls on the drifted page (2026-09-21); earlier 2026-09-09 manual-apply run `80414559-...` (single selector patch). | Same on a multi-node instruction-built Flow on current dev. |
| 23 | Handle without unnecessary LLM | proven live (dated) | Same as 22: zero calls, zero harness activations. | Same as 22. |
| 24 | Simple Mode shows it learned | implemented, not proven live | Simple Mode's conversation card was replaced by the chat panel (live-activity D6); "Run #N, AI activated once, learned 1 variation" summary not found. t256 wording lives in Core's Adaptations view and inbox, not confirmed in the extension. | A learned-something message in the extension chat or Automations row after a repair, proven live. |
| 25 | Open Advanced Editor | implemented, not proven live | t219 (`aef6ceae`): "open the selected Flow in FluxIQ" from the extension. Core web panel is the editor. t224 browser behavior unexercised. | Live click-through from the extension to the Core editor on the right Flow. |
| 26 | Inspect automation and adaptation | implemented, not proven live | Core Flow editor plus Adaptations view (t256); web-panel audit browser-certified 2026-09-01, before t224/t256 changes (core-ui-history). | Live check that the repaired node and its adaptation record are visible and understandable. |

### Week 3 exit and Week 4 phases

| Row | Status | Evidence | Work still needed |
| --- | --- | --- | --- |
| Week 3 exit: Install, Describe/Demonstrate, Generate, Run, Observe, Encounter change, Watch adaptation, Re-run learned, without Advanced Editor | partial | Describe-Generate-Run-Observe-Re-run proven on A8 only. Encounter-change, adaptation and learned re-run: no chained live run on an instruction-built multi-node Flow. Week 2 exit criteria 1-4 were never met (week2-exit-plan, 2026-09-22; status-survey 2026-09-24). | One chained live run: A8-class Flow, drifted variant, live repair, persist, key-less re-run. This is the MVP thesis demo. |
| 4.2 Onboarding (<5 min) | missing | Getting-started is connection-only; no runtime-start guidance in the panel found; `docs/user/quickstart.md` exists. | Three-option start, concept message, timed first-run test. |
| 4.3 Reliability hardening (20 cases) | partial | Delivered: reconnect/pairing persistence (t182), Stop relay, project-store loss (t258), network guard, purse refusals and endings (t254/t262). Not evidenced: browser restart, extension reload, tab closure mid-run, runtime crash, pause/resume, human takeover, LLM timeout as user-visible. Real reconnect/restart/Stop "not exercised" live (other-history). | A live matrix of the 20 cases, prioritizing restart, reload, Stop, takeover. |
| 4.4 Credentials and sensitive data | implemented, not proven live | `docs/architecture/sensitive-values.md`; X0 sensitive-control refusals and five leak fixes; D12 excluded-column rule; t182 at-rest/privacy/withholding; `docs/user/privacy-policy.md`. t182-w2 storage scan "best-effort". | Review against the 13-item 4.4 list; confirm problem reports are redacted. |
| 4.5 AI cost and model controls | partial | Billed-cost purse and per-flow ceiling (t254, $0.10 default), per-run spend split build/judge/read (t255), t262 logical-call admission. Not found: AI cost per 100 successful executions, adaptations per 100 executions (2.9 metrics were `null` on 2026-09-21), user-facing adaptation enable/disable or policy control. | Metrics roll-up, user controls review. |
| 4.6 Performance pass | missing (as a pass) | Build/test speed work only (t187/t192 facility). No profile of runtime snapshot, target resolution or UI rendering found. | Profile a deterministic replay (A8 reuse took 85 s and 2.3 s in the two reuses: worth checking why). |
| 4.7 FluxBench release qualification | partial | Week 1 bench complete (2026-09-15, 180/189). Language-driven loop replaced corpus runs with one-run-one-debug (2026-09-24); 4-of-36 corpus predates t010. No repeated full suite on the current line. | Decide qualification set (likely the ten realistic scenarios) and run it repeatedly within spend rules. |
| 4.8 Product diagnostics / Report Problem | implemented, not proven live | `apps/extension/src/background/diagnostics/problem/report.ts`, `panel/settings/problem-report-section.ts` with tests. | Live check: report contains flow/run id, failed node, versions, and is redacted. |
| 4.9 Packaging | partial | Chrome/Edge and Firefox zips, versions, build stamp, icons, store listing, privacy policy, install docs (release-packaging.md, docs/user). Store submission and AMO signing are manual owner steps. CI settings (Core repo/ref/token) unverified (other-history facility item 1). Store screenshots not checked. | Clean outside-dev install; CI settings; screenshots; submission. |
| 4.10 Release-candidate testing | missing | No clean-environment first-time-user run recorded. | The 13-step script, after 4.2 and 4.9. |

### Notes on the topics the brief singled out

- **Demonstrate/record path:** built, last proven 2026-09-21 on one site, deliberately out of measured scope since 2026-09-22.
- **Scraping UX:** picker path proven 2026-09-20/22; held UI fixes (caret, preview table, feedback) paused with t224.
- **Pause/stop:** Stop exists, no live proof; no run Pause.
- **Human takeover:** no takeover control found; permission asks park and resume through conversations (`conv-parking-and-resume`), which is the nearest behavior.
- **Simple Mode vs Advanced Editor:** Simple Mode was replaced by the chat; the Advanced Editor is Core's web panel, reached through t219's "Open in FluxIQ".
- **Onboarding:** connection steps only.
- **Packaging:** zips and docs exist; no outside-dev install.
- **Firefox parity:** Firefox target builds and packages (min 128); native popup at about 600 px never loaded or tested (other-history items 5, 8; PANEL-007).

## Five largest gaps by user-visible impact

1. **No live adaptation loop on an instruction-built Flow (items 12-20, 22-24, Week 3 exit).** The product thesis
   (detect, repair, persist, re-run without AI) was last shown live on 2026-09-21 on a single-node selector patch,
   with manual Lab apply and Resume blocked in production Core. Nothing on the current line.
2. **Creation works on one scenario only (items 3, 5, 6).** A8 passes; B7 fails on binding affordances; C and D are
   unproven live; P5 `$step` earlier-output binding is refused (`binding-forms.ts:124`). Users will hit B/C/D-shaped
   tasks immediately.
3. **No onboarding (item 2, 4.2).** A first-time user sees connection steps and then an empty chat.
4. **Run control: no Pause, no takeover, Stop unproven live (item 10, 4.3).**
5. **No outside-dev install or release-candidate run (items 1, 4.9, 4.10), and Firefox is unproven in a browser.**

## Commands run and observed results

All read-only:
- `sed`/`grep` on `FluxIQ Web Extension — 30-Day MVP Implementation Plan.md` lines 1010-1030 and 1084-1440: read the
  Week 3 exit, 4.2-4.10 and the acceptance test.
- Read `docs/working/claude-work-handoff-2026-10-03/reports/{core-ui-history,live-history,other-history}.md` in full.
- Read Current State of `week2-exit-plan.md`, `first-class-data-extraction-plan.md`, `live-activity-chat-plan.md`,
  `fluxiq-conversations-plan.md`, `codex-ui-ux-review-2026-09-30.md`, `manual-panel-test-findings.md`, and t262's
  `mvp-live-continuation-2026-10-03.md`.
- To check specific claims: Current State of `language-driven-flow-loop-plan.md` and
  `flow-authoring-and-defensive-runtime-plan.md`; `week2-exit-plan/reports/w2x-created-flow-repair-lane.md` lines 1-47;
  `flow-authoring-and-defensive-runtime-plan/reports/status-survey-loop.md` lines 95-262 in part.
- Source greps under `apps/extension/src` and `domain/src` for onboarding, pause, stop, takeover, report problem,
  Simple Mode / Open in FluxIQ. Found: `run-control.ts` (Stop), `diagnostics/problem/report.ts`, `getting-started/`,
  `recording/record-control.ts` (pause belongs to recording); no run Pause, no takeover control, no onboarding copy.
- `docs/architecture/release-packaging.md` lines 1-30; listed `docs/user/` (README, install, permissions,
  privacy-policy, quickstart, store-listing).

No build, test, Lab, browser, panel or provider call.

## Not verified

- Core source for run pause, Resume, recovery-exploration policy and the Recover blockers cited from 2026-09-21. All
  adaptation statuses rest on documents dated 2026-09-21 to 2026-09-24, plus the 2026-10-03 handoff. Core may have
  changed since then.
- Whether t262 or the dirty lane trees add Pause, takeover, onboarding or adaptation behavior. I read only t262's
  Current State, not its diff.
- `docs/user/*.md` contents and store screenshots; Core's own install/start documentation.
- Whether the extension chat or Automations row shows a "learned" message (item 24). Only a name grep was done.
- No claim above was reproduced; live run ids are cited from documents.

## Open questions or contradictions found

1. **Demonstrate is an acceptance item, but recording is out of scope.** Acceptance items 4 and Week 3 exit include
   "Demonstrate". The 2026-09-22 user scope in `flow-authoring-and-defensive-runtime-plan.md` says recording-built
   Flows "are not tested, measured, or reported as progress". The supervisor needs a decision: keep demonstrate as a
   supported-but-unmeasured path, or re-prove it before release.
2. **Simple Mode was removed, but items 24 and the Week 3 phrasing still assume it.** live-activity D6 replaced Simple
   Mode's card with the chat. Item 24 needs to be read as "the extension chat", and no learned-summary message is evidenced.
3. **Stale Current States contradict delivered work.** `fluxiq-conversations-plan.md` still says "Dispatched", yet
   store/API, parking/resume and live chat window are delivered (other-history). `first-class-data-extraction-plan.md`
   says both "picker complete" (2026-09-20) and "picker in progress / X5.3, X5.5-X5.7 not done" (2026-09-15); nested
   reports show those delivered. `codex-tasks-2026-09-30.md` says none started, but t216-t221 merged.
   `manual-panel-test-findings.md` describes a `127.0.0.1:3000` host as current (2026-09-20 snapshot).
4. **t252 overstates `$step`.** The t252 merge and live-loop Current State say the build may bind "an earlier output".
   Core `binding-forms.ts:124` refuses `$step` (`step_binding_not_yet`), confirmed by both the live-history report and
   t262 (P5).
5. **The live-activity P4 "free RAM below the 4 GB floor" skip contradicts AGENTS.md.** AGENTS.md says machine load
   is never a cause. P4 was handed to the live lane, and no report found here closes it.
6. **The Week 2 exit gate (repair chain via Lab and `ui:e2e` P2, third entry point, week2 corpus) was never closed or
   formally retired.** The language-driven loop superseded its measurement, but none of its four criteria has a
   recorded pass. Either retire it explicitly or fold criterion 1 into the MVP adaptation proof (gap 1).
