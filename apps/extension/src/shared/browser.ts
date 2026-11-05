import { DEFAULT_CORE_API_URL, DEFAULT_GATEWAY_URL } from "./constants";
import type { BrowserDescriptor, FluxIQSettings } from "./protocol";

export function defaultSettings(): FluxIQSettings {
  return {
    gatewayUrl: DEFAULT_GATEWAY_URL,
    coreApiUrl: DEFAULT_CORE_API_URL,
    autoReconnect: true,
    captureMutations: true,
    captureInputValues: true,
    captureSnapshots: true,
    requestsEnabled: false
  };
}

/** What a person calls this browser, for choosing among theirs: "Chrome on Windows". */
export function browserClientLabel(userAgent: string, platform: string): string {
  const browser = /\bEdg\//u.test(userAgent) ? "Edge" : /\bFirefox\//u.test(userAgent) ? "Firefox" : /\bChrome\//u.test(userAgent) ? "Chrome" : "This browser";
  const system = /\bWin/iu.test(platform) || /Windows/u.test(userAgent) ? "Windows" : /\bMac/iu.test(platform) ? "Mac" : /Linux/iu.test(platform) ? "Linux" : undefined;
  return system ? `${browser} on ${system}` : browser;
}

export function browserDescriptor(): BrowserDescriptor {
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

export function runtimeSendMessage<TResponse = unknown>(message: unknown): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response as TResponse);
    });
  });
}
