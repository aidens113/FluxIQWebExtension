import type { WebLlmEvidenceElement } from "../elements";

export function isActingControl(element: WebLlmEvidenceElement): boolean {
  return ["button", "a", "input", "select", "textarea", "summary"].includes(element.tag)
    || ["button", "link", "menuitem", "checkbox", "radio", "switch", "tab"].includes(element.role ?? element.implicitRole ?? "")
    || element.hasClickHandler === true || element.cursor === "pointer";
}

