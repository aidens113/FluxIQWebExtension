import type { BrowserContext, Page } from "@playwright/test";
import { launchFirefoxWithExtension } from "./firefox/index.js";
import { pagePanelDriver } from "./panel-driver.js";
import type { ChatBrowserSession } from "./types.js";

const POPUP_PATH = "popup/index.html";
const POPUP_WIDTH = 420;

/**
 * Headed Firefox with the extension's Firefox build as a temporary add-on, the
 * scenario page, and the extension's popup.
 *
 * The popup is opened the way that keeps the scenario tab the focused window's
 * active tab, which is the page the chat must name:
 *
 * 1. `browser.action.openPopup()` from an extension page, with the scenario
 *    window focused. It is the real toolbar popup, and counts only if
 *    Playwright is handed its page to type in.
 * 2. Otherwise the popup page in an unfocused `type: "popup"` window beside
 *    the browser window, as the Lab's docked popup does for Chrome.
 */
export async function openFirefoxChatSession(input: { profileDir: string; addonPath: string; scenarioUrl: string }): Promise<ChatBrowserSession> {
  const launched = await launchFirefoxWithExtension({ profileDir: input.profileDir, addonPath: input.addonPath });
  const { context, extensionOrigin } = launched;
  const control = context.pages()[0] ?? await context.newPage();
  await gotoExtensionPage(control, `${extensionOrigin}/${POPUP_PATH}`);
  const scenario = await context.newPage();
  await scenario.goto(input.scenarioUrl, { waitUntil: "domcontentloaded" });
  const session: ChatBrowserSession = {
    browser: "firefox",
    context,
    control,
    scenario,
    extensionOrigin,
    profileDir: launched.profileDir,
    browserVersion: context.browser()?.version() ?? "firefox",
    async openPanel() {
      await scenario.bringToFront();
      const popupUrl = `${extensionOrigin}/${POPUP_PATH}`;
      const before = new Set(context.pages());
      const refusal = await control.evaluate(async () => {
        try { await (globalThis as any).browser.action.openPopup(); return null; } catch (error) { return error instanceof Error ? error.message : String(error); }
      });
      const real = refusal === null ? await newPage(before, popupUrl, context, 5_000) : undefined;
      if (real) {
        session.panel = pagePanelDriver(real);
        session.panelMode = "action-popup";
        session.panelNote = "Firefox's real toolbar popup, opened by browser.action.openPopup() with extensions.openPopupWithoutUserGesture.enabled rather than by a click on the toolbar button.";
        return;
      }
      const opened = await control.evaluate(async ({ url, width }) => {
        const api = (globalThis as any).browser;
        const host = await api.windows.getLastFocused();
        const left = (host.left ?? 0) + Math.max(0, (host.width ?? 0) - width);
        const created = await api.windows.create({ url, type: "popup", focused: false, left, top: host.top ?? 0, width, height: host.height ?? 900 });
        return { ok: typeof created?.id === "number" };
      }, { url: popupUrl, width: POPUP_WIDTH });
      const docked = opened.ok ? await newPage(before, popupUrl, context, 10_000) : undefined;
      if (!docked) throw new Error(`Neither way of showing the popup gave Playwright a page: openPopup ${refusal === null ? "resolved but no page was attached" : `refused: ${refusal}`}; the popup window ${opened.ok ? "opened but no page was attached" : "was not created"}`);
      await scenario.bringToFront();
      session.panel = pagePanelDriver(docked);
      session.panelMode = "popup-window";
      session.panelNote = `The popup page in an unfocused popup-type window beside the browser window, because the real toolbar popup ${refusal === null ? "opened but Playwright was not handed its page" : `was refused (${refusal})`}. It is the same page and the same background relay, but not the toolbar popup's own document, and nothing here clicks the toolbar button.`;
    },
    close: () => context.close(),
  };
  return session;
}

/** A moz-extension page is opened by address; Firefox may report the navigation as aborted while it still loads it. */
async function gotoExtensionPage(page: Page, url: string): Promise<void> {
  try { await page.goto(url, { waitUntil: "domcontentloaded" }); } catch { /* best-effort: Firefox may report an aborted navigation while loading the page, which the URL wait below checks */ }
  await page.waitForURL(candidate => candidate.href.startsWith(url), { timeout: 10_000 });
  await page.waitForFunction(() => typeof (globalThis as any).browser?.runtime?.sendMessage === "function", undefined, { timeout: 10_000 });
}

async function newPage(before: ReadonlySet<Page>, url: string, context: BrowserContext, timeoutMs: number): Promise<Page | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = context.pages().find(page => !before.has(page) && page.url().startsWith(url));
    if (found) {
      await found.waitForLoadState("domcontentloaded").catch(/* best-effort: the composer wait that follows fails with the reason if it never loads */ () => undefined);
      return found;
    }
    if (Date.now() >= deadline) return undefined;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
