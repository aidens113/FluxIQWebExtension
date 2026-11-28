import type { ChatWelcome } from "@fluxiq/ui-components";

/**
 * What the extension's empty chat says: one way in. A person types what they want; FluxIQ picks the
 * project (making the first when there is none) and saves the Flow. It says nothing about choosing or
 * creating a project first, because none is needed, and no key or settings form lives here.
 */
export const EXTENSION_WELCOME: ChatWelcome = {
  title: "What do you want FluxIQ to do?",
  line: "Tell FluxIQ what you want. It picks the project and saves the Flow.",
  items: []
};
