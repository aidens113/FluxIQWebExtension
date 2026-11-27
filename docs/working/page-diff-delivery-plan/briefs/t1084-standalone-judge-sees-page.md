# Brief t1084: a judge asked on its own request sees the pages the result rests on

**Goal.** A replay calls no decider, so its judge is asked on its own request. That judge gets the semantic trail
with `captureOmitted` and no page text. In bigbox run-mwz29d50, attempt 3's judge never saw "4.5 out of 5 Stars"
or the pickup "Today" line, answered `unknown`, and the attempt repaired a Flow that had worked. Until this is
fixed, every replay of a task whose conditions are checked by looking at a page will repair.

The user's rule (2026-11-19): the judge sees the run's whole trail plus the final data.

**Read first.** These are your context:
- `docs/working/page-diff-delivery-plan/reports/run-mwz29d50-bigbox.md`, sections "2. What stopped attempt 3" and
  "F2";
- Core `packages/fluxiq/src/runtime/result-verification/judge-evidence/page-views.ts` and `summary.ts` (`:120-160`);
- `unreadable-asks/note.ts`;
- whichever of `verify.ts` and `flow-less/judge.ts` builds a judge request that does not continue a decider.

**Decision (lead's).** Every judge that does not continue a decider's conversation gets page views:
- whatever the run did, not only where `stateRequired` holds;
- not only on an unreadable re-ask.

The order, shared within `AUTOMATION_STUDIO_LLM_PAGE_BUDGET_CHARS` with whole lines only, saying `linesNotShown` as
`page-views.ts` already does:
1. the end view;
2. the before view, where a lasting act ran;
3. the page each lasting act was pressed on (this attempt's acts, then carried acts, newest first), where Core holds
   that page;
4. the pages the attempt's steps landed on, newest first;
5. drop duplicate texts.

**Constraints.**
- A judge that continues the decider is unchanged.
- The deciding digest is unchanged. Views stay beside the summary, never in it (t1036).
- Screening (`deniedEvidenceKeys`) applies to every page sent.
- If carried acts' pages are not held anywhere Core can reach, say so in your report, and do not invent storage for
  them in this task.
- Core never reads a line's text.

**Owned.** Core (`fxwork/t1084-standalone-judge-sees-page/!FluxIQ`): `packages/fluxiq/src/runtime/result-verification/**`
and their tests.

**Must not touch.**
- `engine/automation/state-routing/**` and `domain/src/**` (t1083).
- `task-memory/better-flow.ts` and `flow-authoring/draft/amendment/**` (t1085).
- `packages/test-runner/**`.

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1084-<label> -- <cmd>`.
- A deterministic test, with no model call: rebuild a standalone judge request for a replay whose trail visited a
  product page and ended on a cart. Assert that the product page's rating and pickup lines are in it, within the
  page budget. Do this from this run's records if you can reach them (F2's "Offline proof"); otherwise use a
  fixture of the same shape.
- The tests beside the changed files: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <dirs>` from
  `packages/fluxiq`, plus the unreadable-asks and judge-evidence tests.
- `node scripts/structure-audit.mjs` (Core) and `node scripts/check/model-text.mjs` (downstream).
- Update the Core architecture document that describes judge evidence.

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1084.md` in the downstream worktree, ending with the
return contract.
