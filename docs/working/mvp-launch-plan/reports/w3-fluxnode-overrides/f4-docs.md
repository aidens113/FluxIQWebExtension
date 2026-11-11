# W3 F4: FluxNode developer documentation

## Outcome
Done. Nothing committed. Only `docs/fluxnodes/**` and the link list in `docs/README.md` (Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t899/!FluxIQ`) were touched.

## What changed and why
Pages written (all under `docs/fluxnodes/`):
- `README.md`: what a FluxNode is, the learned Flow, endings, 5-minute quickstart (SDK and CLI), index, "coming soon" (person-needed handlers, per-role model routing).
- `reference/`: `spec.md`, `options.md` (incl. humanness and layering), `overrides.md` (section table from `section-ids.ts`, tool policies, criteria, models, deadlines, retry waits, pace, layering, digest), `http-api.md` (every path, request, response, SSE, open-mode guards, curl), `errors.md` (API codes plus overrides.*, run_request.*, spec.*, inputs.*, answer.*, pipeline.*, SDK codes), `limits.md`.
- `guides/`: `customizing-prompts.md`, `retries-and-deadlines.md`, `judging-results.md`, `choosing-models.md`, `safety.md`.
- `examples/`: `scraping-with-check.md`, `custom-prompts-and-criteria.md`, `pipeline.md`, `per-run-overrides-http.md`.
- `docs/README.md`: link list added under Authored Docs.

Section ids and policies were taken from `packages/contracts/src/fluxnode/overrides/section-ids.ts` as it stands now. Section descriptions were checked against `answer-first/guidance/guidance.ts`. If the other worker renames `explorer.role.*` ids, update the table in `reference/overrides.md` and the prose in `guides/customizing-prompts.md`, `guides/safety.md` and the two prompt examples.

## Commands run and observed results
- `pnpm docs:check` (Core root), run after the pages and again after the README edit -> `structure-audit: passed (0 warning(s), 0 baselined).` and `Deterministic framework reference is current.`, exit 0.
- Grep of each cited code identifier (`defineFluxNode`, `FluxIQ`, `pipeline`, `runPipeline`, `resumePipeline`, `registerPipeline`, `exportFlow`, `getRun`, `listRuns`, `follow`, `learn`, `stop`, `FLUXNODE_PROMPT_SECTIONS`, `FLUXNODE_CORE_TOOL_POLICIES`, `FLUXNODE_API_PATHS`, `fluxNodeApiPath`, `onPersonNeeded`, `overridesDigest`, `FluxNodePromptSectionId`, `SdkError`, `FluxNodeApiError`, `apiCode`) in `packages/sdk/src` and `packages/contracts/src/fluxnode` -> all found.

## Not verified
- The TypeScript examples were not compiled or run against a live engine. They were written against the exported API by reading the source.
- The sample outputs in comments (call counts, run ids, hashes) are illustrative.
- The Availability note in `reference/overrides.md` is a snapshot. At writing, the engine read `retries`, `retryWaits`, `deadlines.llmCallMs`, `deadlines.modelSilence`, `deadlines.personWaitMs`, and judge deadlines/criteria and the digest were being wired (uncommitted edits by the other worker). Prompt and tool text seams were not visible in the engine yet. Reconcile that note when the seams land.
- The quickstart does not say how the engine gets its model key; I did not find where it is set and did not guess.

## Open questions or contradictions found
1. `canonicalFluxNodeSpec` (`contracts/.../spec/hash.ts`) lists option keys `retries, judge, budgetUsd, model, mode, timeoutMs` and omits `humanness`, so two specs differing only in humanness compare equal in canonical form. Likely a one-line fix.
2. Per-run `overrides` on a pipeline run are accepted by the contract and offered by the SDK (`runPipeline`), but nothing in `service/fluxnode/pipeline/` reads them, and child runs get only the parent's `options`. The docs say so plainly. Either apply them or refuse them with `pipeline` in the request.
3. Pinning is recorded but not enforced (`flow-export.ts` header says so). The docs say a pin is recorded and replaying a pinned version is not enforced yet.
4. Per-role model routing is not wired: no use of `overrides.models` in `service.ts` or elsewhere in the engine. Docs mark it "coming soon" as instructed.
5. API codes `invalid_spec`, `no_host`, `rate_limited`, `unavailable`, `unauthenticated` are in the contract but no server code in this tree emits them (the local handler uses `invalid_request` for every invalid body, including a bad spec, plus `forbidden`, `unknown_*`, 409s and `internal`). `errors.md` documents all contract codes. Consider noting which are hosted-engine only.
6. The safety-word pattern in code includes `credential` where the design report said `password`. Docs follow the code.
7. The design says a re-registered name and hash must update the held spec; `owner-flows.ts` has an `update` hook on registration, but I did not trace that it covers `overrides`. The docs state that overrides are not part of identity and the learned Flow is kept.
8. `FluxNodeRunCarried.overrides` is not passed to child runs of a pipeline (by design); the docs state it.

Return contract is below.
