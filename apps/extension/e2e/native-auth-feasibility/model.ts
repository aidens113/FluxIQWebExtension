import type { Browser, BrowserContext, CDPSession, Page } from "@playwright/test";

export type ProbeAllocation = Readonly<{ parent: string; root: string; profile: string; extension: string }>;
export type ProbeConfiguration = Readonly<{ ordinaryUrl: string; alternateUrl: string }>;
export type ProbeArtifact = Readonly<{ contentSha256: string; pageWorldSha256: string }>;
export type ProbeHost = { browser: Browser; context: BrowserContext; cdp: CDPSession; control: Page; extensionId: string; browserVersion: string; close(): Promise<void>; crash(): Promise<void>; assertContained(): Promise<void>; containment(): { forwarded: number; denied: number; nativeCallbackRequests: number; connectionResets: number; transportFailures: number } };
export type ProbeReply = { ok: boolean; [key: string]: unknown };
export type ProbeEvidence = Readonly<{ case: string; values: Readonly<Record<string, boolean | number | string>> }>;
export type ProbeStage = "setup" | "allocation" | "fixture" | "artifact" | "browser" | "pending" | "capture" | "completion" | "close" | "cancel" | "reload" | "worker_stop" | "restore" | "containment" | "cleanup";
