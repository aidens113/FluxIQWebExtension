# Brief t1101: the answer-first endings tests failing on dev

**Goal.** On Core `dev` (fluxiq 0.55.0), the real-sql run of
`node ../../scripts/vitest-groups.mjs --groups=real-sql src/framework/automation-service/service/answer-first/tests/endings`
(from `packages/fluxiq`) shows `Tests 21 failed | 64 passed (85)` across 8 files:
- output-not-observed (9);
- person (4);
- steps (2);
- saved-on-every-ending (2);
- refused-completion, rounds-keep-memory, saved-shapes and stalls ("a repeat-without-progress stall changes approach")
  (1 each).

t1100's worker saw that most of them say the script ran out, or that a failed step never reached the model.

These tests pin the user's hard rules: a task ends only with its result, its budget, or a person's Stop; one call that
goes wrong never ends a task; every ending keeps the best attempt. A broken pin here hides real regressions.

**Find the cause.** Use read-only git to find when they began failing. Today's Core merges are the suspects:
- t1091 (result reads);
- t1093 (answer-first default, strict fit, refusal words);
- t1096 (parameters checked before a call is sent, answered repeats through loop detection, visible page first, step
  fields only on steps);
- t1095 (UI and conversations);
- t1100 (refusals not waited on).

Bisect by running the group at those merge commits in a scratch worktree of your own. Use `git worktree add` under
`C:/Users/osrs_/FluxStuff/fxwork/t1101-bisect`, read-only, and remove it with `git worktree remove` when done.

Strong guess: t1096's parameter check refuses undeclared parameters that these tests' scripted calls send, and
answered repeats now steer where these scripts expect another call. Confirm or rule it out with evidence.

**Fix at the cause.**
- **Test fault:** if a test's script sends a call the product now rightly refuses, or pins behaviour a user-approved
  change replaced, update the script to the current contract and keep what the test proves.
- **Product fault:** if the product broke a rule these tests pin, fix the product.

Never weaken an assertion or skip a test.

**Owned.** Core (`C:/Users/osrs_/FluxStuff/fxwork/t1101/!FluxIQ`):
- `framework/automation-service/service/answer-first/tests/endings/**` and their support files;
- any product file the cause is in (name it).

**Must not touch.**
- `runtime/automation-activity/**`, `@fluxiq/ui-components` and `apps/extension/src/panel/**` (t1099). If the cause is
  there, report it.
- The main checkouts.

**Checks.**
- The endings group in both vitest groups passes 85 of 85.
- The answer-first, `runtime/llm` and `runtime/answer-first` groups still pass.
- Core `pnpm check`.
- `node scripts/structure-audit.mjs`. It now refuses one-file test groups.
- The kestrel and bigbox provider-free harnesses still pass 4 of 4, if a product file changed.
- Heavy commands through the heavy slot. No mutating git on the task branch, no live runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1101.md` in the downstream tree, ending with the return
contract: which commit broke each, and whether it was the test or the product.
