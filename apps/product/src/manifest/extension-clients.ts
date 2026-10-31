import type { PanelProduct } from "fluxiq/platform/panel";

// Chrome and Edge are left out until the store item id is known (hosted plan,
// "Chrome Web Store": the id is assigned at the first upload). An id is never
// guessed. Firefox's Origin is per install, so Core matches it by prefix.
export const productExtensionClients: NonNullable<PanelProduct["extensionClients"]> = [
  { id: "firefox", label: "FluxIQ for Firefox", origins: ["moz-extension://*"] }
];
