# Structural Agent Plan

Status: Active
Status detail: Consultant/source audit reordered stages: acceptance and explicit candidates first; fallback feasibility alongside; implementation pending.
Created: 2026-10-07
Last updated: 2026-10-06
Owner: Senior supervisor agent
Scope: Independent outcome acceptance, separate discovery and candidate submission, declared-start execution and shared promotion, typed browser blockers, and bounded script/request feasibility. Read-list implementation stays in first-class-data-extraction-plan; cross-repository sequencing and live gates stay in mvp-final-month-plan.
Paired document: none (planning review only; create a Core-side companion before implementation changes generic authoring, verification or promotion)
Related: [MVP final month plan](./mvp-final-month-plan.md), [week report](./mvp-final-month-plan/reports/week-review/report.md), [read-list design](./first-class-data-extraction-plan/reports/read-list-collect-design.md), [working index](./README.md)

---

## Current State

User's direction (2026-10-07, after round 4): "Tiny things like exact node functionality shouldn't completely cripple the bot. The bot should be able to write JS and extract data, interact, etc. It should be able to direct request, etc." The supervisor's analysis: four of the last eight live failures were one mistake in different shapes (the model labels a step with an act it did not do; Core trusts the label), and the rest came from narrow typed nodes with no fallback and a growing list of special-case refusals. Point fixes have not converged.

Done: nothing of this plan is built. Groundwork already on dev: page-change evidence on every draft step (t285), node definitions on first use (t280), readable field labels (t279), every refusal names its way out and three same-kind refusals end the round (t287), judges see only this run's changes (t286), read-list collection and run-end processing (S1-S6).

Planning review completed 2026-10-06 locally. The cancelled stage designs were
never implemented. The consultant review and code audits are now recorded under
`mvp-final-month-plan/`; revised stages below supersede their dispatch order.
Current source retains unknown-confirmation acceptance and apply-before-judged
exceptions for unsupported topology. Existing candidate/signature/held-promotion
seams should be extended. No source or Core files changed in this planning task.

Next: acceptance/readiness fence, explicit candidate submission and declared-start
verification/promotion. Finish navigation/gaps audits; improve typed blockers in
parallel by file. Design script/request feasibility alongside, without requiring
arbitrary page JS before the first trustworthy typed Flow.

User decisions (2026-10-07, memory `js-last-resort-requests-off-by-default`): direct API requests are a toggle, OFF by default, settable in config and in the extension's settings UI; no debugger channel for running JS (normal extension script injection; the debugger only if absolutely needed for network capture and only with the requests toggle on); JS is a last resort, allowed only after about three failed typed-node attempts, and every Lab run that used it is scored "partial success, used JS" and becomes node work (`node-catalog-plan.md`, which also holds the user-ordered full node audit). Typed nodes stay the default.

Structural problem list (supervisor, 2026-10-07, given to the user in full): A1 act labels trusted; A2 complex edit grammar; A3 narrow nodes without fallback; A4 rule-book prompt (~60 KB); A5 opaque handles renumbered on reload; B7 one budget for explore, author, test, judge and repair; B8 exploring and authoring are one activity, so exploration accidents become Flow structure; B9 too many build-test step states; B10 guards as accumulating special cases; B12 layered repair process; B13 giant core files (`service.ts` ~4,400 lines, the loop at 800); C14-16 AI judges from summaries, no oracle in real use, intricate pair rules; D17 the instruction reader misreads choices; E18-23 page view size, target resolution, no code or network access, wording coupled to codes, connection lifecycle; F24 a cheap model asked for long rule-heavy bookkeeping, F25 no worked examples; G26 only live runs show model coping, G27-30 per-run patching, integration, two repositories, Lab overhead.

## Stages (revised after consultant/source audit)

The current implementation detail is the [consultant revision](./mvp-final-month-plan/consultant-revision.md).
The [original stage order and briefs](./structural-agent-plan/archive/2026-10-06-original-direction.md)
remain historical evidence. They must not be dispatched unchanged.

1. **Acceptance and readiness fence.** Fix yes-plus-unknown/silent confirmation;
   block unsupported apply-before-judged repair topologies; define requirement/run/
   candidate-bound evidence; add running-worker build identity and reachable Stop/
   build cancellation. Negative and provider-free readiness cases before paid runs.
2. **Separate discovery from complete candidate submission.** Feature-flagged path
   using current Flow schema, validation and executor. Discovery is evidence only;
   submission makes an immutable revision with consolidated diagnostics. Do not
   build another remove/redo/move/keep editing language first.
3. **Declared-start execution and shared promotion.** Execute the exact candidate
   through the normal runtime on declared resettable fixture state; verify outcomes
   independently; promote only that revision. Bootstrap and repair share the gate,
   including topology, cancellation, crash and stale-result cases. Use existing
   held-candidate and graph/adaptation storage seams.
4. **Typed blockers alongside 1-3.** Finish the ordered full node audit; prioritize
   shared checkbox/type/Next-page/row/coverage/permission defects blocking A-D.
   Keep durable identity descriptions, desired-state operations and bounded waits.
5. **Fallback feasibility alongside, then bounded capability.** Preserve the user's
   JS-last-resort and requests-OFF rules. Distinguish pure serialized-data transforms
   from page/network code. Resolve browser/CSP/store channel and pre-effect permission
   limits before implementation; effect inspection cannot retroactively authorize.
6. **Prompt/controller/replay throughout.** Extract touched responsibilities, remove
   obsolete bookkeeping only with regressions, add three concise worked examples,
   keep global hard budget and protected verification/repair reserve. Decision replay
   stops at divergence; checkpoint model tests and saved-Flow replay remain distinct.
7. **Live qualify, adapt, release.** A-D twice per same integrated build pair plus
   zero-call replays, C S7 after proof, Phase 1b, three-site learned repair chain,
   ten-site breadth, UX/reliability and clean-profile acceptance. Dates/gates stay
   in the final-month plan. No live runs performed by this review.

## Worker Briefs

Historical, superseded dispatch instructions; use the revised stages and final-month next brief instead. Stage 2's former design brief: `mvp-final-month-plan.md` "Brief: evidence-acts design" (scope widened by message on 2026-10-07 to the small edit language and cheap recovery). Stage 1's design brief:

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

### 2026-10-06 - Consultant and source audit revised execution order
- Agent: Codex supervisor, task t295.
- Changed: stage order, cancelled-brief status and stale script/request defaults; original preserved in archive.
- Why: independent outcome acceptance and explicit candidate boundaries address the repeated failures before new editing grammar or broad fallback tools.
- Validation: source/doc audit only; no implementation, live runs or paid calls.
- Outcome: Accepted
- Follow-up: P0 readiness/acceptance tasks, then P1/P2 vertical candidate slice.

## Open Questions

- Page-script channel, browser version/toggle/CSP and store compatibility require
  a concrete feasibility report. Preserve no debugger for JS; network debugger
  only if absolutely needed and direct requests enabled. The old debugger default
  is superseded by the user's later explicit decision.
- Direct-request origins, session attachment, redirects and uncertain-write handling
  need design. Requests remain OFF by default; do not inherit any-origin as an
  authorization decision. Existing delete/money/send-or-publish gates stay binding.
- Trusted-input-only sites cannot be promised by synthetic pointer events or JS;
  report unsupported behavior under the no-debugger policy rather than silently
  changing it.
