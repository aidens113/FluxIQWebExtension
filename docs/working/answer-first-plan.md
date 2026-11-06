# Answer First

Status: Active
Status detail: The two-attempt Lab, Run again and the live lanes' first fixes are on dev; four live lanes run on their own branches. Live round about $9 of $160 credit.
Created: 2026-11-03
Last updated: 2026-11-06
Owner: Senior supervisor agent
Scope: The extension and Lab side of Answer First: the chat experience the person sees, the Lab's two scores, a same-workspace second attempt, a double-act oracle, and the Lab's default build path. Core's plan owns the idea, the design, the lanes and the open questions.
Paired document: `C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/answer-first-plan.md`
Related: [testing facility](../architecture/testing-facility.md), [extension client](../architecture/extension-client.md), [offline trials plan](./trace-offline-trials-plan.md)

---

## Current State

**State (2026-11-06).** Core's paired plan holds the user's words, the full state, the live results, the open defects with their owners, and the questions waiting on the user. The user has made the extension and `@fluxiq/ui-components` the focus for now; the web panel waits until they reopen it.

**On `dev` (fb7a7a865), not yet on `main`:**
- The extension screens for the answer, the work header, the saved state, the task list, the model key unlock; Run again from the answer card through the relay to Core; a check already in state answering `skipped`.
- The domain: a saved read keeping what its handle stood for, the controls line carrying headings with bare names for conditions, a press's witness recorded at a person-only check, an act named by its card.
- The Lab: every realistic task's final facts read independently of the page a run ends on (`answer-first-plan/reports/final-facts-audit.md`); `pnpm lab attempt ... --attempts 2 [--restart-between]` with no reseed, attempt 2 judged on its change; the declared person played for person-only checks; a paid attempt's evidence, picture and cost kept whatever fails; startup logs kept in the run folder; Run-again judgement telling set-to from add.

**Live lanes A-D** (`task/t875`-`t878-live-breadth-*`, pushed) run paid attempt pairs on the ten realistic sites, one Lab slot each, and fix on their own branches. Their later fixes reach `dev` at the next integration round. Results, defects and owners: Core's paired plan.

**Blockers:** none. **Next:** integration round 2, the full sweep on dev and promotion to `main`, then live testing resumes with count tasks once lane A's repeat fix lands.

## Extension Lane

Rendering goes in `@fluxiq/ui-components`. Approvals, routing, extension storage and `chrome.*` stay in `apps/extension/src/panel/chat`, as now. Checks are unit tests beside the code plus provider-free headed specs on the ten realistic scenarios, never a synthetic page in a browser.

The Lab presses names: `#connectButton`, "Settings", "Start recording", `#stopRecordingButton`, `panelTab-*` and the settings labels. A phase that moves one moves the Lab in the same unit.

No saved picture shows getting-started, the empty state, Automations, the strip, Settings, recording, extraction or Firefox. So the first step is a provider-free capture of each, for this plan and for later comparison.

| Phase | Build | Proves | Checked on |
| --- | --- | --- | --- |
| Truth pass | No codes, no cut sentences, no tick on "not confirmed", red only when it matters, onboarding claims true, dead review code gone | The chat stops saying untrue things | everything-store, crossborder-marketplace |
| Budget out | The only failure shape: the best result so far, what was saved, add budget and carry on; anything else that goes wrong shows as a step while it keeps working | A task never ends in a bare failure | crossborder-marketplace with a scripted ending |
| Answer turn | `results` port, rows preview, counts, CSV and JSON, on-site list, check line, Run again | The result can be taken without leaving chat | company-website; 360 px and keyboard |
| Real rows | The adapter reads the last run's dataset into the answer turn | Value before Core's result record lands | crossborder-marketplace, oracle rows equal the preview |
| Work header | Time, cost, one Stop, each step and ask told once | The person knows what it costs and can stop | job-board; robot check on crossborder-marketplace |
| Setup | One screen in order, deep links, readiness, the extension's factory passing `purpose` | A new person reaches a first task | Stand-in gateway and a realistic page |
| Second attempt shown | Saved state chip, "Using what I saved", from-saved marking, comparison line | The loop's value is visible | bigbox-retail, everything-store replay |
| Tasks | Inside the Automations tab: search, attempts, rename, delete; durable steps from Core | Old work can be found and understood | local-classifieds; worker restart |
| Asks | Told once; consequences; no PIN once a Flow is running; for money, delete and send, a PIN once ever, when first starting a chat or Flow (user, 2026-11-03); Firefox popup re-open | Lasting acts finish in the extension | auction-marketplace |
| Library | Tree, search, run with inputs, inspect | Nested subflows are usable | professional-network |
| Recording and settings | "Show me how" as a composer attachment; settings in order, Advanced for the rest | Chat-first end to end | everything-store, company-website, photo-social |
| Firefox pass | Popup layout, long work without an open panel, badge | Parity is real | social-network-feed |

## Lab Lane

The Lab today throws `lab.candidate_not_promoted` on a draft and never consults the oracle, so a task the person got right scores as a failure if no Flow was promoted.

**Every rule that binds a Lab run stays:** the ten realistic scenarios, starting from the extension chat, visible browsers, the task audit, up to four live lanes, no weakened oracle, and no fixture or guidance shaped to pass.

1. **`answerVerdict`.** Judge the attempt's stored rows and the site's state against the same private oracle, on the attempt itself, before any fixture reset (before `lane.ts:452`). `oracleVerdict` then means Flow playback only. Relax the validation that forces both null without a Flow (`lane-observation.ts:163`, `evaluation-validation.ts:137`). `judgeCreatedFlowDataset` needs a dataset source without a persisted Flow run.
2. **What the chat showed.** Score the answer the person saw, screened, as well as what is stored, so a right answer that never reached them fails.
3. **A double-act oracle.** For each task with a lasting act, the site's recorded change must equal what the task asked for, once. Final-state oracles are absolute today, so attempts need a seeded baseline and a judgement of the change, as the standing rule says.
4. **A same-workspace second attempt.** Each build starts blank in a fresh workspace today, so repeated runs are repeats and not attempts. A new lane runs a task twice on one workspace and proves the second started from the first's draft. `persistent-isolated` and `lab replay` are the nearest existing pieces.
5. **The per-attempt report.** One row per attempt: task, attempt, path, calls, tokens, dollars, time, live steps, simulation result, both verdicts, repeated acts, loops caught. A per-task series over it, and the bench report carrying both scores. Calls and tokens sit beside dollars, because models and prices change.
6. **The defaults.** The Lab's authoring mode default (`packages/test-runner/src/live-llm/authoring-mode-env.ts`) equals the product's, and `testing-facility.md`'s stale line about it is corrected.

Old pass rates are not comparable to `answerVerdict` and are never blended with it. Only a few tasks run fully end to end (user rule), so a second attempt runs on about one task per site, and every other task stays proven provider-free.

**The hard rule in the Lab (user, 2026-11-03).** A task that ends without its result fails, unless its budget is gone or a person stopped it.

**Done when:** a provider-free lane scores a task right with no Flow promoted, wrong with a repeated act, and shows a second attempt spending less than its first, all headed on a realistic site.

## Work Ledger

### 2026-11-03 - Plan

- Agent: lead.
- Changed: this document. No source.
- Validation: not validated; this is a plan. The evidence is in Core's ledger.
- Outcome: shown to the user for review.

### 2026-11-05 - Paid runs and the two-attempt Lab

- Agent: lead; lane supervisor of t869 and its workers.
- Changed: on t869 only, the Lab's final facts on all ten realistic scenarios, `--attempts 2`, Run again in the panel and relay, `check` answering `skipped`, the saved-read binding, and headings on the controls line.
- Validation: lane, provider-free in a visible browser: `FLUXIQ_ATTEMPT_SCRIPT_FORM=again-check pnpm lab attempt local-classifieds --task local-classifieds-save-dining-tables --authoring-mode answer-first --scripted-model --attempts 2` -> exit 0, `run-mw3r7gal-3ef7639e`, attempt 2 `change: {}`; with `again-press` -> exit 1, `run-mw3rfe9e-af5a3ce8`, the Lab naming three `unsaved` rows. Lead: the extension's pre-push structure audit -> `passed (244 warning(s), 552 baselined)`. Paid runs are in Core's ledger.
- Outcome: the Lab can prove a second attempt. t869 is not landed.

### 2026-11-06 - The integration round and four live lanes

- Agent: lead; supervisors of t869 and of live lanes A-D (t875-t878).
- Changed: on `dev` (fb7a7a865), t869 with lanes A, B and C merged in; the Lab, domain and extension changes listed in Current State. On the lane branches only, their later fixes.
- Validation: lead, on the integration tree before the merge to dev: `node scripts/test-domain.mjs runtime/llm-evidence runtime/route-state` -> `# pass 1685`, `# fail 0`; `node scripts/test-extension.mjs panel/chat/transport background/automation-relay content/actions` -> `# pass 272`; runner attempt-lane, site-change, answer and core-web-build `node --test` -> `# pass 185`; Lab scenarios professional-network, local-classifieds and crossborder -> `# pass 152`, `# fail 1` (the `local-classifieds` breadth test's 12-second wait under load), then `# pass 7`, `# fail 0` alone; `node scripts/structure-audit.mjs` -> `passed (244 warning(s), 552 baselined)`; `node scripts/check/core-mirror.mjs` -> `1 mirror set(s) match`; the scripted `again-check --attempts 2` pair -> both attempts `answer right`. Core's checks are in Core's ledger.
- Outcome: four live attempt-2 pairs passed; one live repeat of a carried count act is open in lane A. Not on `main`.

## Open Questions

None here beyond those in Core's plan.
