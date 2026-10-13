import assert from "node:assert/strict";
import type { WebAutomationExtractionProposal, WebAutomationRecordedExtraction } from "@fluxiq-web-extension/domain/client";
import { fakeShadowDom } from "../../extraction/tests/fake-shadow-dom";
import { captureSettings } from "../../capture-settings";
import { EXTRACTION_CONTENT_MESSAGES, EXTRACTION_PICKED_MESSAGE, type ExtractionContentResponse } from "../../../shared/extraction-messages";

type Listener = (event: Event) => void;
type Captured = { type: string; sessionId?: string; proposal?: WebAutomationExtractionProposal; payload?: { kind: string; extraction?: WebAutomationRecordedExtraction; element?: unknown } };
const stableWindow: Record<string, unknown> = {};
let loaded: { session: typeof import("../session"); messages: typeof import("../messages"); recorder: typeof import("../../recorder") } | undefined;

/** Real structural inference and public recorder, with a synthetic light DOM and controllable delivery. */
export async function onConfirmationPage(body: (page: {
  command(type: keyof typeof EXTRACTION_CONTENT_MESSAGES, sessionId: string, definition?: unknown): ExtractionContentResponse;
  fire(type: string, target?: Element | null, key?: string): { swallowed: boolean };
  listeners: Map<string, Listener[]>;
  timers: Map<number, () => void>;
  sent: Captured[];
  pick(sessionId: string): WebAutomationRecordedExtraction;
  recording(active: boolean): void;
  reset(): void;
}) => void): Promise<void> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const names = ["window", "document", "location", "chrome", "MutationObserver", "Element", "Node", "CSS", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "setTimeout", "clearTimeout"];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globals, name)]));
  const settings = { ...captureSettings };
  const listeners = new Map<string, Listener[]>();
  const timers = new Map<number, () => void>();
  const sent: Captured[] = [];
  let nextTimer = 0;
  try {
    const { el } = fakeShadowDom();
    const sample = el("span");
    globals.Element = sample.constructor;
    const document: Record<string, unknown> = { nodeType: 9, title: "Synthetic structure", readyState: "complete", addEventListener: () => undefined };
    const decorate = (element: Element): Element => {
      const originalQuery = element.querySelectorAll.bind(element);
      element.querySelectorAll = ((selector: string) => {
        const groups = selector.split(/,(?![^\[]*\])/u);
        const selected = new Set(groups.flatMap(group => Array.from(originalQuery(group.trim()))));
        const found = Array.from(originalQuery("*")).filter(node => selected.has(node));
        return Object.assign(found, { item: (index: number) => found[index] ?? null });
      }) as unknown as typeof element.querySelectorAll;
      element.querySelector = ((selector: string) => element.querySelectorAll(selector)[0] ?? null) as typeof element.querySelector;
      const match = (selector: string): boolean => selector === "*" || (element as unknown as { matchesStep(selector: string): boolean }).matchesStep(selector);
      element.matches = match;
      element.closest = ((selector: string) => {
        for (let current: Element | null = element; current; current = current.parentElement) if (current.matches(selector)) return current;
        return null;
      }) as typeof element.closest;
      Object.defineProperties(element, {
        localName: { value: element.tagName.toLowerCase() }, namespaceURI: { value: "http://www.w3.org/1999/xhtml" },
        ownerDocument: { value: document }, isConnected: { get: () => element.getRootNode() === (document as unknown as Node) },
        textContent: { get: () => Array.from(element.childNodes).map(node => node.textContent).join(""), set: (text: string) => {
          (element.childNodes as unknown as unknown[]).splice(0);
          element.append(text);
        } },
        style: { value: { setProperty: () => undefined } }
      });
      element.getRootNode = (() => {
        let root: { parentNode?: unknown } = element;
        while (root.parentNode) root = root.parentNode as typeof root;
        return root as Node;
      });
      element.setAttribute = (name: string, value: string) => {
        const attrs = (element as unknown as { attrs: Map<string, string> }).attrs;
        attrs.set(name, String(value));
      };
      element.remove = () => {
        const parent = element.parentNode;
        if (parent) (parent.childNodes as unknown as unknown[]).splice(Array.from(parent.childNodes).indexOf(element), 1);
        (element as unknown as { parentNode: null }).parentNode = null;
      };
      for (const child of element.children) decorate(child);
      return element;
    };
    const list = el("ul", { "data-testid": "synthetic-list" }, ...Array.from({ length: 3 }, () => el("li", { "data-testid": "synthetic-item" },
      el("span", { "data-testid": "synthetic-name" }, "CELL_SENTINEL_NAME"), el("span", { "data-testid": "synthetic-private" }, "CELL_SENTINEL_PRIVATE"))));
    const html = decorate(el("html", {}, el("body", {}, list)));
    (html as unknown as { parentNode: unknown }).parentNode = document;
    document.documentElement = html;
    document.body = html.children[0];
    document.querySelectorAll = (selector: string) => [...(html.matches(selector) ? [html] : []), ...Array.from(html.querySelectorAll(selector))];
    document.querySelector = (selector: string) => (document.querySelectorAll as (selector: string) => Element[])(selector)[0] ?? null;
    document.createElement = (tag: string) => decorate(el(tag));
    document.elementFromPoint = () => null;
    Object.assign(stableWindow, {
      addEventListener: (type: string, listener: Listener) => { listeners.set(type, [...listeners.get(type) ?? [], listener]); },
      removeEventListener: (type: string, listener: Listener) => { listeners.set(type, (listeners.get(type) ?? []).filter(entry => entry !== listener)); }
    });
    globals.window = stableWindow;
    globals.document = document;
    globals.location = { href: "https://synthetic.invalid/list" };
    globals.CSS = { escape: (text: string) => text.replace(/[^\w-]/gu, char => `\\${char}`) };
    globals.chrome = { runtime: { sendMessage: (message: Captured) => {
      sent.push(message);
      return Promise.resolve();
    } } };
    globals.MutationObserver = class {
      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] { return []; }
    };
    globals.setTimeout = (callback: () => void) => {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    };
    globals.clearTimeout = (id: number) => { timers.delete(id); };
    loaded ??= { session: await import("../session"), messages: await import("../messages"), recorder: await import("../../recorder") };
    const modules = loaded;
    Object.assign(captureSettings, { mutations: false, inputValues: false, snapshots: false });
    modules.recorder.setRecordingState(true);
    const command = (type: keyof typeof EXTRACTION_CONTENT_MESSAGES, sessionId: string, definition?: unknown): ExtractionContentResponse => {
      const message = modules.messages.extractionContentMessage({ type: EXTRACTION_CONTENT_MESSAGES[type], sessionId, definition });
      assert.ok(message);
      let response: ExtractionContentResponse | undefined;
      assert.equal(modules.messages.handleExtractionMessage(message, value => { response = value; }), "answered");
      assert.ok(response);
      return response;
    };
    const fire = (type: string, target: Element | null = list.children[0]!.children[0]!, key?: string) => {
      const result = { swallowed: false };
      const event = { type, target, key, clientX: 1, clientY: 1, preventDefault: () => { result.swallowed = true; }, stopImmediatePropagation: () => undefined } as unknown as Event;
      for (const listener of [...listeners.get(type) ?? []]) listener(event);
      return result;
    };
    const pick = (sessionId: string): WebAutomationRecordedExtraction => {
      assert.deepEqual(command("pickStart", sessionId), { ok: true });
      fire("pointerdown");
      const picked = [...sent].reverse().find(message => message.type === EXTRACTION_PICKED_MESSAGE && message.sessionId === sessionId);
      assert.ok(picked?.proposal, "actual inference must produce a proposal");
      assert.equal(picked.proposal.itemCount, 3);
      assert.equal(picked.proposal.item, '[data-testid="synthetic-item"]');
      assert.ok(picked.proposal.fields.length > 0);
      assert.doesNotMatch(JSON.stringify(picked), /CELL_SENTINEL/u);
      return { form: "list", datasetId: "synthetic", label: "Chosen records", itemCount: 3,
        fieldLabels: Object.fromEntries(picked.proposal.fields.map(field => [field.key, field.label])), request: {
        item: picked.proposal.item,
        fields: Object.fromEntries(picked.proposal.fields.map(field => [field.key, { ...field.spec, label: field.label, ...(field.label === "synthetic-private" ? { handling: "exclude" as const } : {}) }]))
      } };
    };
    body({ command, fire, listeners, timers, sent, pick, recording: active => modules.recorder.setRecordingState(active), reset: () => modules.session.stopPick() });
  } finally {
    loaded?.session.stopPick();
    loaded?.recorder.setRecordingState(false);
    Object.assign(captureSettings, settings);
    listeners.clear();
    timers.clear();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}
