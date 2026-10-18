# lane4-w6-drawing-every-path (live-lane-4, t567)

## Outcome

Done. The `drawing` signal is now saved on two more paths:

- **Recording.** The gateway projection sends it.
- **Runtime repair.** The domain's repair override writes it, and Core's element-target normalizer keeps it.

Core treats it as an opaque, bounded token. It never scores or interprets it.

## What changed and why

### Extension

- `apps/extension/src/background/connection/gateway-payloads.ts`:
  - `elementTarget` now writes `drawing: element.drawing`.
  - It is kept for a sensitive control, like `attributes`. A drawing is geometry and image paths, never a control's contents.
  - The doc comment says so.
- `apps/extension/src/shared/dom-element.ts`:
  - `"drawing"` is removed from `UnwiredElementField`, along with its paragraph.
  - It is added to `DomElementIdentitySignal`, so `WiredIdentitySignals` now fails to compile if the wire ever drops it again.
- `apps/extension/src/background/connection/tests/gateway-payloads.test.ts`:
  - `drawing` is added to `WIRE_ELEMENT_FIELDS`, `IDENTITY_SIGNALS` and the `fullyDescribed` fixture.
  - New test: "a recorded wordless icon carries its drawing to the gateway payload and its Flow-node element". It covers:
    - the wire key;
    - the domain's `elementFingerprint` reading it;
    - a sensitive control keeping it;
    - no key when the icon draws nothing.

### Domain

- `domain/src/runtime/llm-evidence/target/override.ts`:
  - `validateWebRuntimeTargetOverrideEvidence` takes a new optional 5th parameter, `drawings?: ReadonlyMap<string, string>` (the binding's side channel).
  - It passes `drawing` to `webPacketElementFingerprint`, so the floor counts it.
  - It writes `drawing` on `WebResolvedRepairTarget`. When the size bound applies, `drawing` is kept.
- `domain/src/runtime/llm-evidence/tools.ts` (one line, outside the listed ownership): the retained-packet call now passes `retained.drawings`. Without that line no caller can hand the override the drawing. It is not on the must-not-touch list.
- `domain/src/runtime/llm-evidence/target/tests/override.test.ts`, two new tests:
  - A repair onto a wordless `<button>` (one hashed class, the only button in its recorded form) is `resolved`, carries the drawing, reads back through `elementFingerprint`, and passes `webElementIdentityShortfall`. The packet never contains the drawing.
  - Without a drawing, and with a drawing in the binding but not passed, the same repair is refused `target_indistinguishable`. The floor is unchanged.

### Core (`!FluxIQ`)

- `packages/fluxiq/src/programs/automation-studio/model/action-element-target.ts`:
  - `drawing?: string` is added to `AutomationStudioElementTargetFingerprint`, so candidates have it too.
  - `normalizeFingerprint` reads it from the value or from `metadata.drawing` through `readDrawing`. `readDrawing` accepts one token: trimmed, 1–64 characters, printable ASCII with no whitespace (`/^[!-~]+$/u`). Anything else is dropped, never truncated.
  - `"drawing"` is added to `promotedFingerprintMetadataKeys` and to `validateFingerprint`'s empty-signal list.
  - `hasFingerprintSignal` is deliberately unchanged: Core does not count the drawing as an identifier.
  - The element matcher (`fingerprinting/element-fingerprint.ts`) is untouched.
  - Other undeclared keys are still dropped.
- `.../model/tests/action-element-target.test.ts`, two new tests:
  - The drawing is kept across the shapes a target arrives in:
    - the flat repaired target (and an unknown key is still dropped);
    - the canonical `{kind, fingerprint}`;
    - candidates;
    - `metadata`;
    - an action `element`.
  - Page words, 65 characters, a non-string, or blank are dropped, and 64 characters is kept.
  - A target holding only a tag and a drawing still normalizes to `null`.

### Docs

- Core `docs/architecture/package-boundaries.md`: a new Migration Notes entry, "an element target keeps a domain's drawing digest".
- Core `docs/architecture/automation-studio-native-nodes.md`: a paragraph on the declared-fields-only rule and the opaque `drawing`.
- This repo, `docs/architecture/element-identity.md`:
  - The `stableFingerprintMatches` order now includes the drawing.
  - A new paragraph covers where it is saved on every path, Core's bound, the floor, and that the model never sees it.

## Commands run and observed results

- `npx tsc -p tsconfig.test.json` in `apps/extension`: exit 0, no output.
- `EXTENSION_TEST_BUILD_LABEL=lane4-w6 node scripts/test-extension.mjs background/connection/tests shared`: `# tests 333`, `# pass 333`, `# fail 0`. The new row printed `ok 118 - a recorded wordless icon carries its drawing to the gateway payload and its Flow-node element`.
- `npx tsc -p tsconfig.test.json` in `domain`: exit 0, no output (final run).
- `DOMAIN_TEST_BUILD_LABEL=lane4-w6 node scripts/test-domain.mjs runtime/llm-evidence element-fingerprint` (final): `# tests 1198`, `# pass 1198`, `# fail 0`.
  - Intermediate runs failed only my new tests, and the failures were in the fixtures:
    - `handle_incompatible`: a span without `hasClickHandler`.
    - `target_unanchored`: a wordless control needs a recorded form.
    - The no-drawing case resolved because a `role` exempts the lone-class rule. The fixture became a bare `<button>`.
- `npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq`: exit 0.
- `npx vitest run src/programs/automation-studio/model` from `packages/fluxiq`: `Test Files 15 passed (15)`, `Tests 120 passed (120)`.
- Core `node scripts/structure-audit.mjs`:
  - The first run failed `[as-never]` on my test, line 150. I removed the cast; the normalizer takes `unknown`.
  - Final: `structure-audit: passed (400 warning(s), 1154 baselined).`
- This repo's `node scripts/structure-audit.mjs`:
  - One run failed `[contract-spread]` on my override test, line 404. I rewrote the fixture without a conditional spread.
  - Final: `structure-audit: passed (210 warning(s), 638 baselined).`
  - Earlier runs also showed failures in `apps/extension/src/content/action-runtime/**`, another worker's files in progress. They were gone by the final run.
- No dist was built and nothing was committed.

## Not verified

- **End to end across the repositories.** The domain and extension resolve `fluxiq/automation-studio` from Core's `dist`, which I did not rebuild (per the brief). Until it is rebuilt, a domain path that runs through Core's normalizer still strips `drawing`, because it uses the old build. The Core change is proven only by Core's own vitest.
  - After a Core build, `plan-resolution/tests/identity-guard` and a test that sends a repaired target through `normalizeAutomationStudioElementTarget` should be re-run.
- Whether Core's `edit_action_target` (or another Core save path) stores the repaired target through this normalizer or raw. I changed only the normalizer, per the brief.
- No live Lab run and no loaded-extension browser test.
- Full package suites were not run (per AGENTS.md).

## Open questions or contradictions found

1. **`tools.ts` edit.** It is outside the listed ownership but needed: it is the only caller holding the binding. It is a one-argument addition.
2. **Wordless repair needs an anchor.** A repair onto a wordless control passes the equivalence check only when it is anchored, for example as the sole control of its kind in the recorded form. In a list row with no form it is refused `target_unanchored` whether or not it has a drawing. The equivalence check does not compare drawings. Using a matching drawing as an anchor would be a separate design decision; I left `equivalence.ts` alone.
3. **Core's identifiability rule.** `hasFingerprintSignal` does not count `drawing`, `classNames` or `tagName`. A repaired target with no selector, holding only a tag, a class and a drawing, would normalize to `null` at dispatch. Repairs from a retained packet carry a selector, so this does not arise today.
