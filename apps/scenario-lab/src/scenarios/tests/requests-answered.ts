import type { BrowserContext, Page } from "@playwright/test";
import { withinPageTime } from "./within-page-time.js";

/**
 * Waits, in the page's own time, until every request the page itself sent has
 * been answered. A recording-script step is done when what it did has landed,
 * and an act whose handler saves something (an offer declined, a store chosen)
 * has landed once that save is answered: the extension's own landing counts the
 * page's requests until they answer (`apps/extension/src/page-world/page-work`).
 *
 * A step that moved on before then could navigate away from a save still in
 * flight, and the next page was drawn from a state that never heard of it. On a
 * saturated machine (t904), bigbox's "No thanks" removed the email offer and
 * only then sent its dismissal; the next step opened the cart, the cart was
 * drawn with the offer still pending, and the offer came back over the
 * checkout button. Nothing about that is the site's fault, and on an idle
 * machine the request merely happened to win.
 *
 * The first call arms the context, so every document it loads after counts its
 * requests from its first script; call it before a script's first step. A
 * document with nothing counted has nothing open.
 */
export async function requestsAnswered(page: Page, budgetMs: number, what: string): Promise<void> {
  await armed(page);
  await withinPageTime(page, budgetMs, `${what}: the page's own requests were never answered`, async () => {
    // Mid-navigation the read fails and is asked again of the next document; a closed page ends the wait.
    while (!page.isClosed() && (await page.evaluate(openRequests, ACCOUNT).catch(() => undefined)) !== 0) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  });
}

const ACCOUNT = "__scenarioLabOpenRequests";

/** A request object as the page's own XHR is one: listened to until it ends. */
type PageRequest = { addEventListener(type: string, listener: () => void, options?: { once?: boolean }): void; removeEventListener(type: string, listener: () => void): void };
type PageScope = Record<string, unknown> & {
  fetch?: (...args: unknown[]) => Promise<unknown>;
  XMLHttpRequest?: { prototype: { send?: (this: PageRequest, ...args: unknown[]) => unknown } };
};

/** Counts the page's fetches and XHRs from the call until they settle, as an init script; invisible to the site's own enumeration. */
function countRequests(name: string): void {
  const scope = globalThis as unknown as PageScope;
  if (scope[name]) return;
  const account = { open: 0 };
  Object.defineProperty(scope, name, { value: account, enumerable: false });
  const settle = () => { account.open -= 1; };
  const fetchOriginal = scope.fetch;
  if (typeof fetchOriginal === "function") {
    scope.fetch = function (this: unknown, ...args: unknown[]) {
      account.open += 1;
      try {
        const answer = fetchOriginal.apply(this, args);
        answer.then(settle, settle);
        return answer;
      } catch (error) {
        settle();
        throw error;
      }
    };
  }
  const prototype = scope.XMLHttpRequest?.prototype;
  const send = prototype?.send;
  if (prototype && typeof send === "function") {
    prototype.send = function (this: PageRequest, ...args: unknown[]) {
      account.open += 1;
      this.addEventListener("loadend", settle, { once: true });
      try {
        return send.apply(this, args);
      } catch (error) {
        this.removeEventListener("loadend", settle);
        settle();
        throw error;
      }
    };
  }
}

function openRequests(name: string): number {
  const account = (globalThis as unknown as Record<string, { open: number } | undefined>)[name];
  return account?.open ?? 0;
}

const armedContexts = new WeakSet<BrowserContext>();
const armedPages = new WeakSet<Page>();

async function armed(page: Page): Promise<void> {
  const context = page.context();
  if (!armedContexts.has(context)) {
    armedContexts.add(context);
    await context.addInitScript(countRequests, ACCOUNT);
  }
  if (!armedPages.has(page)) {
    armedPages.add(page);
    // The document already open predates the init script.
    await page.evaluate(countRequests, ACCOUNT).catch(() => undefined);
  }
}
