// Everything the content script puts on the wire: the JSON envelope, the DOM
// descriptors it captures, and the browser-action command and result it
// exchanges with the background worker. Shapes here are a contract with
// `background/` and the panel, so widen them rather than reshaping them.

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type RectDescriptor = { x: number; y: number; width: number; height: number };
export type DomElementDescriptor = {
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
  hasValue?: boolean | undefined;
  selectedValue?: string | undefined;
  bounds?: RectDescriptor | undefined;
  documentBounds?: RectDescriptor | undefined;
  isVisibleOnViewport?: boolean | undefined;
  hasClickHandler?: boolean | undefined;
  attributes?: Record<string, string> | undefined;
  options?: Array<{ value: string; label: string }> | undefined;
};
export type FrameDescriptor = {
  isTop: boolean;
  viewportOffset?: RectDescriptor | undefined;
};
export type DomSnapshot = {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number; documentWidth?: number | undefined; documentHeight?: number | undefined; devicePixelRatio?: number | undefined };
  frame?: FrameDescriptor | undefined;
  focusedElement?: DomElementDescriptor | undefined;
  selectedText?: string | undefined;
  interactiveElements: DomElementDescriptor[];
};
export type RecordingEventPayload = {
  kind: string;
  sequence: number;
  url: string;
  title: string;
  eventTimestampMs: number;
  element?: DomElementDescriptor | undefined;
  snapshot?: DomSnapshot | undefined;
  inputValue?: string | undefined;
  key?: string | undefined;
  scroll?: { x: number; y: number } | undefined;
  mutation?: { added: number; removed: number; attributes: number; text: number } | undefined;
  actionResult?: BrowserActionResult | undefined;
  metadata?: JsonObject | undefined;
};
export type BrowserActionCommand = {
  commandId: string;
  actionType: string;
  selector?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  key?: string | undefined;
  timeoutMs?: number | undefined;
  coordinates?: { x: number; y: number } | undefined;
  visualTarget?: {
    bounds?: RectDescriptor | undefined;
    documentBounds?: RectDescriptor | undefined;
    anchor?: { type: "bounds"; bounds: RectDescriptor } | undefined;
    selector?: string | undefined;
  } | undefined;
  options?: JsonObject | undefined;
};
export type BrowserActionResult = {
  commandId: string;
  actionType: string;
  status: "succeeded" | "failed" | "timed_out" | "cancelled";
  message?: string | undefined;
  url?: string | undefined;
  title?: string | undefined;
  element?: DomElementDescriptor | undefined;
  visualTarget?: BrowserActionCommand["visualTarget"] | undefined;
  snapshot?: DomSnapshot | undefined;
  extracted?: JsonValue | undefined;
  startedAt: number;
  finishedAt: number;
};
