# Brief t1090: recovery-matrix case 14 with a signed search effect

**Goal.** Provider-free proof (b) of t1083's K1.

Recovery-matrix case 14 drives a search into the site's bot check, which lets the visitor on after a few seconds.
Its authored search step carries no recorded effect, so the effect check never ran on it. In live kestrel run
`run-mwz2jc4w`, the same search did carry a signed effect, and the replay stopped `core.step.effect_not_seen` on the
check page.

Add a variant of case 14 whose search step carries a signed effect, as the answer-first draft writes it, under
`browser-check-first`.
- **On code before t1083,** it stops `effect_not_seen` at the search.
- **With t1083** (now on dev), it reads the check page `unknown`, retries the next step until the check lets the
  visitor on, and reaches the shop with no model call.

**Read first.**
- `docs/working/page-diff-delivery-plan/reports/run-mwz2jc4w-kestrel.md`, section "K1".
- `docs/working/page-diff-delivery-plan/reports/t1083.md`.
- The recovery matrix and case 14 under `packages/test-runner/`. Start from `hood-seller-shop.ts` and grep for
  `browser-check-first`.
- `domain/src/runtime/route-state/effect/sign.ts`, for the effect shape. It now signs `from`.

**Owned.**
- The recovery-matrix files under `packages/test-runner/**` that case 14 lives in, and their tests.
- Do not touch the scripted-model scripts (`scripted-model/scripts/**`).

**Must not touch.** Core, and `domain/src/**`.

**Checks** (in `C:/Users/osrs_/FluxStuff/fxwork/t1090-recovery-matrix-signed-search`; put heavy commands through
`node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1090-<label> -- <cmd>`):
- the recovery-matrix tests for case 14 and the new variant;
- `node scripts/structure-audit.mjs`. Group by shared prefix; no one-file groups.

Report the variant's path, calls and failure codes. If the matrix runs a browser, it must be one of the ten realistic
scenarios' sites (AGENTS.md). Say which one it is.

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1090.md` in the worktree, ending with the return contract.
