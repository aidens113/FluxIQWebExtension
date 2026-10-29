# t792 fix4-covered-layer

## Outcome
Done (Core untouched; one follow-up outside my ownership, below).

## What changed and why
- Client `interference/own-controls.ts` (new, pure wording) + `covering-layer.ts`: the covered sentence now lists the layer's own controls (buttons, drawn controls), header-band ones first, icon-only ones as "a control with no words in the layer's header" (+ `named "<aria-label/title>"` when labelled), and puts links in a separate clause "the links inside it ... are its content and not its controls". Previously icon-only controls were skipped and links were listed as controls. Capture does not press anything.
- Domain `node-run/layer/own-controls.ts` (new, `webLayerOwnControls`, exported from layer barrel): header-first own controls of the cover as `tN (domain words)`, excluding links, fields, closers already in `closeWith`, and holder rows (innermost only). `run.ts` passes it as new `layerControls` on the `covered_by_layer` detail; `tool-rejection.ts` carries the field; `rejection-next/next-sentence.ts` says "tCOVER's own controls, header first: ...; links and rows inside the layer are its content" (only entries matching a strict domain-words regex are inlined, never page text). Old wording unchanged when no controls.
- Core: not changed (wording is the domain's `next`; repeat-guard's COVERED text already points to the earlier answer).

## Commands run and observed
Under the heavy lock, from the t792 downstream tree:
- domain `node scripts/test-domain.mjs node-run/layer node-run/tests/covered rejection-next tool-rejection` -> 55 pass, 0 fail (earlier wider run with press-effect, action-failure: 156 pass, 0 fail; new tests listed as ok).
- extension `node scripts/test-extension.mjs interference` -> 77 pass, 0 fail (wider with action-runtime: 439 pass, 0 fail).
- `tsc --noEmit -p .` in domain and in apps/extension -> no output (clean).
- `node scripts/structure-audit.mjs` -> 3 FAILs remain, none mine: gateway-mapping.test.ts `as never` 6>5, node-run/tests/ 26 files > 25 (another worker's addition; my test lives in node-run/layer/tests/), resolve-target.ts 804 lines (other worker). My first run flagged run.ts 801, tool-rejection.ts 805 and a `layer-` prefix; all fixed.
Tests added: domain `node-run/layer/tests/own-controls.test.ts` (help-desk panel with header icon button + three links; icon button and handle first, links absent), `rejection-next/tests/next-sentence.test.ts` (entry filtering), extension `interference/tests/own-controls.test.ts`.

## Not verified
Capture in a real DOM (covering-layer.ts header band, icon-only detection) has no unit/content spec; only the pure wording is tested. No live run.

## Open questions
- `domain/src/runtime/llm-evidence/repeated-refusal.ts` (not owned) rebuilds the detail on a repeat and drops `layerControls` (it passes `closeWith` through at ~line 152); add `layerControls: detail?.layerControls` there. Core's repeat text points to the earlier answer, so the first answer already carries it.
- Real captures may omit `text` for aria-label-only buttons; domain treats `aria-label`/`title` in `attributes` as icon-only, else lists it as "a button in the layer's header" (still first, with handle).
