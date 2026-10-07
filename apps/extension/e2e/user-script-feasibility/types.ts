import type { Browser, BrowserContext, CDPSession, Page } from "@playwright/test";
export type UserScriptProbeSession = { browser: Browser; context: BrowserContext; cdp: CDPSession; extensionPage: Page; missingPage: Page; settingsPage: Page; extensionId: string; missingId: string; root: string; parent: string; rootName: string; version: string };
