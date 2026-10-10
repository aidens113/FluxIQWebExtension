// What a web step's saved control is built from, whichever path met it.
//
// Three paths save a step that aims at a control: a recording (the recorder's
// element descriptor), a runtime repair (an element of the evidence packet the
// model was shown), and a build (the same packet, through the handle the model
// named). Each used to write its own identity, and each wrote a different one:
// the recording carried every signal the page offered, a repair carried four,
// and a build's quantity box reached the page as a tag and an id the page mints
// again on every load (R4a, `reports/r4a-debug-run-mv2pgqkj.md`). So a step
// built one way was found by many signals and the same step built another way
// by one.
//
// This is the one shape all three hand to `webElementFingerprint`. Every field
// is what the page said about the control; none is what the control holds. A
// path that has a field fills it, and a path that does not leaves it out --
// `attributes` is the fallback the builder reads an id, a name, a class list, a
// test id, an input type and a link destination out of when a path has no field
// of its own for one.

import type { WebAutomationElementContext } from "../actions/types";

export type WebElementFingerprintSource = {
  /** The element's tag, as the page reported it. */
  tagName: string;
  /** Where the control was, as one locator among the signals: never the identity on its own. */
  selector?: string | undefined;
  xpath?: string | undefined;
  /** The `role` attribute the page wrote. */
  role?: string | undefined;
  /** The role the markup implies where no `role` was written. */
  implicitRole?: string | undefined;
  /** The computed accessible name. */
  accessibleName?: string | undefined;
  /** The text of the label that names the control, as the page lays it out. */
  label?: string | undefined;
  /** The element's visible words. */
  visibleText?: string | undefined;
  /** The element's own text, as the recorder trimmed it. */
  text?: string | undefined;
  /** What the control holds. The builder keeps it only where it is the control's own label (a button input). */
  value?: string | undefined;
  inputType?: string | undefined;
  href?: string | undefined;
  /** The authored `id`. */
  id?: string | undefined;
  /** The authored `name` attribute. */
  name?: string | undefined;
  /** The `class` attribute's tokens, each one its own entry. */
  classNames?: readonly string[] | undefined;
  /** An author's test id: `data-testid`, `data-test`, `data-cy` or `data-qa`. */
  testId?: string | undefined;
  /** The attributes the page wrote, by name. */
  attributes?: Readonly<Record<string, string>> | undefined;
  /** Where the control sat: its form, its place in a list, its record, the shadow roots around it. */
  context?: WebAutomationElementContext | undefined;
  /**
   * The control holds a secret (`domain/src/sensitivity/`). It then carries no
   * words that could be its contents -- no visible text, no text, no value, no
   * accessible name -- and keeps the author's description of it: its label, its
   * placeholder, its `aria-label`, and every structural signal.
   */
  secret: boolean;
};
