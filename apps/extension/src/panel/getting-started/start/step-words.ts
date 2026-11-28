// What each setup step says, in one place so the screen and the tests agree.
// Plain words: nothing a beginner has to decode. The one address shown is the FluxIQ web address.

/** FluxIQ has no installer yet, so this says only what a person needs: it runs on this computer and stays running. */
export const START_LINE = "FluxIQ needs to be running on this computer. Start it and keep it running while you use this panel. When it is running, its web page opens.";
export const START_PROBLEM = "FluxIQ isn't answering. Check that it is still running on this computer, then press Try again.";
/** The request goes out by itself once FluxIQ is found, so this says only what to do when it is not found yet. */
export const CONNECT_LINE = "Once FluxIQ is running, this browser asks it for approval by itself.";
export const CONNECTING_LINE = "Connecting to FluxIQ...";
export const ASKING_LINE = "Asking FluxIQ for approval...";
export const RECONNECTING_LINE = "Lost the connection. Trying again...";
/** Sign-in is FluxIQ's own page: the extension cannot tell whether it is open, so the step says it where it is needed. */
export const APPROVE_LINE = "In FluxIQ, sign in if it asks, check that its request shows this code, then press Confirm.";
/** The trust is gone: FluxIQ refused this browser, or the approval was dropped after it was connected. */
export const ACCESS_REMOVED_LINE = "Access was removed. Connect again to ask for approval.";
/** A connection that ended without a sign the approval is gone. */
export const NOT_CONNECTED_LINE = "Not connected. Connect again.";
/** The AI key is the last step; keys are added in the FluxIQ panel, and the chat says when one is missing. */
export const KEY_LINE = "Add your AI key in the FluxIQ panel. Then ask FluxIQ for anything in the chat.";
export const SETUP_LINE = "A few steps, then ask FluxIQ for anything in the chat.";

/** Where FluxIQ was found, with the "Change" that follows it on screen. */
export const foundLine = (host: string): string => `FluxIQ found at ${host}`;
/** Where FluxIQ was looked for and did not answer. */
export const notFoundLine = (host: string): string => `FluxIQ isn't answering at ${host}. Start it and keep it running, or change the address.`;
