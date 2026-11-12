import type { CDPSession, Page } from "@playwright/test";
import { navigateChatProject } from "./project-navigation/index.js";
import { pressInViewTarget } from "./view-target-press/index.js";

const COMPOSER = 'textarea[aria-label="Message to FluxIQ"]';
const SEND = 'button[aria-label="Send"]';

export type ChatProjectScope = { projectId: string | null; scopeState: "loading" | "ready" | "error" | null; composerAvailable: boolean; composerEnabled: boolean };

/**
 * The chat as a person uses it: type a message and send it, read what the
 * panel shows, press one of its buttons.
 *
 * `input` says how: `trusted` is Playwright's own input into a page it drives;
 * `view-dom` is script in the panel's own document, used for Chrome's real
 * side panel, whose page Playwright 1.51 does not hand over; its button
 * presses are still real mouse input, sent over CDP to the panel's own target,
 * because answers require a person's activation. Both run the panel's real
 * composer, controller and background relay; only the typing and the Send
 * click differ.
 */
export type ChatPanelDriver = {
  input: "trusted" | "view-dom";
  /** The panel's page when Playwright drives it, for a screenshot of the panel alone. */
  page?: Page;
  /** Setup navigation only; sends no turn and waits for the actual scoped thread read. */
  selectProject(projectId: string, timeoutMs?: number): Promise<ChatProjectScope>;
  projectScope(): Promise<ChatProjectScope>;
  send(text: string): Promise<void>;
  /** True once the panel shows `text`, false if it did not within `timeoutMs`. */
  shows(text: string, timeoutMs: number): Promise<boolean>;
  /** Presses the button with exactly this label once it shows; fails after `timeoutMs`. */
  press(label: string, timeoutMs: number): Promise<void>;
  text(): Promise<string>;
};

/** A panel page Playwright drives: the Firefox popup, or any panel page Playwright was handed. */
export function pagePanelDriver(page: Page): ChatPanelDriver {
  const scope = () => page.evaluate(inProjectView, { action: "read" as const }) as Promise<ChatProjectScope>;
  return {
    input: "trusted",
    page,
    selectProject: (projectId, timeoutMs) => navigateChatProject(projectId, () => page.evaluate(inProjectView, { action: "navigate" as const, projectId }), scope, timeoutMs),
    projectScope: scope,
    async send(text) {
      const box = page.locator(COMPOSER);
      await box.waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForFunction(selector => { const element = document.querySelector(selector) as HTMLTextAreaElement | null; return !!element && !element.disabled && !element.readOnly; }, COMPOSER, { timeout: 30_000 });
      await box.click();
      await box.fill(text);
      const send = page.locator(SEND).first();
      if (await send.count() > 0 && await send.isEnabled()) await send.click();
      else await box.press("Enter");
    },
    shows: (text, timeoutMs) => page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: timeoutMs }).then(() => true, () => false),
    async press(label, timeoutMs) {
      const button = page.getByRole("button", { name: label, exact: true }).first();
      await button.waitFor({ state: "visible", timeout: timeoutMs });
      await button.click();
    },
    text: () => page.locator("body").innerText({ timeout: 5_000 }),
  };
}

/**
 * Chrome's real side panel, driven from the extension's control tab through
 * `chrome.extension.getViews()`: the side panel is an extension view in the
 * same process, so its `window` is reachable from another extension page. The
 * text is set through the textarea's own value setter with an `input` event,
 * and Send is clicked with `HTMLElement.click()` (sending a message needs no
 * activation).
 *
 * A button press is different: the chat's answer controls ignore untrusted
 * events and the extension sends an answer only while the panel has a
 * person's activation, so `press` sends real mouse input to the side panel's
 * own target through a CDP session on the control tab (`pressInViewTarget`).
 * `openSession` opens that session; tests pass a fake.
 */
export function extensionViewPanelDriver(control: Page, panelPath: string, openSession: () => Promise<CDPSession> = () => control.context().newCDPSession(control)): ChatPanelDriver {
  const run = <T>(action: string, argument: string) => control.evaluate(inView, { panelPath, action, argument, composer: COMPOSER, sendSelector: SEND }) as Promise<T>;
  const scope = () => control.evaluate(inProjectView, { panelPath, action: "read" as const }) as Promise<ChatProjectScope>;
  return {
    input: "view-dom",
    selectProject: (projectId, timeoutMs) => navigateChatProject(projectId, () => control.evaluate(inProjectView, { panelPath, action: "navigate" as const, projectId }), scope, timeoutMs),
    projectScope: scope,
    async send(text) {
      const deadline = Date.now() + 30_000;
      for (;;) {
        const outcome = await run<string>("send", text);
        if (outcome === "sent") return;
        if (Date.now() >= deadline) throw new Error(`The side panel's composer could not send: ${outcome}`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    async shows(text, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        if ((await run<string>("text", "")).includes(text)) return true;
        if (Date.now() >= deadline) return false;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    async press(label, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      const viewUrl = extensionViewUrl(control.url(), panelPath);
      const session = await openSession();
      try {
        for (;;) {
          const outcome = await pressInViewTarget(session, { viewUrl, label });
          if (outcome === "pressed") return;
          if (Date.now() >= deadline) throw new Error(`The side panel showed no enabled "${label}" button to press: ${outcome}`);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } finally {
        await session.detach().catch(/* best-effort: the session only reads and presses, and a closed browser has none left */ () => undefined);
      }
    },
    text: () => run<string>("text", ""),
  };
}

/** Self-contained because Playwright serializes it into the actual extension view. */
function inProjectView({ panelPath, action, projectId }: { panelPath?: string; action: "navigate" | "read"; projectId?: string }): ChatProjectScope | null {
  const current = globalThis as unknown as Window & { chrome: { extension: { getViews(): Window[] } }; CustomEvent: typeof CustomEvent };
  const panel = panelPath === undefined ? current : current.chrome.extension.getViews().find(view => view !== current && view.location.pathname === `/${panelPath}`);
  if (!panel) throw new Error("The mounted chat project view is unavailable");
  if (action === "navigate") {
    if (!projectId || projectId.length > 256 || /[\s\u0000-\u001f\u007f]/u.test(projectId)) throw new Error("Chat project identifier is invalid");
    panel.dispatchEvent(new (panel as Window & { CustomEvent: typeof CustomEvent }).CustomEvent("fluxiq:chat-project", { detail: { projectId } }));
    return null;
  }
  const chat = panel.document.querySelector('[aria-label="Chat with FluxIQ"]');
  if (!chat) throw new Error("The mounted chat project receiver is unavailable");
  const state = chat.getAttribute("data-fluxiq-chat-scope-state");
  const box = chat.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message to FluxIQ"]');
  const parkedDraft = chat.querySelector<HTMLElement>(".composer-draft-review");
  return {
    projectId: chat.getAttribute("data-fluxiq-chat-project"),
    scopeState: state === "loading" || state === "ready" || state === "error" ? state : null,
    composerAvailable: box !== null,
    composerEnabled: box !== null && !box.disabled && !box.readOnly && (parkedDraft === null || parkedDraft.hidden),
  };
}

/** Runs in the control tab, an extension page: finds the side panel's window among the extension's views and acts in it. */
function inView({ panelPath, action, argument, composer, sendSelector }: { panelPath: string; action: string; argument: string; composer: string; sendSelector: string }): string {
  const chrome = (globalThis as any).chrome;
  const views: Window[] = chrome.extension.getViews();
  const panel = views.find(view => view !== (globalThis as unknown as Window) && view.location.pathname === `/${panelPath}`);
  if (!panel) return `no side panel view among ${views.length} extension view(s): ${views.map(view => view.location.pathname).join(", ")}`;
  const document = panel.document;
  if (action === "text") return document.body?.innerText ?? "";
  if (action === "send") {
    const box = document.querySelector(composer) as HTMLTextAreaElement | null;
    if (!box) return "no composer";
    if (box.disabled || box.readOnly) return "the composer is disabled";
    const setter = Object.getOwnPropertyDescriptor((panel as any).HTMLTextAreaElement.prototype, "value")!.set!;
    box.focus();
    setter.call(box, argument);
    box.dispatchEvent(new (panel as any).Event("input", { bubbles: true }));
    const send = document.querySelector(sendSelector) as HTMLButtonElement | null;
    if (!send) return "no Send button";
    if (send.disabled) return "the Send button is disabled";
    send.click();
    return "sent";
  }
  return `unknown action ${action}`;
}

/** The extension view's address on the control tab's extension origin (`chrome-extension://<id>/<path>`). */
function extensionViewUrl(controlUrl: string, viewPath: string): string {
  const control = new URL(controlUrl);
  return `${control.protocol}//${control.host}/${viewPath}`;
}
