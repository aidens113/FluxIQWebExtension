type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
type JsonObject = {
    [key: string]: JsonValue;
};
type RectDescriptor = {
    x: number;
    y: number;
    width: number;
    height: number;
};
type DomElementDescriptor = {
    tagName: string;
    selector: string;
    text?: string | undefined;
    value?: string | undefined;
    role?: string | undefined;
    name?: string | undefined;
    href?: string | undefined;
    inputType?: string | undefined;
    bounds?: RectDescriptor | undefined;
    attributes?: Record<string, string> | undefined;
};
type DomSnapshot = {
    url: string;
    title: string;
    viewport: {
        width: number;
        height: number;
        scrollX: number;
        scrollY: number;
    };
    focusedElement?: DomElementDescriptor | undefined;
    selectedText?: string | undefined;
    interactiveElements: DomElementDescriptor[];
};
type RecordingEventPayload = {
    kind: string;
    sequence: number;
    url: string;
    title: string;
    eventTimestampMs: number;
    element?: DomElementDescriptor | undefined;
    snapshot?: DomSnapshot | undefined;
    inputValue?: string | undefined;
    key?: string | undefined;
    scroll?: {
        x: number;
        y: number;
    } | undefined;
    mutation?: {
        added: number;
        removed: number;
        attributes: number;
        text: number;
    } | undefined;
    actionResult?: BrowserActionResult | undefined;
    metadata?: JsonObject | undefined;
};
type BrowserActionCommand = {
    commandId: string;
    actionType: string;
    selector?: string | undefined;
    text?: string | undefined;
    value?: string | undefined;
    key?: string | undefined;
    timeoutMs?: number | undefined;
    coordinates?: {
        x: number;
        y: number;
    } | undefined;
    options?: JsonObject | undefined;
};
type BrowserActionResult = {
    commandId: string;
    actionType: string;
    status: "succeeded" | "failed" | "timed_out" | "cancelled";
    message?: string | undefined;
    url?: string | undefined;
    title?: string | undefined;
    element?: DomElementDescriptor | undefined;
    snapshot?: DomSnapshot | undefined;
    extracted?: JsonValue | undefined;
    startedAt: number;
    finishedAt: number;
};
declare const CONTENT_EVENT = "fluxiq.contentEvent";
declare const CONTENT_READY = "fluxiq.contentReady";
declare let recording: boolean;
declare let sequence: number;
declare let captureMutations: boolean;
declare let captureInputValues: boolean;
declare let captureSnapshots: boolean;
declare let scrollTimer: ReturnType<typeof setTimeout> | undefined;
declare let mutationTimer: ReturnType<typeof setTimeout> | undefined;
declare let pendingMutation: {
    added: number;
    removed: number;
    attributes: number;
    text: number;
};
declare const observer: MutationObserver;
declare function sendReady(): void;
declare function emit(kind: string, details: Partial<RecordingEventPayload>): void;
declare function basePayload(kind: string, details: Partial<RecordingEventPayload>): RecordingEventPayload;
declare function executeAction(action: BrowserActionCommand): Promise<BrowserActionResult>;
declare function resolveTarget(action: BrowserActionCommand): Element;
declare function success(action: BrowserActionCommand, startedAt: number, message: string, element?: DomElementDescriptor, snapshot?: DomSnapshot, extracted?: JsonValue): BrowserActionResult;
declare function actionFailure(action: BrowserActionCommand, error: unknown, startedAt?: number): BrowserActionResult;
declare function captureSnapshot(): DomSnapshot;
declare function describeElement(element: Element): DomElementDescriptor;
declare function selectorFor(element: Element): string;
declare function visibleText(element: Element): string | undefined;
declare function readElementValue(element: Element | null): string | undefined;
declare function accessibleName(element: Element): string | undefined;
declare function pointerMetadata(event: MouseEvent): JsonObject;
declare function cssString(value: string): string;
declare function scrollElementIntoView(element: Element): void;
declare function setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void;
declare function dispatchInputEvents(element: Element): void;
declare function waitForElement(selector: string | undefined, timeoutMs?: number): Promise<Element>;
declare function waitForText(text: string, timeoutMs?: number): Promise<void>;
declare function extractElement(element: Element, options?: JsonObject): JsonValue;
declare function compactObject<T extends Record<string, unknown>>(value: T): T;
