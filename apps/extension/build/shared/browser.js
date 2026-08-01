import { DEFAULT_GATEWAY_URL } from "./constants";
export function defaultSettings() {
    return {
        gatewayUrl: DEFAULT_GATEWAY_URL,
        autoReconnect: true,
        captureMutations: true,
        captureInputValues: true,
        captureSnapshots: true
    };
}
export function browserDescriptor() {
    return {
        clientKind: "browser_extension",
        clientName: "FluxIQ Browser Extension",
        extensionVersion: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
}
export function isProbablySecureGateway(url) {
    return url.startsWith("wss://") || url.startsWith("ws://127.0.0.1") || url.startsWith("ws://localhost");
}
export function runtimeSendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            const error = chrome.runtime.lastError;
            if (error)
                reject(new Error(error.message));
            else
                resolve(response);
        });
    });
}
//# sourceMappingURL=browser.js.map