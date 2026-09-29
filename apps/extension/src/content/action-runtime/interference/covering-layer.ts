// What a covered target is covered by, said plainly: the layer the hit test
// landed in, and the controls on that layer a reader could press.
//
// **Why this exists.** A refusal used to name only the element the hit test
// landed on -- `div.scrim` -- which says that something is in the way and
// nothing about what to do about it. On the job board (`run-mulwm2dc-0bd95f22`)
// the model's search was refused as covered twelve turns running, behind a
// consent wall whose Accept, Reject and Manage buttons it was never told
// about. So a covered refusal now names the layer and the controls on it.
//
// **It names, it never presses.** Which of those controls to press is the
// reader's decision, and for a consent wall it is a choice about the person's
// data that the runtime deliberately does not make on its own
// (`vocabulary.ts`). This module only reads.
//
// **What counts as the layer.** The declared dialog around the element the hit
// test landed on, or else the outermost fixed or sticky ancestor of it -- a
// scrim, a banner, a widget's host -- found across shadow boundaries, because a
// consent platform's layer is a custom element whose content lives in its
// shadow root. A layer that holds the target is not over it, and is not named.
// Nothing painted in normal flow is a layer: an element that merely sits on
// top of the target is already named by the refusal itself.
//
// **What it carries.** Accessible names of pressable controls -- the browser's
// own and the ones a page drew out of a `<div>` -- bounded in
// count and length -- words a person reads on a button, which the snapshot
// already carries for the same controls. A form field is not listed, so no
// value can be read, and a sensitive control is skipped outright.

import { isSensitiveFormControl } from "../../element-traits";
import { isDrawnControl } from "../../evidence";
import { accessibleNameFor } from "../../identity";
import { deepElementFromPoint } from "../../selector";
import { composedClosest, composedContains, composedDescendants } from "../../shadow-dom";
import { outermostFixed, type Point } from "./overlays";

/** What is pressable on a layer: the controls a person would click, never a field they would type into. */
const PRESSABLE_SELECTOR = [
  "button", "a[href]", "summary",
  'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]', 'input[type="checkbox"]', 'input[type="radio"]',
  '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="tab"]', '[role="checkbox"]', '[role="radio"]', '[role="switch"]'
].join(",");

const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog';
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/** At most this many of a layer's elements are read. The same bound the way-out scan uses. */
const LAYER_SCAN_LIMIT = 400;
/** At most this many controls are named: a layer with more is a page, not a prompt. */
const MAX_NAMED_CONTROLS = 5;
/** At most this many characters of one name or heading. */
const MAX_NAME_LENGTH = 40;

/**
 * The sentence a covered refusal adds about the layer over `target` at
 * `point`, or `undefined` when what covers it is not a layer. Never throws: it
 * adds to a refusal, and a refusal must still be reported if it cannot.
 */
export function coveringLayerSentence(target: Element, point: Point): string | undefined {
  try {
    const hit = deepElementFromPoint(point.x, point.y, target.ownerDocument);
    if (!hit || composedContains(target, hit)) return undefined;
    const layer = composedClosest(hit, DIALOG_SELECTOR) ?? outermostFixed(hit);
    if (!layer || composedContains(layer, target)) return undefined;
    return describeLayer(layer);
  } catch (error) {
    return `the layer over it could not be read (${error instanceof Error ? error.name : "unknown error"})`;
  }
}

function describeLayer(layer: Element): string {
  const { heading, controls } = readLayer(layer);
  const what = `${layerName(layer)}${heading ? ` headed "${heading}"` : ""}`;
  if (!controls.names.length) return `it is part of ${what}, a layer over the page with no control to press`;
  const more = controls.more ? `, and ${controls.more} more` : "";
  return `it is part of ${what}, a layer over the page whose controls are ${controls.names.map((name) => `"${name}"`).join(", ")}${more}; the target can be reached once that layer is answered or closed`;
}

/** The layer's first painted heading and its painted, named, pressable controls, in page order. */
function readLayer(layer: Element): { heading: string | undefined; controls: { names: string[]; more: number } } {
  let heading: string | undefined;
  const names: string[] = [];
  let more = 0;
  let read = 0;
  for (const element of composedDescendants(layer)) {
    if (++read > LAYER_SCAN_LIMIT) break;
    if (element.getClientRects().length === 0) continue;
    if (heading === undefined && element.matches(HEADING_SELECTOR)) heading = bounded(element.textContent);
    if (!isPressable(element) || isSensitiveFormControl(element)) continue;
    // A drawn control has no computed name from its content, so its own words stand in.
    const name = bounded(accessibleNameFor(element) ?? element.textContent);
    if (!name || names.includes(name)) continue;
    if (names.length < MAX_NAMED_CONTROLS) names.push(name);
    else more += 1;
  }
  return { heading, controls: { names, more } };
}

/**
 * A control a person would click: one the browser makes, or one the page drew
 * out of a `<div>` and dressed to be pressed -- a chat widget's Send is one --
 * by the snapshot's own rule for those (`../../evidence/controls.ts`).
 */
function isPressable(element: Element): boolean {
  return element.matches(PRESSABLE_SELECTOR) || isDrawnControl(element);
}

/** How the layer reads: its declared role and name when it has them, else its tag -- a widget's own element name. */
function layerName(layer: Element): string {
  const tag = layer.tagName.toLowerCase();
  const role = layer.getAttribute("role")?.trim();
  const name = bounded(accessibleNameFor(layer));
  if (role && name) return `the ${role} "${name}"`;
  if (name) return `${tag} "${name}"`;
  return role ? `the ${role} ${tag}` : tag;
}

function bounded(text: string | null | undefined): string | undefined {
  const collapsed = (text ?? "").replace(/\s+/gu, " ").trim();
  if (!collapsed) return undefined;
  return collapsed.length <= MAX_NAME_LENGTH ? collapsed : `${collapsed.slice(0, MAX_NAME_LENGTH - 1)}…`;
}
