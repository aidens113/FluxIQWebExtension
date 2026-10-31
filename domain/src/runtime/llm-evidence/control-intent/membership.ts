import type { WebLlmEvidenceElement } from "../elements";

function layerKind(element: WebLlmEvidenceElement): string | undefined {
  return element.isDialog?.kind ?? element.kind;
}

/** Membership is ancestry or a sanitized modal join, never merely being covered. */
export function belongsToConsent(chain: readonly WebLlmEvidenceElement[] | undefined, byHandle: ReadonlyMap<string, WebLlmEvidenceElement>): boolean {
  if (!chain) return false;
  const control = chain[0];
  if (!control || chain.some((element) => element.hidden || element.coveredBy?.length)) return false;
  const memberships = new Set(chain.flatMap((element) => element.inDialog ? [element.inDialog] : []));
  const layers = chain.filter((element) => element.isDialog || element.kind || element.covers?.length || element.coversCount);
  const nearest = layers[0];
  if (nearest && layerKind(nearest) !== "consent") return false;
  if (memberships.size > 1) return false;
  const dialogHandle = [...memberships][0];
  const dialog = dialogHandle === undefined ? undefined : byHandle.get(dialogHandle);
  if (dialogHandle !== undefined && (!dialog || dialog.frameId !== control.frameId || dialog.hidden || dialog.isDialog?.kind !== "consent")) return false;
  if (nearest && dialog && nearest.target !== dialog.target && !chain.some((element) => element.target === dialog.target)) return false;
  return nearest !== undefined && layerKind(nearest) === "consent" || dialog !== undefined;
}
