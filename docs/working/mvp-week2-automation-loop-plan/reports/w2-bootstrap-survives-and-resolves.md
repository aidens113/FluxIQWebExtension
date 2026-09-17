# w2-bootstrap-survives-and-resolves — worker report

Repository changed: FluxIQ Core (`F:\!FluxIQ`). `AS/` =
`packages/fluxiq/src/programs/automation-studio/`. In this repository, only
this report was written. No live provider calls, no network, no `pnpm lab`.
Nothing committed.

The brief grew four times while I worked, each time from a coordinator message.
All five items are done:

1. Flow creation survives bad replies (the original part 1).
2. Handles resolve into real parameters (the original part 2), rebuilt to the
   exact binding signature the coordinator later fixed for the web domain, then
   extended with the optional `location` key.
3. Applying a Flow Bootstrap indexes each Subflow graph, so opening the graph no
   longer makes the bootstrap impossible to revert.
4. A build's recorded token totals are no longer capped at one request's
   50,000.
5. An invalid plan is fed back to the model and asked for again, and the
   failure record says why.

## Outcome

**Done.**

- **Bad replies.** A malformed reply, a timeout, or a plan that fails a check
  now costs one call, and the exploration asks again. Three in a row stop the
  build as `flow_bootstrap.evidence_unusable_decision`. The failure record
  names the issue codes, carries the loop trace, and reports what was spent.
- **Authorization failures** still end the build at once, and the grant is
  revoked. For every other outcome the grant is released only when generation
  ends.
- **Handles.** A plan node may name what the exploration showed as
  `{ "handle": "…" }` or `{ "handle": "…", "location": "…" }`. The bound domain
  turns it into real parameters before validation, or refuses the node. No
  handle can reach persistence, apply or dispatch.

**Binding method, final signature** (on `AutomationStudioLlmEvidenceRuntimeBinding`
in `AS/runtime/llm/harness-options/binding.ts`). It is exactly what the
coordinator specified:

```ts
resolvePlanNodeParameters?(input: {
  projectId: string;
  flowId: string;
  nodeDefinitionId: string;
  parameters: JsonObject;
}): { status: "unchanged" } | { status: "resolved"; parameters: JsonObject } | { status: "refused"; issueCodes: readonly string[] };
```

An earlier draft, `resolvePlanNodeHandles` with a `$handle` marker, was replaced
before anything used it. It was never committed.

## What changed and why

### 1. Creation survives bad replies

- **New `AS/runtime/llm/unusable-decision.ts`.** It holds
  `AutomationStudioLlmUnusableDecisionError` and
  `automationStudioLlmTaskResultSpentWithoutDecision` /
  `automationStudioLlmUnusableDecisionError(result)`.
  - A failed decision call counts as "unusable" only if both hold:
    - the provider was reached;
    - every error is either in `llm_output.*` or is a provider code the
      failure-disposition table marks as a spent call.
  - That is the same table the grant reads, so "the grant survives it" and
    "worth asking again" cannot drift apart.
  - It fails closed. These all end the build: a pre-flight refusal,
    `auth_failed`, `aborted`, `secret_unavailable`,
    `llm.provider_request_failed` (a grant that is gone), a usage breach, and a
    4xx.
- **Changes to `AS/runtime/llm/evidence-loop.ts`:**
  - **New input `unusableDecisions: { maxConsecutive, stalled }`.** When a
    decision throws the error above, that iteration is spent and recorded as a
    new trace kind, `decision: "unusable"`, and the loop asks again. A usable
    decision resets the count. At the streak limit the loop throws
    `stalled(...)`, which Flow Bootstrap supplies.
  - **No new loop failure code was added**, on purpose.
    `recovery/exploration-outcome.ts` maps every loop code in a closed
    `Record`, and I do not own that file.
  - **New input `checkCompletion(result)`.** A refused completion is an
    unusable decision. Its feedback is added to the evidence the model sees,
    under tool id `core.completion_check`
    (`AUTOMATION_STUDIO_LLM_EVIDENCE_COMPLETION_FEEDBACK_TOOL_ID`), and the
    model is asked again. The check receives a copy of the result.
  - **The evidence window is now capped at 64 entries as well as by bytes.**
    DeepSeek refuses a request with more entries than that, and completion
    feedback adds entries that are not tool calls.
  - **The error class and classifier are re-exported** from `evidence-loop.ts`
    as part of the loop's input contract. So `llm/index.ts` did not need an
    edit.
- **`AS/runtime/loop-limits/`.**
  - New constant
    `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_MAX_CONSECUTIVE_UNUSABLE_DECISIONS = 3`.
    A test pins it to recovery's
    `AUTOMATION_STUDIO_EXPLORATION_DEFAULT_MAX_STEPS_WITHOUT_PROGRESS`.
  - The Flow Bootstrap loop limits gain `maxConsecutiveUnusableDecisions`,
    clamped to the call count.
- **Changes to `service.ts`, inside `generateFlowBootstrapAdaptation`:**
  - It configures `unusableDecisions` and `checkCompletion`.
  - `decide` now throws the unusable error when that applies, and otherwise
    throws the old harness failure.
  - Loop failures and the unusable-streak failure now carry accounting.
- **Bounds that predated the 64-iteration ceiling were raised to it.** Each one
  would have turned a long exploration's named outcome into a generic failure:
  - `sanitizeEvidenceLoopTrace` (`service.ts`): 17 steps / iteration 16 became
    65 / 64. It also accepts `"unusable"`.
  - `parseEvidenceLoopCounts` (`flow-bootstrap/generation-failure.ts`): 16
    became 64 or 65. Before, a failure diagnostic with more than 16 decisions
    failed to parse and fell back to `provider_request_failed`.

### 2. Handles become real parameters

- **New `AS/runtime/llm/harness-options/plan-node-handles.ts`.** It defines the
  reserved reference shape: an object whose keys are `handle` and, optionally,
  `location`.
  - A token outside the target-override handle syntax is refused as malformed.
    So is a non-string location, an empty one, one over 2,048 characters, one
    containing a control character, or a node naming more than 16 references.
  - An object with `handle` beside any other key is treated as a literal, not a
    reference.
- **New `AS/runtime/llm/harness-options/plan-parameter-resolution.ts`.**
  `resolveAutomationStudioFlowBootstrapPlanParameters` asks the domain about
  every node, one at a time, including Core's built-in nodes, with a copy of
  the parameters. It trusts none of the answer:
  - A throw, a malformed answer, or extra keys refuse the node.
  - So do resolved parameters that are not plain JSON (bounded to depth 12,
    256 entries and 16 KB).
  - So does anything that still names a handle afterwards, including an
    `unchanged` answer for a node that names one.
  - The refusing domain's codes are kept: up to 16 distinct ones matching
    `^[a-z0-9_.:-]{1,100}$`.

  Core's own issue codes:

  | Code | Meaning |
  | --- | --- |
  | `bootstrap.handle_malformed` | A reference has the reserved shape but is not usable |
  | `bootstrap.handle_not_issued` | The plan names a handle, but no exploration ran |
  | `bootstrap.handle_resolution_unavailable` | The plan names a handle, but no resolver is bound |
  | `bootstrap.parameter_resolution_failed` | The domain's resolver threw |
  | `bootstrap.parameter_resolution_invalid` | The domain's answer was malformed |
  | `bootstrap.parameters_refused` | The domain refused but gave no valid code |
  | `bootstrap.handle_unresolved` | A handle survived resolution |

  `assertAutomationStudioFlowBootstrapPlanHandlesResolved` is now called in
  both `createFlowBootstrapAdaptation` and `applyFlowBootstrapAdaptation`
  (`service.ts`). So a plan that arrives any other way still cannot carry a
  handle.
- **New `AS/runtime/llm/harness-options/bootstrap-completion.ts`.**
  `checkAutomationStudioFlowBootstrapCompletion` runs every check a completed
  evidence result must pass: wrapper, plan structure, evidence-profile limits,
  parameter resolution, and registry validation. A validator that throws
  becomes `bootstrap.validation_failed` instead of a record with no reason.
  - **On refusal it returns three things:** the failure code, the issues, and
    the model's feedback.
  - **The feedback contains only these:**
    - `{ ok:false, code:"flow_bootstrap.completion_refused", refusal }`;
    - up to 16 issues, as `{ code, path }`. The paths are the plan's own
      structure, bounded to 300 printable characters;
    - a fixed instruction on writing handles and `location`.

    It never includes page content or a validator's prose.
- **`service.ts`, evidence path.** The old post-loop wrapper, parse and profile
  checks moved into the check above, which now runs inside the loop.
  - **Non-evidence path.** It still resolves then validates, with
    `handlesIssued: false`, so any handle there is refused.
- **Model-facing text:**
  - **`flow-bootstrap/plan/evidence-schema.ts`.** The completion schema's
    `parameters` gained a description, telling the model:
    - to write `{"handle": …}` where a value must point at something the
      evidence showed (a control, a field, or a list a tool detected);
    - to add `"location"` after exploring more than one location;
    - never to write a locator, path or query of its own.

    The wording stays domain-neutral: no "selector".
  - **The completion feedback instruction** says the same.
- **Barrel.** `harness-options/index.ts` exports the new modules (it was
  already re-exported by `llm/index.ts`).

### 3. Applying a bootstrap indexes its Subflow graphs (coordinator item)

- **The fix.** In `applyFlowBootstrapAdaptation` (`service.ts` ~4152), each
  Subflow graph is saved and then passed to `this.flows.replaceFlowGraphIndex`
  before the applied digest is taken. This is the same pattern the
  recording-proposal path already uses.
- **Test.**
  `tests/service-bootstrap/tests/apply-graph-index.test.ts` applies a
  bootstrap, opens the graph's viewport, and checks two things: the digest
  still equals `appliedDependencyDigest`, and revert succeeds.
  - Before the fix it failed with `expected '19d1…' to be 'ac11…'`. After the
    fix it passed.
  - Negative control G (the fix removed) failed it again.

**Other `saveFlowInternal` calls that write a graph without creating its
index.** `saveFlowInternal` only reconciles an index that already exists
(`service/flows/store.ts` `reconcileCanonicalGraphFromDocument` returns early
when there are no revisions). So any graph written this way has no index until
the first viewport creates one, and the digest moves at that moment.

- **`service.ts:2141` `saveFlow`.** The public save. Any new or never-indexed
  graph Flow saved through it is exposed.
- **`service.ts:2292` publish.** Re-saves the published Flow and creates no
  index.
- **`service.ts:2706` legacy migration (`"legacy_single_graph"`).** Writes
  migrated graphs with no index.
- **`service.ts:3791` orchestration conversion.** Only the parent's metadata
  changes.
- **`service.ts:3844` duplicate Subflow.** Writes a new graph Flow copied from a
  materialised source. The copy has no index, and it also carries the source's
  `metadata.graphRevision`, which is now stale.
- **`service.ts:4297` bootstrap revert rollback.** Restores deleted graph
  documents. `deleteFlowArtifact` leaves the old graph index behind, so the
  reconcile path happens to cope.
- **`service/flows/mutations.ts:118` `createFlowSubflow`.** Writes a new blank
  Subflow graph with no index. This is the same hazard as the bootstrap one,
  for Subflows created by hand.
- **`service/adaptations/durable.ts:142` and `:177`, and
  `service/adaptations/patches.ts:65` and `:130`.** Adaptation apply and revert
  re-save existing Flows and create no index when none exists.
- **`service/flows/subflow-migration.ts:106` and `:151`.** Parent conversion.
  Line 151 clears the parent graph, and the index is reconciled only if it
  already exists.

**Not affected:**

- `service/flows/graph-patch.ts:80`: the index always exists there.
- The recording-proposal path (`service.ts:2502`): it calls
  `replaceFlowGraphIndex` itself.

Also note: `deleteFlowArtifact` (`service/flows/writer.ts:132`) never removes a
deleted Flow's canonical graph index.

### 4. Token totals follow the grant (coordinator item)

**Where the cap was.** One request's ceiling (50,000) was being applied to a
build's totals:

- `service.ts` `sanitizedBootstrapAccounting`, in `boundedInteger`
  (`> 50_000`). This throws after the loop has finished, so creation failed as
  `provider_output_validation_failed` after every call had been paid.
- `flow-bootstrap/generation-failure.ts` `parseAccounting`
  (`estimatedInputTokens` and the three token fields `<= 50_000`). A failure
  record above the cap stopped parsing, and its named reason was lost.

**The new bound.**
`AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ACCOUNTED_TOKENS = maxIterations (64) × 50,000`,
in `loop-limits/flow-bootstrap-evidence-loop.ts`.

- A test pins this bound to two things:
  - `AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` (the
    per-request ceiling);
  - `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS × 50,000`. That product is
    the largest `maxTotalTokensPerRun` any grant can authorise, so the grant
    stays the thing that enforces the budget.
- **The per-request 50,000 limit is unchanged.**

### 5. Named, fed-back plan failures (coordinator item)

- **The failure diagnostic** (`AutomationStudioFlowBootstrapFailureDiagnostic`)
  gains an optional `issueCodes: string[]`.
  - It holds 1 to 16 entries, each matching the code pattern. The parser is
    strict about this, and a test covers the bounds.
  - It is filled by `flowBootstrapEvidenceCompletionFailure` (new optional
    `issues` argument) and by `flowBootstrapEvidenceUnusableDecisionFailure`.
- **`flowBootstrapEvidenceLoopFailure`** takes optional accounting.
- **Renamed code.** `flow_bootstrap.evidence_completion_handle_unresolved` (my
  draft name) became
  `flow_bootstrap.evidence_completion_parameters_unresolved`. It now appears
  only in the model's feedback as `refusal`, because a refused plan is fed back
  rather than ending the build.
- **New codes in the phase list:**
  - `flow_bootstrap.evidence_unusable_decision`;
  - `flow_bootstrap.evidence_completion_parameters_unresolved`.

### Tests added or changed (all in Core)

- **New `llm/tests/unusable-decision.test.ts`** (30 tests):
  - which failures are unusable;
  - asking again, the streak, the stalled error, and not propagating;
  - the iteration bound and cancellation;
  - configuration refusal;
  - `checkCompletion` feedback, the shared streak, malformed checks, a check
    that throws, and the copy semantics.
- **New `llm/harness-options/tests/plan-parameter-resolution.test.ts`**
  (32 tests):
  - the scanner, including `location`;
  - every node being asked;
  - domain codes and their bounds;
  - the not-issued, unbound and malformed cases;
  - 12 kinds of untrustworthy answer;
  - the copy semantics;
  - a `location`-qualified handle round-tripping through a stub binding;
  - the persistence assert.
- **New `tests/service-bootstrap/tests/plan-parameters.test.ts`** (9 tests):
  - a handle resolved into the stored plan and graph node, including with
    `location`;
  - a guessed locator (`input[name="Name"]`) fed back and then corrected;
  - a registry-invalid plan fed back and then corrected;
  - three refused plans stopping as `evidence_unusable_decision` with
    `issueCodes`, accounting and trace, creating nothing, and revoking once;
  - an unknown handle refused with the domain's code;
  - no resolver bound;
  - calls exhausted on refused plans;
  - `createFlowBootstrapAdaptation` refusing a smuggled handle.
- **New `tests/deepseek-bootstrap-exploration.test.ts`** (8 tests). These run
  the real grant service and the real DeepSeek adapter, with only the network
  and the key store stood in:
  - malformed, then good: the Flow is created, the same grant pays for 3 calls,
    and it is released at the end;
  - a hang past the deadline, then good;
  - three malformed replies: the named outcome, and the grant released;
  - bad replies interleaved with good ones never stop the build;
  - a 401 ends the build at once and revokes;
  - a 19-call creation is saved;
  - a 20-call run that runs out is named `evidence_iteration_limit`;
  - totals of 60,000 tokens are recorded under a 100,000 grant.
- **New `tests/service-bootstrap/tests/apply-graph-index.test.ts`** (1 test).
- **Changed:**
  - `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`: +2 describes.
  - `flow-bootstrap/tests/generation-failure.test.ts`: the pinned 16-step and
    50,000-token bounds now test the new bounds, plus the unusable-failure and
    `issueCodes` cases.
  - `tests/service-bootstrap/tests/rejections.test.ts`: the four
    invalid-completion cases now expect the feedback, then
    `evidence_unusable_decision` with the specific issue code.
  - `tests/service-bootstrap/tests/generation.test.ts`: a loop failure now
    carries accounting.

### FB files touched

Here `FB/` means `flow-bootstrap/`, as in the brief's own definition. The
four must-not-touch files, `plan/{validation,catalog,contracts,ranking}.ts`,
were not edited.

- **`flow-bootstrap/generation-failure.ts`.** Unavoidable: it has the closed
  code list, the diagnostic parser, and the 16-step and 50,000-token bounds.
- **`flow-bootstrap/plan/evidence-schema.ts`.** The model-facing handle
  wording, as the coordinator directed.
- **`flow-bootstrap/tests/generation-failure.test.ts`.**

## Commands run and observed results

- **`npx tsc --noEmit -p .`** in `packages/fluxiq`: final run **exit 0**.
  - An earlier run failed only on another worker's
    `nodes/importer-sdk.ts(112)`; that later cleared.
  - My own intermediate errors (a readonly trace, `exactOptionalPropertyTypes`,
    a `vi.fn` tuple type) were fixed.
- **Core `pnpm check`, final run: exit 0.**
  - Structure tests: `# pass 105`, `# fail 0`.
  - `structure-audit: passed (147 warning(s), 254 baselined)`.
  - `packages/contracts`, `client-gateway-websocket`, `fluxiq` and `apps/web`
    all reported `check: Done`.
  - Structure audit JSON: `failures 0`.
- **Runtime suite, first full run.**
  `npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq`:
  `Tests 4 failed | 1146 passed (1150)`.
  - Three failures were the 15 s timeout, in `instruction-readiness`,
    `adaptation` (the API bridge) and `proposals`.
  - The fourth was my new deadline case. Under load, the 1 s deadline fired
    before the grant released the credential. The grant ended the call by
    design, and the build failed as `provider_transport_unknown`. I raised that
    case's deadline to 3 s.
  - **Those four files alone: `Tests 28 passed (28)`.**
- **Runtime suite, second full run: `Tests 2 failed | 1159 passed (1161)`,
  120 files, 117 s.**
  - Both failures are assertion failures in
    `service/summaries/tests/run-detail-preservation.test.ts`. That file is
    **untracked and belongs to another worker**, alongside untracked
    `service/summaries/run-detail-lock.ts` and `run-detail-merge.ts` and a
    modified `recovery/annotation/patches.ts`.
  - It fails alone as well (`Tests 2 failed (2)`).
  - It tests run-detail persistence (`llmGate` preserved across re-saves;
    `listFlowRunActions` rejecting an unreadable index). None of my changes
    touch that.
- **My test files and the adjusted existing ones, together:**
  `Test Files 9 passed (9)`, `Tests 152 passed (152)`.
- **Recovery end-to-end** (`tests/deepseek-recovery-requests.test.ts`), run
  with my end-to-end file: `Tests 14 passed (14)`. Recovery is unaffected.
- **Negative controls.** Each broke one behaviour, ran the guarding tests, and
  then restored the file. `filecmp` confirmed every restore byte-identical.

  | Control | What was broken | Result |
  | --- | --- | --- |
  | A | Creation does not ask again | 10 failed |
  | B | No failure is classed unusable | 9 failed |
  | C | A refused plan is not fed back | 3 failed |
  | D | Plan checks skipped in the loop | 6 failed |
  | E | No persistence assert | 1 failed |
  | F | No post-resolution handle check | 2 failed |
  | G | Apply does not index the Subflow graph | 1 failed |

- **Token-cap control.** With the constant reset to `50_000`, 2 cases failed
  with `expected {…(5)} to be undefined`:
  - "saves a creation that looked more than sixteen times";
  - "records a build's token totals past one request's ceiling".

  The file was restored and `cmp` confirmed it.
- **Graph-index test before the fix: 1 failed** (a digest mismatch), as quoted
  above.
- **Control-character scan.** The Write tool turned `\u0000` in one regex
  into real control characters in `bootstrap-completion.ts`. I fixed it, and a
  byte scan of all 18 changed files found none left.
- **Line counts.**
  - `service.ts`: **6422**, within the 6434 limit.
  - `evidence-loop.ts`: 473.
  - `generation-failure.ts`: 629.
  - `plan-parameter-resolution.ts`: 172.
  - `plan-node-handles.ts`: 110.
  - `bootstrap-completion.ts`: 131.
  - `unusable-decision.ts`: 80.

## Not verified

- **No live DeepSeek run.** Everything used stand-ins.
  - I did not check whether the model actually writes `{ "handle": … }` from
    the new schema description and feedback text.
- **The web domain's real `resolvePlanNodeParameters`** and its
  detection tool were not exercised. Only stub bindings were used.
- **Why the live run's record had `evidenceLoop: null`** is not established.
  By reading the code: the old path added `evidenceLoop` to every completion
  failure. Only an exception thrown during validation fell back to a generic
  record without it. Validation exceptions now become
  `bootstrap.validation_failed` inside the check, with the trace kept.
- **Not run:** Core `pnpm test`, `pnpm build`, the web panel, a browser, and
  this repository's suites.
- **The apply path's handle assert** is covered only by reading the code. The
  create path is tested. Testing apply would need a tampered stored
  adaptation.
- **The new 64-entry cap on the evidence window** cannot be reached with
  today's limits (at most 64 entries reach a decision), so it has no test.
- **Performance.** The 19- and 20-call end-to-end cases take 13–18 s each
  (their timeouts are 120 s). Under heavy load they are the slowest cases in
  that file.

## Open questions or contradictions found

1. **The recovery classifier is duplicated.** `recovery/annotation/exploration.ts`
   still has a private `spentWithoutDecision`, and its own
   `AutomationStudioExplorationUnusableDecisionError`. Both mirror the new
   shared ones in `llm/unusable-decision.ts`. The recovery owner should switch
   to the shared classifier, and could make its error class extend the `llm`
   one. I did not own `recovery/`.
2. **The API contract type is behind.** `api/contracts/adaptation.ts`
   `GenerateFlowBootstrapAdaptationFailureDiagnostic` lacks `evidenceLoop`
   (that was already the case) and now `issueCodes`. It is type-only, and the
   handler passes the runtime diagnostic through. `api/` was not mine.
3. **Structure baseline.** `service.ts` can be lowered from 6434 to 6422
   (`pnpm structure:baseline`). I did not touch the baseline file.
4. **New advisory warnings from my work:**
   - `llm/evidence-loop.ts`: 473 lines (over the 400-line advisory);
   - `flow-bootstrap/generation-failure.ts`: 9 exported values (over 8), and
     629 lines;
   - `runtime/llm/tests/`: 16 files;
   - `runtime/tests/`: 23 files.
5. **Timing risk on live runs.** A deadline that fires before the grant has
   released the credential ends the grant by design. The build then fails as
   `provider_transport_unknown`, not as an unusable decision. With production
   deadlines of 25–45 s this is unlikely. Under a loaded machine with short
   deadlines it can happen.
6. **The domain is asked about every node, including Core built-ins.** This
   follows the coordinator's "every executable plan node". A domain should
   answer `unchanged` for definitions it does not own; the web domain
   reportedly does.
7. **Handle rules differ between the two paths.** On the non-evidence
   (single-call) path, any handle is refused (`bootstrap.handle_not_issued`)
   without asking the domain. The domain is still asked about the other nodes.
8. **Docs are now out of date.** Core architecture docs describing Flow
   Bootstrap failure codes, the evidence-loop trace, the binding surface and
   the 50,000 accounting bound need updating. `docs/` was out of scope.
9. **An ambiguity in the brief.** It defines `FB/` as `flow-bootstrap/`, but
   its must-not-touch names live in `flow-bootstrap/plan/`. I read them as
   `flow-bootstrap/plan/{validation,catalog,contracts,ranking}.ts`, and edited
   none of them.
10. **Another worker's red test.** Their untracked
    `run-detail-preservation.test.ts` fails, as described above. It may need
    `service.ts` wiring, and `service.ts` is in my ownership. If so, the
    supervisor should sequence it.
