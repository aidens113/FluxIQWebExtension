import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { RunnerFailure } from "../../../failure.js";
import { screenIdentity } from "./screen.js";
import { assertIdentityMatch } from "./assert-match.js";

/** Must run after content injection, before chat/build/recording/action dispatch. */
export async function verifyRunningBuildIdentity(control: Page, extensionPath: string, scenarioUrl: string, write: (identity: unknown) => Promise<void>): Promise<void> {
  let expected: unknown;
  try { expected = (JSON.parse(await readFile(path.join(extensionPath, "build-info.json"), "utf8")) as { identity?: unknown }).identity; }
  catch (cause) { throw new RunnerFailure("extension.worker", "Intended extension build stamp cannot be read; provider dispatch refused", { cause, details: { extensionStage: "build-identity" } }); }
  const response = await control.evaluate(async (url: string) => {
    const chrome = (globalThis as any).chrome;
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((tab: any) => tab.url === url && typeof tab.id === "number");
    if (!tab) return null;
    return await chrome.runtime.sendMessage({ type: "fluxiq.buildIdentity", tabId: tab.id });
  }, scenarioUrl) as { ok?: unknown; background?: unknown; content?: unknown } | null;
  const identities = { expected: screenIdentity(expected), background: screenIdentity(response?.background), content: screenIdentity(response?.content), verified: false };
  await write(identities);
  assertIdentityMatch(expected, response?.ok === true ? response.background : null, response?.ok === true ? response.content : null);
  await write({ ...identities, verified: true });
}
