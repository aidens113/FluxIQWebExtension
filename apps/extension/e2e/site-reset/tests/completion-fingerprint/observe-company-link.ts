import type { Page } from "@playwright/test";

/** Observes the actual link receiving a click, across the fixture's real document navigations. */
export async function observeCompanyLink(page: Page, origin: string) {
  const key = "completion-fingerprint-proof";
  const home = "/scenarios/company-website/";
  const originalId = "company-main-team";
  const changedId = "company-main-team-restyled";
  type Mode = "original" | "restyled" | "missing";
  type Click = { document: number; landmark: "navigation" | "contentinfo" | "other"; restyled: boolean; originalAddressMissing: boolean };
  type State = { mode: Mode; documents: number; selector?: string; clicks: Click[]; setupFailures: number };

  await page.addInitScript(({ key, home, origin, originalId, changedId }) => {
    if (location.origin !== origin) return;
    type Stored = { mode: "original" | "restyled" | "missing"; documents: number; selector?: string; clicks: Array<{ document: number; landmark: "navigation" | "contentinfo" | "other"; restyled: boolean; originalAddressMissing: boolean }>; setupFailures: number };
    const read = (): Stored => JSON.parse(sessionStorage.getItem(key) ?? '{"mode":"original","documents":0,"clicks":[],"setupFailures":0}') as Stored;
    const save = (value: Stored) => sessionStorage.setItem(key, JSON.stringify(value));
    const state = read();
    state.documents++;
    save(state);
    document.addEventListener("click", (event) => {
      const link = event.composedPath().find((entry): entry is HTMLAnchorElement => entry instanceof HTMLAnchorElement);
      if (!link) return;
      const current = read();
      current.clicks.push({
        document: current.documents,
        landmark: link.closest('nav[aria-label="Main"]') ? "navigation" : link.closest("footer") ? "contentinfo" : "other",
        restyled: link.id === changedId && link.className === "restyled-company-link",
        originalAddressMissing: typeof current.selector === "string" && document.querySelectorAll(current.selector).length === 0
      });
      save(current);
    }, true);
    const prepare = () => {
      if (!location.pathname.startsWith(home)) return;
      const links = [...document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Main"] a')]
        .filter((link) => link.textContent?.trim() === "Our team");
      const current = read();
      if (links.length !== 1) {
        current.setupFailures++;
        save(current);
        return;
      }
      const link = links[0]!;
      // Only a weak address is introduced before capture. The saved identity
      // itself always comes from the actual extension snapshot and normalizer.
      link.id = originalId;
      if (location.pathname === home && current.mode === "missing") link.remove();
      else if (location.pathname === home && current.mode === "restyled") {
        link.id = changedId;
        link.className = "restyled-company-link";
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepare, { once: true });
    else prepare();
  }, { key, home, origin, originalId, changedId });

  const snapshot = () => page.evaluate((key): State => JSON.parse(sessionStorage.getItem(key) ?? "null") as State, key);
  const mode = (mode: Mode, selector: string) => page.evaluate(({ key, mode, selector }) => {
    const state = JSON.parse(sessionStorage.getItem(key) ?? "null") as State | null;
    if (state === null) throw new Error("completion_fingerprint.observer_missing");
    sessionStorage.setItem(key, JSON.stringify({ ...state, mode, selector }));
  }, { key, mode, selector });
  return { snapshot, mode };
}
