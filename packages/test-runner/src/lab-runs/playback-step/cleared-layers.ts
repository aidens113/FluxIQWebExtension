// The layers a playback action closed over the page while it ran (the
// extension's interference clearing, `clearedLayers` on the action result), as
// each layer's closed kind and the word of the control pressed. Run
// `run-mvac0ddx-f52ba929`'s s5 closed the Flow's own store picker and its step
// folder never said so. Only those two fields are copied, under Core's bound
// (`executor/node-execution/cleared-layers.ts`).

type Json = Record<string, unknown>;
const record = (value: unknown): Json | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Json : undefined;
const text = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;

/** One layer the run closed over the page: Core's closed kind and the pressed control's word. */
type ClearedLayer = { kind: string; control: string };

/** Core's layer kinds, kept in step with it. */
const LAYER_KINDS: ReadonlySet<string> = new Set(["consent", "rate_limit", "promotion", "assistant", "dialog"]);
/** Core's bounds: at most this many layers from one dispatch, and a control word this short. */
const LAYERS_MAX = 12;
const CONTROL_MAX = 40;

/**
 * The layers the action's run closed, and the sentence a step summary ends
 * with, from `clearedLayers` at the depths a list read is looked for: the
 * dispatch payload's top, where the domain's gateway dispatcher lifts it, or
 * the client's own payload under it. An entry outside Core's kinds, or whose
 * word is empty or longer than Core keeps, is dropped, as is every other field
 * (a layer's name, its way-out reference). Undefined when none is left.
 */
export function playbackClearedLayers(outcome: Json | undefined): { layers: ClearedLayer[]; said: string } | undefined {
  const reported = [outcome?.clearedLayers, record(outcome?.result)?.clearedLayers].find(Array.isArray) as unknown[] | undefined;
  const layers: ClearedLayer[] = [];
  for (const entry of reported ?? []) {
    if (layers.length >= LAYERS_MAX) break;
    const kind = text(record(entry)?.kind);
    const control = text(record(entry)?.control)?.replace(/\s+/gu, " ").trim();
    if (kind !== undefined && LAYER_KINDS.has(kind) && control && control.length <= CONTROL_MAX) layers.push({ kind, control });
  }
  if (!layers.length) return undefined;
  return { layers, said: `cleared ${layers.length} layer${layers.length === 1 ? "" : "s"}: ${layers.map(layer => `${layer.kind} ${JSON.stringify(layer.control)}`).join(", ")}` };
}
