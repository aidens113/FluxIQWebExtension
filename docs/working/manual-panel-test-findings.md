# Manual Panel Test Findings

Status: Active
Status detail: User-facing inbox for manual FluxIQ panel and extension testing; PANEL-001 is fixed by launch configuration and awaiting user retest.
Created: 2026-09-20
Last updated: 2026-09-20
Owner: User for submission; senior supervisor agent for triage and closure
Scope: Capture manual panel, extension, recording, Flow creation, execution, repair, reuse, and performance findings so isolated workers can reproduce and fix them.
Paired document: none
Related: [Concurrent live-testing plan](./mvp-week2-automation-loop-plan/reports/w2-concurrent-live-testing-plan.md), [Week 2 automation-loop plan](./mvp-week2-automation-loop-plan.md)

---

## Current State

This is the durable inbox for anything the user notices while manually testing
the FluxIQ web panel or extension. The user may add a polished finding using
the template below or simply paste rough notes into **Quick Drop**. The senior
supervisor converts rough notes into numbered findings, assigns isolated
workers, verifies fixes live, and keeps the status current.

**Done:** the intake format, triage states, worker handoff, and retest loop are
defined and linked to the concurrent live-testing campaign. PANEL-001 traced a
login HTTP 500 to a missing importer-root launch setting; the panel was
restarted with the t027 downstream checkout as owner.

**Next:** the user retests PANEL-001, then records further observations without
including secrets or private recorded-page content.

**Blockers:** none.

---

## Quick Drop

Paste unstructured observations below this line if filling out the complete
template would interrupt testing. Include approximately what you clicked,
what you expected, what happened, and when. The supervisor will structure it.

<!-- Add quick notes here. Do not include passwords, tokens, cookies, or private page data. -->

---

## Findings Queue

Use one heading per issue: `### PANEL-### — short title`. Copy the template for
new findings. It is fine to leave unknown fields blank.

### PANEL-001 — Login returned HTTP 500 when panel lacked importer root

- Status: Ready for retest
- Reported: 2026-09-20, America/Los_Angeles
- Build or branch shown in panel: paired t027 candidate
- Browser and version: user browser, version not reported
- Panel URL or test instance: `http://127.0.0.1:3000`
- Starting state: sign-in screen
- What I did: entered the bootstrap login and submitted Sign in
- Expected: authenticate or show an ordinary credential response
- Actual: browser reported a resource HTTP 500
- Frequency: every attempt before restart
- Visible error text or code: HTTP 500
- Severity: blocking
- Assigned worker: supervisor (launch configuration)
- Worker report: server trace showed `resolveFluxIQWebHostRoot` refused the
  framework checkout because no importing repository root was configured
- Supervisor verification: panel restarted with
  `FLUXIQ_IMPORTER_ROOT=F:\fxwork\t027\!FluxIQWebExtension`; user retest pending
- Retest requested: yes

### Finding template

- Status: Submitted
- Reported: YYYY-MM-DD HH:MM and timezone
- Build or branch shown in panel: unknown
- Browser and version: unknown
- Panel URL or test instance: unknown
- Starting state: new project / existing project / recording / saved Flow
- Instruction or goal: describe without secrets or sensitive page data
- What I did: numbered UI steps
- Expected: what should have happened
- Actual: what happened instead
- Frequency: once / intermittent / every time
- Performance: approximately how long it waited and at which visible stage
- Visible error text or code: exact non-sensitive text if available
- Run ID: if the UI shows one
- Attachment paths: screenshots/video saved locally; do not paste secrets
- Severity: blocking / major / minor / cosmetic / unsure
- Notes: anything else that might help reproduce it
- Assigned worker: unassigned
- Worker report: pending
- Supervisor verification: pending
- Retest requested: no

---

## Status Meanings

- **Submitted:** captured but not yet reproduced or classified.
- **Triaged:** scope, severity, and reproduction lane are understood.
- **Assigned:** an isolated worker brief and report path exist.
- **In progress:** reproduction or repair is active.
- **Ready for retest:** supervisor verified the fix; user confirmation is useful.
- **Verified:** the user or supervisor reproduced the expected behavior.
- **Closed:** merged to `dev`, pushed when eligible, and no follow-up remains.
- **Unable to reproduce:** evidence and attempted environment are recorded;
  the finding remains searchable and can be reopened.

## Triage and Worker Handoff

The supervisor assigns one worker per independent finding or tightly related
cluster. Each worker receives the exact finding ID, frozen source provenance,
an isolated worktree/browser/profile/store/ports/run directory, a narrow live
reproduction, owned files, and a unique report path. Workers never rewrite
this inbox; the supervisor updates it after reviewing their reports and raw
evidence.

Reproduction is live first. Once a fix works through the affected panel or
extension path, narrow automated checks run. A coherent, independently useful
fix can merge promptly to `dev`; it does not wait for unrelated findings. The
entry then records the merge and asks the user to retest when human judgment
or the original environment matters.

Provider/facility noise and product defects are kept distinct. An empty
provider response or launch failure may receive one identical retry. Wrong
behavior, permission stops, bad UI state, slow stages, failed actions, and
incorrect Flows are findings, not reasons to retry until green.

## Manual Test Suggestions

These are prompts, not a required script. Test naturally and record whatever
feels confusing, incorrect, unsafe, or slow.

- Type a plain instruction and watch exploration, progress, Flow review,
  approval, execution, and the final result.
- Record a browser task and check whether the resulting Flow is understandable
  and runs correctly.
- Decline an action, grant a permission, or stop midway; confirm nothing later
  executes unexpectedly.
- Change a page or target after saving a Flow, then observe diagnosis, repair,
  approval, and rerun.
- Reload the panel or browser and run a saved Flow again; note whether reuse is
  deterministic and whether the model is unnecessarily called.
- Record where time is spent: startup, "thinking", browser action, saving,
  verification, repair, or final UI refresh.

## Work Ledger

### 2026-09-20 — Manual findings inbox created

- Agent: supervisor
- Changed: created this intake and linked it to concurrent live testing.
- Why: the user needs a direct path from hands-on panel findings to isolated
  worker reproduction, repair, supervisor verification, and retest.
- Validation: not applicable; documentation-only planning change.
- Outcome: Accepted
- Follow-up: add the first manual observation under Quick Drop or Findings Queue.

## Open Questions

- None. The user may use Quick Drop without completing the template.
