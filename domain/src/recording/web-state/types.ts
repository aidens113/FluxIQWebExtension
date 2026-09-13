// What the recorder hands the state projection. These are wire-shaped inputs
// produced in the browser by `content/dom-snapshot.ts`, not Core state types:
// every field is optional that the page may not offer, and nothing here has
// been normalized yet. `geometry.ts` turns a rect into Core's `StateBounds`,
// and `element/` decides what an element is and what it is called.

import type { WebAutomationElementContext } from "../../actions/types";

export type WebAutomationRect = { x: number; y: number; width: number; height: number };

export type WebAutomationElementStateInput = {
  tagName: string;
  selector: string;
  xpath?: string | undefined;
  id?: string | undefined;
  classNames?: string[] | undefined;
  visibleText?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  role?: string | undefined;
  name?: string | undefined;
  href?: string | undefined;
  inputType?: string | undefined;
  bounds?: WebAutomationRect | undefined;
  documentBounds?: WebAutomationRect | undefined;
  isVisibleOnViewport?: boolean | undefined;
  hasClickHandler?: boolean | undefined;
  attributes?: Record<string, string> | undefined;
  /**
   * Identity signals, matching Core's fingerprint normalizer (Phase 1.3).
   *
   * They are the extension's `WireElementTarget` fields of the same names and
   * they arrive on every recorded element, but this type did not declare them
   * for a week, so `action-target.ts` could not carry what it was being
   * handed. That is the same defect the wire projection had, one layer down:
   * the runtime object holds the signal, the declared type does not mention
   * it, and every projection written against the type drops it in silence.
   */
  testId?: string | undefined;
  accessibleName?: string | undefined;
  /** The text of the element's own `<label>`, not the display name a target is called by. */
  label?: string | undefined;
  /** The role the markup implies where no `role` attribute was authored. */
  implicitRole?: string | undefined;
  context?: WebAutomationElementContext | undefined;
};

/**
 * The five identity signals above, named as a union so a projection of this
 * type is joined to them by the compiler rather than by whoever wrote it.
 *
 * The extension declares the same union as `DomElementIdentitySignal`
 * (`shared/protocol.ts`) for the same reason and against the same defect. Two
 * declarations because `domain/src` may not import `apps/extension/src`; the
 * tests that push a recorded descriptor through both ends are what join them.
 */
export type WebAutomationElementIdentitySignal = "testId" | "accessibleName" | "label" | "implicitRole" | "context";

export type WebAutomationDomSnapshotInput = {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number; documentWidth?: number | undefined; documentHeight?: number | undefined; devicePixelRatio?: number | undefined };
  frame?: {
    isTop: boolean;
    viewportOffset?: WebAutomationRect | undefined;
  } | undefined;
  focusedElement?: WebAutomationElementStateInput | undefined;
  selectedText?: string | undefined;
  interactiveElements: WebAutomationElementStateInput[];
};

export type WebAutomationScreenImageSize = {
  width: number;
  height: number;
};

export type WebAutomationTabStateInput = {
  tabId: number;
  windowId?: number | undefined;
  url?: string | undefined;
  title?: string | undefined;
  active?: boolean | undefined;
  status?: string | undefined;
};
