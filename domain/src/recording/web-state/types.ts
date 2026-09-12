// What the recorder hands the state projection. These are wire-shaped inputs
// produced in the browser by `content/dom-snapshot.ts`, not Core state types:
// every field is optional that the page may not offer, and nothing here has
// been normalized yet. `geometry.ts` turns a rect into Core's `StateBounds`,
// and `element/` decides what an element is and what it is called.

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
};

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
