# W3 t899: secret inputs for FluxNodes

## Outcome

Partial. All the work and every narrow check is done and passing. The fluxiq typecheck through the
heavy-slot queue never ran: it was still waiting at position 4 of 8 when I had to hand back, and
handing back ends the queued job. The supervisor must run it.

A FluxNode input may be declared `format: "secret"` (`secret()` in the SDK). Its value is never
sent to a model, never saved as a step default, never in a Flow export or pinned copy, and shows
`[withheld]` in step files, traces, saved command attempts, FluxNode events and the run result.
The scripted library lane proves it end to end, including a scan of every file Core wrote.

## What changed and why

### Design decisions

1. **Secrets travel beside the run, not in its inputs.** `run-fluxnode.ts` gives the attempt
   only the non-secret inputs and sets an AsyncLocalStorage frame of secret values
   (`runtime/run-secrets/`, the pattern of `runtime/run-overrides/`). Anything that records or
   persists the attempt's caller inputs therefore never holds a secret. If the frame is lost, a
   bound step has nothing to type and fails. It never falls back to typing a stored secret.
2. **The goal names the input; the binding resolves it.** The secret placeholder is filled with
   `the secret "<name>" (withheld from you: bind the written step that needs it to "<name>" by
   name, and Core puts it in when the step runs)`. A model writes the existing `$input` form.
   The engine resolves `$state.path` from the frame wherever a value resolves: graph runs
   (`graph-run.ts` fills missing input names from the frame) and the build's own test of a
   written step (`replay/span.ts` adds the frame to the resolution state). The frame value wins
   over the model's stand-in test value, because state is read before a fallback.
   - **Correction to the brief's premise:** exploration did **not** resolve `$input` against the
     caller's inputs. `rounds.ts:54` only re-values *saved* steps at round start
     (`input-valued-steps.ts`). A newly written step's test typed its `test` fallback, and a
     run-now call refuses bindings outright. Hence the `span.ts` seam.
   - **The wording avoids action words.** The first wording (with `{"$input": ...}`, "entered")
     made the build stop before any model call ("The steps this needs are not available here").
     `required-terms.ts` tokenises the instruction, and "input" or "enter" demand a fill node.
     The current words add no such need.
3. **Saved Flow** (`input-bound-steps.ts`, granted). The run's secrets join the bindable values.
   A value equal to a secret binds to its name with **no fallback**. A binding that is already to
   a secret name, or whose fallback equals a secret, loses its fallback, which drops the model's
   stand-in. A binding with no fallback is a plain state path: it is not listed among the draft's
   Flow inputs, and assembly and replay accept it (proven by the lane).
4. **Withholding at the existing chokepoints**, all keyed on the frame:
   - model requests: `harness/run.ts` passes the packed context through
     `automationStudioWithoutRunSecrets`. That covers every harness call: decisions, the judge,
     annotate and diagnose. I chose `run.ts` over `context-packet.ts` because it is a one-line
     wrap at the single provider path.
   - step files: `step-log/screen.ts` (every step-log write goes through it);
   - saved command attempts: `runtime/service.ts` dispatch unions the frame into `withheldValues`;
   - traces: `trace/withholding.ts` seeds its set from the frame. Replay traces were already
     withheld as resolved values; without a fallback the run input is no longer "authored".
   - FluxNode events and result: `FluxNodeRun.tell`/`end` apply `fluxNodeWithheldForProgram`.
     The event's and result's own ids and enums are kept, so the protocol still parses. Data
     (`outputs`, `inputs`, labels, reasons) is withheld. The developer's `check` receives the
     inputs with the secret withheld.
5. **Export:** relies on the no-fallback binding, plus a second check in `flow-export.ts` that
   drops any default on a binding to a declared secret name in the artifact, the saved steps and
   the proposals.
6. **Contract placement:** secret is allowed only on a string property directly under a
   FluxNode's `inputs.properties` (`parseFluxNodeInputs` / `fluxNodeInputsSchema`). It is refused
   by name (`type_schema.secret_not_input`) on outputs, nested fields, `anyOf` branches, pipeline
   inputs and data-step types. Outputs are returned and stored as given, and a pipeline input is
   not withheld.
   - A secret's name must be bindable (`/^[a-z][A-Za-z0-9]{0,31}$/`, not `item`:
     `secret_bad_name`). This mirrors Core's draft input-name rule.
   - `default`, `examples`, `const` and `enum` beside it are refused (`secret_with_value`).

### Files

- **Contracts:**
  - `type-schema/{type-schema,formats,parse}.ts`
  - `flow/interface.ts` (`readFlowInputs` options)
  - new `spec/inputs.ts` and `spec/secret-inputs.ts` (`fluxNodeSecretInputs`)
  - `spec/{definition,index}.ts`
  - test `spec/tests/secret-inputs.test.ts`
- **SDK:**
  - new `schema/secret.ts` and `schema/secret-mark.ts`. `secret()` marks the zod string's
    definition with a symbol that survives `.min()` and similar.
  - `schema/{zod-to-json-schema,type-schema-from,index}.ts`
  - `define/define-fluxnode.ts`
  - test `schema/tests/secret.test.ts`
- **service/fluxnode:**
  - new `secrets/{goal-inputs,without-secrets,withheld-for-program,secret-defaults,index}.ts`
    and `secrets/tests/secrets.test.ts`
  - `run-fluxnode.ts`, `fluxnode-run.ts`, `create-fluxnode-service.ts`, `flow-export.ts`
  - `tests/library-lane.ts` (exposes `dataDir`) and new `tests/secret-inputs.test.ts`
- **Granted:** `answer-first/flow-run/input-bound-steps.ts` and its test.
- **Outside service/fluxnode, contracts and sdk (seams):**
  - new module `packages/fluxiq/src/runtime/run-secrets/` (`store`, `run-with`, `read`,
    `without-run-secrets`, `with-run-secret-texts`, `index`, `tests/run-secrets.test.ts`)
  - `runtime/llm/harness/run.ts` (wrap the packed context)
  - `runtime/llm/step-log/screen.ts` and `tests/screen.test.ts`
  - `runtime/service.ts` (one line in `dispatch`)
  - `engine/automation/trace/withholding.ts` (seed) and new `tests/withholding.test.ts`
  - `engine/automation/graph-run.ts` (`runGraphToTrace`: fill secret inputs)
  - `runtime/llm/node-tools/replay/span.ts` (`automationStudioFlowDraftReplayPassCall` resolution state)
  - `answer-first/flow-run/input-bound-steps.ts` and `tests/input-bound-steps.test.ts` (granted)
- **Docs:** `docs/fluxnodes/reference/spec.md` ("Secret inputs" and the format list) and
  `docs/fluxnodes/guides/safety.md` ("Secret inputs"). Both were already untracked from another
  lane; I only added sections.

No file in W1's or W2's must-not-touch list, ui-components or apps/web changed.

## Commands run and observed results

- **Contracts** (`packages/contracts`):
  - `npx vitest run` printed `Test Files 105 passed (105)`, `Tests 887 passed`.
  - `pnpm check` printed `contracts:check ... stored in the shared store` (tsc exit 0).
- **SDK** (`packages/sdk`):
  - `npx vitest run` printed `Test Files 20 passed`, `Tests 103 passed | 2 skipped`.
  - `pnpm check` printed `sdk:check ... stored` (exit 0). The first run failed on my test's
    readonly `acts`; I fixed it and reran.
- **fluxiq, one run over 12 targets.** The targets were the `service/fluxnode` folder (all its
  tests), `flow-run/tests`, `runtime/run-secrets`, `engine/automation/trace/tests`,
  `runtime/llm/step-log/tests`, `harness/tests/run.test.ts`,
  `node-tools/tests/replay-span-step-log.test.ts`, `replay-draft.test.ts`,
  `engine/automation/tests/trace-withholding.test.ts`, `graph-run.test.ts`,
  `runtime/tests/attempt-withholding.test.ts` and `service.test.ts`.
  - It printed `Test Files 1 failed | 43 passed (44)`, `Tests 1 failed | 324 passed`.
  - The one failure was my new step-log non-vacuity assertion (it looked for a `-test-` folder;
    the replay is logged as `NNNN-tool-core.run_node`).
  - I fixed the assertion and gave the model a distinct stand-in (`"stand-in"`), so the marker
    can only come from the withheld secret. A rerun of `secret-inputs.test.ts` printed
    `2 passed`.
  - Afterwards, `npx vitest run src/framework/automation-service/service/fluxnode .../flow-run/tests/input-bound-steps.test.ts`
    printed `Test Files 10 passed (10)`, `Tests 41 passed`.
- **Single fluxiq tests:**
  - `npx vitest run .../fluxnode/secrets/tests` printed `3 passed`.
  - `input-bound-steps.test.ts` printed `5 passed`.
  - `run-secrets`, trace `withholding` and step-log `screen` tests printed `7 passed`.
- **What the lane proves.** Spec input `title` is `format: "secret"`. The first secret is
  "clockm" and the replay's is "rivers". Both are lowercase, so no displayed row contains them.
  - the build's test sent `title: "clockm"` to the site, resolved from the binding the model
    wrote with the stand-in;
  - no model request contains it, and the first decision's context names `the secret "title"`;
  - events parse as the contract's; the check got `inputs.title = "[withheld]"`; the events,
    result and state hold no secret;
  - the export holds `{"$state":{"path":"title"}}` with no fallback;
  - the replay made 0 model calls and the engine typed "rivers";
  - `filesHolding(dataDir, secret)` and `filesHolding(stepLogDir, secret)` are both empty for
    both secrets, and a step-log `call.json` holds `[withheld]`;
  - a second case, where the model typed the secret literally, still saved and exported the
    binding with no default and replayed the new secret.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (530 warning(s), 969 baselined)`.
  The first run failed `[as-never]` in my SDK test; I fixed that. No new warning is on my files.
- `pnpm docs:check` printed `structure-audit: passed (0 warning(s))` and
  `Deterministic framework reference is current.`
- I queued the fluxiq tsc with `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t899-secret -- "cd packages/fluxiq && node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit; echo TSC_EXIT=$?"`.
  It last printed `heavy-slot: t899-secret waiting (position 4 of 8)` and never ran, so there is
  no TSC_EXIT. The contracts and sdk tsc (`pnpm check`) both pass, and vitest transpiled every
  changed fluxiq file. Vitest does not typecheck, so type errors in the fluxiq seams are still
  possible.

## Not verified

- No live Lab run and no real web domain. The build's real web flow is not exercised:
  "write the step, then `core.run_flow`". Whether a real model follows the goal's wording to bind
  a secret is untested; a run-now call with a binding is still refused (`binding needs write`),
  and that refusal's feedback is what teaches it.
- The mock provider writes no `decide` step folders, so screening of model request files in
  the step log is proven by the `screen.ts` unit test, not by the lane.
- Not covered by withholding:
  - **Run datasets/records.** Page rows are site data. A site that prints the secret puts it in
    the rows; the result's `outputs` are withheld, but the stored dataset is not.
  - **The ephemeral activity hub stream** (in-memory chat activity). Its FluxNode step events
    are withheld.
  - **A pipeline input mapped into a FluxNode's secret input.** The pipeline layer holds it as
    given.
- I did not check that the frame survives every async path in a real server (for example
  queued work started outside the run's chain). If it is lost, a bound step fails to resolve
  and nothing leaks, except `input-bound-steps` then cannot strip a fallback. The only fallback
  it could see is the model's stand-in.
- **Short secrets:** withholding replaces every occurrence, so a 1 to 3 character secret blanks
  matching text in what the model reads. This is documented, not limited.

## Open questions or contradictions found

- **The brief's premise was wrong.** The brief said exploration resolves `$input` against
  caller inputs (`rounds.ts:54`). It does not: only saved steps are re-valued, and a new written
  step's test types its `test` fallback. I resolved it with the `span.ts` seam, not with W1's
  files.
- **`input-valued-steps.ts` (W1's) writes caller input values into in-memory fallbacks, and
  `keep.ts` persists `run.steps` each round.** Secrets are no longer among the caller inputs, so
  this cannot carry them. If W1 ever passes secrets in caller inputs, that path would leak to
  the attempt store.
- The model-guidance wording lives in `service/fluxnode/secrets/goal-inputs.ts`, not in a
  prompt section, so overrides cannot change it.
