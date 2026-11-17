# server-client-boundary audit rule (t916)

## Outcome
Done. New rule `server-client-boundary` in Core, mirrored verbatim into EXT.

## What changed and why
Core (`scripts/structure-audit/`):
- `rules/server-client-boundary.mjs`: multi-source BFS from every server entry over static value imports; a reached module calling a client-only API fails with the shortest chain (entry -> ... -> module) and the API names plus line. Fail, never ratcheted.
- `client-boundary/` (directive, server-entries, value-imports, resolve-local, client-api-calls, barrel): one export per file. Type-only imports/exports (declaration or all specifiers) ignored; `"use client"` modules are not walked into and are skipped as entries; `use()`/`cache` not flagged; `useX`, `React.useX`, `createContext` flagged.
- `config.mjs`: `nextApps: [{ name: "Core web app", src: "apps/web/src/" }]`. EXT's own config has no `nextApps`, so the rule is inert there (EXT config untouched).
- `rules/tests/server-client-boundary.test.mjs`: 11 tests (t915 chain fixture incl. chain text, use-client stops walk, type-only ignored, use-client entry skipped, use() safe, createContext/custom hook flagged, entry kinds incl. middleware/instrumentation/"use server", `@/` and `.js` resolution, packages not followed, no config inert).
- `docs/architecture/code-structure.md`: rule bullet added.
EXT: the new rule, client-boundary/ files and test copied verbatim.

## Commands run and observed results
- CORE `node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"` -> tests 328, pass 328, fail 0.
- EXT same command -> tests 328, pass 328, fail 0.
- CORE `node scripts/structure-audit.mjs` -> "passed (550 warning(s), 914 baselined)"; rule reports 0 findings, 64 server entries found under apps/web/src.
- CORE `--rule server-client-boundary` ~5.3s wall vs `--rule file-lines` also several seconds: nearly all of that is startup and repository listing, so the rule's own cost is small (not isolated precisely; full audit ~36s).
- EXT `node scripts/check/core-mirror.mjs` -> "1 mirror set(s) match ... structure-audit (82 files)".
- EXT `node scripts/structure-audit.mjs` -> one FAIL, [working-docs] docs/working/README.md out of date with header blocks. Not from this rule; likely from the untracked debug doc / new working docs in progress. Needs `pnpm structure:baseline` by the lead. No other failures.

## Not verified
- The rule finds nothing on the real tree, so it was proven only on fixtures (the t915 break is presumably already fixed by the other workers). I did not reintroduce the break in apps/web.
- Gap: workspace packages (e.g. `@fluxiq/ui-components`, `fluxiq/*`) and node_modules are not followed, so a server entry reaching an unmarked hook module through a package import is not seen. Dynamic imports and `next/dynamic` are not followed either. Following packages is possible via browser-graph's workspace resolver but was out of the brief.
- Hook detection is by name (`useX` call), so a non-hook function named `useFoo` would be flagged.

## Open questions
None.
