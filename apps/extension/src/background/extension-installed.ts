// What the worker does when the extension is installed or updated
// (`chrome.runtime.onInstalled`): the toolbar button opens the side panel.
//
// It writes no saved state. Settings are read with defaults for whatever is
// not stored (`storage.ts`), so storing the defaults adds nothing, and the
// client id is created by the worker's own start-up (`index.ts`), which every
// install and update runs. The handler used to do both: it read the settings,
// then wrote them back, and created the client id beside the start-up's own.
// Anything saved between that read and that write was replaced by what the
// read saw -- on a busy machine, the gateway address a test had just stored, so
// the restarted worker dialled the default address and never reached its
// gateway (t737).

export type ExtensionInstalledDeps = {
  readonly enableSidePanel: () => Promise<void>;
};

export async function handleExtensionInstalled(deps: ExtensionInstalledDeps): Promise<void> {
  await deps.enableSidePanel();
}
