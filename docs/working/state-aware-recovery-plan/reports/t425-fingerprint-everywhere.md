# t425: the full fingerprint on every save path, and a save-time guard

This is a worker report. Both trees are under `fxwork/t425/` on `task/t425-fingerprint-everywhere`. Nothing was
committed, and Core was not changed.

## Outcome

**Partial.**

**Done:**
- One shared builder now makes a saved step's control identity. The recording path and the runtime-repair path both
  use it.
- A mechanical guard refuses a control with fewer than two independent signals besides its address. A build's step
  is refused at its script line. A runtime repair, which `edit_action_target` saves, is refused too.
- A recorded step is still proposed, but its proposal says why the control may not be found again.
- The repair equivalence check now reads the packet's label.
- Tests sit beside each change.

**Not done.** In-run repair steps (`replace_unit`, `add_handler`, and the steps `temporary_action_sequence` inserts)
are not covered. Core saves their `parameters` exactly as the model wrote them, and no domain code ever sees them.
Covering them needs a Core hook and a task of its own (see Open questions, item 1).

**Deliberately not done.** There is no guard on Core's generic `saveFlow`. See Open questions, item 2.

### What the coordinator asked: the guard and hand-authored matrix Flows

**Choice: the guard judges only an identity that is being made right now.** That means:
- an identity a handle resolution builds from evidence;
- a runtime repair;
- a recorded step (described, not refused).

A step that names no handle is left alone. The plan resolver answers `unchanged` for it, and the guard never sees it.
This covers a hand-authored literal-selector step, including a matrix typing step with a literal `element`, and any
step a Flow already holds. It is pinned by the test "a step that names no handle is one the Flow already holds, or a
person wrote, and is never re-judged" in `identity-guard.test.ts`.

The guard is not weakened for model-built, recorded or repaired identities. The matrix Flows were not given
identities.

Proof: matrix cases 1 and 2 compiled and played, provider-free and headed, and both **passed** (results below).

## What changed and why

### 1. Audit: what each save path stored before this task

| Path | Before t425 | After |
| --- | --- | --- |
| **Recorder** (`content/describe-element.ts`; projected whole by `background/connection/gateway-payloads.ts` `elementTarget`) | Every signal: tag, selector, xpath, id, class tokens, visibleText/text, value (when capture is on), role, `name` attribute, href, inputType, checked, testId, accessibleName, label, implicitRole, context, and every attribute (held values withheld when sensitive). `recorded-event*.ts` only classify and label events and carry no identity. | Unchanged. It was already complete. |
| **Recording to node** (`domain/src/output-nodes/payloads.ts`, reached through `io/input-model.ts` and `io/web-automation-io.ts`) | `elementFingerprint(payload.element)`: every signal above, **plus what the control held**. That is a text field's typed `value`/`text`, a select's option words, `checked`, and value or state attributes. | The shared builder: every signal, never contents or state. |
| **Recording proposals** (`domain/src/web-panel-host.ts`, the mapper's `candidate()` and `recordedActionEntry()`) | Passed parameters through. | The same, plus a `description` naming the shortfall when the identity is thin. |
| **Runtime repair** (`runtime/llm-evidence/target/override.ts`, used for a temporary override and the durable `edit_action_target`) | 4 identity signals: tag, role, accessibleName, visibleText. Plus a selector hint and `metadata` (frame, inputType, controlType, formId, listIndex, listTotal). The packet's label, id, name, classes, test id and placeholder were never read. | Full fingerprint through the builder, flat: adds implicitRole, label, id, name, classNames, testId, inputType, href, and the attributes that describe the control. Field contents are dropped. A thin identity is refused. `metadata` is unchanged, and no `context` is written, so the recording's record still wins (`withRecordedRecord`). |
| **Core `runtime/live-patch*` and durable `edit_action_target`** | Core stores the domain's resolved target unchanged (`live-patch.ts:601` → `graph-flow-patch.ts:43`), bounded at 4,000 serialized characters (`isAutomationStudioRuntimeTargetOverrideTarget`). | Inherits the full fingerprint with no Core change. When the target would exceed 3,800 characters, the domain drops `attributes` and `classNames` first. |
| **In-run repair `replace_unit` / `add_handler` (t392)**, and `temporary_action_sequence` steps | Core writes each step's `parameters` as the model wrote them (`live-patch/step-insert.ts:73`, `handler-build.ts`, `unit-replace.ts`). Only bootstrap paths call `resolvePlanNodeParameters`. These steps store **no fingerprint**. A handle written there is not resolved by any domain code. | **Not changed.** Open questions, item 1. |
| **Model-built steps** (`plan-resolution/element-identity.ts`, owned by t422) | tag, role, accessibleName, visibleText (not for content controls), selector, inputType, context {formId, listPosition, shadowHosts, record}. No label, id, name, class or test id. | Not touched. The builder is exported as `webPacketElementFingerprint(element, { selector, context })` from `runtime/llm-evidence/target`, for t422 to adopt. |
| **Lab and demo** (`packages/test-runner/src/demo-workspace/flow-document.ts`; `recovery-matrix/compile/compile-flow-script.ts`) | Selector-only nodes such as `[data-testid=…]`, and literal-selector scripts with no domain resolution. | Not owned and not changed. These pass no guarded seam. |

### 2. Shared builder: new directory `domain/src/element-fingerprint/`

| File | What it does |
| --- | --- |
| `source.ts` | `WebElementFingerprintSource`: the shape every save path hands the builder. |
| `build.ts` | `webElementFingerprint(source)`. Output is the recorded node's own `WebAutomationElementFingerprint`, in the wire reader's key order, so a recorded node keeps its bytes wherever no rule changed a field. |
| `from-descriptor.ts` | `webElementFingerprintFromDescriptor(wire)`: a recorded element through `elementFingerprint`, then the builder. Used by `output-nodes/payloads.ts`. |
| `signals.ts` | `webElementIdentitySignals(fp)`. |
| `shortfall.ts` | `webElementIdentityShortfall(fp)`, plus `WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS = 2` and the closed code `web.target.unidentifiable`. |
| `runtime/llm-evidence/target/packet-fingerprint.ts` | `webPacketElementFingerprint(element, { selector, context })`: a packet element through the builder. It keeps only the attributes that describe the control (id, name, class, type, role, placeholder, aria-label, title, alt, test ids) and skips withheld strings. |

**What the builder carries:**
- tag, role, implicitRole and inputType (taken from `type` when absent);
- visibleText, text, accessibleName (`aria-label` as a fallback) and label;
- the authored id and `name` attribute (from attributes when absent);
- each class token on its own, de-duplicated (split from `class` when absent);
- a test id from `data-testid`, `data-test`, `data-cy` or `data-qa`;
- href, attributes, context, selector and xpath.

**What it never carries:**
- On a content control (textarea, select, or an input whose type is not button, submit, reset, image, checkbox or
  radio), no visibleText, text or value, and no `value` attribute.
- On any control, no `checked`, and no state attributes (`checked`, `selected`, `aria-checked`, `aria-selected`,
  `aria-pressed`, `aria-valuenow`, `aria-valuetext`).
- On a secret control, no visibleText, text, value or accessibleName. Its label, placeholder and structure are kept.

**What the guard counts.** Only signals the page actually finds a control by. Each counts once; selector and xpath
are excluded.
- **kind:** tag, role, implicitRole and inputType together count as one signal.
- **words:** each distinct visibleText, text, accessibleName or label, compared ignoring case and spacing.
- **id, testId and `name`:** each counts **unless the selector is addressed through that token**. So R4a's
  `{ tagName: "input", selector: "#fb1l6ufkg" }` still counts 1 when the regenerated id is also written beside it.
- **classNames:** one signal, counted while a token the selector does not quote is left.
- **Not counted:** record, form, list position, landmark, shadow hosts and href. Each is a gate or is compared by
  nothing.

### 3. Seams

**Build.** In `plan-resolution/resolve-plan-node.ts`, `resolveNode` refuses with `web.handle.unidentifiable` at the
handle's slot. That is the existing refusal path, so the model sees `["web.handle.unidentifiable",
"web.handle.unidentifiable:selector"]` and Core's general "correct and resubmit" advice. It never sees a selector, an id
or a signal list.

The refusal applies only when all of these hold:
- the node is an element node;
- a target handle was resolved;
- the call is not `gatedByCaller`, so exploration, node runs, replays and verification are never judged;
- the node is not a fact target.

The new code is the last entry in `WEB_PLAN_HANDLE_ISSUE_CODES`. It maps to `target_ambiguous` in
`tool-rejection.ts`, whose test requires every code to have a reason. The check lives in a new file,
`plan-resolution/identity-guard.ts`, so that `resolve-plan-node.ts` stays under its 800-line limit (786 lines).

**Repair.** `override.ts` refuses as `{ status: "ambiguous", reason: "target_indistinguishable" }`. That is Core's
closest closed word. I added no new Core reason.

**Repair equivalence.** `target/equivalence.ts` `evidenceNames` now includes the packet's `label`. Without it, a
repair to R4a's quantity box, whose only name is its sibling label "Quantity", was refused as `target_unanchored`.

**Recording.** The proposal carries the shortfall text as its `description`. The step is not refused, because
dropping an act the person recorded without a word is worse.

### 4. Matcher (`apps/extension/src/content/identity/score.ts`, read only)

**What it sends Core.** `comparableFingerprint` sends:
- visibleText, accessibleName and label;
- id and testId (or `attributes["data-testid"]`);
- tagName, and role (falling back to implicitRole);
- selector and classNames.

An id or selector whose token is generated, or carried by no element on the page, is dropped (`page-tokens.ts`). The
`name` attribute, placeholder, inputType, href, other attributes and context are not scored. Record and shadow hosts
act as gates instead.

**How Core scores.** Core (`fingerprinting/element-fingerprint.ts`) adds up weight × similarity over every signal and
normalises the total by the possible weight:
- **Text** (24/24/20): +similarity when similarity ≥ 0.35, −0.55 when below, −0.45 when the text is missing.
- **id and testId** (26/28): +1 when equal, −0.1 when missing, −0.8 when contradicted.
- **role and tag:** ±.
- **classNames** (5): Jaccard overlap when ≥ 0.2, otherwise −0.1.

**No single signal vetoes.** A contradicted id costs about −20.8 of roughly 90+ possible weight, and agreeing words,
label, tag, role and classes outweigh it. The selection then applies a floor of 0.35, a margin of 0.2, and
corroboration (`corroboration.ts`): the winner needs one exact agreement among visibleText, accessibleName, label, id
and testId. `veto.ts` refuses a match the exact lookup (Level 1) already chose only when the net score is below 0,
which is again an aggregate.

**Two caveats:**
- `hasIdentitySignal` returns `unmatched` when nothing but kind is left. That is R4a.
- A control known only by kind and classNames can be ranked but never corroborated. It is found only by Level 1 (its
  selector or a class-set query in `element-finder.ts`).

## Commands run and observed results

Paths below are relative to `fxwork/t425/!FluxIQWebExtension`.

| Command | Result |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` in `domain` | clean |
| `npx tsc -p tsconfig.test.json --noEmit` in `domain` | clean |
| `npx tsc -p tsconfig.json --noEmit` in `apps/extension` | clean (12 s) |
| `DOMAIN_TEST_BUILD_LABEL=t425 node scripts/test-domain.mjs src/runtime/llm-evidence src/tests/ src/output-nodes src/io src/client src/recording src/element-fingerprint` in `domain` | `tests 1320, pass 1317, fail 3` |
| Same, after the last edits, narrowed: `… src/runtime/llm-evidence/plan-resolution src/runtime/llm-evidence/target src/element-fingerprint src/tests/recorded-identity src/output-nodes src/runtime/llm-evidence/tests/tool-rejection src/runtime/llm-evidence/tests/renamed-save` | `tests 417, pass 417, fail 0` |
| `… src/tests/recorded-identity src/tests/domain.test src/tests/web-panel-host src/tests/core-gateway-recording-order` | `pass 14, fail 0` |
| `node scripts/structure-audit.mjs` (downstream) | `passed (184 warning(s), 651 baselined)` — the same count as before the change |
| `node scripts/structure-audit.mjs` (Core) | `passed (322 warning(s), 1160 baselined)` |
| `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 1` | `{"matrixRunId":"rmx-2026-10-10T19-12-49-002Z-a8101e",…,"cases":[{"caseId":"1","verdict":"passed","reasons":[]}]}` |
| `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 2` | `{"matrixRunId":"rmx-2026-10-10T19-16-02-120Z-d14149",…,"cases":[{"caseId":"2","verdict":"passed","reasons":[]}]}` |

**The 3 failures are not caused by this change.** They are in `node-run/retries/tests/dispatch.test.ts` ("an exploring
press whose confirmation was lost…") and `lasting-act.test.ts` (#21 and #23). I reverse-applied my patch
(`git apply -R`), ran `src/runtime/llm-evidence/node-run/retries/tests/` on the base code, and observed the same 3
failures (`pass 36, fail 3`). Then I re-applied the patch.

**An earlier matrix attempt was refused,** because a source edit landed while the Lab was building ("The domain build
is 1 minute(s) behind its source"). Both passing runs above were made after the last source edit.

**Expectations changed deliberately, each with a comment:**
- `output-nodes/tests/payloads.test.ts`: a recorded check no longer carries `checked` in `element`.
- `llm-evidence/tests/renamed-save-override.test.ts`: the repair now carries implicitRole, classNames and attributes.
- `plan-resolution/tests/resolve-plan-node.test.ts`: the list of issue codes gains the new code.
- `plan-resolution/tests/printed-tool-results.test.ts`: the exploration probe now passes `gatedByCaller`. The
  candidate step on the wordless thumbnail now accepts either `resolved`, or a refusal made only of
  `web.handle.unidentifiable`. Before t422 that identity is {kind} alone; t422's classes make it resolve outright.

**New tests:**
- `element-fingerprint/tests/{build,shortfall,from-descriptor}.test.ts`
- `plan-resolution/tests/identity-guard.test.ts`
- 2 tests appended to `target/tests/override.test.ts`
- `domain/src/tests/recorded-identity-shortfall.test.ts`

## Not verified

- **No live or paid run.** No browser test exercised a repair or a build refusal end to end.
- **Matrix cases 1 and 2 only.** Their Flows are hand-authored, so they prove "still saves and plays", not the guard.
- **Model-built identities with t422 merged.** The interaction is reasoned through, not run.
- **The `description` on a thin recorded proposal.** I did not check how the panel displays it.
- **No full suites,** per the rule.

## Open questions or contradictions found

1. **In-run repair steps have no fingerprint and no guard.** This covers `replace_unit` and `add_handler` (t392), and
   `temporary_action_sequence`.

   *Why:* Core stores `step.parameters` verbatim, and nothing resolves the handles in them.

   *Proposal for a follow-up task (Core and downstream):*
   - In Core, around `recovery/annotation/in-run.ts` or the overlay preflight, resolve each step through the binding's
     `resolvePlanNodeParameters` before overlay.
   - In the domain, make failure and exploration packets resolvable by the target-packet store. Today
     `failurePackets` and `toolPackets` sit outside `targetPackets`.

   The builder and the guard then apply automatically.

2. **The panel and hand-saved Flows are not guarded.**

   *Why:* Core's `saveFlow` has no domain hook. `flows/writer.ts` checks graph structure only.

   *What it would cost:* a generic hook would refuse every selector-only, hand-authored Flow, which includes the matrix
   and demo workspaces.

   *My choice:* guard only identities being made, and leave an existing or hand-written step alone. If people editing
   a target in the panel must be guarded too, Core needs a hook scoped to the nodes whose target changed. That
   decision is the supervisor's.

3. **Choices that differ from t422's current rules:**
   - **Select option words:** I dropped them, the same as t422, though recordings used to keep them. This could
     weaken a recorded select that has no label, name or id.
   - **The repair refusal word:** it reuses `target_indistinguishable` rather than a new Core reason.
4. **For t422:** adopting `webPacketElementFingerprint` gives model-built steps the label, id, name, classes and test
   id that R4a lacked. The guard then passes the quantity box on its label and class, even though its regenerated id
   is quoted by its selector.
5. **Docs not updated:** `docs/architecture/` is not in this brief's ownership. The guard and builder need a paragraph
   there, next to the recording and repair contracts.
