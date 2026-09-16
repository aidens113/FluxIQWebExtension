# x1-6-e2e-typecheck: the scenario-lab e2e specs are type-checked by `pnpm check`

## Outcome

**Done.**

- The scenario-lab `check` script now type-checks `apps/scenario-lab/e2e` with DOM types. Root `pnpm check` runs every package's `check` through `pnpm -r check`, so a type error in any e2e file now fails the root check too.
- The two existing errors at `member-directory.spec.ts:27-28` are fixed. The fix changes types only; the test does exactly what it did before.
- No other e2e type errors appeared.

The structure audit exits 1, but its only failure is not in this brief's files: `docs/working/README.md` is out of date with the working documents' headers. It is the same failure `x01-test-runner` reported. That index is a shared document, so I did not regenerate it.

## What changed and why

- **`apps/scenario-lab/tsconfig.e2e.json` (new).** It follows the pattern of the extension's `tsconfig.test.json`, which extends the package config with `noEmit` and adds `e2e/**/*.ts`. Three settings differ from scenario-lab's own `tsconfig.json`:
  - `lib` is `["ES2022", "DOM", "DOM.Iterable"]`. The package config sets `lib: ["ES2022"]`, and the specs use `document`, `window` and `HTMLElement` inside `page.evaluate`. The extension gets DOM from `tsconfig.base.json`; scenario-lab overrides it away.
  - `rootDir` is `"."` rather than `"src"`, because the specs import from `../src/...`.
  - `include` is `e2e/**/*.ts` only. Source files the specs import are still checked, since tsc follows imports. `src` itself stays checked without DOM by the existing `tsconfig.json`, so DOM globals cannot hide a Node-side mistake there.
  - It keeps `noEmit`, `types: ["node"]`, and the `paths` mapping of `@fluxiq-web-extension/test-contracts` to `packages/test-contracts/dist/index.d.ts`.
- **`apps/scenario-lab/package.json`, the `check` script only.** It was `tsc -p tsconfig.json --noEmit` and is now `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.e2e.json`.
- **`apps/scenario-lab/e2e/member-directory.spec.ts:22-23`.** `promoted` and `untouched` each gain `satisfies Partial<MemberDirectoryState>`.
  - **Cause of the errors.** Both were plain object consts, so TypeScript widened `mode: "baseline"` to `string` and the role `"Admin"` to `string`. Neither then fit `Run.state: Partial<MemberDirectoryState>`. Line 27 failed on `mode`; line 28 overrode `mode` with a literal but still failed on `roles`.
  - **Why the behavior is unchanged.** `satisfies` gives the literals their contextual types without changing the values or the inferred object shape. Every `run.state` passed to `toMatchObject` is the same object as before.
  - `untouched` produced no error, because every place it is spread sets `mode`. It gets the same annotation so the two fixtures cannot drift apart. That is a type-only change on an owned line.

## Commands run and observed results

Every command ran alone.

1. **`git status --short -- apps/scenario-lab`, before any edit.** It printed only the new, untracked `apps/scenario-lab/tsconfig.e2e.json`. Nothing else in the package had uncommitted changes. `packages/test-contracts/dist/index.d.ts` exists.
2. **The new config, before the spec fix.** `npx tsc -p tsconfig.e2e.json` (run in `apps/scenario-lab`) printed exactly two errors and `TSC_EXIT=2`:
   - `e2e/member-directory.spec.ts(27,5): error TS2322 ... Types of property 'mode' are incompatible. Type 'string' is not assignable to type '"baseline" | "restyled" | "member-left" | "support-drawer" | "sorted-by-activity"'.`
   - `e2e/member-directory.spec.ts(28,28): error TS2322 ... Types of property 'roles' are incompatible ... Type 'string' is not assignable to type '"Owner" | "Admin" | "Member" | "Billing admin" | "Read only"'.`

   No other e2e file produced an error.
3. **`pnpm --filter @fluxiq-web-extension/scenario-lab check`, after the fix.** It echoed `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.e2e.json`, printed no errors, and ended with `PNPM_EXIT=0`.
4. **The check against a deliberate error.**
   - I copied `e2e/member-directory.spec.ts` to `e2e/x1-6-typecheck-scratch.spec.ts` and appended `export const x16DeliberateTypeError: MemberDirectoryState["mode"] = "not-a-mode";`.
   - The same command printed `e2e/x1-6-typecheck-scratch.spec.ts(322,14): error TS2322: Type '"not-a-mode"' is not assignable to type '"baseline" | ... | "sorted-by-activity"'.`, then `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL ... Exit status 2`, and `PNPM_EXIT=2`.
   - That was the only error. The scratch copy did not repeat the original errors, because it already contained the fixed lines.
5. **Cleanup.** `rm` removed the scratch file. `git status --short -- apps/scenario-lab` then printed exactly `M e2e/member-directory.spec.ts`, `M package.json`, and `?? tsconfig.e2e.json`.
6. **Structure audit.** `node scripts/structure-audit.mjs` ran after the scratch file was deleted and exited 1. Filtered output:
   - `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.`
   - `structure-audit: 1 violation(s) across 1 rule(s).`
   - `warn [directory-files] apps/scenario-lab/e2e/: 18 source files is past the 15-file advisory threshold.` This is only an advisory, and it was already true: `e2e/` held 18 `.ts` files before this work, and I added none there.
   - No violation names a file I changed.
7. **Final rerun.** `pnpm --filter @fluxiq-web-extension/scenario-lab check` on the final tree printed no errors and `PNPM_EXIT=0`.

## Not verified

- **Full gates.** I did not run root `pnpm check`, `pnpm test` or `pnpm build`, because other workers are mid-edit and the machine's RAM is faulty. The claim that root `pnpm check` now fails on an e2e type error rests on the root script's `pnpm -r check` running this package's `check`. I read that script; I did not run it.
- **No browser.** No Playwright, browser or Lab run, per the brief. The spec change is type-only, and I did not execute it.
- **Test-contracts build freshness.** The check reads test-contracts through the `paths` mapping to its existing `dist`. I did not rebuild test-contracts. The new e2e check needs `dist` in the same way the existing `tsconfig.json` check already did.
- **No CI.** I did not observe the check failing in CI, only locally.

## Open questions or contradictions found

1. **`docs/working/README.md` is stale.** The structure audit's only failure is this index. The supervisor clears it with `pnpm structure:baseline` once the working-document edits settle.
2. **Documentation.** `docs/architecture/repository-layout.md` may describe what each package's `check` covers. If it does, it should say that scenario-lab's `check` now includes the e2e specs. I did not open it, because it is outside this brief.
3. **Advisory.** `apps/scenario-lab/e2e/` is at 18 source files against a 15-file advisory. That is not a failure, and it predates this work.
