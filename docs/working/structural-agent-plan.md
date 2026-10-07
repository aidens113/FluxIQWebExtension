# Structural Agent Plan

Status: Active
Status detail: Plan agreed with the user 2026-10-07; stage 1 and 2 designs were stopped at the Codex handoff before writing reports and must be rerun; nothing built.
Created: 2026-10-07
Last updated: 2026-10-07
Owner: Senior supervisor agent
Scope: The structural changes that stop a quirk in one node or one mislabelled step from failing a whole build: general tools (run script, request, network visibility), acts derived from evidence, a small edit language, cheap recovery, three general rules in place of special-case refusals, and direct checks before AI judges. It does not cover the read-list redesign (first-class-data-extraction-plan) or the live-lane operating rules (mvp-final-month-plan), which it builds on.
Paired document: none yet (most of stages 2, 3 and 4 is Core work; a Core-side document is owed once a stage's design is accepted)
Related: [MVP final month plan](./mvp-final-month-plan.md), [week report](./mvp-final-month-plan/reports/week-review/report.md), [read-list design](./first-class-data-extraction-plan/reports/read-list-collect-design.md), [working index](./README.md)

---

## Current State

User's direction (2026-10-07, after round 4): "Tiny things like exact node functionality shouldn't completely cripple the bot. The bot should be able to write JS and extract data, interact, etc. It should be able to direct request, etc." The supervisor's analysis: four of the last eight live failures were one mistake in different shapes (the model labels a step with an act it did not do; Core trusts the label), and the rest came from narrow typed nodes with no fallback and a growing list of special-case refusals. Point fixes have not converged.

Done: nothing of this plan is built. Groundwork already on dev: page-change evidence on every draft step (t285), node definitions on first use (t280), readable field labels (t279), every refusal names its way out and three same-kind refusals end the round (t287), judges see only this run's changes (t286), read-list collection and run-end processing (S1-S6).

Not started (handoff 2026-10-07 05:10 UTC): both design leads were stopped before writing their reports when the user handed off to Codex. Rerun stage 1 from "Brief: general-tools design" below (with the user's decisions) and stage 2 from `mvp-final-month-plan.md` "Brief: evidence-acts design", widened to the small edit language (draft = steps that ran and worked; edits remove, redo, move, make optional, repeat) and cheap recovery (Core redoes a wrong step from its start page; a stuck build ends early or asks in the chat).

Next: accept both designs (bring the user any decision with a recommended default), build stages 1 and 2 in parallel by file, then stage 3, then live rounds on A-D plus new realistic sites.

User decisions (2026-10-07, memory `js-last-resort-requests-off-by-default`): direct API requests are a toggle, OFF by default, settable in config and in the extension's settings UI; no debugger channel for running JS (normal extension script injection; the debugger only if absolutely needed for network capture and only with the requests toggle on); JS is a last resort, allowed only after about three failed typed-node attempts, and every Lab run that used it is scored "partial success, used JS" and becomes node work (`node-catalog-plan.md`, which also holds the user-ordered full node audit). Typed nodes stay the default.

Structural problem list (supervisor, 2026-10-07, given to the user in full): A1 act labels trusted; A2 complex edit grammar; A3 narrow nodes without fallback; A4 rule-book prompt (~60 KB); A5 opaque handles renumbered on reload; B7 one budget for explore, author, test, judge and repair; B8 exploring and authoring are one activity, so exploration accidents become Flow structure; B9 too many build-test step states; B10 guards as accumulating special cases; B12 layered repair process; B13 giant core files (`service.ts` ~4,400 lines, the loop at 800); C14-16 AI judges from summaries, no oracle in real use, intricate pair rules; D17 the instruction reader misreads choices; E18-23 page view size, target resolution, no code or network access, wording coupled to codes, connection lifecycle; F24 a cheap model asked for long rule-heavy bookkeeping, F25 no worked examples; G26 only live runs show model coping, G27-30 per-run patching, integration, two repositories, Lab overhead.

## Stages

1. **General tools (2-3 days).** `Run script` step: JavaScript in the page that can read, interact and return JSON or rows; saved in the Flow and replayed without a model. `Request` step: direct HTTP (the page's session when same-site) returning status and a bounded body. Network visibility: the page's own data requests (URL, method, response shape) shown to the model. Rows a script or request returns collect into the run's dataset like a read. Every typed-node refusal offers "or do it with a script". Permission gates judge what a script or request actually did (page change, mutating requests); secret screening covers everything returned.
2. **Acts from evidence and a small edit language (2-3 days, parallel with 1).** The model no longer claims acts; Core derives which step completed which part of the instruction from what changed (cart count, chosen state, confirmation, store switched, request success); acts with no visible change get an explicit check step. The draft is the steps that ran and worked, in order; edits are remove, redo with new settings, move, make optional, repeat over a list or until done.
3. **Cheap recovery and three general rules (1-2 days).** A wrong step is redone by Core from its start page; a stuck build ends early and tests what it has or asks the person in the chat. Special-case refusals give way to: never resend a call that failed on the same page; every kept step shows an effect or is a read or check; the Flow is judged by one whole run against the instruction.
4. **Direct checks before AI judges (with 3).** Where the instruction is concrete (a count, a value, items in a cart), check it against the page or the data first.
5. **Live rounds.** A-D, then new realistic sites; debug and fix what remains. Target: the structural version in live testing by 2026-10-12/13, before the 2026-10-29 freeze.
6. **Separate exploring from writing the Flow (B8) and give each phase its own budget (B7).** Exploration finds the way; a distinct authoring step writes the Flow from what worked (not from every call made), so stray clicks, extra reads and toggle pairs never become Flow structure; explore, author, test/judge and repair each get a share of the purse so an early mistake cannot starve repair. Design after stage 2 (it reuses evidence-acts).
7. **Shrink the rule book (A4) and add worked examples (F25).** After stages 2-3 remove the rules they make obsolete; measure request size per decision before and after; add two or three short worked Flows (cart, list across pages, per-row act) to the instructions.
8. **Confirm the checklist (D17).** When the instruction reader is unsure of a choice or act, ask the person in the chat before building, or check it against the page; never build on a guessed checklist.
9. **Model strategy (F24).** Measure flash against a stronger model on the same recorded decisions for the judge and for authoring; decide per role from cost per success.
10. **Replay recorded AI decisions against new code (G26).** A provider-free harness that feeds a live run's recorded decisions back through the current build loop, so a fix can be checked against the run that exposed it without paying for a new run.
11. **Split the giant core files (B13).** `service.ts` and the evidence loop split by responsibility, so parallel work stops colliding.

## Worker Briefs

Stage 2's design brief: `mvp-final-month-plan.md` "Brief: evidence-acts design" (scope widened by message on 2026-10-07 to the small edit language and cheap recovery). Stage 1's design brief:

### Brief: general-tools design (lead-xhigh, design stage only; 2026-10-07)
- Repository: both, read-only, at dev.
- Task: Design stage 1 concretely against current source: (1) how the extension can run model-written JavaScript in the page on Chrome/Edge (MV3) and Firefox — compare `chrome.debugger` `Runtime.evaluate`, `chrome.userScripts`, `scripting.executeScript` with world MAIN, and injected script tags, against sites with strict CSP; recommend one per browser with its user-visible cost; (2) the `Run script` node: parameters, return shape (JSON value or rows), time and size bounds, how its rows join the run's dataset (S1), how it replays deterministically, how a script that clicks or types is told apart from a read for permissions (observed page change, network writes during the script); (3) the `Request` node: methods, headers, body, same-site session vs cross-origin, response bounds, consequences by method and observed effect, secret screening of request and response; (4) network visibility: capturing the page's fetch/XHR (URL, method, status, response shape, never secrets or tokens) and how the model sees it; (5) the "or do it with a script" way out in typed-node refusals; (6) what the model is taught and how node definitions describe the new nodes; (7) a staged implementation plan partitioned by file (Core node registration and permissions, domain node definitions and plan resolution, extension runtime and content), fail-first tests per stage, and the live proof (a lane where a typed node failed in rounds 3-4 done instead with a script or request).
- Required reads: this document's Current State and Stages; `docs/architecture/extension-client.md`, `docs/architecture/web-capabilities.md`. Permission rule: the model may do anything a person could; only the delete, money and send-or-publish gates and secret screening apply.
- Owns (may edit): `docs/working/structural-agent-plan/reports/general-tools-design.md` in the main downstream checkout only.
- Must not touch: every source, test and other doc; no builds, tests, Lab, browser or provider calls; no fxwork tree.
- Definition of done: the design with sections (1)-(7), file:line evidence for every current-state claim, risks, and user questions each with a recommended default.

## Work Ledger

### 2026-10-07 — Plan written; stage 1 and 2 designs dispatched
- Agent: supervisor
- Changed: this document; the evidence-acts design lead's scope widened to the small edit language and cheap recovery.
- Why: the user's direction after round 4; point fixes for the act-claim family have not converged (W1 in 23 runs; four of the last eight failures).
- Validation: not validated (planning only).
- Outcome: Accepted
- Follow-up: designs back; decisions to the user; build stages 1 and 2.

### 2026-10-07 — Handoff to Codex; designs stopped
- Agent: supervisor
- Changed: this document (Current State).
- Why: the user handed off to Codex; one supervisor at a time.
- Validation: not validated (no design report was written; both leads stopped).
- Outcome: Blocked
- Follow-up: rerun both designs.

## Open Questions

- Script execution channel per browser (debugger bar vs CSP-limited alternatives). Owner: user. Default taken: debugger channel on Chrome/Edge; the stage 1 design recommends Firefox's.
- Cross-origin requests. Owner: user. Default taken: allowed to any origin; mutating methods gated.

