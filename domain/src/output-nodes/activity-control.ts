import type { AutomationStudioActivityControlReader } from "fluxiq/automation";

/**
 * The control a web step acts on, as a card names it: the element identity a
 * resolved node keeps (`element`), which is part of the Flow the person owns.
 * The field's own label comes first, else its accessible name, else the words
 * it shows: a quantity field carried only `label: "Quantity"` and its card read
 * "Type · Done", and a search box's accessible name was its placeholder (t174-w108
 * D5). Many controls a page draws as plain elements have no accessible name at
 * all. Never a value typed, read or observed.
 *
 * What it is comes from its role and its input type, the two places a page says
 * a control is a box or one option of several.
 */
export const webActivityControlReader: AutomationStudioActivityControlReader = (parameters) => {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return undefined;
  const element = (parameters as { element?: unknown }).element;
  if (!element || typeof element !== "object" || Array.isArray(element)) return undefined;
  const identity = element as { label?: unknown; accessibleName?: unknown; visibleText?: unknown; role?: unknown; inputType?: unknown };
  return { names: [identity.label, identity.accessibleName, identity.visibleText], kinds: [identity.role, identity.inputType] };
};
