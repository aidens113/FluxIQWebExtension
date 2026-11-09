import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../sanitize";
import { createWebLlmExtractionHandles } from "../../../structure";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters, type WebPlanNodeResolutionInput } from "../..";

/** Real sanitized bindings with deliberately reused packet numbering, without browser/provider calls. */
export function controlIntentHost() {
  const scope = { projectId: "project.intent", flowId: "flow.intent" };
  const targets = createWebLlmTargetPackets();
  const stores = { targets, extractions: createWebLlmExtractionHandles() };
  const capture = (options: {
    words?: string; consent?: boolean; layer?: string; selector?: string; location?: string;
    document?: number; frame?: number; shadowHosts?: string[]; empty?: true;
    /** Filler elements placed first, so the control's handle is t(2 + leading) instead of t2. */
    leading?: number;
  } = {}) => {
    const leading = options.leading ?? 0;
    const url = options.location ?? "https://example.test/notice";
    const prefix = options.frame ? `frame[${options.frame}] >> ` : "";
    const layer = options.layer ?? "#notice";
    const attributes: JsonObject = options.frame ? { "data-fluxiq-frame-url": "https://frame.example.test/notice" } : {};
    const binding = sanitizeWebLlmSnapshotWithBindings({
      url,
      interactiveElements: options.empty ? [] : [
        ...Array.from({ length: leading }, (_, index) => ({ tagName: "div", selector: `${prefix}#filler-${index}` })),
        { tagName: "div", role: "dialog", selector: `${prefix}${layer}` },
        { tagName: "button", selector: `${prefix}${options.selector ?? "#answer"}`, accessibleName: options.words ?? "Accept all", parent: leading, attributes }
      ],
      evidence: {
        navigation: { url, origin: new URL(url).origin, path: new URL(url).pathname, type: "navigate", timeOrigin: options.document ?? 1, historyLength: 1, visibility: "visible" },
        dialogs: { open: options.consent ? [{ selector: `${prefix}${layer}`, modal: false, kind: "consent" }] : [] }
      }
    });
    if (options.shadowHosts !== undefined) binding.shadowHosts?.set(`t${2 + leading}`, options.shadowHosts);
    return binding;
  };
  const resolve = (parameters: JsonObject = { target: { handle: "t2" } }, extra: Partial<WebPlanNodeResolutionInput> = {}) => resolveWebPlanNodeParameters({
    ...scope, nodeDefinitionId: "web.output.dom-click", parameters, declaredConsequences: [],
    permission: async () => ({ permitted: true as const }), ...extra
  }, stores);
  return { scope, targets, stores, capture, resolve };
}
