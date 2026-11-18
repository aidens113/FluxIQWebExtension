# t933 finish-t885: port of t885's fixes onto dev (sub-supervisor verified)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t933-finish-t885`, branch `task/t933-finish-t885`, base dev `8a9888c4d`. Uncommitted.

## Item 2, `9e49d0db4` interruption provenance: done, ready to commit

- The worker added the tests and docs. It never got a slot, so I applied the source myself. Dev's `own-layers/{act,memory,opened-by}.ts` and
  `node-run/run.ts` were byte-identical (CR stripped) to the original's pre-image, so the original's post-image applies exactly.
- The changed lines match the original commit's source, test and architecture-doc lines exactly: 142 added or removed lines, sorted diff empty.
  The original's report files under `docs/working/` are left out.
- Files: `domain/src/runtime/llm-evidence/node-run/own-layers/{act,memory,opened-by}.ts`, `node-run/run.ts`,
  `own-layers/tests/{memory,opened-by}.test.ts`, new `own-layers/tests/card-after-answer.test.ts`, `docs/architecture/build-loop.md`.
- Validation, one heavy slot (`t933-port`), `DOMAIN_TEST_BUILD_LABEL=t933`, from `domain/`:
  - Red, with the tests in place and the source still dev's: `node scripts/test-domain.mjs src/runtime/llm-evidence/node-run/own-layers`
    -> 28 tests, 23 pass, 5 fail, exit 1. This matches the original's recorded red, 23/5.
  - Green, after the source: `node scripts/test-domain.mjs src/runtime/llm-evidence/node-run` -> 584 tests, 584 pass, exit 0.
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check` -> exit 0. A fresh build: the cache said "no stamp", 43 s. Core build current.
  - `node scripts/structure-audit.mjs` (tree root) -> "passed (252 warning(s), 551 baselined)", exit 0; no warning names a changed file.
- Proposed commit: "Port of 9e49d0db4 from t885: preserve interruption provenance when another layer appears after its answer".
  Body: an act that answered an interruption owns no fresh layer, so replay never makes cleanup after that answer a required step.
  Trailers: `Task: t933`, `Worker: t933-port`.

## Item 1, `b5278e377` group samples: dropped from t933, lands with t905

- Its 6-line change to `first-item/walk.ts` edits the group walk (`groupOf`, `groupCompound`, `elementsIn`). The unvalidated t885 WIP
  `8af850680` introduced that walk (about 200 lines in `structure/`), and it is not on dev. A grep finds none of those names on dev.
- `walk.ts` is identical on `task/t885-live-checks-r3` and `task/t905-result-ledger` (git diff empty), so t905 already carries the group
  walk together with this fix. They reach dev with t905, which validates them there. No separate port is needed.

## Not verified

Browser behaviour (the original was never browser-verified either). Extension package check (only domain files changed).
