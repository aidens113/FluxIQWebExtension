// The durable target of a control, in the form the pressing node takes with no
// handle (CC7, interface I1 of the heavy-lifting plan).
//
// Core presses a way out it learned by running a transient `web.dom.click`
// whose `target` is this object. That is the "adapted target" a click already
// takes at run time (`domain/src/output-nodes/targets/targets.ts`
// `outputTargetFromPayload`): `selector` for the address, and `element` for the
// identity the resolver checks the page's candidate against (`resolve-target.ts`,
// `identity/`). Nothing in it is a handle -- a handle is a number a page view
// printed and is gone with that view -- so a Flow that learned the way out on
// one visit finds the same control on the next, by its selector, shadow-host
// chain, role, accessible name, text and the dialog it sat in.
//
// **Identity only.** The signals are the ones the fingerprint matcher reads and
// no more: no box, no bounds, no value, no attribute bag. A control inside a
// sensitive field is not described at all. Each string is the page's, collapsed
// and bounded, exactly as a capture would write it.

import { linkHref, testIdFor, visibleText } from "../../../describe-element";
import { isSensitiveFormControl } from "../../../element-traits";
import { accessibleNameFor, authoredNameAttribute, elementContext, implicitRole } from "../../../identity";
import { selectorFor } from "../../../selector";

/** The most characters one signal carries. */
const SIGNAL_MAX = 200;

/**
 * The control as `{ selector, element }`, or `undefined` for a control that may
 * not be described (a sensitive field) or has no address. A control whose
 * identity the content script cannot read is reported without a target too: the
 * rest of the obstruction still travels.
 */
export function controlRefOf(control: Element): Record<string, unknown> | undefined {
  let ref: Record<string, unknown> | undefined;
  try {
    ref = describedControl(control);
  } catch {
    /* best-effort: a control whose identity cannot be read is reported without a target */
  }
  return ref;
}

function describedControl(control: Element): Record<string, unknown> | undefined {
  if (isSensitiveFormControl(control)) return undefined;
  const selector = selectorFor(control);
  if (!selector) return undefined;
  const element: Record<string, unknown> = { tagName: control.tagName.toLowerCase(), selector };
  const text = bounded(visibleText(control));
  if (text) Object.assign(element, { text, visibleText: text });
  const accessibleName = bounded(accessibleNameFor(control));
  if (accessibleName) element.accessibleName = accessibleName;
  const name = bounded(authoredNameAttribute(control));
  if (name) element.name = name;
  const role = bounded(control.getAttribute("role"));
  if (role) element.role = role;
  const markupRole = implicitRole(control);
  if (markupRole) element.implicitRole = markupRole;
  if (control.id) element.id = bounded(control.id);
  const testId = bounded(testIdFor(control));
  if (testId) element.testId = testId;
  const href = bounded(linkHref(control));
  if (href) element.href = href;
  const context = elementContext(control);
  if (context) element.context = JSON.parse(JSON.stringify(context)) as unknown;
  return { selector, element };
}

function bounded(value: string | null | undefined): string | undefined {
  const collapsed = (value ?? "").replace(/\s+/gu, " ").trim();
  return collapsed ? collapsed.slice(0, SIGNAL_MAX) : undefined;
}
