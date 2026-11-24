# t1023 run.ts split

## Outcome
Done. `node-run/run.ts` is 800 lines (was 805); structure audit passes.

## What changed and why
run.ts grew because t1022 (list-page guard, 5 lines inline) and t1023 (standing-choices wiring, 5 lines) each added inline logic. Moved each into the directory that owns it, one exported thing per file, re-exported from the barrel:
- `list-pages/answer-guard.ts`: `webNodeListReadGuard(run, input)` does the whole post-answer check: refuse a read whose list is not on the page it read (raising the refusal with the page, or the start location from nowhere), then record the list a Next page moved. Named `answer-guard` because `read-guard` tripped the naming rule (3 files sharing the `read-` prefix).
- `standing-choices/found.ts`: `webStandingChoicesFound`, the options standing chosen as a changing call found the page.
- `standing-choices/stated.ts`: `webStandingChoicesStated`, the draft statement's `chosen`.
- Barrels (`list-pages/index.ts`, `standing-choices/index.ts`) updated; headers kept and explain why each exists. run.ts calls all three. Behaviour is unchanged (same order of checks, same arguments).
- Two call-site comments in run.ts were moved to trailing position on their call line (file's existing style), not deleted.

## Commands run and observed results
- `node scripts/structure-audit.mjs` (tree root) -> "structure-audit: passed (260 warning(s), 551 baselined)." run.ts: `wc -l` 800.
- `DOMAIN_TEST_BUILD_LABEL=t1023split node scripts/test-domain.mjs runtime/llm-evidence` (domain/) -> tests 1767, pass 1767, fail 0.
- `pnpm --filter @fluxiq-web-extension/domain check` -> "core-build: ... current with its source", build-cache step domain:check ran, no tsc errors printed (my `exit=` echo followed a `tail`, so it is not the pnpm exit code; the absence of errors and the completed step are the evidence).

## Not verified
- Exact pnpm exit code (piped through tail).
- Live browser behaviour (not applicable, no behaviour change).

## Open questions
- run.ts sits at exactly 800, so any growth fails the audit again. The next honest split is the post-dispatch refusal throw (the same page-or-start-location pattern appears twice) and `refusal`/`personDraft`, which belong outside the owned paths.
