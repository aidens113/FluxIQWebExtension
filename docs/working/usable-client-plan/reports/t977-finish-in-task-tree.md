# t977 report: finish runs in the task tree

## Outcome
Done.

## What changed and why
Core `scripts/task/finish.mjs`:
- The "branch checked out elsewhere" refusal is gone. `workRoot = task.checkedOutIn ?? repositoryRoot`; the integration merge, contract tests and `pnpm check` run in `workRoot`.
- With a task worktree the main checkout is touched only for the final `merge --no-ff` (checked out onto dev only if it was elsewhere), then the worktree is detached.
- With no worktree: same as before, but any gate failure aborts a conflicted merge (best effort) and checks the main checkout back out to dev (or its original branch). Task branch keeps its integration merge.
- Header comment, `validate` error and `contract/gate.mjs` error text updated (no longer say "checkout is left on the task branch").
- Deletion goes through new `scripts/task/delete-merged-branch.mjs`: `merge-base --is-ancestor`, then `branch -D`; a git "no" refuses with a message, other git failures propagate. Local only.

Extension `scripts/task/finish.mjs`: final deletion uses new `scripts/task/delete-merged-branch.mjs` (same logic, imports from `../worktree`). Its gates already ran in `workRoot`.

## Commands run and observed results
- `node --test scripts/task/tests/finish.test.mjs` (Core): pass 9, fail 0.
- `node --test scripts/task/tests/delete-merged-branch.test.mjs scripts/task/tests/finish-core-currency.test.mjs` (extension): pass 8, fail 0.
- `node scripts/structure-audit.mjs` Core: "passed (562 warning(s), 909 baselined)" (first run flagged a swallowed `.catch`; fixed with a reasoned best-effort comment).
- Same in extension: "passed (258 warning(s), 551 baselined)".

Tests added (Core `finish.test.mjs`): worktree-held branch merges with main staying on dev and gates running in the worktree; contract failure with worktree leaves main on dev; contract failure without worktree leaves main on dev (existing test updated from "on task branch"); pushed branch with stale upstream deleted; unmerged branch refused and kept. Extension: new `delete-merged-branch.test.mjs` (stale-upstream delete, unmerged refusal).

## Not verified
- Extension `finishTask` end to end with the new deletion (only the helper is tested directly; the one-line call site is covered by no new test).
- Real Windows worktree behaviour of `checkout --detach` beyond the temp-repo tests; no `pnpm task finish` run on the real repos.
- Core's full test suite and extension's other task tests were not run.

## Open questions
- Core `scripts/task/` is mirrored/imported by the extension only partly; the extension got its own helper copy rather than importing Core's new file.
