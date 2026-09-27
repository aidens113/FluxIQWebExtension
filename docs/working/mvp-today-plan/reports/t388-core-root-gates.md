# t388 — Core repository-root closure gates

## Verdict

**NO-GO.** The Core root build and all three changed-production-source freshness and downstream
junction identity checks passed, but the root check, root test, and authored docs check failed.
This tree is not ready to commit, finish, or push as the provider-free closure unit.

No source or shared working document was edited. No provider, live, panel, browser, Lab, commit,
push, or downstream build/test command ran. Downstream t385 remained held throughout; the only
downstream reads were junction metadata and hashes, followed by this assigned report write.

## Script inspection and required serial gates

Before running a gate, I inspected root `package.json`. The applicable scripts are exactly:

- `check`: `pnpm structure:test && pnpm task:test && node scripts/structure-audit.mjs && pnpm -r check`
- `test`: `pnpm -r test`
- `build`: contracts, `fluxiq`, websocket gateway, then web builds in that order
- `docs:check`: docs-link structure audit followed by the reference freshness check

Commands ran from `F:\!FluxIQ` in the required order on 2026-09-26 Pacific time:

1. `pnpm check` — **FAIL**, exit 1. Structure tests and task tests passed, then the structure audit
   stopped the chain before `pnpm -r check`. The one failing violation was
   `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/`: 26 source files exceeds the
   25-file `directory-files` limit. The audit also reported that one baseline entry can be lowered.
   It emitted 188 advisory warnings: 6 `class-methods`, 27 `directory-files`, 45
   `exported-values`, and 110 `file-lines`. These warnings are not represented as failures, but are
   not omitted from this result.
2. `pnpm test` — **FAIL**, exit 1. Contracts passed 9 files / 53 tests; websocket passed 1 file / 3
   tests. FluxIQ finished with 3 failed files, 411 passed files (414 total), 3 failed tests, 4,032
   passed tests, and 1 intentional skip (4,036 total). Every failure was a 15,000 ms timeout:
   - `runtime/tests/service-adaptation/tests/llm-grants.test.ts`: diagnosis-only execution grant;
   - `runtime/tests/service-flows/tests/canonical-persistence.test.ts`: explicit per-run global-to-
     domain Call Flow grant; and
   - `runtime/tests/service-flows/tests/scale-pages.test.ts`: paged Flow expansion summaries.
3. `pnpm build` — **PASS**, exit 0. Contracts, FluxIQ, websocket gateway, and web built. Next
   compiled, type-checked, generated 16/16 static pages, and finalized successfully. It warned that
   the filesystem benchmark took 536 ms and suggested local-disk/antivirus review if applicable.
4. `pnpm docs:check` — **FAIL**, exit 1. The docs-link audit passed with 0 warnings and 0 baselined
   findings. The reference check then reported `docs/reference/framework-reference.md` stale and
   directed running `pnpm docs:reference` and committing its generated result. I did not regenerate
   it because source/shared-document edits were forbidden by this brief.

Because the root check output is large, I reran its two pre-audit constituents after the required
sequence to record exact counts: `pnpm structure:test` passed 182/182 with no skips; `pnpm
task:test` passed 20/20 with no skips. I also reran `node scripts/structure-audit.mjs` read-only to
count the 188 warnings by rule; it reproduced the same single failure and exit 1. These supporting
runs do not replace the failed root command.

After build, docs, and freshness checks were complete, I reran each root-suite timeout alone with
its exact test-name filter. All three passed serially, so the observed root failures are consistent
with full-suite load/timeout pressure rather than a deterministic assertion failure; the required
root `pnpm test` result remains red:

- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/service-adaptation/tests/llm-grants.test.ts -t "binds and revokes a diagnosis-only execution grant without persisting session identity"`
  / `binds and revokes a diagnosis-only execution grant without persisting
  session identity`: **PASS**, 1 passed / 4 skipped in the file, test 2,602 ms, command 7.22 s.
- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/service-flows/tests/canonical-persistence.test.ts -t "requires an explicit per-run grant for global-to-domain Call Flow execution"`
  / `requires an explicit per-run grant for global-to-domain Call
  Flow execution`: **PASS**, 1 passed / 8 skipped, test 2,487 ms, command 6.97 s.
- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/service-flows/tests/scale-pages.test.ts -t "persists Flow expansion summaries with paged run and adaptation detail reads"`
  / `persists Flow expansion summaries with paged run and adaptation detail
  reads`: **PASS**, 1 passed / 2 skipped, test 2,844 ms, command 7.32 s.

## Post-build freshness and junction identity

After the successful root build, each built JavaScript output was newer than its changed
production TypeScript source. `F:\!FluxIQWebExtension\domain\node_modules\fluxiq` is a junction
targeting exactly `F:\!FluxIQ\packages\fluxiq\`. Hashing each built file through the Core path and
through that downstream junction produced the same SHA-256 (3/3 byte-identical):

| Seam | Source UTC | Built UTC | SHA-256 | Result |
| --- | --- | --- | --- | --- |
| projection bound, `flow-bootstrap/evidence-loop-steps` | `2026-09-27T06:07:34.1907572Z` | `2026-09-27T06:30:45.0261498Z` | `DC796ABE9DE0F780E964F6E80700D7628E92B9EA8647F325DBEE8327C4691131` | fresh; junction identical |
| draft packing, `flow-draft/entry` | `2026-09-27T06:15:49.6365039Z` | `2026-09-27T06:30:44.9388446Z` | `B8948F72BD2A804DE2930D85356E7B997393ECB3AB1FFA85C0AFA7CBB273B743` | fresh; junction identical |
| packed measurement, `llm/evidence-loop/draft-shown` | `2026-09-27T06:12:43.2602761Z` | `2026-09-27T06:30:46.4759611Z` | `29A46A8F1947F906A2680D90548400BE74CB91B4D833C065864FF0BD31CF3153` | fresh; junction identical |

The hashes are unchanged from t379, while the build timestamps are from this root build. Thus the
root build reproduced the previously validated production bytes and the held downstream checkout
currently resolves those exact bytes.

## Closure blockers

Core root closure requires all of the following before GO: remove or structurally resolve the new
26-file directory violation and rerun the complete root check; reconcile the three timed-out tests
and obtain a green full root test; regenerate/review the authored framework reference and obtain a
green docs check; then rerun any gate affected by those edits. The green build and 3/3 freshness/
identity proof do not override these failures.
