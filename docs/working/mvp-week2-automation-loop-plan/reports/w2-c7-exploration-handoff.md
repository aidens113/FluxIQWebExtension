# C-7 exploration-to-repair handoff (D-3): worker report

Core at `F:\!FluxIQ`, branch `dev`, HEAD `c0b04be` plus uncommitted work. `AS/` =
`packages/fluxiq/src/programs/automation-studio/`. Nothing was committed.

## Outcome

Done. There is one design decision the supervisor should confirm: handles taken
from an explored packet are written with a prefix (see the first open question).

Before this change, a `runtime_patch` request carried only the failure packet.
It now also carries the packets the exploration returned, in a bounded slot.
The target check reads the same packets the request carried.

- A handle that only an explored packet issued is now accepted.
- A handle that no packet issued is refused with the same code as before
  (`handle_not_issued` from the domain stub).
- When no exploration evidence exists, the request, the prompt and the target
  check are exactly as they were.

## What changed and why

### The one design decision: a prefix on explored handles

The domain numbers handles per packet: `target.${elements.length + 1}`, at
`domain/src/runtime/llm-evidence/sanitize.ts:132`. So `target.3` names a
different control in the failure packet and in every explored packet.

The brief's literal design, "validate against the failure packet plus the
explored packets", would silently re-point a repair at the wrong control:

- Failure packet checked first: a control the exploration revealed is lost,
  because the failure packet's own `target.N` wins.
- Explored packets checked first: a handle the model took from the failure
  packet gets resolved against a later page.

Refusing whenever more than one packet accepts is safe, but it would refuse
almost every repair.

So a handle taken from an explored packet is written
`<evidenceId>:<handle>`, for example `explored.2:target.3`. Core's handle
pattern already allows `:`. The target check strips the prefix and asks the
domain about exactly that one packet.

### Files

**`AS/runtime/llm/harness/task-request.ts`**
- New type `AutomationStudioLlmExploredEvidencePacket`, with fields
  `{ evidenceId, toolId, packet }`.
- New harness input field `explorationEvidence?: { packets, maxBytes }`, for
  `runtime_patch` only.

**`AS/runtime/llm/harness/context-packet.ts`**
- New context field `explorationEvidence?: { schemaVersion: "automation-studio.exploration-evidence.v1", packets, withheldPackets }`.
- The slot is packed last, after the rest of the request.
- It throws on a caller defect:
  - a task other than `runtime_patch`;
  - missing `deniedEvidenceKeys`, which the existing declaration rule now also
    covers;
  - an allowance that is not a positive integer;
  - labels that are missing, repeated, or contain `:`.
- A packet is withheld and counted, never thrown, when it is not a bounded
  packet. A bounded packet has a `schemaVersion`, passes `isJsonObject`, has no
  string over 2,000 characters, no key over 100 characters, and none of the
  domain's denied keys at any depth.
- Packets are chosen newest first and sent oldest first.
- Count bound: `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxToolCalls` (64).
- Byte bound: the smaller of two numbers:
  - the caller's `maxBytes`;
  - the room the rest of the request left:
    `3 × min(maxInputTokens, maxTotalTokens − maxOutputTokens) − packed bytes − 6,000`.
- The 6,000-byte reserve covers the provider's system prompt, the output schema
  and the request envelope. An empty `runtime_patch` request measured 3,774
  bytes with the DeepSeek adapter's own estimate. A test pins the reserve.
- Without the room bound, the slot could get a patch call that works today
  refused as over budget.

**`AS/runtime/llm/deepseek-provider.ts`** (prompt text only)
- New constant `AUTOMATION_STUDIO_EXPLORED_EVIDENCE_HANDLE_INSTRUCTION`.
- It is appended to the `runtime_patch` system prompt only when the request
  carries at least one explored packet.
- It says:
  - explored packets are equally valid sources of handles;
  - use the prefixed form for them;
  - take every handle of one target from the same packet;
  - prefer the newest packet that shows the control.
- Without explored packets the prompt is byte-identical to before (tested).

**`AS/runtime/llm/harness-options/binding.ts`** (documentation only)
- `validateTargetOverrideEvidence` now documents that it is called once per
  packet: the failure packet or one explored packet, with Core's prefix
  removed.
- The signature is unchanged, so the web domain needs no change.
- I added no new export, because `harness-options/index.ts` is not in my list
  of files.

**`AS/runtime/recovery/annotation/exploration.ts`**
- `runAutomationStudioRecoveryExploration` now returns
  `{ exploration, explored }`.
- It wraps the loop binding's `executeTool` and records returned evidence when:
  - the tool id belongs to the bound domain (its `tools` or `harnessOptions`);
  - and the evidence is an object with a string `schemaVersion`.
- It keeps only calls the loop accepted, meaning trace steps that have both
  `callId` and `evidenceBytes`, and labels them `explored.1`, `explored.2`, and
  so on.
- New export `automationStudioExploredEvidenceHandle(handle)`. It is the only
  parser of the prefixed form, and it sits in the same module that creates the
  labels.

**`AS/runtime/recovery/annotation/patches.ts`**
- Input gains `explorationEvidence`, which is the patch request's
  `context.explorationEvidence`.
- The target check is built here, where the failure-only check already lived:
  - **No slot:** the old check exactly (every handle, as written, against the
    failure packet). With no failure packet either, there is no check at all.
  - **Slot present:**
    - Unprefixed handles go to the failure packet. If there is no failure
      packet, the result is `absent`/`domain_check_unavailable`.
    - Prefixed handles go to the named carried packet, with the prefix
      stripped.
    - A prefix naming a packet the request did not carry, or a target that
      mixes packets, gets `absent`/`handle_not_issued` without asking the
      domain.
    - A domain `matched` on an explored packet is returned as `resolved` with
      the stripped target, so the prefix is never stored.
- Each domain call is guarded; a throw becomes `absent`, as before.
- The receipt gains `targetEvidence`, set to `failure_evidence` or
  `exploration_evidence`, only when the domain accepted the target.
- Brief item 4 needed no production change. `live-patch.ts`
  (`targetOverrideFailedAction`) builds the failed action with `outputId`.
  `patches.ts` only forwards it. An existing test already asserted this, and a
  new test asserts it on the explored path.

**`AS/runtime/recovery/annotation/annotate.ts`**
- Passes `explorationEvidence: { packets, maxBytes }` to the `runtime_patch`
  call only when the exploration returned packets.
  `maxBytes = floor(maxInputTokens × 3 × 0.5)`.
- Passes `patchResult.request.context.explorationEvidence` to the patch stage.
  That is the list the model was shown, not the exploration's own list.
- Adds counts only to `llmGate`:
  `explorationEvidence: { carriedPackets, withheldPackets }`.
- Explored packets are carried whatever the exploration's outcome.

### Tests (every one is new unless marked "updated")

- **`AS/runtime/llm/tests/harness.test.ts`**, four new tests:
  - newest-first selection, withholding, a denied key at depth, and the
    64-packet count bound;
  - refusal on other tasks, without a declaration, without an allowance, and
    with bad labels;
  - the input-budget pin: the largest packet the room admits passes
    `estimateAutomationStudioDeepSeekInputTokens`, and one more byte is
    withheld;
  - the prompt sentence appears only when packets are carried, and the prompt
    is identical otherwise. This test captures the outbound body through
    `resolveSecret`; the fake `fetch` throws, so nothing is sent.
- **`annotation/tests/patches.test.ts`**, seven new tests with a stub domain
  that numbers handles per packet. They cover:
  - an explored-only handle being accepted;
  - a handle no packet issued keeping its old refusal;
  - an uncarried packet or mixed target being refused without asking;
  - an unprefixed handle going to the failure packet;
  - with no slot, the exact old behaviour;
  - `matched` being carried without the prefix;
  - no failure packet;
  - a throwing domain.
  The slot in these tests is built by the real packet builder.
- **`annotation/tests/exploration.test.ts`**: two new tests (labelled order with
  refusals excluded; an evidence-limit refusal and a run that never started
  return nothing). The two existing tests were updated for the new return shape.
- **`annotation/tests/annotate.test.ts`**: three new end-to-end tests under a
  `diagnose_and_adapt` grant:
  - a repair naming a control only the explored page shows is proposed, and
    `llmGate` counts the packets;
  - handles no packet issued are still refused;
  - with no exploration, the patch request has no slot.

## Commands run and observed results

- `npx tsc --noEmit -p packages/fluxiq` (in `F:\!FluxIQ`)
  - First run: 1 error, `exploration.ts(223,48) TS2339`. Fixed.
  - Every run after that, including the final one: exit 0.
- `FLUXIQ_TEST_ENV_FILES=none npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/recovery packages/fluxiq/src/programs/automation-studio/runtime/llm`
  - Final result: `Test Files 40 passed (40)`, `Tests 543 passed (543)`, exit 0.
  - No hardware-fault reruns were needed.
- `node scripts/structure-audit.mjs`
  - First run, before any edit: failed with 35 violations, all
    `[swallowed-failure]`, all in files I do not own. That is another worker's
    rule, still in progress.
  - Final run: `structure-audit: passed (153 warning(s), 355 baselined).`,
    exit 0.
  - Advisory warnings touching my files:
    - `annotate.test.ts` is 514 lines. This warning is new; the file was 395.
    - `harness.test.ts` is 672 lines. It was already over 400, at 522.
    - `deepseek-provider.ts` is 764 lines. It was already over 400, at 759.
    - `context-packet.ts` briefly reached 410, so I tightened my comments. It
      is now 399.
- **Negative probes.** I backed each file up to the scratchpad, broke one piece,
  ran the annotation tests plus `harness.test.ts`, and restored the file. `cmp`
  confirmed all five files byte-identical afterwards.
  - A: dropped the slot from the patch call in `annotate.ts`. 1 test failed.
  - B: `patches.ts` read every handle as unprefixed. 5 tests failed.
  - C: shrank the reserve to 2,000 bytes. The budget-pin test failed.
  - D: dropped the prompt sentence. The prompt test failed.
  - E: stopped filtering explored packets by the trace. The refused-packet test
    failed.
  - F: kept `matched` with the prefix. The matched test failed.
- **Overhead measurement.** A temporary vitest file (deleted afterwards)
  printed `C7MEASURE 681 243 1258 3774`: request JSON 681 characters, context
  243, DeepSeek estimate 1,258 tokens, which is 3,774 bytes.

## Not verified

- **No live DeepSeek run** (forbidden by the brief). Untested:
  - whether DeepSeek follows the prefixed-handle form;
  - whether it picks the newest packet;
  - the real explored packets' byte sizes under the 8,000-token default. My
    estimate is that only about one 6,000-byte web packet fits once failure
    evidence, recovery context and recent actions are packed.
- **No web domain run.** The web domain was not exercised end to end, and I did
  not type-check this repository's domain. The binding's shape is unchanged,
  so I expect no impact, but that was not checked.
- **Executed repairs not tested.** The explored-packet path was tested only
  through proposals (`diagnose_and_adapt`), not an executed repair. The
  executed path shares the same target check.

## Open questions or contradictions found

1. **The prefix goes beyond the brief's wording.** Without it, the literal
   design mis-resolves handles, because the domain numbers them per packet.
   Please confirm, or choose one of:
   - a packet field on the target (needs `structured-response.ts` and the
     schema, which are C-11's files);
   - handles made unique across an exploration on the domain side (a domain
     change).
2. **The domain's recovery options never keep selectors.**
   `domain/src/runtime/llm-evidence/harness-options/execute.ts` stores its own
   `returned` map and never calls `tools.ts`'s `retain`. As a result, a repair
   resolved from an explored packet is fingerprint-only, with no selector hint;
   `validateTargetOverrideEvidence` finds no retained selectors for that packet
   key. The brief assumed that "a handle from an explored packet resolves" with
   selectors. It resolves, but without the hint. Fixing this is a domain change.
3. **The domain can substitute a control for an unknown handle.** When a packet
   has exactly one compatible element, the domain puts that element in place
   of a handle it never issued (`target-override.ts`, `handleResolution:
   "inferred"`). This is unchanged, and it now applies to explored packets too.
4. **The provider does not re-check explored packets.** The DeepSeek provider
   re-sanitizes `failureEvidence` before sending (`validFailureEvidence`) but
   does not re-check `explorationEvidence`. I stayed within "prompt text".
   Adding that check needs a new preflight code in `provider-contract.ts`,
   which is not in my list.
5. **The label format lives in two places.** It is defined in
   `annotation/exploration.ts` (creation and parsing) and in
   `context-packet.ts`, which rejects labels containing `:`. The format
   belongs beside the packet builder. That needs `llm/harness/index.ts` to
   export it, and that file is not in my list. Tests tie the two together.
6. **Denied keys are not applied during exploration.** This predates my change
   and I did not alter it. The exploration's own
   `evidence_tool_decision` requests carry the evidence values without
   applying the domain's denied keys (`packAutomationStudioLlmContext` does
   `structuredClone(input.evidenceLoop)`). The patch slot added here does
   apply them.
7. **Other in-progress work is in the tree.** `live-patch.ts`, `flow-change/**`,
   `adaptation-store.ts` and `service/adaptations/patches.ts` have uncommitted
   changes from another worker. My type check and test runs included them.
   `service.ts` was not touched.
