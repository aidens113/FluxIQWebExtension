# w2x-exploration-handles: every handle names one element, and no two elements read alike (P18, t070)

Worker report for `### Brief: w2x-exploration-handles`. Worktrees:
`F:\fxwork\t070\!FluxIQWebExtension` (task branch `task/t070-exploration-handles`)
and `F:\fxwork\t070\!FluxIQ` (P2's Core, unchanged). Nothing is committed.

## Outcome

**Partial.** The code change is complete. The focused tests and both repositories'
checks pass. On `everything-store-first-page-plus-earbuds-deal-wheel` there is a
same-base before and after comparison. The second task,
`auction-marketplace-kestrel-auctions`, never reached a plan in either arm: the
machine was overloaded and Core timed out both runs. **No run created a Flow**, so
matched-against-expected records was never measured.

### Root cause (seen in source and live)

Core's Flow script format tells the model to write a step's target bare, as
`target: target.7` (`flow-script-format.ts`). The domain numbered each page's
controls from `target.1`. So once an exploration had seen two pages, a bare handle
named a different control on each page. The plan resolver refused it, correctly, as
`web.handle.ambiguous`, and Core recorded that as `core.decision_unusable`.

Live, on this base with the old numbering (`run-mubvjplr-4b4b0612`), the model
wrote: type into search, press Go, press a filter, extract. The filter step's
`target.29` was "Shop Tidewell kettles" on the front page and "4 Stars & Up" on the
results page, so it was refused as ambiguous. The build then stalled.

### Live results

All runs used `FLUXIQ_TEST_ENV_FILES=none` and `persistent-isolated`, one at a time.
`FLUXIQ_LAB_ALLOW_BEHIND_CORE` was never set. In every row the snapshot's
`build.providerCalls` equals `observed.calls` wherever the Lab recorded them.

| Run | Task | Code | Ambiguous-handle decisions | Where the build stopped | Flow / matched |
|---|---|---|---|---|---|
| `run-mubvjplr-4b4b0612` | deal-wheel | **before** (old per-page numbering, see note) | **1 of 1 plan** (`target.29`, 1 of 5 nodes) | `evidence_repeat_without_progress`, 16 calls, $0.0827 | none / not measured |
| `run-mubv61bg-da3a3514` | deal-wheel | **after** | **0 of 1 plan** (all 5 nodes resolved; bare `target.63`, `target.64`, `target.83`) | `lab.generation_http_400` about 2 s after resolution (Core unclassified 400, lane B gap 5) | none / not measured |
| `run-mubvpauy-a0435ab7` | deal-wheel | after | 0 (no plan submitted) | `evidence_repeat_without_progress`, 10 calls, $0.0484 | none |
| `run-mubur6gl-442ea57d` | deal-wheel | after | 0 (no plan) | `provider_transport_unknown` after 2 tool calls | none |
| `run-mubveip3-8f1a6b64` | auction | after | 0 (no plan) | `provider_transport_unknown` after 7 tool calls | none |
| `run-mubtlz0i-544bf67d` | deal-wheel | before (P2 + dev as checked out) | none observed | `provider_transport_unknown` | none |
| `run-mubtxwlz-56360a36` | deal-wheel | before (P2 + dev) | 0 (no plan) | `provider_transport_unknown` after 3 tool calls | none |
| `run-mubuahj0-b1ae50f9` | auction | before (per-page) | none | Lab `http.timeout` on `issue-llm-execution-grant` (30 s), no provider call | none |

Note on the before arm: `run-mubvjplr` ran the fixed build with a temporary
switch, `FLUXIQ_T070_PER_PAGE_HANDLES`, which gave every page its own number pool.
That is the old numbering. The look-alike cues were present in that run too; they
cannot cause or remove an ambiguity refusal. The switch has been removed. The Lab
records no accounting for builds that end in a transport or HTTP failure, so those
rows' spend is unknown. A 5-token DeepSeek probe took 726 ms, so the provider itself
was responsive.

Packets captured with the temporary trace, compared by description (every field but
the handle and passing state):
- **Before, front page:** one group of three elements read identically: bare `div`s
  `target.5`, `target.7` and `target.10`.
- **After, every packet of all four traced runs:** no group reads alike. The same
  three `div`s carry `alike` 2/3, 1/3 and 3/3. Handles run across pages, e.g.
  front page `target.1`–`53`, results page `target.54`–`101` (deal-wheel) and
  `target.60`–`107` (auction).
- **Results page:** its repeated "Add to cart" buttons were already distinguishable
  by `heading` and `item`, so they were given no cues and cost no bytes.

## What changed and why

Everything is under `domain/src/runtime/llm-evidence/`.

- **`stable-handles.ts`: numbers are spent per Flow, not per page.** An address is
  a digest of the page, frame, selector, record and occurrence. A number, once
  given, never names another control while the Flow is being authored. A bare
  handle therefore names exactly one element, and a `location` beside it only
  confirms what the handle says.
  - The pool is `target.1`–`target.9999`
    (`WEB_LLM_TARGET_HANDLE_MAX_NUMBER`, pattern
    `WEB_LLM_TARGET_HANDLE_PATTERN`). One exploration cannot use it all: 64 calls ×
    3 captures × 40 elements is 7,680. A Flow that does use it all starts again,
    which is the old behaviour, and the store still refuses any collision.
  - Addresses are hashed, so the memory per Flow is bounded by the number of
    handles issued.
- **The handle pattern is defined once and shared.** `tools.ts` (the tool schemas
  and `boundedTargetHandle`), `plan-resolution/handle-tokens.ts`,
  `structure/detect.ts`, `harness-options/options.ts` and `execute.ts` all use it.
  The recovery options had to follow, because
  `detect-option.test.ts` pins them to the authoring detection tool's bounds.
- **`sanitize.ts`: the budget includes the renumbering.** The packet is measured as
  though every handle had the widest number. The authoring tools renumber after
  trimming, and Core ends a build with `evidence_limit` if a packet exceeds the
  room it gave the call.
- **`look-alikes.ts` (new): no two elements of a packet read alike.** An element
  whose description equals another's is given, in closed and bounded form:
  - `dialog`: the name of the open dialog it sits in, when the look-alikes are not
    all in the same one;
  - `within`: the record's own words (row, card or list item, less its controls'
    words, cut to the 80-character placement bound), when those words differ
    between the look-alikes;
  - then `alike: {index, total}`: its position top to bottom by `documentBounds`,
    falling back to packet order.

  The cues are recounted after every budget trim, so they describe the packet
  that is actually sent.
- **Supporting edits.**
  - `elements.ts` declares `dialog`, `within` and `alike`, and carries the record's
    words and document position beside each described element.
  - `front-layer.ts` gains `openDialogNameOf`, using the same geometry. P2's
    front-layer ranking is behaviourally unchanged.
  - `state-digest.ts` omits the three new fields: they describe the packet's
    composition, not the page.
- **Tests.**
  - Updated: `tests/stable-handles.test.ts`, `tests/limits.test.ts` (the boundary
    now includes the reserve), `tests/present.test.ts`,
    `plan-resolution/tests/resolve-plan-node.test.ts` (numbering is per Flow, and
    `target.10000`/`target.0` are the malformed cases) and
    `plan-resolution/tests/plan-node-identity.test.ts` (the store's identity rule
    is now held against the store directly).
  - New: `tests/look-alikes.test.ts` and
    `plan-resolution/tests/target-packets.test.ts`.
- **Comment-only updates** in `plan-resolution/target-packets.ts` and `tools.ts`.

## Commands run and observed results

- **Before any live run,** Core's build was older than its source, and the Lab
  refused to run. I ran `pnpm --filter fluxiq build` in `F:\fxwork\t070\!FluxIQ`:
  exit 0. That regenerated build output only; Core's `git status` stayed clean.
- **Live runs:** `node scripts/lab/live-campaign.mjs --max-attempts 1 --output
  test-runs/campaigns/t070-<arm>-<task> <task-id> -- --target persistent-isolated
  --workspace <ws>` with `FLUXIQ_LAB_INSTANCE=t070` and
  `npm_config_workspace_concurrency=1`. Results are in the table above.
- **Workspaces:** `t070-es`, `t070-es2`, `t070-es3`, `t070-es4`, `t070-auction` and
  `t070-auction2`, under `test-runs/instances/t070/persistent-isolated/`.
- **Focused domain tests:** a scratch esbuild runner (the same approach P2 used,
  labelled `t070`, now deleted) over `src/runtime/llm-evidence`. On the final code:
  `entries: 30`, `# tests 231`, `# pass 231`, `# fail 0`. The first run on the new
  code failed 6 tests, all of which pinned per-page numbering, the old pattern or
  the old byte boundary; they were updated as listed above.
- **Domain typecheck:** `npx tsc -p tsconfig.json --noEmit` exit 0, and
  `npx tsc -p tsconfig.test.json --noEmit` exit 0.
- **Downstream `pnpm check`,** three full runs:
  - Run 1 failed in `task:test`, in `scripts/worktree/tests/remove.test.mjs`.
  - Run 2 passed: **exit 0**. Structure tests 182/182, Lab tests 74 passed with 0
    failed, task tests 113/113, `structure-audit: passed (85 warning(s), 122
    baselined)`, every workspace `Done`.
  - I then moved a test to fix the one new advisory (`resolve-plan-node.test.ts` at
    416 lines) and ran run 3. It hit the same flake: 2 worktree tests failed with
    `Bad control character in string literal in JSON` in
    `scripts/worktree/process-list.mjs`.
  - On that final tree I ran the remaining steps directly. `node
    scripts/structure-audit.mjs` gave `passed (84 warning(s), 122 baselined)`, and
    `pnpm -r check` gave every workspace `Done`, exit 0. A retried `pnpm task:test`
    gave `# pass 113`, `# fail 0`.
- **Core `pnpm check`:** exit 0. `structure-audit: passed (170 warning(s), 361
  baselined)`, and every package `Done`.

## Not verified

- **No Flow was created,** so no oracle, no `matchedRecords` against
  `expectedRecords`, and no replay without a model.
- **The auction task has no before and after ambiguity comparison.** Both arms died
  on the environment before reaching a plan.
- **Full suites** (`pnpm test` in either repository) were not run, as the brief
  says.
- **The effect of `dialog` and `within` on the model's choices** is not measured
  live. They fired only in unit fixtures; the traced live packets needed only
  `alike`.
- **The cause of the `provider_transport_unknown` failures** is not confirmed.
  Core swallows the error, and I did not instrument Core.

## Open questions or contradictions found

1. **The environment is killing builds (Core, not this change).** Four of nine builds
   ended with `flow_bootstrap.provider_transport_unknown` mid-exploration, with CPU
   at 88–100%. Another worker's `burn.mjs` processes were running during some of
   them. My domain-side trace shows no tool throw.
   - Likely path, read in source and not proven: `execution-grants.ts`
     `abandonTimedOutCall` revokes the grant when a call times out before its
     credential is released (scrypt-sealed key, CPU-bound). The next claim then
     throws an untyped `Error("LLM execution grant is unavailable.")`, which
     `generation-failure.ts` maps to `provider_transport_unknown`.
   - The Lab's `issue-llm-execution-grant` also timed out at 30 s under load. t057's
     recent campaigns show the same `http.timeout`.
2. **`scripts/worktree/process-list.mjs` breaks on a process whose command line
   contains a control character.** That makes `pnpm check` fail intermittently
   depending on what else is running.
3. **After the fix, Core returned an unclassified 400 about 2 s after every plan
   node resolved** (`run-mubv61bg`). This is lane B's gap 5. The Lab drops Core's
   error string, so the cause is unknown.
4. **Ranking gap (not handles).** On the everything store's results page, the
   "Brightaisle Plus" filter the task needs was not among the 40 elements carried
   (609 captured; footer links ranked in). The model guessed filter URLs, got
   `no_progress` twice, and then chose "4 Stars & Up". Footer inputs also carry the
   last card's title as `heading`.
5. **Documentation (not in my ownership).** `docs/architecture/page-evidence.md`
   (about lines 168–173) says the record "never reaches the packet". Its words now
   reach it as `within` on look-alikes, and handles are numbered per Flow. The
   `web-llm-evidence.v2` element gains three optional fields; the schema version is
   unchanged, because every existing reader ignores unknown optional fields.
6. **Possible overlap.** `harness-options/options.ts` and `execute.ts` changed only
   to use the shared handle pattern. If P9 edits those files, expect a one-line
   merge.
7. **Temporary diagnostics** (the `T070-TRACE` code and the per-page switch) are
   fully removed, and a NUL-byte count against HEAD is clean. The trace files are in
   my scratchpad as `t070-trace-*.ndjson` and contain sanitized packets only.
