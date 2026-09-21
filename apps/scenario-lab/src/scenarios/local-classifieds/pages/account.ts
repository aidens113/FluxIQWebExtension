import { SAVED_SCRIPT } from "../client/index.js";
import type { ClassifiedsState } from "../types.js";
import { inboxMarkup, peopleResultsMarkup, placeholderMarkup, savedMarkup, shellMarkup, type ShellSection } from "../view/index.js";
import { classifiedsDocument, type PageBuild } from "./document.js";

/** The pages behind the sidebar's links, and the top bar's people search. */
export type AccountPage = "saved" | "inbox" | "buying" | "notifications" | "selling";

export function accountPage(build: PageBuild, state: ClassifiedsState, which: AccountPage): string {
  const { sheet, ids } = build;
  const main = which === "saved" ? savedMarkup(sheet, ids, state)
    : which === "inbox" ? inboxMarkup(sheet, state, "Marketplace inbox")
      : which === "buying" ? inboxMarkup(sheet, state, "Buying")
        : which === "notifications" ? placeholderMarkup(sheet, "Notifications", "You're all caught up.")
          : placeholderMarkup(sheet, "Your listings", "You haven't listed anything for sale yet.");
  const section: ShellSection = which;
  const body = shellMarkup({ sheet, ids, state, section, main });
  const titles: Record<AccountPage, string> = { saved: "Saved items", inbox: "Inbox", buying: "Buying", notifications: "Notifications", selling: "Selling" };
  return classifiedsDocument(build, state, `${titles[which]} | Kerbfind Marketplace`, body, which === "saved" ? [SAVED_SCRIPT] : []);
}

export function peoplePage(build: PageBuild, state: ClassifiedsState, text: string): string {
  const body = shellMarkup({ sheet: build.sheet, ids: build.ids, state, section: "other", main: peopleResultsMarkup(build.sheet, text) });
  return classifiedsDocument(build, state, `${text} | Kerbfind search`, body, []);
}
