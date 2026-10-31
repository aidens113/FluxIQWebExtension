import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebLlmEvidenceElement } from "../../elements";
import { webLlmFrameUrlPath } from "../frame-url-path";

/** The actual retained document and containing layer, never a saved fingerprint's claimed context. */
export function webPlanControlIntentSource(binding: WebLlmSnapshotBinding): (element: WebLlmEvidenceElement) => { location: string; key: string } {
  const byHandle = new Map(binding.evidence.elements.map((entry) => [entry.target, entry]));
  return (element) => {
    const layers = new Set<string>();
    const visited = new Set<string>();
    let at: WebLlmEvidenceElement | undefined = element;
    while (at !== undefined && !visited.has(at.target)) {
      visited.add(at.target);
      if (at.isDialog || at.kind || at.coversCount || at.covers?.length) layers.add(JSON.stringify([
        binding.selectors.get(at.target), at.frameId, at.isDialog, at.kind
      ]));
      if (at.inDialog !== undefined) {
        const dialog = byHandle.get(at.inDialog);
        layers.add(JSON.stringify([binding.selectors.get(at.inDialog), dialog?.frameId, dialog?.isDialog, dialog?.kind]));
      }
      at = at.parent === undefined ? undefined : byHandle.get(at.parent);
    }
    const scope = binding.captureProvenance?.scope;
    const location = binding.evidence.location;
    return { location, key: JSON.stringify([
      location, scope?.sessionId, scope?.browserTabId, scope?.resetResource,
      scope?.timeOrigin ?? binding.evidence.navigation?.timeOrigin,
      element.frameId ?? scope?.browserFrameId ?? 0, webLlmFrameUrlPath(element) ?? scope?.browserFrameUrlPath,
      [...layers].sort()
    ]) };
  };
}
