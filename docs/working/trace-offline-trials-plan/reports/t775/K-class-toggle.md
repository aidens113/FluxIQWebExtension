# K: class-state toggle signature

Outcome: Partial. Domain and extension done and tested; headed e2e still fails because the click node's `ensureState` parameter schema lists only `via` "attribute" or "name".

## What changed
- domain/src/actions/toggle-signature: new `{via:"class",gains,loses}` in signature.ts; reading.ts gains optional `classes: string[][]` (element, then wrappers); new class-delta.ts (transient filter), class-tokens.ts, control-ancestor.ts (wrapper allowed up to 2 levels, never li/ul/tr/form/main/body/section etc. or list/row roles); derive.ts falls to class only when attribute and name did not change (first level with a non-transient delta wins); shown.ts matches when some level has all gains and no loses; value.ts parses it.
- press-effect/toggle-signature.ts reads classes from the packet's `class` attribute and `parent` chain; no idempotentWith for class.
- apps/extension content/actions/toggle-reading.ts reads classes from the live DOM the same way. click.ts needed no edit (it already passes the reading).
- docs/architecture/web-capabilities.md: class-signature sentence.
- Tests added beside each (toggle-signature, press-toggle-signature, ensure-state).

## Commands run
- domain test-domain.mjs actions/ press-effect/tests node-run/tests: 469 pass, 0 fail.
- extension test-extension.mjs content/actions/tests/click: 52 pass, 0 fail.
- tsc --noEmit -p tsconfig.json and tsconfig.test.json in domain and apps/extension: no output (clean).
- structure-audit: passed (230 warnings, 616 baselined).
- extension build: chrome/firefox/e2e-chromium verified.
- headed judged-change-save-then-read.spec.ts: 1 failed at line 112, trial codes `flow_bootstrap.completion_refused` x2. Diagnostic json: answers.save no longer lacks a toggle; Core refused with `bootstrap.parameter_schema_mismatch` at `plan.subflows.0.nodes.2.parameters.ensureState`: "takes only attribute or name" (valid: ["attribute","name"]). So the class signature is derived and written, and Core's schema rejects it.

## Not verified
Skip-on-second-trial behaviour end to end.

## Open
The refusing schema is in this repo, outside my owned paths: domain/src/actions/schemas.ts line 264, `via: { type: "string", enum: ["attribute", "name"] }`. Adding "class" there (one word) should clear the refusal; then rerun the spec. Not edited because the brief forbids other source.
