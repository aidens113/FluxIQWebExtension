# Run debug — pending t171 measured-correction run

This file and every assertion in Stage 1 were frozen before the live invocation and before any
new run output existed. After launch it must be renamed, without content changes, to the safe real
run id before the run path, verdict, inspection result, or bundle is opened. Later fields may be
filled only from an integrity-valid, conservatively redacted bundle. A missing fact is recorded as
`NO EVIDENCE`; no prior-run trace or predicted result may fill it.

Run 4 (`run-muje0grk-4d8d2d3f`) remains the latest accepted live measurement and the pre-run pass
streak is **0**. It exhausted the build at Stage 2 with
`flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`. This run is
not an unchanged retry. Its sole convergence hypothesis is the delivered lossless `step_rows_v1`
packing correction, which retains every bounded draft input inside the unchanged 4,000-byte
reservation. No answerability rule or budget was enlarged.

---

## Header

- Run id: `pending`
- UTC start / finish: `pending`
- Scenario / variant / task: `everything-store` / none /
  `everything-store-plus-earbuds-under-50`
- Provider / observed model: DeepSeek / `pending`
- Build-grant calls, tokens, and cost: `pending`
- Playback/repair-grant calls, tokens, and cost: `pending`
- Observed/evaluation accounting representations: `pending`; overlapping representations must not
  be added. No combined total may be published unless typed evidence proves the components disjoint.
- Verdict as reported: `pending`
- Highest stage reached: `pending`
- Exact request command, invoked once from `F:\!FluxIQWebExtension`:

  ```powershell
  node packages/test-runner/dist/cli.js run everything-store `
    --target isolated `
    --live-llm `
    --llm-profile mvp-hard-scenario `
    --llm-provider deepseek `
    --llm-task create-flow `
    --instruction-task everything-store-plus-earbuds-under-50 `
    --replays 1
  ```

- Required exact-launch-process environment invariant: `FLUXIQ_TEST_ENV_FILES=none` and
  `FLUXIQ_TEST_TARGET=isolated`; inherited `FLUXIQ_LAB_INSTANCE` and `FLUXIQ_TEST_RUNS_DIR` must be
  absent or cleared by name immediately before invocation. The runner then owns its private
  production panel and default `test-runs/<run-id>` output.
- Request equivalence: executable, subcommand, scenario, ordered option/value tokens, working
  checkout, and isolation variables are the accepted t419 dry-run request; the sole request
  difference is removal of terminal `--dry-run`. Capture, null stderr, parsing, and environment
  normalization are wrapper controls rather than request mutations.

## Frozen candidate and output identity

- Core source/runtime closure: clean `F:\!FluxIQ` `dev` at
  `f44930aba0640f850f2e09f06ea03c0343d69361`, aligned with cached `origin/dev`.
- Downstream pre-Stage-1 parent: clean `task/t171-run5-live-validation` at
  `042e9aa375c6dbe03a04d79aecf5c9524cfbe167`. T419's original clean snapshot was
  `8ca0c1f9d95942e52c1d0ae33852c2a363537681`; only the reviewed t419–t422 reports changed between
  that snapshot and this later containing parent. This pending file is the only intended delta
  before its dedicated Stage-1 commit. The launch gate must bind the resulting containing commit
  and prove the worktree clean; any source, report, output, or other path change is NO-GO.
- Corrected-order outputs: t419's final successful domain → downstream domain web-panel host → test-contracts →
  Scenario Lab → test-evidence → extension → test-runner build sequence. Strict freshness is 6/6,
  required output markers 12/12, E2E manifest identity passes, and Core runtime identity is 3/3.
- Accepted provider-free request: t419 returned `ready`, `providerCallCount: 0`, lane
  `created-flow`, target `isolated`, expected-dataset step `extract-plus-under-fifty`, and one replay.
- Machine transients in the corrected-order build were bounded pre-output launcher/compiler faults;
  each affected command passed once on retry before the final chronology. They are operational
  history, not live product evidence.

## Stage 1 — frozen instruction, chain, and oracle

Normalization for authored text identities is strict UTF-8, CRLF/lone-CR to LF, existing terminal
newlines removed, and exactly one terminal LF added. The canonical instruction is the decoded
string value, not its TypeScript quoting. No instruction or record value is reproduced here.

| Identity | Canonical source | Count | SHA-256 |
| --- | --- | ---: | --- |
| Task declaration | `apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts:20-27` | 8 lines / 649 bytes | `4fa34d5ce9c7bb5f68ebde5e1208422627e0d1c55650452623f6bfd1455d525f` |
| Instruction scalar | `live-tasks.ts:24`, decoded and normalized | 415 scalars / 416 bytes | `46bd24470ade5869622a93cdc549071136bb29b0eaaa877c6940a7d3959351de` |
| Accepted nine-step chain | `docs/working/mvp-today-plan/reports/t331-run4-no-hindsight-stage1-draft.md:49-57` | 9 lines / 1,424 bytes | `60bd00a3bb29478dab0fbefc1a8d6a1fb46a04c2842876e0566ac668b9c1d319` |

The dry-run's own instruction identity used its runner convention and reported 415 characters with
SHA-256 `d4f7835b8fc63ee857b5c15bd6a01f1f08fe3df19446153ad0f443045fd087ef`.
The differing digest conventions identify the same canonical task source and are not compared as
like-for-like hashes.

The accepted chain contains consecutive ordinals 1 through 9 exactly once and in order: **9/9**.
It requires navigation from blank start; dismissal of the deal and cookie interruptions; real
header search; conditional browser-check continuation; exact organic/earbuds/Plus/rating/price
predicates; four-field organic extraction; complete pagination/lazy-load traversal; first-occurrence
identity de-duplication with stable relevance order; and Core-owned exact judgement, screened repair,
durable application, selected-Subflow zero-provider replay, post-replay judgement, and terminal
grant revocation. This summary does not replace the frozen chain identity.

The oracle is exactly 13 ordered records from `extract-plus-under-fifty`:

| Identity | Canonical source | SHA-256 |
| --- | --- | --- |
| Oracle definition | `apps/scenario-lab/src/scenarios/everything-store/workflows/plus-under-fifty.ts` | `17d62daffd0ff2a99a17b06e6b6597ab12b1cb74ad39362d07f524b08709febd` |
| Record mapper | `apps/scenario-lab/src/scenarios/everything-store/workflows/earbud-records.ts` | `fdebf3d9f715d059f3b39e9bfb5904d59cfe9d68976fe3861bc10b9bb7e27777` |
| Organic relevance order | `apps/scenario-lab/src/scenarios/everything-store/catalog/search.ts` | `e09e8df552f0bd050966547856b725f0dcc0ddadf3c7a4f295469ffc0de5e88c` |
| Page-boundary model | `apps/scenario-lab/src/scenarios/everything-store/catalog/results-page.ts` | `5a92ce9272d6c9d129b955619138da067b047e3e23a4baf2004bf91250c3fb16` |
| Canonical ordered records | `JSON.stringify(records)` plus LF, 3,457 bytes | `c8b7f87109cf593d6601863f19a488b4c2fa915bec65707813a19bab09e8c866` |

The authored oracle is **13/13**. Every record has exactly the ordered string fields `name`,
`price`, `rating`, `url`; every source product has kind `earbuds`, Plus eligibility, rating at least
4, and price strictly below 5,000 cents; identities are unique; adverts are excluded; qualifying
later-page members remain represented; and first-occurrence relevance order is stable. Exact row
and field equality in order is required. Count alone cannot pass.

## Frozen authorization and budget contract

- One CLI invocation only; no automatic retry. A product failure, facility failure, unsafe id,
  integrity failure, or disclosure-gate failure consumes the authorization.
- Per provider request: at most 48,000 input, 8,000 output, and 56,000 total tokens; USD 0.25
  estimated cost; effective 25-second timeout; zero provider retries.
- Per provider grant: at most 26 calls, 560,000 total tokens, and USD 2 estimated cost; concurrency
  is one.
- The lane can issue at most two sequential grants: `build_and_adapt`, then only after a successful
  proposal/review, `explore_and_adapt` for playback, judgement, and repair. Componentwise
  invocation maxima are 52 calls, 1,120,000 grant-total tokens, and USD 4. There is no third grant
  or renewal; binding continuation preserves the second grant's remaining uses/spend.
- The requested replay issues no grant and must make zero provider calls.
- If and once the run-owned second grant is issued, only that same grant may continue after an
  authorized exact binding update. It may not be minted again, replaced, widened, reset,
  transferred, or spared terminal revocation.

## Frozen evidence and disclosure contract

Evidence sources use normalized identities recorded by t421. Their ordered composite—normalized
path, NUL, source digest, LF—is 415 bytes with SHA-256
`be0a71851a5ec7ec8eede281dcc7996b75e0166aa61e6c41a3fcb5a4698552db`.
It binds test-evidence schema `0.1`, the finalized index, completion marker/index digest, safe
relative paths, byte counts/digests, and silent `inspect` verification.

After the single invocation, the t422 wrapper must parse only the final nonblank stdout JSON in
memory, require the facility-shaped safe id and default immediate-child run path, refuse collisions
and reparse points, and rename this pending file to `<run-id>.md` before reading verdict, inspection,
or bundle content. It then performs exactly one silent inspection; verifies the completion marker,
exact index bytes/digest, schema, safe unique contained index entries, and conservative redaction;
and matches the manifest's id, closed verdict, and redaction state. Its Windows PowerShell 5.1
static parse and two independent final reviews are GO. No raw object or error record may print.

Only after those gates pass may semantic review open exactly one indexed instance of, in order:
`run.json`, `summary.json`, `evaluation.json`, `snapshots/live-llm.json`, then only if present and
needed `snapshots/flow-lane.json`, `snapshots/extraction-mismatches.json`,
`snapshots/repair-lane.json`, and `snapshots/redaction-attestation.json`.

Never open or display raw stdout/inspection objects, prompts/responses, page values or raw datasets,
logs/events, HTML/screenshots, selectors, headers/cookies, credentials, authorization material,
browser profiles/state, unindexed files, or run-artifact digests.

## Frozen pass, stop, and streak rules

A pass requires a finalized integrity-valid bundle with `verdict: passed`, `flowCreated: true`,
`oracleVerdict: passed`, `reportedVerdict: passed`, affirmative confirmation, exact ordered 13-row
four-field equality, and one deterministic zero-provider replay. If repair occurs, it additionally
requires a screened actionable directive, applied and persisted adaptation, authoritative binding,
selected-Subflow replay, post-replay judgement, and terminal revocation.

One complete pass advances the streak only from 0 to 1. It does not authorize pass 2. Any failure
or facility fault consumes the invocation and leaves/resets the streak to 0. It forbids another
provider call until a measured fix and fresh provider-free closure exist; classification alone is
not retry authority. A second pass requires a new post-debug freeze and a new explicit command-
specific authorization under the same unchanged scenario, instruction, oracle, profile, budgets,
and acceptance threshold.

## Required final prelaunch attestation

These point-in-time facts are not claimed by this Stage-1 payload. A separate immutable supervisor
authorization record must bind all of them immediately before launch; any unsatisfied or changed
fact is NO-GO:

- final containing downstream commit, clean status, and clean diff check;
- unchanged clean Core identity and unchanged t419 output freshness/marker/runtime identities;
- this pending payload's strict UTF-8 byte identity after its final review and commit;
- fresh one-Lab/no-competing-build-or-test process and lock result;
- exact-launch environment location invariants and default output root;
- credential name/source syntactic readiness only, without reading or recording its value; and
- the exact single-command authorization identity, one invocation/no retry, with the disclosed
  two-grant maximum exposure.

## Stage 2 — exploration

Fill only after the integrity/disclosure gate from allowlisted evidence; otherwise write
`NO EVIDENCE`:

- build outcome and terminal category/code/issue;
- decision, tool-call, progress, and answerability summaries; and
- provider-output validation, proposal transition, and highest observed build stage.

## Stage 3 — proposed Flow

Fill only after the integrity/disclosure gate from allowlisted evidence; otherwise write
`NO EVIDENCE`:

- proposal and review outcome;
- Flow identity, shape, authored nodes, and registered outputs; and
- creation/persistence result before runtime.

## Stage 4 — runtime and replay

Fill only after the integrity/disclosure gate from allowlisted evidence; otherwise write
`NO EVIDENCE`:

- runtime id/status, action summary, and result verification;
- selected-Subflow identity and deterministic replay outcome; and
- replay provider-call count, which must be zero to pass.

## Stage 5 — exact answer

Fill only after the integrity/disclosure gate from allowlisted evidence; otherwise write
`NO EVIDENCE`:

- exact oracle verdict and matched/expected counts;
- ordered row/four-field equality, predicate, uniqueness, and ordering result; and
- bounded mismatch classification without copying record or page values.

## Stage 6 — judgement and repair

Fill only after the integrity/disclosure gate from allowlisted evidence; otherwise write
`NO EVIDENCE`:

- judgement, confirmation/refutation, and screened actionable repair directive;
- repair application, durable persistence, and authoritative binding result;
- post-repair selected-Subflow replay and post-replay judgement; and
- terminal run-owned grant revocation.

## Final classification

After every allowed field above is resolved from accepted evidence or marked `NO EVIDENCE`, record
the product/facility classification, pass-streak consequence, accounting representation rule, and
whether another provider call is forbidden. Do not infer a missing fact or create retry authority.
