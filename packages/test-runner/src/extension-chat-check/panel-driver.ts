import type { Page } from "@playwright/test";

const COMPOSER = 'textarea[aria-label="Message to FluxIQ"]';
const SEND = 'button[aria-label="Send"]';

/**
 * The chat as a person uses it: type a message and send it, read what the
 * panel shows, press one of its buttons.
 *
 * `input` says how: `trusted` is Playwright's own input into a page it drives;
 * `view-dom` is script in the panel's own document, used for Chrome's real
 * side panel, whose page Playwright 1.51 does not hand over. Both run the
 * panel's real composer, controller and background relay; only the key
 * presses and clicks differ.
 */
export type ChatPanelDriver = {
  input: "trusted" | "view-dom";
  /** The panel's page when Playwright drives it, for a screenshot of the panel alone. */
  page?: Page;
  send(text: string): Promise<void>;
  /** True once the panel shows `text`, false if it did not within `timeoutMs`. */
  shows(text: string, timeoutMs: number): Promise<boolean>;
  /** Presses the button with exactly this label once it shows; fails after `timeoutMs`. */
  press(label: string, timeoutMs: number): Promise<void>;
  text(): Promise<string>;
};

/** A panel page Playwright drives: the Firefox popup, or any panel page Playwright was handed. */
export function pagePanelDriver(page: Page): ChatPanelDriver {
  return {
    input: "trusted",
    page,
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
 * and the Send and answer buttons are clicked with `HTMLElement.click()`.
 */
export function extensionViewPanelDriver(control: Page, panelPath: string): ChatPanelDriver {
  const run = <T>(action: string, argument: string) => control.evaluate(inView, { panelPath, action, argument, composer: COMPOSER, sendSelector: SEND }) as Promise<T>;
  return {
    input: "view-dom",
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
      for (;;) {
        const outcome = await run<string>("press", label);
        if (outcome === "pressed") return;
        if (Date.now() >= deadline) throw new Error(`The side panel showed no enabled "${label}" button: ${outcome}`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    },
    text: () => run<string>("text", ""),
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
  if (action === "press") {
    const button = Array.from(document.querySelectorAll("button")).find(candidate => candidate.textContent?.trim() === argument && !(candidate as HTMLButtonElement).disabled) as HTMLButtonElement | undefined;
    if (!button) return "not shown yet";
    button.click();
    return "pressed";
  }
  return `unknown action ${action}`;
}
