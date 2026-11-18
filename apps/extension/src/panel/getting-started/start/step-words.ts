// What each setup step says, in one place so the screen and the tests agree.
// Plain words: nothing a beginner has to decode. The one address shown is the FluxIQ web address.

/** FluxIQ has no installer yet, so this says only what a person needs: it runs on this computer and stays running. */
export const START_LINE = "FluxIQ needs to be running on this computer. Start it and keep it running while you use this panel. When it is running, its web page opens.";
export const START_PROBLEM = "FluxIQ isn't answering. Check that it is still running on this computer, then press Try again.";
export const SIGN_IN_LINE = "Open FluxIQ and sign in on its sign-in page. If it is your first time, the page tells you how to get started.";
export const SIGN_IN_TO_APPROVE_LINE = "Sign in on FluxIQ's page to approve. Use Open FluxIQ below.";
export const CONNECT_LINE = "Press Connect so FluxIQ can work in this browser.";
export const CONNECT_AGAIN_LINE = "Connect to pick up where you left off.";
export const CONNECT_FAILED_LINE = "Can't reach FluxIQ.";
export const APPROVE_LINE = "In FluxIQ, check that its request shows this code, then press Confirm.";
/** The browser was approved once, and nothing since has said it still is. */
export const APPROVED_EARLIER_LINE = "This browser was approved earlier. Connect to check it still is.";
/** After a connection that was refused or lost: FluxIQ may have been told to forget this browser. */
export const MAY_HAVE_BEEN_REMOVED_LINE = "FluxIQ may have removed this browser. Connect again to ask for approval.";
export const SETUP_LINE = "A few steps, then ask FluxIQ for anything in the chat.";

/** Where FluxIQ was found, with the "Change" that follows it on screen. */
export const foundLine = (host: string): string => `FluxIQ found at ${host}`;
/** Where FluxIQ was looked for and did not answer. */
export const notFoundLine = (host: string): string => `FluxIQ isn't answering at ${host}. Start it and keep it running, or change the address.`;
