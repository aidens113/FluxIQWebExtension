# C-7b: evidence protection on the exploration path

Worker report. FluxIQ Core `F:\!FluxIQ`, branch `dev`. The work started on
`a8ce814`; HEAD is now `6964d63` (a working-docs commit by someone else,
unrelated). Nothing is committed. `AS/` means
`packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done.** All three gaps are closed, and every requested test failed before
the change and passes after it.

- **Disposition of the new code.** After the coordinator gave me
  `AS/runtime/llm/failure-disposition.ts` and its test, I gave
  `llm.provider_exploration_evidence_invalid` the same disposition as its
  sibling `llm.provider_failure_evidence_invalid`: **`END_GRANT`** (end the
  grant). I also changed the test's count from seventeen to eighteen.
- **Flow creation.** `flow-bootstrap/generation-failure.ts` already maps the
  new code to `flow_bootstrap.provider_exploration_evidence_invalid` (its line
  42; the build-loop worker added it). Its 43 tests pass.
- **Type check: clean apart from one foreign file.** With both changes present,
  the real `tsc` still reports one error. It is in another worker's
  in-progress `recovery/annotation/tests/patches.test.ts` (TS2353:
  `allowedPatchKinds` is not yet on `AutomationStudioRuntimeRecoveryPatchInput`).
  With only that file served at its committed version, `tsc` reports **0
  errors**.
- **Tests: all mine pass.** The final `runtime/llm` + `runtime/recovery` run
  has 9 failures, all in three files that same worker is editing: tests
  written ahead of features not yet built. My previous full run, before their
  edits landed, had 606 of 608 passing, and the only failures were the
  disposition table that is now fixed.

## What changed and why

### A. The DeepSeek adapter re-checks every evidence slot before sending

- New file `AS/runtime/llm/harness/request-evidence-check.ts`.
  `automationStudioLlmRequestEvidenceRefusal(request)` returns the pre-flight
  code of the first evidence slot that may not be sent. It covers three slots,
  each with its own code:
  - **Failure evidence** (`llm.provider_failure_evidence_invalid`). It must
    re-sanitize to exactly itself, now under the domain's declared keys (before,
    no keys were applied), and must contain no credential-shaped text.
  - **Explored packets** (new code `llm.provider_exploration_evidence_invalid`).
    The runtime patch task only. The slot must be exactly what the packet
    builder would produce under the declared keys, with no credential-shaped
    text anywhere.
  - **An evidence loop's gathered results** (`llm.provider_evidence_loop_context_invalid`).
    Each gathered value must be free of declared keys, and each entry free of
    credential-shaped text. This is checked on any task that carries a loop.
- **Missing declaration.** A slot that carries evidence on a request with no
  declared keys is refused. An absent list is never treated as empty.
- **Declared keys match domain values only.** They are matched against what the
  domain supplied, never against Core's envelope field names, so a domain's
  list cannot collide with `packet`, `callId` and so on.
- **The keys now travel with the request.** `AutomationStudioLlmTaskRequest`
  gained an optional `deniedEvidenceKeys` field (`harness/task-request.ts`).
  `harness/run.ts` copies the input's declaration onto it, frozen, after the
  token estimate. It is added only when a declaration exists, it is never
  defaulted, and it is never part of the outbound body (a test asserts this).
  Until now the provider could not apply denied keys at all.
- **Credential shapes.** New file `harness/evidence-screen.ts` holds
  `screenAutomationStudioLlmEvidence(value, deniedKeys)`. It looks for declared
  keys (compared the same way as `automationStudioEvidenceKey`) and for
  credential-shaped strings, at every depth, in keys and values.
  - Core had no credential-shape rule, so I wrote a deliberately narrow one: a
    PEM private-key header, a JWT, `Bearer <20+ chars with a digit and a
    letter>`, `sk-<20+ chars with a digit>`, AWS `AKIA`/`ASIA` keys, GitHub
    `gh?_` tokens and Slack `xox?-` tokens.
  - Tests confirm that ordinary page text is left alone, for example
    `task-list-…`, `risk-assessment-000…`, `Bearer YOUR_API_TOKEN_HERE`,
    `SKU-1234…` and URLs.
- **Provider wiring.** `deepseek-provider.ts` replaces its own
  `validFailureEvidence` with one call to the shared check, using a fixed
  message. The refused value is never read into an error. The file went from
  764 to 759 lines.
- **New code registered.** `provider-contract.ts` lists
  `llm.provider_exploration_evidence_invalid` in the pre-flight list, so it now
  has 18 codes.
- **Slot rule moved.** The explored-packet packer and its validity rule moved
  unchanged from `context-packet.ts` into new file `harness/explored-evidence.ts`,
  which adds `isAutomationStudioLlmExploredEvidenceSlot(value, deniedKeys)`.
  The packer and the provider now apply the same rule, which is how the failure
  evidence slot already worked. `context-packet.ts` went from 399 to 330 lines.

### B. Evidence-loop requests apply the domain's declared keys

**Behaviour: refuse, not remove.** This matches the failure-evidence path.
There, the sanitizer throws, `annotate.ts` catches it and records "Sanitized
runtime failure evidence was unavailable", and no provider is called.

- `context-packet.ts` `packEvidenceLoop` replaces the bare `structuredClone`. If
  any gathered value carries a declared key at any depth, in any spelling
  (`inner_html`, `OuterHTML`, `page-source`), packing throws "Evidence-loop
  evidence carries a key the bound domain denies…". The message names no key
  and repeats no value.
- `declaredDeniedEvidenceKeys` now also refuses an `evidence_tool_decision`
  whose loop has gathered anything when nothing was declared. A first decision
  with nothing gathered needs no declaration. That keeps
  `llm/stages/tests/registry.test.ts` (not mine) valid, and matches the brief's
  wording "every request that carries evidence".
- **In practice, a recovery's exploration** now ends with outcome `failed` on
  the decision after a domain option returns such a page, and the model is
  never sent it (tested in `exploration.test.ts`).
- **Flow bootstrap** already forwards the binding's keys through
  `automationStudioHarnessInputWithDeniedEvidenceKeys`, and evidence-guided
  bootstrap requires a binding.
- `exploration.ts` now forwards `deniedEvidenceKeys: input.binding.deniedEvidenceKeys`
  directly. It used to be a conditional spread; the field is required on the
  binding.
- **Risk check against the web domain.** I read the web domain's source
  (`domain/src/runtime/llm-evidence/tools.ts`, `structure/packet.ts`). Its
  packets are designed never to carry `selector`, which is kept on the domain
  side. Core's loop feedback entries carry only codes, paths and instructions.
  So I expect no refusal on today's live paths. I did not run it live.

### C. One definition of the explored-packet label

- New file `harness/explored-evidence-label.ts`, exported through
  `harness/index.ts` and from there through `llm/index.ts`. It exports:
  - `automationStudioExploredEvidenceLabel(n)`, which throws `RangeError`
    outside 1..999;
  - `isAutomationStudioExploredEvidenceLabel`;
  - `automationStudioExploredEvidenceHandle`, moved unchanged;
  - `AUTOMATION_STUDIO_EXPLORED_EVIDENCE_MAX_ORDINAL`.
- **What uses it:**
  - `exploration.ts` makes its labels with it, and keeps the old
    `automationStudioExploredEvidenceHandle` export as a re-export of the same
    binding, so `patches.ts` (not mine) is unchanged.
  - The packet builder accepts only labels this module writes. Before, it
    accepted any 1–32-character label without a colon. This is tighter, and
    every existing label was already `explored.N`.
  - The provider builds its prompt example (`explored.2:target.3`) from it.
- **Import direction.** `llm` imports nothing from `recovery`; `recovery`
  imports from `llm`.
- **Mechanical guards** in `harness/tests/explored-evidence-label.test.ts`:
  - A comment-stripped scan of every non-test source file under `runtime/llm`
    and `runtime/recovery` finds no label literal outside the definition. The
    scan ignores property access such as `result.explored.length`.
  - A test fails if the loop's `maxToolCalls` (64) ever exceeds the label's
    999 ceiling.

### Tests (all written before the change; 20 failed on the old code)

New files:

- `AS/runtime/llm/tests/deepseek-evidence-preflight.test.ts` (test 1). Six
  refusal cases: a denied key, a denied key spelled another way, an API key, a
  bearer token, a JWT and a private key. Each is refused with the new code,
  with no credential resolution and no transport, and the value is absent from
  the message, `String`, the stack, the JSON form and the normalized failure.
  It also has 13 structural refusals, a harness round-trip whose diagnostics and
  intervention do not contain the value, and failure-evidence and loop-evidence
  cases under their own codes.
- `AS/runtime/llm/harness/tests/context-packet.test.ts` (test 2).
- `AS/runtime/llm/harness/tests/explored-evidence-label.test.ts` (test 3).
- `AS/runtime/llm/harness/tests/evidence-screen.test.ts`.

Changed files:

- `recovery/annotation/tests/exploration.test.ts`: labels are now tied to the
  shared definition, plus a new test that a denied-key page ends the
  exploration before any request carries it.
- Declared keys added where hand-built requests now carry evidence:
  - `deepseek-provider.test.ts`: the web list, plus `[]` for its example domain.
    Its old comment said keys never travel with a request; that is now
    rewritten.
  - `opaque-target-override.test.ts`: the web list; the real sanitizer output
    passes it.
  - `evidence-loop-provider.test.ts`: `[]`, because its legacy v1 page packet
    still has `selector` keys.
  - `execution-grant-fixture.ts` (`gatherRequest`): `[]`.
- `llm/failure-disposition.ts` and `llm/tests/failure-disposition.test.ts`,
  assigned to me mid-task: the new code maps to `END_GRANT`, and the count is
  now eighteen.

## Commands run and observed results

All commands were run from `F:\!FluxIQ`.

1. **Before the change:**
   `FLUXIQ_TEST_ENV_FILES=none npx vitest run <the new and changed tests> --no-file-parallelism`
   → **20 failed.** Each failed for the intended reason, for example "expected
   undefined to be an instance of AutomationStudioLlmProviderError", "expected
   [Function] to throw", or the preflight list not containing the new code.
2. **Break-it probes.** Each removed one check, ran the tests, restored the
   file from a scratch backup, and `cmp` confirmed it identical:
   - **1**: the explored-evidence line removed from
     `request-evidence-check.ts` → `deepseek-evidence-preflight.test.ts`
     **8 failed / 4 passed**. Restored, identical.
   - **1b**: only the credential screen removed on explored packets → **5
     failed** (the four credential cases and the harness round-trip).
     Restored, identical.
   - **1c**: the provider's `refuse(evidenceRefusal…)` line removed → preflight
     test plus `deepseek-provider.test.ts` **11 failed / 25 passed**.
     Restored, identical.
   - **2**: the denied-key throw removed from `packEvidenceLoop` →
     `context-packet.test.ts` and `exploration.test.ts` **3 failed / 6
     passed**. Restored, identical.
   - **2b**: the declaration requirement for gathered loop evidence disabled →
     **1 failed** (the "never reads the absence as an empty list" test).
     Restored, identical.
   - **3** (extra): `exploration.ts` writing `` `explored.${index + 1}` ``
     again → the one-definition scan **failed** on `recovery\annotation\exploration.ts`.
     Restored, identical.
3. **Before I owned the disposition files: `npx tsc --noEmit -p packages/fluxiq`**
   → **exit 2.** 4 errors, all from the missing table entry: 1 in
   `llm/failure-disposition.ts` (TS1360) and 3 in its test. Earlier runs also
   showed `generation-failure.ts` (TS2741, since fixed by the build-loop
   worker) and another worker's untracked `record-output-contract.test.ts`
   (transient).
4. **The same type check, with the disposition diff served from scratch
   copies** (`scratchpad/c7b-overlay/tsc-overlay.mjs`, a compiler-host
   overlay) → first attempt **segmentation fault, exit 139** (faulty RAM).
   Rerun alone → **exit 0**, "overlay files applied: 3 of 3; diagnostics: 0".
5. **The brief's vitest run on `runtime/llm` + `runtime/recovery`, before the
   disposition fix** → **Tests 2 failed | 606 passed (608)**, both in
   `failure-disposition.test.ts`. Served through the overlay config
   (`vitest.overlay.config.mjs`) → **608 of 608 passed**, "c7b overlay served
   3 file(s)".
6. **Applying the fix.** The coordinator gave me the disposition files, and I
   applied the same diff with Edit. `cmp` against the verified scratch copies
   printed identical for both files.
7. **Final `npx tsc --noEmit -p packages/fluxiq`**, run twice → **exit 2,
   exactly 1 error both times:**
   `recovery/annotation/tests/patches.test.ts(293,5): TS2353 … 'allowedPatchKinds' does not exist in type 'AutomationStudioRuntimeRecoveryPatchInput'`.
   That file is another worker's uncommitted test-first edit, and I changed
   neither it nor `patches.ts`. Overlay run with only that file served at its
   HEAD version (`tsc-overlay-patches.mjs`) → **exit 0**, "overlay files
   applied: 1 of 1; diagnostics: 0".
8. **Final vitest** over `runtime/llm`, `runtime/recovery` and
   `flow-bootstrap/tests/generation-failure.test.ts` → **Test Files 3 failed |
   43 passed (46); Tests 9 failed | 653 passed (662).**
   - **My files all pass:** `failure-disposition.test.ts` (6),
     `deepseek-evidence-preflight.test.ts` (12), `deepseek-provider.test.ts`
     (24), `harness/tests/*` (4 + 4 + 4 + 11), `exploration.test.ts` (5),
     `evidence-loop-provider.test.ts` (6), `opaque-target-override.test.ts`
     (5), `harness.test.ts` (33), the `execution-grant*` tests, and
     `generation-failure.test.ts` (43).
   - **The 9 failures** are 3 each in `recovery/annotation/tests/annotate.test.ts`,
     `annotation/tests/patches.test.ts` and `recovery/tests/plan.test.ts`. They
     cover a patch-kind allowlist and "no patch when the result is no longer
     achievable". All three files are another worker's uncommitted edits, and
     all three passed in command 5.
9. **`node scripts/structure-audit.mjs`**, final → **exit 0**, "passed (156
   warning(s), 354 baselined)". No failures and no "can be lowered" notice.
   New advisory warnings from my change:
   - `llm/harness/` now has 19 files (the advisory threshold is 15);
   - `tests/deepseek-provider.test.ts` is 413 lines (threshold 400).
   The baselined count read 355 on my first run and 354 on later ones. I did
   not find the cause, and the audit asked for no baseline change.
10. **Regression check outside the brief's scope** (run before the
   disposition fix): vitest over
   `runtime/tests/deepseek-bootstrap-exploration.test.ts`,
   `deepseek-recovery-requests.test.ts`, `llm-deepseek-flow-bootstrap.test.ts`,
   `runtime/tests/service-bootstrap` and
   `service-adaptation/tests/llm-diagnosis.test.ts` → **12 files passed, 1
   failed; 93 of 94 tests passed.**
   - The failure is `deepseek-bootstrap-exploration.test.ts` › "stops after
     three unusable decisions in a row…". Only `evidenceLoop.evidenceBytes`
     differs: expected 0, received 1536.
   - That counter is only changed in `llm/evidence-loop.ts`. Its uncommitted
     diff, which is another worker's, now charges unusable-decision feedback
     through `reserveEvidence(feedback)`. So I attribute this failure to that
     work, not to C-7b. This rests on reading the diff; I did not isolate it
     by reverting their file.

## Not verified

- **No live DeepSeek run.** Nothing here was run against the real provider,
  and I made no live provider calls.
- **Full suites not run.** I did not run `pnpm check`, `pnpm test`, or
  anything outside the scopes listed above.
- **No live campaign.** I did not check whether any live demo page trips the
  new credential screen or the loop-evidence refusal. My expectation that none
  does rests on reading the web domain's sanitizer.
- **Core docs not updated.** `docs/architecture/` does not yet mention the
  pre-send evidence check, the new pre-flight code, or the request's
  `deniedEvidenceKeys`. The brief did not ask for it.

## Open questions or contradictions found

1. **Resolved: the disposition diff.** It is applied, in the files the
   coordinator assigned me. `llm.provider_exploration_evidence_invalid`
   maps to `END_GRANT`, as `llm.provider_failure_evidence_invalid` does, and
   the test now counts eighteen pre-send refusals.
   `flow-bootstrap/generation-failure.ts` already names
   `flow_bootstrap.provider_exploration_evidence_invalid` (the build-loop
   worker added it), so nothing more is needed there. The only remaining
   type error belongs to another worker (command 7).
2. **The credential screen is new behaviour on the failure-evidence and
   loop-evidence slots too**, not only on explored packets. I read the brief's
   "same pre-send check" as one rule for every slot. A refusal there ends the
   execution grant, because every pre-flight code maps to `end_grant`. The
   shapes are narrow, but a live demo page that displays a real-looking token
   would now stop the call. Watch campaign records for
   `llm.provider_failure_evidence_invalid`,
   `llm.provider_exploration_evidence_invalid` and
   `llm.provider_evidence_loop_context_invalid`.
3. **Refusing, rather than removing, loop evidence with a denied key ends the
   whole exploration or bootstrap loop.** That follows the brief ("choose the
   failure-evidence behaviour"). One latent case: Core's built-in
   `core.flow_graph` harness option returns node parameter values. For a web
   Flow those include keys named `selector`, so if a host ever binds
   `describeFlowGraph`, every later decision would be refused. No production
   code binds a host today (`automationStudioHarnessOptionRegistry` is only
   called with `{ binding }`).
4. **The exploration's `explored` list can still hold a packet with a denied
   key**, because the loop accepted it before the next decision was refused.
   The runtime patch packer withholds such a packet, as it did before, so it
   is never sent.
5. **One remaining default-to-empty, in a file not mine.**
   `sanitizeAutomationStudioLlmFailureEvidence(taskKind, evidence, deniedKeys = [])`
   still defaults, and `recovery/annotation/annotate.ts:184` passes
   `ports.llmEvidenceRuntime?.deniedEvidenceKeys`, which can be undefined.
   Today the packer and the provider re-check with the real declaration, so it
   is not a live leak. Making `deniedKeys` required would need `annotate.ts`
   to change too. Suggested diff:
   - in `failure-evidence.ts`, drop `= []`;
   - in `annotate.ts:184`, pass `ports.llmEvidenceRuntime.deniedEvidenceKeys`
     (the enclosing `if` already requires `ports.llmEvidenceRuntime`).
6. **Optional tidy-up.** `recovery/annotation/patches.ts` still imports
   `automationStudioExploredEvidenceHandle` from `./exploration.ts`, which is
   now a re-export. It could import from `../../llm/index.ts` instead, and the
   re-export line in `exploration.ts` could then be removed.
7. **Slots not covered by the provider re-check.** `reusableContext` and
   `recoveryContext` are not re-checked at send time; the packer still
   sanitizes `reusableContext`. I did not treat them as evidence slots.
   Covering them would need more pre-flight codes.
8. **Harness requests now carry the declared key names.** Every
   harness-built request now carries `deniedEvidenceKeys` (key names only,
   never sent to the provider). Anything that stores `result.request` whole
   will now store that list too.
