// FluxIQ's own pages: the one rule both the background's tab gate and the
// content script decide by, and the refusal both give.

export { isOwnPageAddress, ownPageAddresses } from "./rule";
export { isOwnPageRefusalReply, OWN_PAGE_ADDRESSES_MESSAGE, OWN_PAGE_REFUSAL_MESSAGE, ownPageRefusalReply, ownPageUnconfirmedReply } from "./refusal-reply";
export type { OwnPageRefusalReply } from "./refusal-reply";
