# Brief t1092: the carried-row service repair tests failing on dev

**Goal.** `domain/src/runtime/tests/carried-row-service-repair.test.ts` fails 4 tests on `dev` (5 `not ok` lines). The
same failures show on dev before and after t1083, so they are older:
- `actual saved row repair retains fresh listing and per-row mapping before judgement`, which fails
  `actual writer must admit the only faulty-step replacement` (expected true, got false);
- `ordinary repair freshly tests the untouched carried selector through real web dispatch`;
- `actual saved repair refuses a missing declaration before full-test actions`;
- `actual saved repair without a captured start tests the carried Flow where it stands`;
- `actual saved repair refuses an unresolved current binding before mutation`.

Find why, and fix the cause:
- **If the product is wrong** (a repair no longer admits the one replacement it should), fix the product, in Core or
  the domain.
- **If the tests pin behaviour a later user-approved change replaced on purpose,** update them to the current
  contract. Cite the change (task id or commit) and the rule it carried out.

Never weaken an assertion to make it pass. Never skip or delete a test without naming the change that superseded it.

**Start here.**
1. Run the file alone: `node scripts/test-domain.mjs src/runtime/tests/carried-row-service-repair.test.ts`, from
   `domain/`, after building Core.
2. Find when it began failing, using `git log` on the file and on the Core modules it drives (read-only git is
   fine). Recent suspects: t1068 and t1069 (amendment atomicity), t1078, t1085 (amendments checked after drops), and
   t1083 (state routing). Confirm or rule each out with evidence, not by guessing.

**Owned.**
- Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t1092/!FluxIQWebExtension`): `domain/src/**`.
- Core (`C:/Users/osrs_/FluxStuff/fxwork/t1092/!FluxIQ`), only if the cause is there: the module that holds it, and its
  tests. Name each file.

**Must not touch.**
- `framework/automation-service/service/answer-first/result/**` and `answer-first/result-feed/**` (t1091).
- `packages/test-runner/**`.

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1092-<label> -- <cmd>`.
- The file above passes.
- `node scripts/test-domain.mjs src/runtime/tests` passes, or shows only failures you prove are unrelated.
- If Core changed: the tests beside the change, and `pnpm check` in `packages/fluxiq`. Vitest does not type-check.
- `node scripts/structure-audit.mjs` in each repository you changed.

No `node -e`, no mutating git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1092.md` in the downstream tree, ending with the return
contract.
