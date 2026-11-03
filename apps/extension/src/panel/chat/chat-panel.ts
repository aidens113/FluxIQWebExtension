// The chat as the extension's panel mounts it: `@fluxiq/ui-components`' chat
// widget over the extension's background (`transport/`), with the extension's
// own Open FluxIQ control and the owner identity its `ExtensionStatus` implies
// (`owner-context.ts`). The chat itself, and everything it knows how to show,
// lives in the package; this keeps the panel's one call, `createChatPanel`.

import { createChatWidget, type ChatOpenControlFactory, type ChatWidget } from "@fluxiq/ui-components";
import "@fluxiq/ui-components/styles/chat.css";
import type { PanelStore } from "../state";
import type { ExtensionStatus } from "../../shared/protocol";
import { hostStatusOf } from "./host-status";
import { createChatOwnerContext } from "./owner-context";
import { createExtensionChatTransport } from "./transport";

/** The mounted chat: the package's, told about the extension's status. */
export type ChatPanel = Omit<ChatWidget, "render"> & {
  render(status: ExtensionStatus): void;
};

/** An Open FluxIQ control. */
export type OpenFluxIQControl = { readonly element: HTMLElement; observe(status: ExtensionStatus): void };

/**
 * Makes an Open FluxIQ control, for a question that only FluxIQ can show. The panel passes its own (`panel/open-fluxiq/`), so the
 * chat does not reach into it.
 */
export type OpenFluxIQFactory = (style: { label: string; look: "small" | "link"; canOpen?: () => boolean }) => OpenFluxIQControl;

/** How the panel mounts the chat. */
export type ChatPanelOptions = {
  /** Hears whether the thread has turns, each time that changes. */
  onConversation?: (hasTurns: boolean) => void;
  /**
   * Whether the chat shows its own line naming the automation, with "Latest
   * chat" (default true). A panel that shows the open automation above the
   * chat itself passes false, so the name is not said twice.
   */
  contextLine?: boolean;
  /** The empty latest chat's "Extract data from this page": the panel shows its extraction sheet. */
  onExtract?: () => void;
};

/** Creates the chat, talking to the background through `request`. */
export function createChatPanel(request: PanelStore["request"], openFluxIQ: OpenFluxIQFactory, options: ChatPanelOptions = {}): ChatPanel {
  const owners = createChatOwnerContext(request);
  let latest: ExtensionStatus | undefined;
  // Each control the chat makes observes the extension's latest status, which `render` records before the chat sees it.
  const openControl: ChatOpenControlFactory = (style) => {
    const control = openFluxIQ(style);
    return {
      element: control.element,
      observe: () => {
        if (latest !== undefined) {
          control.observe(latest);
        }
      }
    };
  };
  const widget = createChatWidget(createExtensionChatTransport(request), {
    ...options,
    openControl,
    ownerKey: owners.capture().identity
  });
  return {
    ...widget,
    render(status) {
      latest = status;
      owners.observe(status);
      widget.render(hostStatusOf(status, owners.capture().identity));
    }
  };
}
