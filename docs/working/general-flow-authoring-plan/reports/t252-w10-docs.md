# t252-w10-docs: report

## Outcome

Done. Both pages are written, and both are linked from the right indexes. Everything is uncommitted. I changed authored documentation only, and no code.

## What changed and why

**Core** (`C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ`):
- New `docs/architecture/automation-studio/flow-authoring.md`. It covers four areas:
  - **The draft**: recorded and written steps, what the draft entry shows, `amend_draft bind` with a table of its refusals, `rerun_holds_binding`, and how a rerun keeps a step's kind.
  - **Bindings**: the forms table (`$step` is marked not built), the assembly checks, Flow inputs and their test values. A "Not built" paragraph covers P5 and P6.
  - **The build's test**: the walker, lasting acts and the excusal rule, `not_reached`, the unchanged-replay guard, part runs, what the judge reads, and parity.
  - **Consequences**: `metadata.declaredConsequences`, with a plain statement that no stored-run gate reads it and that adding one is the user's call.
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`: two short pointers to the new page, and no rewrite.
  - One follows the "model authors the draft" paragraph (written steps and bind).
  - One follows the dry-run paragraph (per-row test and `not_reached`).
- `docs/architecture/README.md`: the new page is listed under Automation Studio Architecture.

**Downstream** (`C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQWebExtension`):
- New `docs/architecture/build-loop.md`. It covers:
  - live run versus write (`run.ts` and `written-step.ts`);
  - replay and verify with `item` through `row-scope.ts`;
  - `outputs.records` (`webNodeReplayFlowRows`);
  - per-row verify of lasting acts;
  - the tested values of left-out rows (`readRows`);
  - `rowContextKeys`;
  - the `web-4` Lists line;
  - what is not built.
- `docs/architecture/repository-layout.md`: the build loop is added to the "by subject" list of architecture pages.

**Things in the code that differ from the design doc** (the docs follow the code):
- **`flow_draft.input_conflict` is not built.** `flow-inputs.ts` computes `conflicts`, and its header says the assembler refuses them, but nothing reads the list. The page says so.
- **The draft entry shows `passes` as a count**, not as a list.
- **The parity test is new and untracked.** `runtime/llm/node-tools/tests/replay-parity.test.ts` appeared during this task (w7 is working in parallel). I described it from its header and did not run it.

## Commands run and observed results

- Core, from the repo root: `node scripts/structure-audit.mjs --rule docs-links` printed `structure-audit: passed (0 warning(s), 0 baselined).` (run after the final edit).
- Core: `node scripts/docs-reference.mjs --check` printed `Deterministic framework reference is current.`
- Downstream: `node scripts/structure-audit.mjs`.
  - **First run** failed with `FAIL [docs-links] docs/architecture/build-loop.md:9: the link to ../../../!FluxIQ/docs/architecture/automation-studio/flow-authoring.md is broken: it points outside the repository.`
  - **Fix**: I replaced the link with a backticked Core path, as `extension-client.md` and `testing-facility.md` already do.
  - **Re-run** printed `structure-audit: passed (163 warning(s), 118 baselined).`

## Not verified

- The parity test's behaviour: I did not run it, and it is another worker's file in progress.
- I checked the claims against source headers and greps, not by running anything. That covers, for example:
  - the request pre-flight re-screen;
  - `excused: "withheld"` on pass members;
  - `verify.ts` row scoping.

## Open questions or contradictions found

- **The brief's link cannot be followed.** It asked for a relative link to Core's page. From `docs/architecture/`, the correct path is `../../../!FluxIQ/...`, not the `../../!FluxIQ/...` the brief gave. Either form fails downstream's docs-links rule, which refuses any link outside the repository, so Core's page is named by path instead.
- **Stale header comment.** The header of `R/flow-draft/flow-inputs.ts` claims an assembler refusal (`flow_draft.input_conflict`) that does not exist. Either the refusal should be built, or the comment should be corrected.
- **Core's `docs/architecture/automation-studio.md`** points to its sub-guides only inline and has no index list, so I added no link there.
