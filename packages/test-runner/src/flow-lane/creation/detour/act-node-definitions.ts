import type { DemonstrationDetourAct } from "@fluxiq-web-extension/test-contracts";

/**
 * The node definition a demonstration operation becomes when a Flow performs
 * it. The ids are the web output nodes the domain registers
 * (`web.output.dom-click`, `-type`, `-select`, `-check`); an operation absent
 * here (navigate, scroll, extract, wait) names no control by label and so can
 * never be a copied detour act.
 */
export const ACT_NODE_DEFINITIONS: Readonly<Partial<Record<DemonstrationDetourAct["operation"], string>>> = {
  click: "web.output.dom-click",
  type: "web.output.dom-type",
  select: "web.output.dom-select",
  check: "web.output.dom-check",
};
