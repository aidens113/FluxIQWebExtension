# A declaration naming a site key binds the column the page words (t999)

Lead: Claude Code session, 2026-11-23. Tier: worker-heavy (the t997 worker, continuing).
Trees: `C:/Users/osrs_/FluxStuff/fxwork/t999/!FluxIQ` (Core task branch) and `t999/!FluxIQWebExtension`.
Read: this brief; your t997 report; Core `packages/contracts/src/record-sets/process/binding/bind.ts` and its tests; `cell-text.ts` (`foldedText`).

Gap, found by t997: a renamed column whose page has its own words is stored with the label "Brightaisle Plus" under the model's id `plus`. A declaration naming the site's detected key `brightaisle_plus` binds nothing, because label matching (`bind.ts:24`, `foldedText`) ignores only case and spaces.

Lead's decision:
- Do not label renamed columns with raw keys: for generated columns those are class paths, which would become answer headers.
- Instead, in binding only, also treat `_` and `-` as word separators when a written name is compared with a label. `brightaisle_plus`, `Brightaisle-Plus` and "brightaisle plus" then all name "Brightaisle Plus".
  - Exact id still wins first, a unique match is still required (more than one is `ambiguous`), and excluded fields still refuse.
  - `foldedText` itself must not change, since cell-value comparisons use it. Add a binding-only name key, one export in its own file.

Steps:
1. Implement it in Core contracts, with tests in `binding/tests/`:
   - a snake-case and a kebab-case key bind a worded label;
   - an exact id still beats a label;
   - two labels that collide after normalisation give `ambiguous`;
   - cell comparisons are unchanged (a `contains` over `_` text still needs the `_`).
   Bump `@fluxiq/contracts` patch over dev's (dev is 0.23.1).
2. Downstream: once the lead merges t997 into dev and dev into this tree (the lead will message you), make the read-oracle use declarations as written by default. If the earbuds proof binds without it, remove the `model-aliases.ts` rewrite and its tests rather than keeping dead code, and update the t990/t997 notes in `docs/architecture/recorded-offline-proof.md` if they mention the rewrite.
3. Proof: the earbuds recorded read as written (`earbuds-mwocg0zw-aswritten.json`; inputs preserved in `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t997/`, copied into this tree's ignored `test-runs/`). Expected: ready, 11/13, with the 2 missing on unread pages and 0 calls. Rebuild the Core libraries in this tree first. Do not use `FLUXIQ_LAB_ALLOW_BEHIND_CORE`, because this tree's Core is current.

Checks, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <cmd>`, one at a time:
- contracts vitest on `src/record-sets/process` with `--maxWorkers=1 --minWorkers=1 --fileParallelism=false`;
- `pnpm --filter @fluxiq/contracts check` and `pnpm --filter fluxiq check`;
- the read-oracle tests;
- `pnpm --filter @fluxiq-web-extension/test-runner check`;
- both structure audits.
No full suites, no git mutations, no `node -e`, no provider or paid calls. Low free memory is not a reason to wait.

Owned:
- Core `packages/contracts/src/record-sets/process/binding/**` and `packages/contracts/package.json`;
- downstream `packages/test-runner/src/recorded-attempt-replay/read-oracle/**` and `docs/architecture/recorded-offline-proof.md`;
- your brief and report.

Must not touch: `packages/fluxiq/**` (t994), domain, other worktrees, the shared `fxwork/!FluxIQ`, `docs/working/data-first-simplification-plan.md` and `docs/working/README.md`.

Report: `reports/t999-bind-word-separators.md`. End with the return contract.
