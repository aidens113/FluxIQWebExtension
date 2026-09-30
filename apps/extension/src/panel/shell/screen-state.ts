// Which screen fills the panel under the top bar. Pure, so every rule is
// tested without a DOM.
//
//   settings         the gear was pressed: configuration, in place of
//                    everything else, until the person goes back or picks a tab
//   getting-started  FluxIQ is not connected, this browser is not approved yet,
//                    or something critical is wrong: numbered steps replace the
//                    chat completely until it is fixed
//   chat             the default: the conversation, with the whole panel
//   automations      the person's automations
//
// Settings wins over getting-started on purpose: the connection address is in
// settings, and a person who cannot connect may need to change it.

/** The top bar's tabs. */
export type ShellTab = "chat" | "automations";

/** What the person chose: a tab, and whether settings are open over it. */
export type ShellState = { readonly tab: ShellTab; readonly settings: boolean };

/** What the person did in the top bar or a screen. */
export type ShellEvent =
  | { readonly type: "tab"; readonly tab: ShellTab }
  | { readonly type: "gear" }
  | { readonly type: "closeSettings" };

/** The screen on show. */
export type ShellScreen = "settings" | "getting-started" | ShellTab;

/** The panel as it opens: the chat, settings closed. */
export const INITIAL_SHELL: ShellState = { tab: "chat", settings: false };

/** Applies `event`. Picking a tab closes settings; the gear toggles them. */
export function reduceShell(state: ShellState, event: ShellEvent): ShellState {
  switch (event.type) {
    case "tab":
      return state.tab === event.tab && !state.settings ? state : { tab: event.tab, settings: false };
    case "gear":
      return { ...state, settings: !state.settings };
    case "closeSettings":
      return state.settings ? { ...state, settings: false } : state;
  }
}

/** The screen for `state` while `gated` says the getting-started steps must show. */
export function shellScreen(state: ShellState, gated: boolean): ShellScreen {
  if (state.settings) return "settings";
  if (gated) return "getting-started";
  return state.tab;
}
