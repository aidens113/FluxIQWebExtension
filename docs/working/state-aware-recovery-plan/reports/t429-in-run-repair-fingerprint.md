# t429: a step an in-run repair writes is resolved and fingerprinted like a built step

This is a worker report. Both trees are under `fxwork/t429/` on `task/t429-in-run-repair-fingerprint`. Nothing was
committed. Core was changed (the repository boundary is crossed, as the brief asked).

## Outcome

**Done.**

Before a repair patch is overlaid on the held run, Core now puts every step it writes, and every handler fact target,
to the domain through the build's own seam (`resolvePlanNodeParameters`, by way of
`resolveAutomationStudioFlowBootstrapPlanParameters`). That covers `temporary_action_sequence` steps, `add_handler`
steps and facts, and `replace_unit` steps and handler.

What this means:
- A handle becomes the selector plus the full identity from t425's one builder.
- t425's guard refuses a thin identity (`web.handle.unidentifiable`).
- An unknown handle is refused.
- A handle is never overlaid or saved raw.
- The adaptation saved after the judged end carries the resolved parameters.

## What changed and why

### Core (`C:/Users/osrs_/FluxStuff/fxwork/t429/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`)

| File | Change |
| --- | --- |
| `llm/harness-options/binding.ts` | `resolvePlanNodeParameters` input gains optional `handleEvidence?: JsonObject`: the one packet a repair step's handles were issued in. It is absent for a build. Domain-neutral; no web words. |
| `llm/harness-options/plan-parameter-resolution.ts` | `resolveAutomationStudioFlowBootstrapPlanParameters` takes `handleEvidence` and hands it (cloned) to the resolver with every node and fact. Header paragraph added. Nothing else changed. |
| `recovery/annotation/step-evidence-resolution.ts` (new) | `automationStudioRecoveryStepResolution(...)` returns `(patch) => {ok, patch} \| {ok:false, code, reason, issueCodes}`. See below. Exported through the annotation barrel. |
| `service/runtime-session/in-run-repair.ts` | `applyPatches` calls the resolver after the permission gate and before `prepareAutomationStudioInRunRepair`, and overlays `resolved.patch`. Each step's permission check is the recovery gate's `checkFor({kind:"flow_step", ...})`, or `automationStudioActionPermissionDenied` when there is no gate. `Refusal` gains optional `issueCodes`, which the ledger receipt records. |

**How the resolver treats each step and fact:**
- **Routing:** a step's handles are routed the way a target override's are (`target-evidence-check.ts`).
  - Unqualified handles use the failure packet.
  - Handles qualified with one explored label (`explored.N:tM`) use that explored packet, with the qualifier removed.
  - A step is refused without asking anyone (`bootstrap.handle_not_issued`) when it mixes packets, names an uncarried
    label, or names a handle when no packet was shown.
- **The question:** each step is asked as a one-node plan, with `handlesIssued: true`. Its `declaredConsequences` are
  the patch's `consequences`.
- **Fact targets:** a fact target `{handles:{k:h}}` must name exactly one handle, or it is refused. It is resolved as
  the build resolves one, under `fluxiq.fact.target`, and the domain's answer becomes the fact's `target`. That is the
  `{selector, element}` shape that `domain/src/runtime/facts/query.ts` reads. Before this change a raw `{handles}`
  target could never evaluate.
- **No domain bound:** a step with no handle stands as written, because the gate already answered for it. A step with
  a handle is refused (`bootstrap.handle_resolution_unavailable`).
- **Reason text:** the sentence a person reads is "The fix's step N names a control that could not be tied to the page
  the model was shown, so the fix was not used." It never says how a control is found. The codes go in `issueCodes`
  only.

### Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t429/!FluxIQWebExtension/domain/src/runtime/llm-evidence/`)

| File | Change |
| --- | --- |
| `plan-resolution/packet-targets.ts` (new) | `webLlmPacketTargets(scope, binding)`: a `WebLlmTargetPackets` store holding one retained packet's handles and no others. Exported in the barrel. |
| `tools.ts` | `retainedFor(evidence)` is shared by `validateTargetOverrideEvidence` and `resolvePlanNodeParameters`; it looks in the `failurePackets` and then the `toolPackets` window by retention key. With `handleEvidence`, the step resolves from that retained packet alone, through `resolveWebPlanNodeParameters`. That brings the same element identity (t425 builder), the identity guard, press/control checks and permission gating. A packet that was not retained answers `refused ["web.handle.unknown"]`. Without `handleEvidence`, behaviour is unchanged. The file is 771 lines. |

## Commands run and observed results

| Command (tree) | Result |
| --- | --- |
| `pnpm run check` (Core `packages/fluxiq`) | clean (last run after the final edit) |
| `npx vitest run …/recovery/annotation/tests/step-evidence-resolution.test.ts` | `12 passed (12)` |
| `npx vitest run …/llm/harness-options/tests …/recovery/annotation/tests …/service/runtime-session/tests …/tests/in-run-repair` | `Test Files 43 passed (43)`, `Tests 431 passed (431)` |
| `npx vitest run …/tests/service-bootstrap/tests/plan-parameters.test.ts …/flow-bootstrap/candidate/tests …/recovery/in-run-repair …/live-patch` | `15 passed (15)`, `116 passed (116)` |
| `pnpm run build` in Core `packages/contracts`, then `packages/fluxiq` | contracts reused (stamp); fluxiq rebuilt |
| `DOMAIN_TEST_BUILD_LABEL=t429 node scripts/test-domain.mjs src/runtime/llm-evidence/tests src/runtime/llm-evidence/plan-resolution` (domain) | `tests 347, pass 347, fail 0` |
| `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` (domain) | both clean |
| `npx tsc -p tsconfig.json --noEmit` (apps/extension) | clean |
| `node scripts/structure-audit.mjs` (downstream) | `passed (184 warning(s), 651 baselined)`, the same as t425's |
| `node scripts/structure-audit.mjs` (Core) | `passed (323 warning(s), 1160 baselined)`. That is +1 against t425's 322: `service-proofs.test.ts` is now 428 lines (advisory). |
| `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 1` | `rmx-2026-10-10T20-24-16-989Z-3acfc8`, case 1 **passed** |

The first audit runs failed twice, and both were fixed:
- Core `as-never`, in my test.
- Downstream `contract-spread`, in my test.

### Tests added, beside each change

**Core `recovery/annotation/tests/step-evidence-resolution.test.ts` (12 tests):**
- An inserted step resolves from the failure packet. The domain is asked with `handleEvidence` equal to that packet.
- An explored qualified handle resolves from its packet, with the qualifier stripped.
- An unknown handle is refused, and so is a thin identity (`unidentifiable`). The reason has no finding words.
- A step is refused without asking anyone when its label is uncarried, its packets are mixed, or no packet was shown.
- An `unchanged` answer for a handle is refused (`bootstrap.handle_unresolved`).
- With no domain, a plain step stands and a handle is refused.
- A step with no handle is still asked about.
- A step the domain says needs permission answers `permission_required`.
- `add_handler`: its body and its `when`/`completionCheck` targets are resolved, and no `handle(s)` key is left.
- A fact with two handles is refused, and so is a fact with an unknown handle.
- `replace_unit`: its steps resolve, and a handler replacement with a thin step is refused.
- A wait-retry patch is left alone.

**Core `tests/in-run-repair/tests/service-proofs.test.ts` (+2, through the real service and executor):**
1. A `replace_unit` whose step names `{control:{handle:"t7"}}`:
   - the domain is asked with the failure packet;
   - the trial presses "fixed";
   - the judge sees the stored Flow unchanged;
   - after the judged end the stored node is `{control:"fixed", element:{tagName, accessibleName, testId}}`, and the
     applied adaptation's patch has no handle.
2. An unknown handle:
   - the run fails, and nothing presses the fix;
   - the stored node stays `{control:"broken"}`;
   - the receipt is `{outcome:"none", code:"step_unresolved", issueCodes:["example.handle.unknown"]}`.

`STEP` gains an optional `element` parameter.

**Downstream `tests/recovery-selector-hints.test.ts` (+5, real runtime, captured failure and explored packets):**
- A failure-packet handle resolves to `#keep`, with tag, role and name.
- An explored handle resolves from its own packet. The same number in the failure packet resolves to that packet's
  control. With no packet, the build's views are used and it is refused `web.handle.unknown`.
- An unknown handle is refused, and so is an edited (unretained) packet.
- A wordless button is refused `web.handle.unidentifiable`, while the worded control beside it resolves.
- A typed field resolves with label, `name`, testId and class tokens, and with no `value`. That is the full builder
  output.

## Not verified

- **No live or paid run, so R4b itself was not run.** Nothing exercised a real model writing a handle-bearing repair
  on a realistic scenario.
- **Recovery-matrix case 1 only.** Its Flow is hand-authored and does not reach in-run repair. It proves "still builds,
  plays and passes", not this path.
- **The after-run (detached) applier `recovery/annotation/patches.ts` is not covered.** It still runs
  `temporary_action_sequence` steps as written. Per `step-insert.ts` that path is trial-only and never promoted, so
  nothing is saved from it. It was out of the brief's "overlaid on the live run".
- **Exploration packets returned by Core's own (non-domain) options were not exercised.** Only domain packets are
  retained, so their handles would be refused.
- **No full suites,** per the rule.

## Open questions or contradictions found

1. **`web.dom.wait_for_selector` is offered to the model (reported, not changed).**
   - The model's library is Core's node registry (`node-run/catalog.ts`), which includes
     `web.output.dom-wait_for_selector`.
   - Its label is "Wait For Selector", and its schema (`actions/schemas.ts` `waitForSelectorSchema`) *requires*
     `selector`, typed `string` and labelled "CSS selector".
   - A handle does resolve in its `selector`/`target` slot, because it is in `SELECTOR_NODE_IDS` and
     `ELEMENT_NODE_IDS`, so the model *can* use it by handle.
   - But the model-facing name and parameter say "selector", which t426 treats as a finding word, and the schema
     invites a literal string.
   - The same "CSS selector" label sits on every element action's `selector` property (`elementProperties`).
2. **A literal selector in a repair step is not refused.** A step written `{selector: "#x"}`, with no handle, gets
   `unchanged` from the domain and is overlaid as written, with no fingerprint. This is the same as a build's
   hand-written step under t425's "judge only identities being made" choice. The user's rule (the model names elements
   by handle only) would suggest refusing it for model-written steps. That is a domain decision for the supervisor.
3. **The per-step permission check runs again.** Core's in-run gate first asks about the whole patch's
   `consequences`. Then the domain asks the same gate once per acting step, as it does for a build. If the gate is
   permitted it answers the same way; it records one more declaration per step.
4. **Docs:** `docs/architecture/` is not in this brief's ownership. The repair-step resolution needs a paragraph beside
   the recording and repair contracts, in both repositories.
