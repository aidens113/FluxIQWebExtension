# W3 (t899): FluxNode developer overrides and docs, sub-supervisor report

All paths are in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t899/!FluxIQ` unless noted.
`pkg/` means `packages/fluxiq/src/`. The lead committed checkpoint 2 as `af6bf1705` and checkpoints
3-5 as `a809073d7`. Checkpoints 6, 7 and 8 were committed by the lead (8 as `7617981d4`); checkpoint 9 is
not committed.

## Checkpoint 9 (2026-11-11): the judge's window without routing, the result check, and panel presses (W3 complete)

**1. The judge without routing is built to the attempt model's window (my edits).**
- `pkg/runtime/result-verification/flow-less/types.ts`: the judge's input takes an optional `tokenLimits`.
- `flow-less/judge.ts`: passes it to the harness request.
- `pkg/framework/automation-service/service/answer-first/attempt/run-attempt.ts` (the granted line):
  the judge's run gets `tokenLimits: input.provider.tokenLimits`.
- A routed judge model's own window, stated on its provider, still wins.
- `judged-summary.ts` is untouched.
- Test (worker): `answer-first/attempt/tests/judge-token-limits.test.ts`. An attempt whose resolution has
  small limits sends its judge a request checked to them; a summary that does not fit goes in its shorter,
  stated form, with `summarised` naming `answerText.text`, instead of being refused.

**2. The Flow-run result check already passed its judge's limits.** The resolution's `tokenLimits` reach
the harness through `run-outcome.ts`, then `verify.ts` near line 475. No source change was needed, and
`service.ts` is untouched. The worker added a test with a small-window judge resolution:
`pkg/runtime/result-verification/tests/judge-limits/tests/judge-token-limits.test.ts`. It sits in a
subfolder because `result-verification/tests/` is at its file limit.

**3. Panel presses carry the attempt's overrides (worker, granted files).**
- An optional, JSON-only `runOverrides` (the frame the FluxNode run set) is on the caller options and on
  the kept options (`flow-bootstrap-commands/contracts.ts`).
- The reader validates it strictly and refuses a malformed frame by name
  (`answer-first/caller/{options.ts, run-overrides-read.ts (new)}`).
- `caller/kept.ts` keeps it, and `fluxnode/caller-options.ts` and `run-fluxnode.ts` pass it in.
- `attempt/run-attempt.ts` runs the attempt inside the kept frame only when one is kept and none is
  already set, so an outer frame is never replaced.
- **Secrets are never in the frame or the kept options.** A press on a secret-input attempt runs with no
  secrets frame, so a bound step cannot resolve; it never types a remembered or wrong value. That
  conclusion comes from reading the code; the person-facing wording was not observed.
- Tests:
  - `answer-first/caller/tests/run-overrides.test.ts`;
  - `answer-first/attempt/tests/run-overrides-press.test.ts`: Carry on and Run again each run under the
    attempt's frame, and a non-FluxNode press sees none;
  - `fluxnode/tests/run-overrides-kept.test.ts`.
- **My fix:** a press dropped `humanness`, because it was missing from the kept options. It is now in
  `AutomationStudioAnswerFirstKeptCallerOptions` and `caller/kept.ts`, with a test in
  `caller/tests/run-overrides.test.ts`.

**Checkpoint 9 file list (Core worktree):**
- Modified:
  - `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/run-attempt.ts`
  - `packages/fluxiq/src/framework/automation-service/service/answer-first/caller/kept.ts`
  - `packages/fluxiq/src/framework/automation-service/service/answer-first/caller/options.ts`
  - `packages/fluxiq/src/framework/automation-service/service/flow-bootstrap-commands/contracts.ts`
  - `packages/fluxiq/src/framework/automation-service/service/fluxnode/caller-options.ts`
  - `packages/fluxiq/src/framework/automation-service/service/fluxnode/run-fluxnode.ts`
  - `packages/fluxiq/src/runtime/result-verification/flow-less/judge.ts`
  - `packages/fluxiq/src/runtime/result-verification/flow-less/types.ts`
- New:
  - `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/tests/judge-token-limits.test.ts`
  - `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/tests/run-overrides-press.test.ts`
  - `packages/fluxiq/src/framework/automation-service/service/answer-first/caller/run-overrides-read.ts`
  - `packages/fluxiq/src/framework/automation-service/service/answer-first/caller/tests/run-overrides.test.ts`
  - `packages/fluxiq/src/framework/automation-service/service/fluxnode/tests/run-overrides-kept.test.ts`
  - `packages/fluxiq/src/runtime/result-verification/tests/judge-limits/tests/judge-token-limits.test.ts`

**Checks run by me (checkpoint 9):**
- `pnpm exec vitest run src/framework/automation-service/service/answer-first/caller src/framework/automation-service/service/answer-first/attempt src/framework/automation-service/service/answer-first/carry-on src/framework/automation-service/service/answer-first/run-again src/framework/automation-service/service/fluxnode src/runtime/result-verification src/runtime/llm/role-routing src/runtime/llm/harness src/runtime/run-overrides src/runtime/run-secrets`
  -> 327 files, 2,372 passed
- `pnpm exec vitest run src/framework/automation-service/service/answer-first/caller/tests` -> 6 files, 26 passed (after the humanness fix)
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (533 warning(s), 969 baselined).`
- `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).`, `Deterministic framework reference is current.`
- fluxiq tsc through the slot (`heavy-slot.mjs run t899-w3 -- "... tsc --noEmit; echo TSC_EXIT=$?"`) -> **`TSC_EXIT=0`**

**Workers:**

| Worker | Tier | Outcome | What I verified |
| --- | --- | --- | --- |
| panel-presses | worker | Done | Read the press wrap (no double wrap); fixed the dropped `humanness`; re-ran tests |
| result-check-limits | worker | Done (no source change needed) | Re-ran tests; confirmed `service.ts` is untouched |

**W3 is complete.** Still recorded as known and outside FluxNodes: the runtime-session repair provider
and the standing result-check authorization (checkpoint 8).

## Checkpoint 8 (2026-11-11): repairs on the repair model; each role sized to its own model's window

**1. Repair routing (worker, in the granted `answer-first/attempt/round.ts`).**
- A round's evidence loop runs inside `runWithAutomationStudioLlmModelRole("repair", ...)` when the round
  is repairing the saved Flow:
  - the path is `run_flow_then_repair` (the saved Flow's replay went out and broke; `rounds.ts` resets
    the path before any fresh round);
  - or, an addition of mine, the first round of a `repair` route, whose saved steps did not assemble.
- Fresh rounds stay on the explore model. Without `models.repair`, nothing changes.
- Test: `service/fluxnode/tests/repair-routing.test.ts`. With `{ explore: A, repair: R }`, the first run's
  decisions are served by A, and the repair run's decisions are served and priced by R, with cost equal to
  the sum charged. With no models, everything goes to the default model.
- The repair-route branch has no scripted case: the library lane cannot produce saved steps that fail to
  assemble. It rests on code reading and the typecheck.
- The docs caveats are removed from `docs/fluxnodes/guides/choosing-models.md` and `README.md`.

**2. Per-role token limits (worker-heavy).**
- **What the worker found.** Core never trims a request to fit. Each resolution's `tokenLimits` is its
  model's window less an 8,000-token reply reserve, and the harness refuses anything larger by size. The
  explorer copes by turning earlier views into recallable `core.view_reference` entries, and by starting a
  fresh round from Core's own account.
- **The defect.** The Flow-less judge passed no `tokenLimits`, and role routing discarded each role's own
  limits. A small-window judge was sent a request its adapter refused, which read as "not judged". A test
  reproduces this.
- **Fix, step 1: limits come from the serving model.** `pkg/runtime/llm/harness/served-limits.ts` (new)
  makes a role's provider state its model's limits in provider metadata, which every decorator forwards.
  `role-routing/resolution.ts` wraps the judge and repair providers with their own resolution's limits.
- **Fix, step 2: the harness builds to them.** `harness/sized-request.ts` (new, called from `run.ts`)
  builds the request, asks `servedBy`, and rebuilds to the served model's limits.
  - A new optional input, `resultSummaryFitting`, offers the summary in progressively shorter forms.
  - The whole summary goes when it fits; otherwise the first shorter form that fits.
  - The harness itself trims nothing.
- **What gets summarised.** `flow-less/window-fitting.ts` (new, called from `judge.ts`) summarises one more
  item per step:
  - the start and end views;
  - then the looks, read pages, acts and the model's own words;
  - the rows last.

  There is no count cap, and `judged-summary.ts` is untouched (t885's pending change stays clean).
- **The judge is never misled (the user's no-hiding rule).** A summarised item stays in place as
  `{"core.summarised": {...}}`, with counts only. A final `summarised` entry names every summarised item
  and says a yes must stand on what was shown whole, otherwise answer unknown. Yes citations are still
  checked against the full rows.
- **Tests:**
  - `role-routing/tests/served-window.test.ts` (6);
  - `flow-less/tests/judge-window.test.ts` (3): a small-window judge's request fits, it is told what was
    summarised, and it returns yes; the old behaviour comes out not judged; a large-window judge's
    evidence is byte-identical to an unrouted one;
  - `flow-less/tests/window-fitting.test.ts` (3).
- **Docs:** a "Model requests" section in `docs/fluxnodes/reference/limits.md`.

**Grant requested (one line, W1):** a judge **without** routing still passes no `tokenLimits`. It is held
to the default largest window, not the attempt model's, so an attempt model with a window under 1,000,000
tokens would still have oversized judge requests refused. The fix is to pass
`tokenLimits: input.provider.tokenLimits` to the judge's run in
`pkg/framework/automation-service/service/answer-first/attempt/run-attempt.ts`. Every model Core ships
today has a 1,000,000-token window, so this cannot happen yet.
- **Why not in W3's files:** stating the explore model's limits on the unrouted provider from
  `role-routing/resolution.ts` would change the provider metadata, and so the receipts, of every run
  without `models`. That breaks "no models = exactly as before".

**Known, unrouted, outside FluxNodes (as the lead asked):**
- The runtime-session in-run repair provider, in `pkg/framework/automation-service/service.ts` near the
  runtime-session repair provider resolution (about line 2396). FluxNode runs never reach it.
- The standing result-check authorization, which judges on its own key's model:
  `resolveAutomationStudioResultCheckProvider` (`service.ts` result ports, about line 2471), on the
  authorization path in `pkg/runtime/result-verification/`.
- **Not checked:** whether the Flow-run result check (`verify.ts` via `resolveCallerProvider`) passes its
  judge resolution's limits to the harness.

**Checks run by me (checkpoint 8):**
- `pnpm exec vitest run src/framework/automation-service/service/answer-first/attempt/tests src/framework/automation-service/service/fluxnode src/runtime/llm/role-routing src/runtime/llm/harness src/runtime/result-verification/flow-less src/runtime/llm/domain-instructions src/runtime/agents/budget`
  -> 112 files, 771 passed
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (533 warning(s), 969 baselined).`
- `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).`, `Deterministic framework reference is current.`
- fluxiq tsc through the slot (`heavy-slot.mjs run t899-w3 -- "... tsc --noEmit; echo TSC_EXIT=$?"`) -> **`TSC_EXIT=0`**

**Workers:**

| Worker | Tier | Outcome | What I verified |
| --- | --- | --- | --- |
| repair-routing | worker | Done | Read the `round.ts` diff and `rounds.ts`'s path reset; added the repair-route first round; re-ran tests |
| role-token-limits | worker-heavy | Done | Read the resolution, served-limits and harness flow; re-ran tests and the audit; confirmed `judged-summary.ts` is untouched |

## Checkpoint 7 (2026-11-11): per-role model routing

**Outcome.** Each model call in a FluxNode run goes to its role's model from `overrides.models`, through
one routing wrapper. It is held and charged at the price of the model that served it, from the run's one
budget. **Repair calls still use the explore model.** A FluxNode run fixes a broken saved Flow with its
own decision calls, so routing them to `repair` needs one W1 edit (open item 1).

**How it works (worker-heavy):**
- `pkg/runtime/llm/role-routing/**` (new):
  - every task kind has a role; `loop_verification` is always judge, and a call carrying an in-run-repair
    slot is repair;
  - a role frame, `runWithAutomationStudioLlmModelRole`, can move explore-kind calls to repair;
  - the routing provider returns the explore provider itself when no other role names a model, so a run
    without `models` is unchanged;
  - each role's model is resolved once, when the attempt starts.
- The provider contract gains an optional `servedBy(request)` (`pkg/runtime/models/contracts/provider.ts`).
  The domain-instructions wrapper (`pkg/runtime/llm/domain-instructions/provider.ts`) passes it through,
  because answer-first wraps the attempt's provider from outside.
- **How cost learns the served model:** the harness (`pkg/runtime/llm/harness/run.ts`) works out the
  serving provider once per call. That provider is used for the size measure, the run-budget reservation
  and its receipt, the purse hold, the call itself and the result's provider metadata.
- **The judge's reserve.** The purse keeps money back to judge the result. That reserve is now priced at
  the judge model's price, where before it took the last call's price (`pkg/runtime/agents/budget/{call-hold,types,judging-reserve}.ts`).
- **`service.ts`:**
  - the attempt's provider comes from `automationStudioLlmRoleRoutedResolution`;
  - the result check asks for `models.judge`, else the Flow's model;
  - three lines changed in place; the file stays at its line limit.
- **A role model that cannot be resolved** fails at the attempt's start exactly like an unknown
  `options.model`: same failure code, no fallback, no new way for a run to end.
- **Files outside the brief's list that the worker had to touch** (no lane owns them): the provider
  contract, the domain-instructions wrapper, and three files in `agents/budget`. Without them no caller
  could learn which model served a call, or price the judge's reserve. **Please ratify.**
- **Tests:**
  - new `role-routing/tests/{role-of,provider,resolution,served-model}.test.ts`;
  - new `service/fluxnode/tests/model-routing.test.ts` with its helper `priced-models.ts`, covering:
    - with explore=A and judge=B, every judge call is served by B and every decision by A, and `cost.usd`
      is the sum of each call at its own model's price;
    - an unknown `models.judge` ends the run like an unknown `options.model`, before any call;
    - a run with no `models` uses one model;
    - two concurrent runs route by their own models.

**Integration I did myself:**
- **`pinning.test.ts` was failing on t885's improvement, not on routing.** After the dev merge an adopted
  proposal replaces the broken step rather than keeping it. The test now expects only the fix's label, and
  asserts the path is `repaired` (t885: a hand fix is a repair) instead of "not replayed". The pin guide's
  caveat is updated to match.
- **A stale snapshot from t885.** `flow-less/tests/__snapshots__/judged-summary.json` held the judge's old
  default wording. t885 changed "a short cut of what was found" to "what was found there, whole". That was
  the only difference, so I refreshed the snapshot.
  - **Heads-up for t885's pending `judged-summary.ts` change:** this file snapshot pins the judge's whole
    default summary, so it will need the same refresh (`vitest -u` on `default-question.test.ts`) when that
    change lands.
- **Removed the stale "routing lands with the next release" text** from `docs/fluxnodes/README.md` and
  `examples/custom-prompts-and-criteria.md`. The worker updated `guides/choosing-models.md` and
  `reference/overrides.md`.

**Checks run by me:**
- `pnpm exec vitest run src/framework/automation-service/service/fluxnode src/runtime/llm/role-routing src/runtime/llm/harness src/runtime/llm/domain-instructions src/runtime/agents/budget src/runtime/llm/build-purse src/runtime/models src/framework/automation-service/service/answer-first/attempt/tests/caller-seams.test.ts src/runtime/result-verification/flow-less`
  -> 104 of 105 files passed, 772 of 774 tests. The 2 failures were the stale t885 snapshot; after the
  refresh, `vitest run src/runtime/result-verification/flow-less` -> 9 files, 91 passed.
- `pinning.test.ts` -> 2 passed.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (534 warning(s), 969 baselined).`
- `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).`, `Deterministic framework reference is current.`
- fluxiq tsc through the slot (`heavy-slot.mjs run t899-w3 -- "... tsc --noEmit; echo TSC_EXIT=$?"`) -> **`TSC_EXIT=0`**. The worker's own run before my test and snapshot edits was also 0.

**Open items:**
1. **Repair routing needs a W1 edit.** Run the repair round inside
   `runWithAutomationStudioLlmModelRole("repair", ...)` when the attempt's path is `run_flow_then_repair`
   or its route is a repair, in `answer-first/attempt/rounds.ts` or `round.ts`. Then drop the docs caveat
   in `guides/choosing-models.md` and `README.md`.
2. **Not routed.**
   - The runtime-session in-run repair provider (`service.ts` near line 2396); FluxNode runs never reach it.
   - The standing result-check authorization, which judges on its own key's model.
3. **Context windows.** Every role uses the explore model's token limits. A smaller-window judge model
   given an oversized request would refuse it by size, which reads as not judged. This is untested.

## Checkpoint 6 (2026-11-11): the secret gaps closed (activity stream, pipelines, invariant test)

**1. The chat activity stream (worker; the lead granted the activity code).**
- One seam: `AutomationStudioActivityHub.publish` (`pkg/runtime/activity/hub.ts`) passes every event
  through `automationStudioWithoutRunSecrets` before it is cut to size.
- `publish` is the only path to the hub's storage and its subscribers, and `emit.ts:26` is its only caller.
- With no secrets in context, an event is unchanged.
- Test: `pkg/runtime/activity/tests/hub-secrets.test.ts` (3). It covers a secret withheld in text and
  nested fields, two concurrent runs each withholding only their own, and events emitted after awaits
  and from timers.
- An event emitted outside every run context carries no known secret, so there is nothing to withhold.

**2. Pipeline-mapped secrets (worker).**
- When a record field is mapped into a FluxNode's secret input, its value joins the pipeline run's
  secrets before the call. From then on the pipeline's events, result, outputs, lineage and stored
  datasets are withheld. Files:
  - `service/fluxnode/pipeline/{pipeline-secrets,withheld-dataset-writer,secret-safe-state}.ts` (new);
  - `datasets.ts`, `fluxnode-flow-caller.ts`, `run-fluxnode-pipeline.ts`;
  - `secrets/{withheld-data,withheld-records}.ts` (new);
  - `fluxnode-run.ts`.
- **What the pipeline remembers between runs:**
  - a call to a FluxNode with a mapped secret is never cached, since its cache key would hold the secret
    in plain text;
  - an incremental key that reads the secret's source field is never stored, so that step processes
    every record each run.

  Neither adds a way for a run to end.
- Test: `service/fluxnode/pipeline/tests/pipeline-secrets.test.ts`.
- The developer's own sinks (webhook, file) still receive records as the developer defined them, and
  `pkg/framework/automation-service/service/pipelines/map-step.ts` (not W3's) still builds plain keys in
  memory. Only the `PipelineState` wrapper keeps them from being stored.

**3. Invariant test (worker).**
- `service/fluxnode/tests/secret-invariant.test.ts` runs a FluxNode with a secret input through explore
  and replay on the scripted library lane. It then asserts the value appears nowhere in:
  - the caller `inputs` the attempt received;
  - every file under the service's data directory;
  - the attempt store's records, which are what W1's `attempt/keep.ts` and `flow-run/input-valued-steps.ts`
    write.
- The worker proved it fails (2 failed) when `run-fluxnode.ts` was temporarily changed to pass the
  secret back into the caller inputs, then restored it.

**Checks run by me:**
- `pnpm exec vitest run src/framework/automation-service/service/fluxnode src/runtime/activity src/runtime/automation-activity src/runtime/run-secrets src/framework/automation-service/service/answer-first/flow-run/tests/input-bound-steps.test.ts src/runtime/llm/step-log src/engine/automation/trace`
  (fluxiq) -> 91 files, 678 passed
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (531 warning(s), 969 baselined).`
- `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).`,
  `Deterministic framework reference is current.` (A first run hit my own 150 s shell timeout, exit 143,
  while the machine was busy; the re-run without it passed.)
- fluxiq tsc through the slot. The first run found two TS2352 errors, both in the new tests:
  - `secret-invariant.test.ts:73` cast caller options with `check: undefined`; it now keeps
    `Omit<..., "check" | "personAsk">` and destructures them away.
  - `hub-secrets.test.ts:6` used a wrong `step` shape behind a cast; it now uses `{ index, count, label }`
    with no cast.

  Both tests still pass (5/5). The re-run gave **`TSC_EXIT=0`**.

**Workers:**

| Worker | Tier | Outcome | What I verified |
| --- | --- | --- | --- |
| secret-activity | worker | Done | Re-ran its tests; read the `hub.ts` seam and its single caller |
| secret-pipeline-invariant | worker | Done | Re-ran its tests; read the cache and incremental-key policy; the audit violation another worker saw in its test is gone |

## Checkpoint 5 (2026-11-11): tsc fixes, secret inputs (security fix), one typecheck over 3-5

**The lead's two typecheck errors are fixed:**
- `pkg/runtime/llm/harness/tests/run.test.ts`: imports `AutomationStudioLlmTaskRequest` from `../task-request.ts`.
- `pkg/runtime/result-verification/flow-less/tests/default-question.test.ts:7`: leaves `askedAgain` out
  instead of passing `undefined`.

**Secret inputs (worker-heavy, approved by the lead):**
- **Declaring one.** `format: "secret"` in JSON Schema, or `secret()` in the SDK. It is allowed only on a
  string directly under a FluxNode's `inputs.properties`. Each misuse is refused by name:
  - an output, a nested field, an `anyOf` branch, pipeline inputs or a data-step type:
    `type_schema.secret_not_input`;
  - `default`, `examples`, `const` or `enum` beside it: `type_schema.secret_with_value`;
  - a name a step cannot bind: `type_schema.secret_bad_name`.
- **Kept out of recorded inputs.** Secrets never enter `caller.inputs`; they sit in a per-run frame,
  `pkg/runtime/run-secrets/`, which uses AsyncLocalStorage, with the registry holding only the instance.
  If that frame is lost, a bound step fails to resolve. It never types a remembered secret.
- **The model never sees the value.** The goal names the input, and the model binds the step that needs
  it by name. Core puts the value in when the step runs, during exploration and on replay.
  - Exploration did not resolve bindings against the caller's values, contrary to my brief.
  - The worker fixed that with one seam in `runtime/llm/node-tools/replay/span.ts`.
- **The saved Flow and the export hold no value.**
  - `answer-first/flow-run/input-bound-steps.ts` (the lead's grant) binds with no fallback, and strips the
    fallback from any existing secret binding, including when the model typed the secret literally.
  - `flow-export.ts` strips such a default again, as a second check.
- **Everything that leaves the run shows `[withheld]`:** model requests, step files, saved command
  attempts, traces, FluxNode events and the result. The developer's check also receives the inputs with
  the secret withheld.
- **Files changed outside W3's paths** (unowned seams, plus the granted file):
  - `pkg/runtime/run-secrets/**` (new);
  - `runtime/llm/harness/run.ts`;
  - `runtime/llm/step-log/screen.ts`;
  - `runtime/service.ts`;
  - `engine/automation/trace/withholding.ts`;
  - `engine/automation/graph-run.ts`;
  - `runtime/llm/node-tools/replay/span.ts`;
  - `answer-first/flow-run/input-bound-steps.ts` (granted).

  No W1 or W2 path beyond the grant was touched.

**Integration I did myself:**
- **A minimum length for secrets.** A 1-3 character secret would have blanked ordinary text everywhere the
  model reads it. A secret value is now at least 4 characters, refused as an input that does not fit with
  a message that says why. The change is in `contracts/.../type-schema/{formats.ts,validate.ts}` and a new
  `secret-min-length.ts`; tests are in `type-schema/tests/formats.test.ts` and docs in `reference/spec.md`.
- **A concurrency test for the secrets frame** (`pkg/runtime/run-secrets/tests/store.test.ts`): two
  interleaved runs keep their own secrets; inside an inner run the outer run's secrets are kept with the
  inner name winning; nothing is set outside a run.

**Checks run by me, checkpoint 5 (covering checkpoints 3, 4 and 5 together):**
- fluxiq: `pnpm exec vitest run src/framework/automation-service/service/fluxnode src/framework/automation-service/service/answer-first/flow-run/tests/input-bound-steps.test.ts src/runtime/run-secrets src/runtime/run-overrides src/runtime/llm/step-log src/runtime/llm/harness src/runtime/llm/node-tools src/engine/automation/trace src/engine/automation/defensive src/server/fluxnode-api src/runtime/result-verification/flow-less`
  -> 132 files, 1,208 passed
- `pnpm exec vitest run src/runtime/run-secrets` -> 2 files, 6 passed
- contracts: `pnpm exec vitest run` -> 105 files, 889 passed; `pnpm check` -> rebuilt, no errors
- sdk: `pnpm exec vitest run` -> 20 files, 103 passed, 2 skipped; `pnpm check` -> rebuilt, no errors
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (530 warning(s), 969 baselined).`
- `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).`, `Deterministic framework reference is current.`
- fluxiq tsc through the slot (`heavy-slot.mjs run t899-w3 -- "... tsc --noEmit; echo TSC_EXIT=$?"`) -> first run: one error, TS2345 in `service/fluxnode/tests/secret-inputs.test.ts:57` (the export was
  called with `{}` where the parsed request needs `pin`). I fixed it to `{ pin: false }`, the test still
  passes (2/2), and the re-run gave **`TSC_EXIT=0`**. Workers now run the fluxiq tsc through the slot at
  every checked point.

**Not covered by the secret fix, and who owns each gap:**
1. **Run datasets.** If a site displays a secret, the rows the engine stores hold it as given. The
   result's outputs are withheld, but the dataset is written by W1's `rows/**`. The fix: apply the run's
   secret texts (`automationStudioRunSecrets()`) where rows are stored.
2. **The in-memory chat activity stream** is not withheld; FluxNode step events are. It is in memory and
   seen only by the owner's panel. The fix belongs where activity is published (not W3).
3. **Pipelines.** A pipeline record mapped into a FluxNode's secret input is held as given by the
   pipeline layer, which has that data from the developer's own input already.
4. **No live run** has checked that a real model follows the goal wording to bind a secret by name.
5. **Risk for W1:** `input-valued-steps.ts` copies caller input values into in-memory fallbacks, and
   `keep.ts` saves those steps to the attempt store each round. That is safe only because secrets are kept
   out of `caller.inputs`. W1 must not put them back.

**Open items for integration (the lead applies these when t902 lands):**
1. `pkg/framework/automation-service/service/fluxnode/create-fluxnode-service.ts:79` becomes
   `fetch: source.pipelineFetch ?? createOutboundFetch(),`, importing `createOutboundFetch` from
   `pkg/runtime/outbound-address/node`. This replaces `postWithGlobalFetch` (`:204-205`), so a hosted
   engine's webhook sink passes W6's address guard.
2. `pkg/framework/automation-service/service/fluxnode/events/person-sink.ts:22-33`
   (`fluxNodePersonSink`): pass `settleBy` on the FluxNode sink, as t902's handler-chain sink type defines it.
3. `pkg/framework/automation-service/service/fluxnode/create-fluxnode-service.ts:128` (`async answer`,
   where the FluxNode program answers): import and use `AUTOMATION_STUDIO_FLUXNODE_PROGRAM_ACTOR` from
   t902's module.

**Headless `model_key_locked` (P3b lane), the exact files:**
- `pkg/framework/automation-service/service/fluxnode/create-fluxnode-service.ts:59`: the fixed caller
  `{ actorUserId: "fluxnode.owner", actorSessionId: "fluxnode.open-mode" }`, used at `:72`;
- `pkg/runtime/models/secrets/session-key.ts:55-85`: how a caller's session opens an `llm` Secret Key;
- `pkg/programs/_shared/runtime.ts:280-300`: the key resolution for a program caller;
- `pkg/runtime/models/secrets/locked-wait.ts:12` and
  `pkg/framework/automation-service/service/answer-first/person-waits/key-wait.ts:23`: where the run waits
  as `model_key_locked`;
- `pkg/runtime/answer-first/pre-model/table.ts:36` and `service/fluxnode/result-of.ts:29`: the words shown.

The owner vault wrap (K design) must let the `fluxnode.owner` caller open the owner's key headless.

## Checkpoint 4 (2026-11-10): the docs worker's three findings fixed

**1. Model-key step in the quickstart.**
- `docs/fluxnodes/README.md` now says where the key lives. There is no environment variable or file for
  it: it is a Secret Keys entry of kind `llm` in the engine's data directory (`session-key.ts:55-85`,
  `programs/_shared/runtime.ts:280-300`).
- It also says that `FLUXIQ_LLM_DEFAULT_MODEL` picks only the model.
- It quotes what a missing key and a locked key do (`pre-model/table.ts:36`, `fluxnode/result-of.ts:29`).
- **Finding for the lead (likely; not run end to end):** FluxNode runs call models as the fixed caller
  `fluxnode.owner` (`create-fluxnode-service.ts:58`), and the owner vault wrap from the keys design (P3b)
  is not built. So a headless `fluxiq dev` run will likely wait with `model_key_locked` until a person
  unlocks the key. The docs say so and say how to resume. The root fix is the P3b owner key wrap,
  outside W3.

**2. The five unemitted API codes, decided per code:**

| Code | Decision | Why | Test |
| --- | --- | --- | --- |
| `invalid_spec` | **Emitted** (400) when every body issue is at `/spec` or below; otherwise `invalid_request` | A bad spec was answered as `invalid_request` | `server/fluxnode-api/tests/body-refusal-code.test.ts`; three cases in `api-handler.test.ts` |
| `no_host` | **Removed** | `start` answers once the run is under way. A missing browser is met by the run, not by the call, so a refusal would be a new failure ending | contracts `http/tests/api.test.ts`: the contract names only codes the engine or SDK can meet |
| `rate_limited` | **Removed** | The FluxNode HTTP API has no rate limit; Core's only limit is the client-gateway WebSocket | same |
| `unavailable` | **Removed** | Nothing answers "not now": the listener is up, or the SDK meets a `connection` error | same |
| `unauthenticated` | **Kept** (401) | The open-mode local engine never sends it, and the docs say so. The SDK's session protocol is built on it: it renews and repeats once on 401 (`transport.ts:40`), with `create-session.ts` and the fake engine. A key-requiring engine (P3b local, or W5 hosted) answers it | `api.test.ts` asserts 401; existing transport and session tests |

- **Follow-on I removed:** the error body's `retryAfterMs` was set by nothing once `rate_limited` was
  gone. It is removed from the contract (`run/error.ts`), the server (`http-refusal.ts`, the
  `Retry-After` header in `write-fluxnode-refusal.ts`), the service refusal type (`fluxnode-service.ts`),
  the SDK (`transport.ts`, `FluxNodeApiError`) and the docs. The client gateway's drain `retryAfterMs` is
  a different contract and is real; it is untouched.

**3. Pinning enforced (N8; worker-heavy).**
- **Behaviour.**
  - A pinned FluxNode replays exactly the pinned version.
  - The run still works on until its result or its budget is gone, so no new failure ending.
  - A repair or exploration that would change the pinned Flow is refused as a change: it is held as a
    proposal.
  - The named code `fluxnode.pinned_change_held` is on `result.pinned.held` (with the proposal's id, Flow
    id, steps digest, run, path and time), and a skipped `step` event carries the same code.
- **Adopting.**
  - Pinning again adopts the newest proposal, or the one named:
    `fluxiq pin <name> --proposal <id>`, or `{ "pin": true, "proposal": "<id>" }`.
  - A proposal that is not waiting is refused as `invalid_request` with issue
    `export_flow.unknown_proposal`.
  - A proposal sent without `pin` is refused with issue `export_flow.proposal_without_pin`.
- **Seam (no W1 or engine file).**
  - A pinned `auto` run uses its own task key, `fluxnode:<name>:<hash>:pinned`, whose saved Flow is set to
    the pinned one before each run.
  - The run works in a separate `<name> (proposals)` Flow.
  - Any changed saved Flow afterwards becomes a proposal.
  - A pin that lands mid-run holds that run's change too.
- **Persistence.**
  - The pin is kept in the Flow's `metadata.fluxNode`: the pinned saved Flow, up to 20 proposals, and
    version digests. It survives a restart.
  - The in-memory pin in `run-registry` is gone.
- **Tests:** `service/fluxnode/tests/pinning.test.ts` covers:
  - a broken replay still ends `achieved` with the pinned Flow unchanged and the change held;
  - a pinned replay at zero calls runs the pinned version while a proposal waits;
  - both refusals;
  - adopting gives v2, and the next replay runs it;
  - a restart keeps the pin;
  - a pin that lands mid-run.
- **New docs page:** `docs/fluxnodes/guides/pinning.md`.
- **Review UI:** not needed for the Core refusal. A review screen would need:
  - a list of pinned FluxNodes with waiting-proposal counts (a list endpoint is new API work);
  - a side-by-side diff of `flow.saved` against `flow.proposals[id]`;
  - a link to each proposal's run;
  - Adopt and Keep pinned actions. Dismissing a proposal has no API yet.

  That belongs to W4/W5's panel.

**Integration I did myself this checkpoint:**
- Moved the pin schemas out of `run/result.ts` (9 exported values, over the advisory 8) into
  `run/pinned.ts`. `FLUXNODE_RUN_PATH_KINDS` moved into `run/path-kinds.ts` to avoid an import cycle,
  and both are exported from the run barrel.
- SDK `exportFlow(name, { proposal })` and `fluxiq pin --proposal <id>` (`client/fluxiq.ts`,
  `cli/pin-command.ts`, `cli/help-text.ts`), with a CLI test that the id is sent
  (`cli/tests/run-cli.test.ts`).
- The `retryAfterMs` removal above.
- The pinning rows in `reference/errors.md` (a new "Pin codes" section) and `reference/http-api.md`
  (export body and fields, the result's `pinned`); the `--proposal` line in the pin guide.

**For the lead (decisions or other owners):**
1. **Secrets in the pinned file (security; not W3's code).**
   - FluxNode inputs have no secret format.
   - The attempt learns each input value as a step's default (W1's `flow-run/input-bound-steps.ts`).
   - So a credential passed as an input is stored in the Flow, and written verbatim into both the export's
     `artifact` (as it already was before pinning) and `flow.saved`. That export is the file a developer
     commits to a repository.
   - **Recommendation:** a `secret` input format in the contract whose values are never saved as step
     defaults or exported. This needs a W1 edit in `input-bound-steps.ts`.
2. **W1 findings from the pinning tests.**
   - A hand fix after a broken replay is reported as path `explored`, not `repaired`.
   - The fixed Flow keeps the broken step and adds the new one after it, so an adopted proposal still
     breaks while the site does.
3. **While a pinned Flow keeps breaking, every run repairs it again** and pays for the model calls each
   time. Starting from the waiting proposal would save that, but would bend "replays exactly the pinned
   version". I kept the rule; the pin guide says so.

**Commands run by me (checkpoint 4):**
- `pnpm exec vitest run src/server/fluxnode-api src/framework/automation-service/service/fluxnode src/runtime/run-overrides src/engine/automation/defensive`
  (fluxiq) -> 22 files, 202 passed
- contracts `pnpm exec vitest run src/fluxnode` -> 26 files, 144 passed; `pnpm check` -> rebuilt, no errors
- sdk `pnpm exec vitest run` -> 19 files, 99 passed, 2 skipped; `pnpm check` -> rebuilt, no errors
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (530 warning(s), 969 baselined).`
- `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).`, `Deterministic framework reference is current.`
- **Not run:** the fluxiq tsc. That is a heavy job, and the lead asked for none this phase.

**Workers this phase:**

| Worker | Tier | Outcome | What I verified |
| --- | --- | --- | --- |
| pinning | worker-heavy | Done | Re-ran service, contracts and SDK tests; read the seam; finished its SDK `--proposal` gap, the `result.ts` split and its docs rows |
| error-codes | worker | Done | Re-ran server, contracts and SDK tests and docs:check; removed the `retryAfterMs` it left dead |

## Checkpoint 3 (2026-11-10): prompts, tools, judge and deadlines wired; F4 docs written

**Outcome:** every override in the contract now changes the run, except two:
- per-role `models`, which waits for t885's `service.ts` lines;
- `pace`, which W2 reads from the frame.

The developer docs exist and pass Core's docs check.

**Prompts and tools (B3a, worker):**
- One helper, `automationStudioOverriddenText(kind, id, default)` in
  `pkg/runtime/run-overrides/overridden-text.ts`, applies an append or a replacement.
- As defence in depth, it ignores a replacement on an append-only id, and any entry on a locked id,
  reading the contract's policies.
- It wraps every open and append-only explorer section where it is pushed:
  - `provider-task/system-prompt.ts`;
  - the keyed guidance paragraphs in `answer-first/guidance/` (the joined text is unchanged);
  - `domain.instructions` in `system-instructions.ts`.
- It also wraps every tool description at `request-messages.ts`; an input schema is never touched.
- `judgeCriteria` follow the judge's question (`judge-criteria-text.ts`, `flow-less/judged-summary.ts`).
- The digest is in `promptVersion` (`harness/context-packet.ts`).
- The default wording was pinned by tests before any edit, and is unchanged with no frame and with an
  empty frame (file snapshots under `provider-task/tests/__snapshots__` and `flow-less/tests/__snapshots__`).
- No explorer section id needed renaming.

**Deadlines (B3b, worker):**
- `llmCallMs` wins in `harness/run.ts`, including over answer-first's explicit timeout.
- `judgeMs` is applied in `flow-less/judge.ts`. Its default is the larger of 120 s and (judge calls ×
  call deadline) + 30 s.
- `modelSilence` is read in `answer-first/keep-going/backoff.ts`. It changes the waits between
  attempts and never limits how many there are.
- `personWaitMs`: Core's own 300 s ask expiry used to cut a raised person wait short on the
  flow-stage person check. A frame value now governs it in `events/person-sink.ts`, and the robot-check
  pause still pauses and raises `person_needed`. With no frame, the old minimum holds.

**F4 docs (worker), 16 pages under `docs/fluxnodes/`, linked from `docs/README.md`:**
- `README.md`, with a quickstart;
- `reference/{spec,options,overrides,http-api,errors,limits}.md`;
- `guides/{customizing-prompts,retries-and-deadlines,judging-results,choosing-models,safety}.md`;
- `examples/{scraping-with-check,custom-prompts-and-criteria,pipeline,per-run-overrides-http}.md`.

**Integration I did myself:**
- **Wired `judge.question`** (open) in `flow-less/judged-summary.ts`. B3a had wired only the criteria.
  Test: `flow-less/tests/default-question.test.ts`, covering append, replace, and criteria after a
  replacement.
- **Wired `core.in_run_repair`** (append-only) in `harness/context-packet.ts`, where the repair
  instruction is added. Test: `harness/tests/in-run-repair-slot.test.ts`; an append lands and a
  replacement is ignored.
- **Fixed a defect the docs writer found:** `canonicalFluxNodeSpec` used a fixed list of option keys,
  so t898's `humanness` was missing. A changed humanness under the same hash was therefore ignored on
  re-registration. It now copies every option the spec gives (`contracts/.../spec/hash.ts`), with a
  test in `spec/tests/hash.test.ts`.
- **Per-run overrides on a pipeline run** were accepted and silently ignored. They are now refused by
  name, `run_request.overrides_on_pipeline`:
  - in the contract, for an inline pipeline (`run/request.ts`, sentence in
    `run/pipeline-overrides-message.ts`);
  - in the service, for a name that holds a pipeline (`create-fluxnode-service.ts`, as
    `invalid_request` with that issue);
  - in the SDK, before any request (`build-pipeline-run-request.ts`, `SdkErrorCode`).

  The tests are in contracts `run/tests/request.test.ts`, `pipeline/tests/pipeline-runs.test.ts`, and
  sdk `client/tests/run-overrides.test.ts`, which now expects the refusal. A pipeline run still takes
  `options`. A FluxNode it calls keeps its own declared overrides.
- **`ledger.ts:109` (granted).** The trace reports the run's scaled wait budget. Test in
  `defensive/tests/retry-wait.test.ts`: 7 attempts gives 600 s, `perRunMs` 42 s gives 42 s, and no
  frame gives 300 s.
- **Docs reconciled with the code:**
  - the availability list in `reference/overrides.md`;
  - the judge deadline formula;
  - the person wait's interplay with ask expiry;
  - the pipeline refusal in `examples/pipeline.md` and `reference/errors.md`.

**Commands run by me (checkpoint 3):**
- `pnpm exec vitest run src/runtime/run-overrides src/runtime/llm/provider-task src/runtime/llm/harness src/runtime/answer-first/guidance src/runtime/answer-first/keep-going src/runtime/result-verification/flow-less src/framework/automation-service/service/fluxnode src/engine/automation/tests/retry-policy.test.ts src/engine/automation/outside-graph src/engine/automation/defensive`
  (packages/fluxiq) -> 92 files, 771 passed
- `pnpm exec vitest run src/fluxnode` (contracts) -> 26 files, 142 passed; `src/fluxnode/spec` -> 28 passed
  after the humanness test
- `pnpm exec vitest run` (sdk) -> 19 files, 98 passed, 2 skipped
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (530 warning(s), 969 baselined).`
- `pnpm docs:check` -> exit 0, `structure-audit: passed (0 warning(s), 0 baselined).`,
  `Deterministic framework reference is current.`
- Through the heavy slot: fluxiq tsc, contracts check and sdk check were **not run**. I queued them, but both slots stayed held (lead-sweep since 02:39Z, t885 since 03:17Z) with t902 and t900 ahead of me, so I cancelled the job rather than leave it unread in the queue. The vitest runs above load every touched file through esbuild; they do not type-check.

**Workers this phase:**

| Worker | Tier | Outcome | What I verified |
| --- | --- | --- | --- |
| b3a-prompts | worker | Partial: `judge.question` and `core.in_run_repair` not wired; no typecheck (slot busy) | Re-ran its folders inside the 771; wired both myself |
| b3b-deadlines | worker | Done | Re-ran its folders; read its person-sink reasoning. Its report's `judgeMs` table cell is garbled; the formula above and in the docs is from `deadline.ts:55-58` |
| f4-docs | worker | Done | Re-ran `pnpm docs:check`; fixed the stale availability and pipeline text, and its two code findings |

**Still open after checkpoint 3:**
1. **Per-role model routing** at `service.ts` waits for t885's lines in dev. The contract and docs
   already describe `models`; until it lands, the docs say `options.model` chooses one model for every
   role.
2. **Panel presses** (unchanged, queued for after W1). Files are in checkpoint 2's open item 2.
3. **The judge digest is kept in memory** (checkpoint 2, item 3).
4. **No whole-run 7-dispatch test** (checkpoint 2, item 4).
5. **Docs findings for later, not defects in W3's code:**
   - pinning is recorded but not enforced;
   - the API codes `invalid_spec`, `no_host`, `rate_limited`, `unavailable` and `unauthenticated` are
     never emitted by the local handler;
   - the model-key setup step is not in the quickstart, because the docs writer could not find where
     it is set.
6. **Versions** are held for the lead, as instructed.

## Checkpoint 2 (2026-11-10): F1 done; the overrides reach every run

**Outcome:** F1 is done. A FluxNode's `retries` now sets the attempt count on every path. The
overrides contract, the run frame, the FluxNode service plumbing and the SDK surface are done too.
What remains is F2/F3's prompt, tool, judge and deadline seams, the per-role model, and the F4 docs.

**How F1 works now:**
- `run-fluxnode.ts` always runs the attempt inside `runWithAutomationStudioRunOverrides(frame, ...)`,
  with `frame.nodeAttempts = retries + 1`.
- The store is `pkg/runtime/run-overrides/store.ts`, an AsyncLocalStorage. The `Symbol.for` registry
  holds only that instance, never a frame (the lead's binding condition).
- The engine reads the frame through one helper, `automationStudioRunNodeRetryPolicy()`
  (`retry-policy.ts`):
  - graph runs use it as the floor after declarations;
  - single nodes outside a graph use it in `outside-graph/retries.ts`, which is how the domain's
    exploration and looks run.
- The wait allowances scale with the attempt count, or come from `retryWaits` (`defensive/retry-wait.ts`).
- With no frame, behaviour is today's: every existing test passes unchanged.

**Concurrency proof (lead's condition):**
- `engine/automation/tests/retry-policy.test.ts` runs two real graph runs at once, with frames of 7 and
  5 attempts, and each gets its own count. It also covers 4 attempts with no frame, 101 attempts, and
  waits scaled to 180 s.
- `outside-graph/tests/run-overrides.test.ts` does the same for 7 vs 5 concurrent dispatches.
- `service/fluxnode/tests/run-overrides.test.ts` runs two concurrent FluxNode runs (retries 4 and 9),
  which see 5 and 10 attempts.
- `runtime/run-overrides/tests/store.test.ts` proves that two copies of the module share one store,
  via `vi.resetModules`.

**Pace shape for W2 (answer to the lead):** `automationStudioRunOverrides()?.pace` is
`{ readonly minStepGapMs?: number }`. It is the least gap between two steps in ms, an integer from 0 to
600,000, absent meaning no override. It is imported from `pkg/runtime/run-overrides/index.ts`. The type
is `AutomationStudioRunOverrides["pace"]` in `pkg/runtime/run-overrides/frame.ts`.

**Humanness:** `caller-options.ts` passes `humanness` through. That line fails to typecheck until t898's
`11252f094` merges into this tree, as expected (see the typecheck below). t898 also edits
`contracts/src/fluxnode/spec/options.ts`, where B1 moved the model-id regex into
`spec/model-id-pattern.ts`, so expect a small merge there.

## What changed

- **Contract** (`packages/contracts`):
  - `fluxnode/overrides/**` (new): section ids and policies, core tool policies, the strict bounded
    schema with named refusals, layered resolution, `digest` and `judgeDigest`, and tests.
  - `spec/model-id-pattern.ts` (new).
  - `spec/{definition,hash,index,options}.ts`: `overrides` on the spec, in the canonical form, not in
    the identity hash.
  - `run/request.ts`: `overrides`, plus refusals `run_request.options_on_resume` and
    `run_request.overrides_on_resume`.
  - `run/result.ts`: optional `overridesDigest`.
  - The barrel and tests.
- **Run frame and engine** (`pkg`):
  - `runtime/run-overrides/**` (new): `frame.ts`, `store.ts`, `run-with.ts`, `read.ts`, `index.ts`, tests.
  - `engine/automation/retry-policy.ts`, `outside-graph/retries.ts`, `defensive/retry-wait.ts`, and
    their tests.
- **FluxNode service** (`pkg/framework/automation-service/service/fluxnode`):
  - `run-fluxnode.ts`: resolves overrides, sets the frame, uses the person wait, records the judge digest.
  - `overrides-frame.ts` (new).
  - `caller-options.ts`: humanness; judge `always` when the judge digest changed, unless the judge is off.
  - `fluxnode-run.ts`, `create-fluxnode-service.ts`, `run-registry.ts`, `result-of.ts`: carried
    overrides (never passed to a child run; kept on resume) and the digest on the result.
  - `owner-flows.ts`: a held spec follows the incoming spec under the same name and hash. It also
    passes the domain to `listProjects`, so a domain-scoped owner project is found again after a restart.
  - Tests.
- **SDK** (`packages/sdk`):
  - `defineFluxNode({ overrides })`.
  - `RunOptions.overrides` is widened and split by key into `request.options` and `request.overrides`.
    The key sets are disjoint, so existing calls are unchanged.
  - `resume()` and `resumePipeline()` take `ResumeOptions`. A JS caller who passes options or overrides
    gets an `SdkError` with the contract's code before any request is sent.
  - Re-exports `FLUXNODE_PROMPT_SECTIONS`, `FluxNodePromptSectionId` and the override types.
  - New files: `client/{split-run-overrides,resume-options}.ts`, `define/overrides-input.ts`, and tests.

## Per-worker summary

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| design | worker-heavy | F1 cause and fix; F2 inventory, contract and briefs | Done | Re-read every cited line for F1 and the held spec |
| b1-contract | worker | overrides contract and resume refusals | Done | Re-ran tests and check; read the refusals, merge and schema; my fixes are below |
| b4a-held-spec | worker | stale held spec on re-registration | Done | Re-ran tests; read the diff, including its `listProjects(domain)` fix (`service.ts:3715` signature) |
| b2-frame-f1 | worker-heavy | frame plus F1 in the engine | Partial: one reported figure outside its paths (open item 1) | Re-ran its tests; the typecheck showed no errors in its files |
| b4b-service | worker | FluxNode service plumbing | Partial: it had not re-run the full directory | I re-ran the directory (all pass); read the frame wrap and the judge rule; fixed its TS2375 |
| sdk | worker | SDK overrides and resume | Done | Re-ran its tests and check |

Worker reports: `reports/w3-fluxnode-overrides/{design,b1-contract,b4a-held-spec,b2-frame-f1,b4b-service,sdk}.md`.

## Integration changes I made

- `contracts/.../overrides/section-ids.ts`:
  - dropped the `judge.criteria` section, which duplicated the `judgeCriteria` field;
  - exported the `FluxNodePromptSectionId` literal union;
  - updated the test's count.
- `pkg/runtime/run-overrides/{frame,store,run-with,read,index}.ts`: wrote the stable interface before
  dispatch, so B2, B4b and the SDK built against one module. B2 left the source unchanged.
- `service/fluxnode/overrides-frame.ts`: absent leaves are left out instead of passed as `undefined`
  (TS2375 under `exactOptionalPropertyTypes`).

## Commands run by me and observed results

- `pnpm exec vitest run src/framework/automation-service/service/fluxnode src/runtime/run-overrides src/engine/automation/tests/retry-policy.test.ts src/engine/automation/outside-graph src/engine/automation/defensive`
  (packages/fluxiq) -> 22 files, 192 passed
- `pnpm exec vitest run src/fluxnode` (packages/contracts) -> 26 files, 140 passed
- `pnpm check` (contracts, after my edit) -> exit 0
- `pnpm test` (packages/sdk) -> 19 files, 98 passed, 2 skipped; `pnpm check` (sdk) -> exit 0
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (529 warning(s), 969 baselined).`
- fluxiq typecheck, run through the heavy slot as
  `node .../heavy-slot.mjs run t899-w3 -- "cd packages/fluxiq && node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit"`
  -> exactly two errors, both expected until t898 merges:
  `caller-options.ts(51,17)` and `(51,69)`: TS2339 Property 'humanness' does not exist on type
  'FluxNodeResolvedOptions'. Nothing else fails.

## Open items

1. **Grant needed, one line, reporting only.**
   - `pkg/engine/automation/defensive/ledger.ts:109` reports the fixed 300 s as `trace.defence.waitBudgetMs`.
   - Whether the run keeps absorbing faults already uses the scaled allowance; only the reported figure
     is stale.
   - The change: import `automationStudioRunRetryWaitAllowanceMs` from `./retry-wait.ts` (line 2) and
     set `waitBudgetMs: automationStudioRunRetryWaitAllowanceMs()` (line 109). With no frame it is
     300,000, so no test changes. I did not make it, because it is outside the grant.
2. **Panel presses (queued until W1's lanes land).**
   - Carry on and Run again on a FluxNode attempt run under kept caller options, outside `runFluxNode`,
     so without the frame.
   - Files: `pkg/framework/automation-service/service/answer-first/caller/options.ts:12` (accept the
     kept frame), `caller/kept.ts:8`, `flow-bootstrap-commands/contracts.ts:184,216` (a kept
     `runOverrides` field on caller and kept options), and `answer-first/attempt/run-attempt.ts:96`
     (set the frame from the kept options around the attempt; W1).
3. **Judge digest is in memory.** After an engine restart, a Flow with judge criteria is judged once
   more on its next replay: one extra judge call, never a failure. Persisting it with the learned Flow
   (owner-flows metadata) can follow.
4. **Not yet written:** a scripted library-lane test showing `retries: 6` gives 7 dispatches through a
   whole FluxNode run. The library lane has no fault injection. The chain is proven in two halves: the
   service sets `nodeAttempts = retries + 1` (service test), and the engine honours the frame on both
   paths (engine tests).
5. **Package versions are not bumped yet.** Proposed in the final unit: contracts minor (0.19.0),
   sdk minor (0.3.0), fluxiq minor.

## Next (needs the merge of dev with t898 and t885 into this tree)

- **B3a (worker):** prompt and tool seams, by injection; the default wording stays byte-identical.
  - Files: `provider-task/system-prompt.ts`, `provider-task/request-messages.ts`,
    `runtime/answer-first/guidance/{guidance,system-instructions}.ts`, `diagnosis-instructions.ts`,
    `flow-less/judged-summary.ts` (question and criteria), `harness/context-packet.ts` (digest in
    `promptVersion`).
  - It also confirms B1's explorer section ids against the paragraphs.
- **B3b (worker):** deadlines in `harness/run.ts`, `flow-less/judge.ts` and `keep-going/backoff-schedule.ts`.
- **B5 (worker-heavy):** per-role models at `service.ts`'s model routing, after t885's service.ts lines land.
- **F4 (worker):** FluxNode docs under Core `docs/`, checked by `pnpm docs:check`.
