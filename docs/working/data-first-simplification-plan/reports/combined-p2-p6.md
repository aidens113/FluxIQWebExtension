# Combined P2 + P6 acceptance (t984 with t987 merged)

Worker: Claude Code worker-heavy, brief `briefs/combined-p2-p6-acceptance.md`, 2026-11-23.
Trees: Core `fxwork/t984/!FluxIQ` at `a479033f4` (merge of dev onto the t987 merge `f1ee81995`, fluxiq 0.52.2); downstream `fxwork/t984/!FluxIQWebExtension` at `d7d140fdf`. Both trees were clean before and after the run. The only untracked file is the brief, plus this report.

## Outcome

Done. Every owner group, both Core package checks, the library rebuild, the downstream domain check, the domain judge-evidence owners and both structure audits pass on the combined tree. No source, test or fixture needed a change, so no assertion or oracle was touched. The source-receipt contract was not touched.

## What changed and why

Nothing in either tree. The merge cleared every earlier failure: the 16 Core audit violations in P6 files are gone, and the 36 P6 composition failures (missing P2 task-processing declarations) now pass with t984's fixtures.

## How the groups were run

- Every command ran through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- <command>`, one at a time.
- Vitest commands ran from `!FluxIQ/packages/fluxiq` as `node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --fileParallelism=false <named files>`.
- Logs are in Core's ignored `node_modules/.cache/t984-combined/<label>.log`.
- Each file list was copied exactly from the passing logs named in the lane reports. P2 lists came from `node_modules/.cache/t984-acceptance/compatibility-resume.log` (37 files) and `resume-combined.log` (24 files). P6 lists came from `.heavy-slots/t987-resume-{authority,semantic,checkpoint,composition,requests}.log`.
- For the P6 groups the t987 report defines by directory (semantic, checkpoint, request/window), I expanded the report's definitions against the merged tree. `diff` showed they name exactly the same files as the logs: 25, 14 and 46.

## Commands run and observed results

```text
# 1. Core structure audit (Core root)
t984c-core-structure  node scripts/structure-audit.mjs
  -> exit 0, "structure-audit: passed (569 warning(s), 903 baselined)." 0 violations.

# 2. P2 (Core packages/fluxiq)
t984c-p2-compat    the 37-file compatibility set
  -> exit 0, Test Files 37 passed (37), Tests 195 passed (195)
t984c-p2-combined  the 24-file combined owner command
  -> exit 0, Test Files 24 passed (24), Tests 192 passed (192)

# 3. P6 (Core packages/fluxiq)
t984c-p6-authority    7 files (judge-checkpoint, trail/held, witnesses, judge-window, replacement, judge-evidence summary, recovery-checkpoint)
  -> exit 0, 7 passed, 77/77
t984c-p6-semantic     judge-evidence/tests, run-trail/tests, result-evidence/tests, verdict/tests, harness-options/tests/binding, node-tools/replay/tests, evidence-loop/tests/{tool-result-metadata,authored-draft} (25 files)
  -> exit 0, 25 passed, 255/255
t984c-p6-checkpoint   answer-first/{attempt-store,trail,witnesses}/tests, runtime/answer-first/act-record/gate/tests (14 files)
  -> exit 0, 14 passed, 112/112
t984c-p6-composition  20 files: attempt {call-chain,looked,keep,carried-before,flow-stage-person-stop}, completion looked-evidence,
                      flow-run {trail,flow-run,source-authority}, answer-first {carry-on,later-attempt,saved-read-restart},
                      endings {judge,saved-on-every-ending,saved-shapes}, node-tools {replay-draft-loop,replay-span-step-log},
                      build-judge, project-build {judged-trial,single-subflow}
  -> exit 0, 20 passed, 196/196   (was 160/196 on t987 alone)
t984c-p6-requests     flow-less/tests, build-test/tests, result-verification/tests/{result-summary,verify,run-outcome,judge-sees-each-step,judge-sees-each-row,judge-sees-the-end} (46 files)
  -> exit 0, 46 passed, 420/420

# 4. Core package checks (Core root)
t984c-contracts     pnpm --filter @fluxiq/contracts check
  -> exit 0. The build cache reused its stamp: "inputs and outputs match the stamp".
t984c-fluxiq-types  pnpm --filter fluxiq check
  -> exit 0. Full compile: "inputs changed: packages/fluxiq", 84,524 ms.

# 5. Libraries and downstream
t984c-libraries     node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build   (Core root)
  -> exit 0. All five were built rather than restored: contracts 18.2 s, sdk 7.4 s, fluxiq 145.0 s, client-gateway-websocket 9.7 s, ui-components 22.8 s.
t984c-domain-types  pnpm --filter @fluxiq-web-extension/domain check   (downstream root)
  -> exit 0. "core-build: FluxIQ Core's build at ...\t984\!FluxIQ is current with its source"; domain:check built with no stamp, 37,413 ms (src and test tsconfigs).
t984c-domain-judge  DOMAIN_TEST_BUILD_LABEL=t984-combined node scripts/test-domain.mjs runtime/llm-evidence/judge-evidence/tests runtime/llm-evidence/result-observation/tests runtime/llm-evidence/page-view runtime/llm-evidence/observed-state/tests   (downstream domain/)
  -> exit 0, tests 125, pass 125, fail 0. Output went to domain/.test-build-scratch/t984-combined.
t984c-down-structure  node scripts/structure-audit.mjs   (downstream root)
  -> exit 0, "structure-audit: passed (258 warning(s), 551 baselined)."
```

The downstream `domain/node_modules/fluxiq` links to `fxwork/t984/!FluxIQ/packages/fluxiq`, so the downstream checks ran against this combined Core.

## Not verified

- The contracts typecheck was not recompiled. The build cache reused a stamp it reports as matching the current inputs and outputs. Contracts source is unchanged since that stamp was written; the library rebuild compiled contracts afresh and exited 0.
- `pnpm --filter @fluxiq-web-extension/extension check` and downstream `node-run` tests were not run, because the brief did not name them. t987 had already listed both as unverified.
- No full suite, browser, provider-backed or paid run, and no four-attempt live acceptance, per the brief.
- `git diff --check` was not needed: no file changed.

## Open questions or contradictions found

- None new. The open items in the t984 resume section still stand for the lead. These are the judge "cannot be done" oracle update, the P4 `task-model/resolve.ts` and `fluxnode/pin/pins.ts` fixes made in the P2 lane, and whether a saved Flow should carry its own data declaration.
- `C:/Users/osrs_/AppData/Local/Temp/.../scratchpad/p6-files.txt`, a 107-line list of P6 source paths, was already in my session scratchpad when I started. I did not write it and did not use it.
