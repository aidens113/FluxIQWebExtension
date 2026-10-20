// A control's role as a stateful-control place reads it (L1 reset settlement):
// as the page wrote it, or as its tag implies when it wrote none.

import type { WebLlmEvidenceElement } from "../elements";

/** The element's role, as written or as its tag implies: its first word, lowercase; "" when it has none. */
export function webControlRole(element: Pick<WebLlmEvidenceElement, "role" | "implicitRole">): string {
  return (element.role ?? element.implicitRole ?? "").trim().toLowerCase().split(/\s+/u)[0] ?? "";
}
