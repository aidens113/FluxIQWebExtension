# t499 layer-names-not-effects: worker report

## Outcome

Done. When exploration signs a step's effect, it now leaves out control names that sit only inside a layer the page raised by itself. A step that opened a layer keeps that layer's names. The effect format stays `web-effect.v1`, and the reason is given below.

## What changed and why

- **`domain/src/runtime/llm-evidence/plan-resolution/self-changing/page-raised.ts`** (new): `webLlmPageRaisedNames(before, after)`.
  - It reads layer membership from the capture's own marks. Those marks are written by `llm-evidence/layers.ts`, and this module only reads them.
  - The layers are the `blockedBy[].target`, `dialogs[].target` and `covers`/`coversCount` elements, plus `isDialog` elements.
  - An element is in a layer when it is the layer's element, sits under it in the packet tree (`parent`, in the composed tree), or is marked `inDialog` of it.
  - It returns the hashes of control names that appear only inside page-raised layers. A name that the page also shows outside those layers is not returned.
- **How page-raised layers are told apart from layers the act opened (goal 2).** A layer is treated as page-raised when either of these holds:
  - **(a)** The capture recognised its `kind`: consent, rate_limit, robot_check, promotion or assistant. The kind can come from the blocker or dialog entry, or from the element's own mark.
  - **(b)** The act left a new document: `navigation.timeOrigin` differs between the two captures, and both are known.
- **Every other layer counts as the act's.** That means a layer with no recognised kind that appeared on the same document. Examples are the dialog that "Change servings" opens and the panel that answers an add, and their names stay required.
- **When an act added nothing except page-raised layer names,** the signer keeps those names, because the act opened that layer (an "Open chat", or a navigation onto a page with a modal).
- **Naming rule.** Controls are named with `route-state/project.ts`'s rule, which is rendered, actionable, `webLlmReadableWords(name ?? text)`. The rule is restated in the new file, not imported, because importing project.ts or the llm-evidence barrel from either side created a 38-module import cycle, which the structure audit rejects. A test checks that every returned hash is one of the route state's own control hashes.
- **`route-state/effect/layer-only.ts`** (new): `webAutomationRouteLayerOnlyHashes(layer, elsewhere)`. It is pure hashing of names through `page-features`, so the normalisation and hashing stay in route-state. It is exported from the effect barrel.
- **`route-state/effect/sign.ts`**: `webAutomationRouteEffect` takes an optional fourth argument, `pageRaised`.
  - It tries these exclusions in order and signs the first one that leaves something added:
    1. self-changing plus page-raised names;
    2. self-changing names only;
    3. nothing left out.
  - `removed` cannot be affected, because the layer's names are on the after page.
  - With no `pageRaised` argument the output is byte-identical to before. That is how the host's `signRouteEffect` (`host-runtime.ts`) still calls it.
- **`plan-resolution/act-effect.ts`**: passes `webLlmPageRaisedNames(before.evidence, after.evidence)`. The parameter type is now `Pick<binding, "routeState" | "evidence">`, and its only caller, `target-packets.ts`, already passes full bindings.
- **`route-state/effect/format.ts`**: documents why there is no v2. Leaving names out does not change how a kept name is hashed, and the judge's rule ("every kept name on the page") reads an effect with fewer names the same way. So an old v1 effect that includes layer names checks exactly as before, and `holds.ts` and `seen.ts` are unchanged. A v2 with `addedLayer` would only be needed if some check read the layer names, and none does.
- **Tests:**
  - `act-effect.test.ts` gains 5 runtime tests. The first is the F1 shape: a recipe page where "Save to my box" reloads onto a page that opens a help bubble by itself. The others are: a recognised assistant or promotion bubble on the same document; an unrecognised same-document layer, which is kept; a dialog-opening press; and an add whose panel answers it, still `not_seen` without the panel.
  - The runtime tests were merged into `act-effect.test.ts` because a new file put `plan-resolution/tests/` at 26 files, over the audit's limit of 25.
  - New `self-changing/tests/page-raised.test.ts` (4 tests) covers the reader.
  - New `route-state/effect/tests/layer-names.test.ts` (5 tests) covers the signer cascade and the hashing.

## Commands run and observed results

- **Fail-first, before any source change.** `DOMAIN_TEST_BUILD_LABEL=t499 node scripts/test-domain.mjs plan-resolution/tests/layer-effect` gave `# pass 3 # fail 2`.
  - The reload-bubble test failed `expected: 1 actual: 3`.
  - The recognised-kind test failed `assistant: {"v":"web-effect.v1","added":["069b17c9","27ccf27a","dc3298ee"],...} 3 !== 1`.
  - The three guard tests (same-document layer, dialog, panel) passed.
  - These tests were later moved, unchanged in body, into `act-effect.test.ts`.
- **Signer fail-first.** `... route-state/effect/tests/page-raised` gave `# pass 3 # fail 1`; the layer-left-out test failed.
- **After the change.** `... plan-resolution/tests/act-effect self-changing/tests route-state/effect/tests` gave `# pass 39 # fail 0`. It was rerun after normalising line endings to LF, with the same result.
- **Typecheck.**
  - `npx tsc -p tsconfig.json --noEmit` gave `src exit 0`.
  - `npx tsc -p tsconfig.test.json --noEmit` gave `test exit 0`.
- **Directory tests.** `DOMAIN_TEST_BUILD_LABEL=t499 node scripts/test-domain.mjs runtime/route-state runtime/llm-evidence` exited 0 with `# tests 1074 # pass 1074 # fail 0`.
- **Structure audit.** `node scripts/structure-audit.mjs` exited 0 with `structure-audit: passed (191 warning(s), 646 baselined)`.
  - One warning is on a touched file: `act-effect.test.ts: 418 lines is past the 400-line advisory threshold` (advisory only).
  - An earlier version, with page-raised.ts under `route-state/effect/` importing project.ts, failed on import cycles and a barrel-reach. That version was replaced.

## Not verified

- **Whether the real capture marks the chat card as the brief assumes.** The brief's case relies on run `mv6i28zl` view 0014 and its `t322` "Chat with us ×", and I have not confirmed it against the captured packet.
  - The fixture source puts the pill inside the `<vr-assist>` shadow root. The view prints `COVERING t321 covers 1` and `ARRIVED reload`, so t321 is most likely the shadow host, since elementFromPoint retargets to it.
  - In that case t322 is under it by the composed-tree `parent`, and the reload gives a new `timeOrigin`. The `step.json` did not carry element records, so I could not confirm t322's `parent` or the two timeOrigins.
- **The host's own `signRouteEffect`** (Core `route-state/build-routing.ts` via domain `host-runtime.ts`) signs effects from route states alone and still names no layers. If a Flow node's effect comes from that path rather than from exploration's `acted` effect, the chat card can still get in. `host-runtime.ts` is outside my brief.
- **A toast or notice the act raised on the same document,** with no recognised kind, is still treated as the act's and stays required.
- No Lab or provider run, no full suites, no commits.

## Open questions or contradictions found

- The brief lists `project.ts` among the `effect/**` files, but it lives at `route-state/project.ts`. I did not edit it, because putting layer membership into the route state would change what Routers and state digests see.
- F1 proposes the rule "keep layer names only when the act added nothing else". Applied alone, that would drop an add panel's "View cart / Continue shopping / close" whenever the header count also changed, and it would turn t476's `not_seen` into `unknown`. The document-and-kind rule above avoids that, and the new panel test guards it.
