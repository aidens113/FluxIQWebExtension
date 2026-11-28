# Brief t1098: the structure audit refuses a one-file test group

**Goal.** The audit caps a directory at 25 source files and tells you to "group them by feature (shared filename
prefix)". Core's convention for a group is `tests/<group>/tests/*.test.ts`.

Today, workers repeatedly dodged the cap with a group of one file, which names no shared feature:
- t1088 made `flow-run/tests/stop-observed/tests/` (the lead regrouped the `steps-ran-*` tests instead);
- t1093 made `project-agents/dispatch/tests/provider-refusal/tests/` and `supervisor/tests/provider-refusal/tests/`
  (the lead regrouped `brief-*` and `provider-*`);
- t1096 made, in Core, `evidence-loop/tests/answered-request/tests/split-page.test.ts` and `tests/answered-repeat/tests/`;
- t1096 made, in the domain, `node-run/tests/pager-press/tests/` and `node-run/tests/unreadable-arrival/tests/`.

The user wants standards enforced by checks that fail the build, not by guidance (lesson "Enforce standards
mechanically").

**The rule.** A test group directory (`…/tests/<name>/tests/`) holding a single test file is a violation. The message
says to group files that share a prefix, or to split by kind, instead.
- Make the change in Core's `scripts/structure-audit.mjs` first (Core owns it).
- Mirror it downstream. `scripts/check/core-mirror.mjs` fails `pnpm check` when the copy drifts.
- Existing one-file groups older than today are baselined in each repository's `.structure-baseline.json`, so they can
  be cleaned later. Name them in the report.

**Fix today's six groups properly.** For each one:
- regroup the folder's files that share a prefix into a real group of two or more, or split it by kind;
- move the single test back into its parent `tests/`;
- fix relative imports (count the levels), and keep every test passing.

Today's groups are the four t1096 ones above, plus any t1093 or t1088 left. The lead fixed the t1088 and t1093 ones;
check them.

**Trees.**
- Core: `C:/Users/osrs_/FluxStuff/fxwork/t1098/!FluxIQ`.
- Downstream: `C:/Users/osrs_/FluxStuff/fxwork/t1098/!FluxIQWebExtension`.
- Branch `task/t1098-no-one-file-test-groups`.

**Owned.**
- Core `scripts/structure-audit.mjs`, `scripts/structure-audit/**`, the tests beside them, `.structure-baseline.json`,
  and the test files you move.
- The downstream mirror copy and its baseline, and the domain test files you move.

**Must not touch.** Product source (only test files move), and the main checkouts.

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1098-<label> -- <cmd>`.
- `node scripts/structure-audit.mjs` in both repositories. It passes, and a planted one-file group fails, shown in the
  audit's own tests.
- `node scripts/check/core-mirror.mjs`.
- The moved tests: Core vitest groups over their directories, and `node scripts/test-domain.mjs <dirs>`.
- Core `pnpm check`.

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1098.md` in the downstream tree, ending with the return
contract.
