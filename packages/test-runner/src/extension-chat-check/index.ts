// The headed, provider-free check that the extension's chat reaches Core: a
// message typed in Chrome's side panel or Firefox's popup arrives at
// `append-turn` with the chat's capabilities and the page the person is on,
// Core answers in the thread, and a question pending there is settled by the
// answer the extension sends. `cli.ts` runs it.
export { approvalFlowGraph, saveApprovalFlow, type ApprovalFlow } from "./approval-flow.js";
export { chatNetworkPolicy } from "./chat-network-policy.js";
export { captureBrowserWindows } from "./browser-window-capture.js";
export { startCoreRecordingProxy, type CoreRecordingProxy, type ObservedCoreCall } from "./core-recording-proxy.js";
export { evidenceWriter, type EvidenceWriter } from "./evidence-writer.js";
export * from "./firefox/index.js";
export { openChromeChatSession, type WorkerRequest } from "./open-chrome-session.js";
export { openFirefoxChatSession } from "./open-firefox-session.js";
export * from "./prove/index.js";
export { runExtensionChatCheck, type ChatCheckOptions, type ChatCheckResult } from "./run-chat-check.js";
export { sendChatMessage } from "./send-chat-message.js";
export { extensionViewPanelDriver, pagePanelDriver, type ChatPanelDriver } from "./panel-driver.js";
export { threadReader, type ThreadReader, type ThreadTurn } from "./thread-reader.js";
export type { ChatBrowser, ChatBrowserSession, ChatCheckContext, ChatPanelMode } from "./types.js";
