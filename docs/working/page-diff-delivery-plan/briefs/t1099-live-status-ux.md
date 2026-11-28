# Brief t1099 (sub-supervisor): clear live statuses, so a person always knows what FluxIQ is doing and why it waits

**The user's words (2026-11-28), after testing on a real site:** "Ok its faster on steps which is good. But You need to
add indication of whats happening more. FOr instance I have no idea as user if a delay is due to humanness, model
thinking, etc. There should be proper easy to understand statuses. Work on that UI & UX text, etc."

**Goal.** At every moment of a build, run or repair, the extension chat and the panel show one plain-words live status
saying what is happening, with time elapsed. When FluxIQ is waiting, it says what it waits for. Examples of the kind
(wording is yours to design, plain and generic):
- "Thinking about the next step… 4s"
- "Pausing like a person would (humanness setting)… 2s"
- "Waiting for the page to finish loading… 3s"
- "Pressing 'Next page'"
- "Reading the list: 24 rows"
- "Checking the result…"
- "Trying again: the page changed before the press"
- "Slowing down: the site asked us to wait… 10s"
- "Waiting for your answer"

The status line updates in place, with no flood of messages. The step entries the chat already posts stay
(AGENTS.md / memory: the chat shows every step with its reasoning).

**Phase 1: audit.** Add a section to `docs/working/ui-unification-plan.md`. For every source of delay, record where it
happens and whether a status event exists today:
- model calls in flight, by role, including the judge;
- humanness or pacing delays;
- page readiness waits (t1094's `waitForTabReady` and the press check);
- retries and backoff, including the rate-limit pace;
- permission questions;
- tab and navigation waits;
- Flow replays.

Then design one status model: a small set of kinds, each with a plain sentence and an elapsed timer. Decide and record;
do not stop to ask.

**Phase 2: build.**
- Statuses flow from where the delay happens to Core's activity stream, then to `@fluxiq/ui-components`, so the panel
  and the extension render the same thing.
- The rendering and the wording are Core's (`runtime/automation-activity/wording/`, `ui-components`).
- The extension's `apps/extension/src/panel/chat` stays a thin adapter (AGENTS.md "Repository Boundaries").
- Use plain words with no internal codes. This is product UI text, not model guidance.
- Add tests for each status kind.

**The screenshot gap.** The provider-free `ui:e2e` journeys (F1-F4) open synthetic scenarios, which the ten-scenario
rule refuses, so nobody could screenshot the UI this week. Move the provider-free journeys onto a realistic scenario.
Then capture screenshots of the statuses in a provider-free build, and look at them yourself.

**Trees.**
- Downstream: `C:/Users/osrs_/FluxStuff/fxwork/t1099/!FluxIQWebExtension`.
- Core: `C:/Users/osrs_/FluxStuff/fxwork/t1099/!FluxIQ`.
- Branch `task/t1099-live-status-ux`.
- The user is testing on the panel running from the main checkouts on ports 3000 and 4777: never touch those.

**Must not touch.** Core and downstream `scripts/structure-audit*` and test-group moves (t1098).

**Budget.** `worker` by default and `worker-heavy` for the event plumbing across repositories, about 6 workers.

**Checks.**
- Narrow per the repository rules: Core `pnpm check`, the tests beside each change, the extension check and tests,
  both structure audits (no one-file test groups), and `node scripts/check/model-text.mjs`.
- Kestrel and bigbox provider-free harnesses still pass 4 of 4.
- Screenshots of each status from a provider-free run on a realistic scenario.
- Heavy commands through the heavy slot. No live or paid runs, no git.

**Report.** `docs/working/ui-unification-plan/reports/t1099.md`, plus the return contract, with the screenshots'
paths.
