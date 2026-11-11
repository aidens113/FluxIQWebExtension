// The chat as the extension's panel mounts it: `@fluxiq/ui-components`' chat
// widget over the extension's background (`transport/`), with the extension's
// own Open FluxIQ control and the owner identity its `ExtensionStatus` implies
// (`owner-context.ts`). The chat itself, and everything it knows how to show,
// lives in the package; this keeps the panel's one call, `createChatPanel`.
//
// Questions are worded by `asks/`, with no PIN dialog: one press of Allow answers
// a permission. A panel-command confirmation is the one question that takes a PIN,
// and the extension never asks for it: the chat sends that one question to FluxIQ.
//
// The chat shows Core's list of threads as a drawer ("Chats"), with New chat,
// Rename and Delete through the background's relays (`transport/`). The thread
// on screen is remembered per browser window for the browser's session
// (`thread-memory/`), so a panel closed and opened again comes back to it.

import { createChatWidget, type ChatAskPort, type ChatOpenControlFactory, type ChatThreadsOptions, type ChatWidget, type ChatWidgetOptions } from "@fluxiq/ui-components";
import "@fluxiq/ui-components/styles/chat.css";
import type { PanelStore } from "../state";
import type { ExtensionStatus } from "../../shared/protocol";
import { createAskPort, createWorkWatch } from "./asks";
import { hostStatusOf } from "./host-status";
import { createChatOwnerContext } from "./owner-context";
import { restoringThreadList, sessionThreadMemory, type ThreadMemory } from "./thread-memory";
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
export type OpenFluxIQFactory = (style: { label: string; look: "small" | "link"; canOpen?: () => boolean; purpose?: "model-key" | "ask" }) => OpenFluxIQControl;

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
  /** How questions are worded and answered, instead of the extension's own port. */
  asks?: ChatAskPort;
  /** The composer's host control ("Show me how", beside "+"), as the package takes it. */
  composer?: NonNullable<ChatWidgetOptions["composer"]>;
  /** Where this window's thread is remembered; the browser's session storage when absent. */
  threadMemory?: ThreadMemory;
};

/** Creates the chat, talking to the background through `request`. */
export function createChatPanel(request: PanelStore["request"], openFluxIQ: OpenFluxIQFactory, options: ChatPanelOptions = {}): ChatPanel {
  const owners = createChatOwnerContext(request);
  let latest: ExtensionStatus | undefined;
  // Each control the chat makes observes the extension's latest status, which `render` records before the chat sees it.
  const openControl: ChatOpenControlFactory = (style) => {
    // The widget says what the button is for (`purpose`): it is passed on whole, so a model key's button reaches the keys page.
    const control = openFluxIQ({ ...style });
    return {
      element: control.element,
      observe: () => {
        if (latest !== undefined) {
          control.observe(latest);
        }
      }
    };
  };
  const { threadMemory, ...chatOptions } = options;
  const memory = threadMemory ?? sessionThreadMemory();
  const extension = createExtensionChatTransport(request);
  // The chat does not exist yet while its transport is made; the restore asks for it once the list is read.
  let mounted: ChatWidget | undefined;
  const transport = { ...extension, conversation: restoringThreadList(extension.conversation, memory, () => mounted) };
  // Listening before the chat does, so a question is drawn knowing the same news the chat just heard.
  const work = createWorkWatch(transport.activity);
  // No `unavailableReason`: a message that names no project goes to the session's
  // project, which the background resolves at send time, asking FluxIQ for one
  // when this browser has none stored (`background/connection/project-context.ts`).
  // So the latest chat takes a person's first message before the status names a
  // project; a send that still finds none answers with the relays' own `no_project` sentence.
  const threads: ChatThreadsOptions = {
    layout: "drawer",
    onSelected(conversationId) {
      const target = mounted?.target();
      if (target?.kind === "thread" && target.conversationId === conversationId) {
        memory.keep({ conversationId, projectId: target.projectId });
      }
    }
  };
  const widget = createChatWidget(transport, {
    ...chatOptions,
    openControl,
    ownerKey: owners.capture().identity,
    asks: chatOptions.asks ?? createAskPort({ working: work.working }),
    threads
  });
  mounted = widget;
  return {
    ...widget,
    render(status) {
      latest = status;
      owners.observe(status);
      widget.render(hostStatusOf(status, owners.capture().identity));
    }
  };
}
