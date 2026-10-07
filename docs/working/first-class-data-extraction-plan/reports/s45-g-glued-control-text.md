# s45-g: glued control text (U-B3-3)

## Outcome

Partial. The text the model reads is fixed and tested. The route state's controls list now names the size chip
"12 Double Rolls $16.47". The overlay and step-result naming still glue the two lines. That path runs through
files this brief forbids (`node-run/**`, `plan-resolution/**`), so it is described below and not fixed.

## Root cause

- The content capture was not at fault. `readableTextBeside` (`apps/extension/src/content/describe-element.ts:164`)
  and `readableText` (`content/sensitive-text.ts:95`) produce "12 Double Rolls $16.47" for the fixture's chip,
  `<div tabindex=0>12 Double Rolls<span style="display:block">$16.47</span></div>`
  (`apps/scenario-lab/src/scenarios/bigbox-retail/pages/product-page.ts:55`, `theme/stylesheet.ts:126`).
  `dom-snapshot.ts:249` sends it, and `elements.ts:223` carries it as `readable`. New content tests confirm this.
  They passed before any source change.
- The glued string in `steps/0021-decide/request.txt` is not a page-view line. It is
  `state.page.controls` in a `core.route_state` value. In the page view itself, the chip is the drawn control
  `t666 clickable "12 Double Rolls"`, with its price on its own line.
- **Root cause: `domain/src/runtime/route-state/project.ts:35`** named each control `element.name ?? element.text`.
  It never consulted `readable`. The page view does consult it, through a private `readable()` in
  `domain/src/runtime/llm-evidence/page-view/element/words.ts:34-38`, so the two disagreed.
- The overlay label and step result are a second path, outside this brief. The run's step results carry
  `control: "12 Double Rolls$16.47"`, `does.target`, and a step target `["div", "12 Double Rolls$16.47"]`.
  `node-run/observed-control.ts:47` names the control with `webLlmElementWords`, which is the readable,
  page-view spelling, when the look before acting holds the handle. When it does not, line 50 falls back to the
  resolved identity's `accessibleName`/`visibleText`. In this run those were the glued `visibleText`, which
  must stay as captured. I infer that the overlay's detail sentence is built from that result. I did not trace
  the Core sentence builder (see Not verified).

## What changed and why

- New `domain/src/runtime/llm-evidence/page-view/element/readable-words.ts` exports `webLlmReadableWords(element, words)`.
  It holds the page view's existing rule: use `readable` when it differs from `words` only by spacing, and
  otherwise use `words`, so an authored name is never replaced. It is exported from the `page-view/element`
  barrel (`index.ts`).
- `page-view/element/words.ts`: the private `readable()` is removed and both call sites use `webLlmReadableWords`.
  Page-view output does not change.
- `domain/src/runtime/route-state/project.ts`: controls are named `webLlmReadableWords(element, element.name ?? element.text)`.
  `name` and `text` are untouched.
- `domain/src/runtime/llm-evidence/elements.ts`: doc comment on `readable` only. It now names its second reader.
- Tests:
  - New `domain/src/runtime/route-state/tests/project.test.ts`, with three tests. The route-state folder had one
    test file. Fail-first: before the fix, it got `'6 Double Rolls$8.97 | 12 Double Rolls$16.47'`.
  - `apps/extension/src/content/tests/describe-element.test.ts` gains three tests:
    - block child, flex items and `<br>` all read "12 Double Rolls $16.47";
    - `text` stays "12 Double Rolls$16.47";
    - `<b>Dou</b>ble Rolls` gives no readable words.
- The brief named an overlay label file to change. None was edited, because no extension overlay file
  builds the glued label. The overlay shows Core's activity sentences (`background/activity/headline.ts`
  header).

## Commands run and observed results

- Fail-first: `run-subset.mjs <domain> s45-g src/runtime/route-state/tests/project.test.ts`, then
  `node --test .../project.test.mjs` printed `# pass 2 # fail 1`. The failing test reported
  actual `'6 Double Rolls$8.97 | 12 Double Rolls$16.47'`.
- After the fix:
  - `node --test .../route-state/tests/project.test.mjs` printed `# pass 3 # fail 0`.
  - Domain subset of 18 bundles printed `# tests 100 # pass 100 # fail 0`. It covered:
    - `route-state/tests/{project,signature}`;
    - `runtime/tests/state-routing-run`;
    - all six `page-view/element/tests/*`;
    - all six `page-view/tests/*.test.ts`;
    - `llm-evidence/tests/{elements,present}`.
  - Extension subset `content/tests/{describe-element,sensitive-text}` printed `# tests 22 # pass 22 # fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0.
- `node scripts/structure-audit.mjs`: **exit 1**, with one violation in a file I did not touch:
  - The violation is `[imports]` in `domain/src/runtime/llm-evidence/plan-resolution/tests/target-packets.test.ts`
    line 15, `"../../structure/handles"`.
  - That import exists only in the file's uncommitted diff in this tree. It is another in-flight brief's
    change, and `git show HEAD:` of the file has no such import. The file is Must-not-touch for me.
  - My files raise only advisory warnings:
    - `describe-element.ts` has 11 exported values, which predates this change;
    - `elements.ts` is 492 lines (it was 490), past the 400-line advisory.

## Not verified

- No live run or browser, per the brief. I could not confirm that `readable` reached the packet for this chip in
  `run-mux6pndp-16feb842`, because the run keeps no raw packet. The unit test with layout stubs covers it.
- Which Core or extension code turns the step result's `control`/`does.target` into the overlay sentence.
- Every full domain or extension suite. Only the subsets above ran.

## Open questions or contradictions found

- **Overlay and step naming are still glued** whenever the identity fallback applies. A fix needs one of:
  - `node-run/observed-control.ts:50` reads readable words;
  - the resolved element identity (`plan-resolution/element-identity.ts`) carries the readable words beside
    `visibleText`, as a display-only field.

  Both are Must-not-touch here.
- **Route-signature drift.** `state.page.controls` feeds the route-signature control hashes (`route-state/page-features.ts`).
  A glued name and its spaced form now hash differently. Signatures recorded before this change may differ by
  those controls when they are compared against a new capture. The comparison is by overlap, so only glued names
  shift. A Router condition written against a glued string, such as `contains "Rolls$16.47"`, would stop matching.
- **Brief wording.** The brief calls the glued list "the page view line". It is `state.page.controls`. The real
  page-view line already printed the chip as a drawn control with its own words.
