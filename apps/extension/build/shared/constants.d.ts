export declare const EXTENSION_NAME = "FluxIQ Web Extension";
export declare const PROTOCOL_VERSION = 1;
export declare const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client";
export declare const HEARTBEAT_INTERVAL_MS = 20000;
export declare const RECONNECT_BASE_DELAY_MS = 1000;
export declare const RECONNECT_MAX_DELAY_MS = 30000;
export declare const MAX_EVENT_QUEUE_SIZE = 1000;
export declare const STORAGE_KEYS: {
    readonly settings: "fluxiq.settings";
    readonly session: "fluxiq.session";
    readonly clientId: "fluxiq.clientId";
    readonly queuedEvents: "fluxiq.queuedEvents";
};
export declare const RUNTIME_MESSAGES: {
    readonly getStatus: "fluxiq.getStatus";
    readonly connect: "fluxiq.connect";
    readonly disconnect: "fluxiq.disconnect";
    readonly startRecording: "fluxiq.startRecording";
    readonly stopRecording: "fluxiq.stopRecording";
    readonly contentReady: "fluxiq.contentReady";
    readonly contentEvent: "fluxiq.contentEvent";
    readonly executeAction: "fluxiq.executeAction";
    readonly captureSnapshot: "fluxiq.captureSnapshot";
    readonly statusChanged: "fluxiq.statusChanged";
};
