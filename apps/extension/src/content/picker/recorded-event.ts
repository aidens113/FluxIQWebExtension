// Putting the confirmed extraction in the recording.
//
// The frame records it, not the background worker, because the frame is where
// the recording is sequenced: `emit` flushes the pending DOM-mutation batch
// before an executable kind, so the `data.extract` lands after the changes that
// preceded it and before whatever follows, exactly as a click does. An event
// injected from the worker would have no place in that order.
//
// The event carries the definition and nothing else. No element descriptor is
// attached, although the recorder's other kinds carry one: a descriptor holds
// the element's text, and the element a list extraction was defined on is the
// list -- so its text is the records. The definition already names where to
// read (decision D3), and an excluded column is not in it at all (decision
// D12), so what reaches the recording is selectors, keys, labels and counts.
//
// The definition is checked for shape rather than trusted: what the domain will
// not read as a recorded extraction can never become an executable node, and a
// recording holding an event no node can be built from is worse than a refusal
// the panel can show. The domain's own `webAutomationRecordedExtraction`
// rebuilds it field by field when the recording is mapped, which is the gate
// that finally decides what crosses to Core.

import type { WebAutomationRecordedExtraction } from "@fluxiq-web-extension/domain/client";
import { emit, isRecording } from "../recorder";

/** What happened to a `extraction.record`: it went into the recording, or why it did not. */
export type ExtractionRecordOutcome = "recorded" | "not_recording" | "invalid_definition";

export function recordExtraction(definition: unknown): ExtractionRecordOutcome {
  const extraction = recordableExtraction(definition);
  if (!extraction) return "invalid_definition";
  // Asked before emitting so the worker learns why nothing was recorded; `emit`
  // drops a non-`content.ready` kind while recording is off in any case.
  if (!isRecording()) return "not_recording";
  emit("data.extract", { extraction });
  return "recorded";
}

/** The definition, if it is one of the two shapes the domain records. */
function recordableExtraction(value: unknown): WebAutomationRecordedExtraction | undefined {
  if (!value || typeof value !== "object") return undefined;
  const definition = value as Partial<WebAutomationRecordedExtraction> & { request?: { item?: unknown; fields?: unknown }; read?: { mode?: unknown } };
  if (typeof definition.label !== "string" || definition.label.trim() === "") return undefined;
  if (definition.form === "value") {
    return typeof definition.read?.mode === "string" ? value as WebAutomationRecordedExtraction : undefined;
  }
  if (definition.form !== "list") return undefined;
  const readable = typeof definition.request?.item === "string" && typeof definition.request.fields === "object" && definition.request.fields !== null;
  return readable ? value as WebAutomationRecordedExtraction : undefined;
}
