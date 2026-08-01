import type { BrowserDescriptor, FluxIQSettings } from "./protocol";
export declare function defaultSettings(): FluxIQSettings;
export declare function browserDescriptor(): BrowserDescriptor;
export declare function isProbablySecureGateway(url: string): boolean;
export declare function runtimeSendMessage<TResponse = unknown>(message: unknown): Promise<TResponse>;
