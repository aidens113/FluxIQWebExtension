# t799 stable interfaces (fixed by the sub-supervisor before dispatch)

Core RT = `C:/Users/osrs_/FluxStuff/fxwork/t799/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
Downstream = `C:/Users/osrs_/FluxStuff/fxwork/t799/!FluxIQWebExtension`. These shapes are already in the Core tree;
do not change them without asking the sub-supervisor. Every field is optional on the wire; absent means today.

## I1. Generic layer kinds (CC7) — `RT/executor/node-execution/cleared-layer.ts` (done)

`AutomationStudioClearedLayerKind = "overlay" | "notice" | "rate_limit" | "assistant" | "other"`.
Core's parser (`cleared-layers.ts`, done) also reads the old words: `consent`->`overlay`, `promotion`->`notice`,
`dialog`->`other`. The web sends the generic words (consent->overlay, promotion->notice, unnamed dialog->other).
`AutomationStudioClearedLayer` gains `id?: string` (opaque, stable per layer, <=80 chars `[A-Za-z0-9._:-]`) and
`controlRef?: JsonObject` (opaque: the parameters `wayOutDefinitionId`'s node runs with to press the way out, as the
domain resolved them, e.g. the web click's `{ selector, element }`; only beside `wayOutDefinitionId`; <=8 KB as JSON).
**Revised 2026-10-29 after the headed proof:** it was first written as the node's `target`, which the web click's
plan check refuses (`selector` is required and is filled only by resolution), so Core dropped the handler. Wire: `outputs.result.clearedLayers[]` as today.

## I2. Obstruction (CC7) — `RT/executor/node-execution/obstruction.ts` (type done)

Wire: `outputs.result.obstruction` (one object) on a dispatch whose target was covered or that failed because a layer
stood over the page; also on a `rate_limit` failure (I4). Shape:
`{ id?, name?, kind: <I1 kind, old words mapped>, covers?: string<=80, retryAfterMs?: 1..600000 (rate_limit only, only
when the page states it), dismiss: [{ intent: "dismiss"|"accept"|"neutral", controlRef?: JsonObject, definitionId?:
string, action?: "back" }] (<=6) }`. Attempt trace field: `AutomationStudioNodeAttemptTrace.obstruction` (done).
Core's `clear_interference` rung presses the first way out with intent `dismiss`, else `neutral`, never `accept`,
that has a `definitionId` (and a `controlRef`, unless `action: "back"`), as a transient node
`{definitionId, parameterValues: controlRef}` declaring no consequence; then waits for the target and
attempts again. The web press guard must still refuse anything committing.

## I3. Obstruction fact (CC7 standing fact)

Condition `{ fact: "obstruction", op: "visible" | "absent", value?: <layer name words> }`, answered exactly as the
`dialog` fact is today (any open layer whose name contains the words); `dialog` stays as an alias. Core writes
`obstruction` in a learned handler only for a layer that carried `id` (a new client), else `dialog` (today). Handlers
are keyed by `id ?? name`.

## I4. Rate limit (CC8)

`web.action.rate_limited` failures also report `obstruction: { kind: "rate_limit", retryAfterMs? , dismiss }`.
Core pace: a rate_limit seen without a wait hint (a failed attempt's `obstruction.kind === "rate_limit"`, or a cleared
`rate_limit` layer on any attempt) raises the node's pace to `min(60 s, max(1 s, ceil(pace * 1.5)))`, never below an
authored pace. With a hint (`retryAfterMs`, transport Retry-After), today's `learn` stands.

## I5. Stateful controls (CC9) — `RT/llm/harness-options/binding.ts` (type done)

`AutomationStudioPlanHandleView.control?: { stateful: true; state?: string; ensures?: JsonObject; idempotentWith?:
string }`, on the domain's resolved answer's `handleViews[]` (view_history resolution). `state`: short opaque word
(<=40 chars) for the state the view showed. `ensures`: the domain's own toggle signature (the `ensureState` form its
press node takes) that a press of the control leaves from that state. `idempotentWith`: node id that sets the asked
state itself. Core treats a step resolved from such a handle as tied to a toggle press (lowest precedence after
explored and trial presses) and gives it `ensureState := ensures`.
