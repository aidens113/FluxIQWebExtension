import { DEFAULT_GATEWAY_URL } from "./constants";
import type { BrowserDescriptor, FluxIQSettings } from "./protocol";

export function defaultSettings(): FluxIQSettings {
  return {
    gatewayUrl: DEFAULT_GATEWAY_URL,
    coreApiUrl: "http://127.0.0.1:4777",
    autoReconnect: true,
    captureMutations: true,
    captureInputValues: true,
    captureSnapshots: true
  };
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

export function isProbablySecureGateway(url: string): boolean {
  return url.startsWith("wss://") || url.startsWith("ws://127.0.0.1") || url.startsWith("ws://localhost");
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
