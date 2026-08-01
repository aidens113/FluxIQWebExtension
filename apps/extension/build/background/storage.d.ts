import type { ClientMessage, FluxIQSession, FluxIQSettings } from "../shared/protocol";
export declare function readSettings(): Promise<FluxIQSettings>;
export declare function writeSettings(settings: FluxIQSettings): Promise<void>;
export declare function readSession(): Promise<FluxIQSession | null>;
export declare function writeSession(session: FluxIQSession): Promise<void>;
export declare function readOrCreateClientId(): Promise<string>;
export declare function readQueuedEvents(): Promise<ClientMessage[]>;
export declare function queueEvent(message: ClientMessage): Promise<number>;
export declare function clearQueuedEvents(): Promise<void>;
