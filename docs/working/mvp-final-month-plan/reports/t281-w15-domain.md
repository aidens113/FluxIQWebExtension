# t281-w15-domain: a list read sends `reads`

## Outcome

Done. A live, successful `web.output.dom-extract_list` call now carries
`draft.reads = "list:<16 hex>"`; every other statement leaves it absent.

## What changed and why

- `domain/src/runtime/llm-evidence/node-run/list-read/code.ts` (new, one
  export `webListReadCode(nodeId, location, ran)`), barrel
  `list-read/index.ts`, re-exported from `node-run/index.ts`. Code = `list:` +
  first 16 hex of sha256(`origin + pathname` NUL `ran.extractList.item`).
  Query and hash dropped (page 1 / page 5 of one search are one page; a
  reload keeps it). `fields`, `where`, `sort`, `paginate` and the model's
  handle are not included. No code when the node is not the list read, the
  location is absent / unparseable / has a `null` origin, or `item` is not a
  non-empty string. In a subdirectory because `node-run/` and
  `node-run/tests/` were each at the 25-file budget (audit failed with the
  file loose).
- `node-run/run.ts`: the success statement sets
  `reads: webListReadCode(node.definitionId, current?.evidence.location ?? after?.evidence.location, ran)`.
  The look, the refusal and the not-acted `personDraft` sites set
  `reads: undefined`. The acted `personDraft` (robot check after the command
  went out) carries `record.standing.reads`, computed the same way before the
  command, since that step stands as a success would.
- Identity source: `ran`, not `ranWith`. `ranWith` deliberately keeps the
  `extractList` handle (`node-call.ts` `webNodeFlowParameters`), so the
  resolved `item` selector exists only in `ran`. The request type has no
  separate container selector; `item` is the list's identity.
- Dry-run replay (`replay.ts`) builds no draft statement, so it carries none
  and needs none. `written-step.ts` (not owned) sends none: it does not mention
  the key, which is fine because its `present<>` uses capture.ts's type.
- `docs/architecture/build-loop.md`: new section "Which List A Read Read".

## Commands run and observed results

Runner: copy of the brief's subset runner at
`<scratchpad>/t281-w15-run.mjs` (own outdir `.test-build-scratch/t281-w15`,
optional `W15_DIR` env for another tests folder).

- Fail first (tests written, run.ts not yet wired): `node t281-w15-run.mjs list-read-code`
  -> tests 5, pass 2, fail 3 (the three draft.reads tests: `expected 'string' actual 'undefined'`; press and pure-function tests passed).
- After wiring: same command -> tests 5, pass 5, fail 0.
- After moving into `list-read/` (unit tests) and `tests/run.test.ts` (three end-to-end tests):
  - `W15_DIR=runtime/llm-evidence/node-run/list-read/tests node t281-w15-run.mjs` -> tests 2, pass 2, fail 0.
  - `node t281-w15-run.mjs` (all of node-run/tests) -> tests 209, pass 209, fail 0.
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0 (after fixing
  TS2339 on `result.draft.reads` in the test by reading it through a cast).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (172 warning(s), 118 baselined)`
  (earlier runs failed on directory-files 26>25, failure-as-empty for a
  try/catch around `new URL` (now `URL.canParse`), and contract-spread in the
  test; all fixed).

## Not verified

- No Lab / live run; not tested against Core's second-copy rule end to end.
- That a detection's resolved `item` selector is identical after a real
  reload (assumed: generalized structural selector). If a detection after
  reload produces a different selector for the same list, the codes differ
  and Core simply does not refuse (fails open).
- Lists in child frames: the frame is not part of the code, so the same item
  selector at one path in two frames would share a code. Not tested.

## Open questions or contradictions found

- Brief said `reads` is typed in the domain's `WebNodeDraftStatement` via
  Core. It is not: the draft type is declared locally in
  `domain/src/runtime/llm-evidence/capture.ts` (~L196-250) and has no `reads`.
  Without editing capture.ts (not owned), run.ts widens
  `WebNodeDraftStatement = NonNullable<...["draft"]> & { reads?: string }`.
  Follow-up for the supervisor: add `reads?: string` (with a doc comment) to
  capture.ts's draft type and `reads: undefined` to `written-step.ts`'s
  `present<>` call; the intersection in run.ts then stays correct and can be
  reduced to the plain alias.
- Brief said "the resolved container or item selector in `ranWith`"; the
  resolved selector is in `ran`, not `ranWith` (see above).
