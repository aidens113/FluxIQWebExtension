import { CLIENT_GATEWAY_PROTOCOL_VERSION } from "fluxiq/client-gateway";
import type { Page } from "@playwright/test";
import { extensionStatus, runtimeMessage } from "../../run-lifecycle/index.js";
import type { ChatCheckContext } from "../types.js";

/** What this check found at each step. Every value is what was read, never a credential. */
export type ModelKeyUnlockObservation = {
  steps: { name: string; readiness: string; panelSays: string | null; note?: string }[];
  checks: Record<string, boolean>;
};

export type ModelKeyUnlockInput = {
  /** Restarts the isolated Core on its ports, over the same stores. */
  restartCore(): Promise<void>;
  /** Ends the panel session that approved the browser, as its sign-out button does. */
  signOut(): Promise<void>;
  /** A new panel session, whose cookie value a browser page can carry. */
  signIn(): Promise<string>;
  /** Core's audit and trust, as an operator reads them. */
  gatewaySnapshot(): Promise<unknown>;
  password: string;
  fluxiqOrigin: string;
  gatewayUrl: string;
  coreApiUrl: string;
};

const LOCK_WORDS = /needs your password once|locked on this browser/u;
const EMPTY_CHAT = "What can FluxIQ do for you?";

function setupLine(text: string): string | null {
  return text.split("\n").find(entry => LOCK_WORDS.test(entry))?.trim() ?? null;
}

/** What Core tells the panel about this browser's key: the same read the chat's setup step uses. */
async function keyReadiness(control: Page): Promise<string> {
  const reply = await control.evaluate(() => (globalThis as any).chrome.runtime.sendMessage({ type: "fluxiq.panel.modelReadiness" })) as { payload?: { keys?: unknown[] } };
  const keys = (reply.payload?.keys ?? []) as { unlocked?: boolean; lockedBecause?: string }[];
  if (keys.length === 0) return "no key";
  return keys.every(key => key.unlocked === false) ? `locked:${keys[0]?.lockedBecause ?? "unknown"}` : "unlocked";
}

/**
 * The panel reopened, as a person reopens it, and the setup words it shows, if any. Reads only once
 * the empty chat has rendered, so "no step" can never mean "not drawn yet", and gives the readiness
 * read time to land.
 */
async function panelWords(control: Page, expectStep: boolean): Promise<{ says: string | null; loadedAfterMs: number }> {
  await control.bringToFront();
  await control.reload({ waitUntil: "domcontentloaded" });
  const began = Date.now();
  await control.getByText(EMPTY_CHAT).first().waitFor({ state: "visible", timeout: 45_000 });
  const loadedAfterMs = Date.now() - began;
  const settled = Date.now() + (expectStep ? 15_000 : 4_000);
  for (;;) {
    const says = setupLine(await control.locator("body").innerText());
    if (says !== null || Date.now() >= settled) return { says, loadedAfterMs };
    await control.waitForTimeout(250);
  }
}

async function waitForReadiness(control: Page, wanted: (readiness: string) => boolean, timeoutMs = 45_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = "unread";
  for (;;) {
    try {
      last = await keyReadiness(control);
      if (wanted(last)) return last;
    } catch (error) {
      last = `read failed: ${error instanceof Error ? error.name : "non_error"}`;
    }
    if (Date.now() >= deadline) return last;
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
}

async function waitForConnection(control: Page, wanted: string, timeoutMs = 90_000): Promise<{ state: string }> {
  const deadline = Date.now() + timeoutMs;
  let state = "unread";
  for (;;) {
    try {
      state = String((await extensionStatus(control) as { connectionState?: unknown }).connectionState ?? "unread");
    } catch (error) {
      state = `read failed: ${error instanceof Error ? error.name : "non_error"}`;
    }
    if (state === wanted || Date.now() >= deadline) return { state };
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
}

async function panelPage(context: ChatCheckContext, input: ModelKeyUnlockInput, path: string): Promise<Page> {
  const cookie = await input.signIn();
  const browserContext = context.session.context;
  await browserContext.addCookies([{ name: "fluxiq_session", value: cookie, url: input.fluxiqOrigin, httpOnly: true, sameSite: "Lax" }]);
  const page = await browserContext.newPage();
  await page.goto(`${input.fluxiqOrigin}${path}`, { waitUntil: "domcontentloaded" });
  return page;
}

/** The one-time step, as a person takes it: FluxIQ's Secret Keys page, the browser named, the password once. No PIN. */
async function takeUnlockStep(page: Page, password: string): Promise<string> {
  const button = page.getByRole("button", { name: /^Unlock /u }).first();
  await button.waitFor({ state: "visible", timeout: 30_000 });
  const label = (await button.innerText()).trim();
  await button.click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="password"]').first().fill(password);
  const answered = page.waitForResponse(response => response.url().endsWith("/api/programs/secret-keys/unlock"), { timeout: 30_000 });
  await dialog.getByRole("button", { name: /^Unlock/u }).click();
  const response = await answered;
  const body = await response.json() as { ok?: boolean; error?: string };
  if (body.ok !== true) throw new Error(`The panel's Unlock was refused (${response.status()}): ${body.error ?? "no reason given"}`);
  await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  return label;
}

/** A second party with a copy of this browser's stored credential says hello, takes the next one, and says it stored it. */
async function connectWithACopy(control: Page, gatewayUrl: string): Promise<{ close(): void }> {
  const stored = await control.evaluate(async () => {
    const all = await (globalThis as any).chrome.storage.local.get(null) as Record<string, { token?: string; clientId?: string } | undefined>;
    return Object.values(all).find(value => typeof value?.token === "string" && typeof value?.clientId === "string");
  });
  if (!stored?.token || !stored.clientId) throw new Error("This browser holds no credential to copy.");
  const socket = new WebSocket(gatewayUrl);
  const send = (type: string, payload: Record<string, unknown>) => socket.send(JSON.stringify({ id: `copy.${Date.now()}.${Math.random()}`, type, protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION, timestamp: Date.now(), payload }));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The copy was not answered.")), 20_000);
    socket.addEventListener("open", () => send("client.hello", { clientId: stored.clientId, clientType: "extension", name: "Chrome on Windows", token: stored.token, capabilities: [], metadata: { domainId: "web-automation" } }));
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as { type?: string };
      if (message.type !== "server.session_ready") return;
      send("client.credential_received", {});
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", () => reject(new Error("The copy could not connect.")));
  });
  return { close: () => socket.close() };
}

/**
 * The model key across what a person actually does, in a real browser with no model:
 * paired by the Lab's own approval, Core restarted, signed out with the panel left open,
 * unlocked once by the step, paired again through the panel's dialog with and without the
 * password, and a copy of the credential caught.
 */
export async function proveModelKeyUnlock(context: ChatCheckContext, input: ModelKeyUnlockInput): Promise<ModelKeyUnlockObservation> {
  const { control } = context.session;
  const steps: ModelKeyUnlockObservation["steps"] = [];
  const checks: Record<string, boolean> = {};
  const record = async (name: string, readiness: string, note?: string): Promise<string | null> => {
    const { says: panelSays, loadedAfterMs } = await panelWords(control, readiness.startsWith("locked:"));
    steps.push({ name, readiness, panelSays, ...(note ? { note } : {}) });
    context.log(`[chat-check] model key, ${name}: ${readiness}; the panel drew its chat in ${loadedAfterMs} ms and says: ${panelSays ?? "(no setup step)"}${note ? `; ${note}` : ""}`);
    await context.evidence.shot(`model-key-${name}`);
    return panelSays;
  };

  // The Lab's own pairing gave the password at approval.
  const paired = await waitForReadiness(control, value => value === "unlocked", 15_000);
  const pairedWords = await record("paired-with-the-password", paired);
  checks.labPairingUnlocksAtOnce = paired === "unlocked" && pairedWords === null;

  await input.restartCore();
  const reconnected = await waitForConnection(control, "connected");
  const afterRestart = await waitForReadiness(control, value => value === "unlocked");
  const restartWords = await record("after-core-restart", afterRestart, `extension ${reconnected.state}`);
  checks.reconnectedAfterRestartWithoutPairing = reconnected.state === "connected";
  checks.staysUnlockedAcrossRestart = afterRestart === "unlocked" && restartWords === null;

  // The side panel stays open through the sign-out: nobody reopens anything.
  const sidePanel = context.session.panel;
  await input.signOut();
  checks.openPanelShowsTheStepByItself = await sidePanel?.shows("because you signed out", 40_000) ?? false;
  const signedOut = await waitForReadiness(control, value => value.startsWith("locked:"));
  const signedOutWords = await record("after-sign-out", signedOut);
  checks.signOutLocks = signedOut === "locked:signed_out";
  checks.signOutSaysWhy = /because you signed out/u.test(signedOutWords ?? "");

  const secretKeys = await panelPage(context, input, "/programs/secret-keys");
  const named = await takeUnlockStep(secretKeys, input.password);
  const unlocked = await waitForReadiness(control, value => value === "unlocked");
  const unlockedWords = await record("after-the-unlock-step", unlocked, `pressed "${named}"`);
  checks.stepNamesTheBrowser = /^Unlock .+/u.test(named) && named !== "Unlock";
  checks.stepUnlocks = unlocked === "unlocked" && unlockedWords === null;

  // Forget, over the live socket: Core hears, and the browser pairs again through the panel's dialog.
  const forgot = await control.evaluate(() => (globalThis as any).chrome.runtime.sendMessage({ type: "fluxiq.resetSession" })) as { ok?: boolean; forgetReachedCore?: boolean };
  checks.forgetReachesCore = forgot.ok === true && forgot.forgetReachedCore === true;

  const pairThroughDialog = async (password: string | null): Promise<void> => {
    await runtimeMessage(control, { type: "fluxiq.connect", settings: { gatewayUrl: input.gatewayUrl, coreApiUrl: input.coreApiUrl, autoReconnect: true, captureMutations: true, captureInputValues: false } });
    const dialog = secretKeys.getByRole("dialog", { name: "Client pairing request" });
    await secretKeys.bringToFront();
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    if (password) await dialog.locator('input[type="password"]').fill(password);
    await dialog.locator("[data-modal-submit]").click();
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
    await waitForConnection(control, "connected", 30_000);
  };

  // Core restarted above, so nothing has chosen a project for this browser, and nobody does here: its chat opens anyway.
  await pairThroughDialog(input.password);
  const dialogPassword = await waitForReadiness(control, value => value === "unlocked", 20_000);
  const dialogPasswordWords = await record("paired-in-the-dialog-with-the-password", dialogPassword);
  checks.dialogWithPasswordUnlocksAtOnce = dialogPassword === "unlocked" && dialogPasswordWords === null;

  await control.evaluate(() => (globalThis as any).chrome.runtime.sendMessage({ type: "fluxiq.resetSession" }));
  await pairThroughDialog(null);
  const dialogBare = await waitForReadiness(control, value => value.startsWith("locked:"), 20_000);
  const dialogBareWords = await record("paired-in-the-dialog-without-a-password", dialogBare);
  checks.dialogWithoutPasswordPairsFine = (await waitForConnection(control, "connected", 5_000)).state === "connected";
  checks.dialogWithoutPasswordShowsTheStep = dialogBare.startsWith("locked:") && dialogBareWords !== null;

  // Not offered from the page alone, however often it is opened.
  await secretKeys.bringToFront();
  await secretKeys.reload({ waitUntil: "domcontentloaded" });
  await secretKeys.getByText("has never been unlocked").first().waitFor({ state: "visible", timeout: 30_000 });
  checks.pageAloneDoesNotOfferIt = await secretKeys.getByRole("button", { name: /^Unlock /u }).count() === 0;

  // From the browser itself, by its own Open FluxIQ.
  const opened = await runtimeMessage(control, { type: "fluxiq.panel.openFluxIQ", purpose: "model-key" }) as { url?: string };
  const hash = new URL(opened.url ?? "http://invalid/").hash;
  checks.browserStartsItsOwnUnlock = hash.startsWith("#unlock=");
  // A change of fragment alone reloads nothing, as a person's fresh tab would.
  await secretKeys.goto("about:blank");
  await secretKeys.goto(`${input.fluxiqOrigin}/programs/secret-keys${hash}`, { waitUntil: "domcontentloaded" });
  checks.addressDoesNotKeepIt = await secretKeys.waitForFunction(() => globalThis.location.hash === "", undefined, { timeout: 20_000 }).then(() => true, () => false);
  await takeUnlockStep(secretKeys, input.password);
  const finished = await waitForReadiness(control, value => value === "unlocked");
  const finishedWords = await record("after-the-one-time-step", finished);
  checks.oneStepThenNoAsk = finished === "unlocked" && finishedWords === null;

  // A copy of the credential moves it on, and the browser comes back with what it holds.
  const copy = await connectWithACopy(control, input.gatewayUrl);
  const caught = await waitForConnection(control, "pairing", 45_000);
  const answered = await input.gatewaySnapshot() as { payload?: { auditLog?: { type?: string }[]; trustedClients?: { status?: string }[] }; auditLog?: { type?: string }[]; trustedClients?: { status?: string }[] };
  const seen = answered.payload ?? answered;
  checks.aCopyIsCaughtWhenTheBrowserReturns = caught.state === "pairing" && (seen.auditLog ?? []).some(entry => entry.type === "credential.reuse_detected");
  checks.neitherHoldsTrustAfter = (seen.trustedClients ?? []).length > 0 && (seen.trustedClients ?? []).every(client => client.status !== "active");
  copy.close();
  context.log(`[chat-check] model key, a copy of the credential: browser ${caught.state}, trusts ${JSON.stringify((seen.trustedClients ?? []).map(client => client.status))}`);
  await secretKeys.close();
  return { steps, checks };
}
