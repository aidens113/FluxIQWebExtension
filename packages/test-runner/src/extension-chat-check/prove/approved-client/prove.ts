import { extensionStatus, runtimeMessage } from "../../../run-lifecycle/index.js";
import type { ChatCheckContext } from "../../types.js";
import { connectWithCredentialCopy } from "./credential-copy.js";
import { probeApprovedClientModel } from "./model-probe.js";
import type { ApprovedClientAccessObservation } from "./observation.js";
import { holdPanelChatPage } from "./panel-stream-reconnect.js";
import { PUSH_PROOF_OPENING_TURN, provePanelTurnPush } from "./panel-turn-push.js";
import { approvedClientModelReadiness } from "./readiness.js";
import { revokeAndProbeCredential } from "./revoke-probe.js";
import { KEYS_PAGE_PATH, isBareKeysPageAddress } from "./keys-page.js";

export type ApprovedClientAccessInput = {
  restartCore(): Promise<void>;
  signOut(): Promise<void>;
  signIn(): Promise<string>;
  configureKey(): Promise<void>;
  selectProject(): Promise<void>;
  gatewaySnapshot(): Promise<unknown>;
  /** Writes a turn into a chat as the signed-in person the web panel acts for, the request the panel's own chat makes. */
  writePanelTurn(conversationId: string, text: string): Promise<void>;
  model: { calls(): readonly { answered: boolean }[]; receipts(): readonly string[] };
  fluxiqOrigin: string;
  gatewayUrl: string;
  coreApiUrl: string;
};

/** Measured requests prove approved-client custody; readiness and missing UI alone never do. */
export async function proveApprovedClientAccess(context: ChatCheckContext, input: ApprovedClientAccessInput): Promise<ApprovedClientAccessObservation> {
  const { control } = context.session;
  const result: ApprovedClientAccessObservation = { steps: [], probes: [], revokedRequestStatus: 0, checks: {} };
  const connection = () => extensionStatus(control).then((status) => String((status as { connectionState?: string }).connectionState));
  const readiness = async () => approvedClientModelReadiness(await runtimeMessage(control, { type: "fluxiq.panel.modelReadiness" }));
  const observe = async (name: string): Promise<void> => {
    const state = await readiness();
    const text = await context.session.panel!.text();
    const panelHasUnlockPrompt = /unlock this browser|needs your password once|locked on this browser/iu.test(text);
    result.steps.push({ name, readiness: state, panelHasUnlockPrompt });
    result.checks[`${name}:noUnlockPrompt`] = !panelHasUnlockPrompt;
    context.log(`[chat-check] approved client ${name}: ${state}`);
    await context.evidence.shot(`approved-client-${name}`);
  };
  const probe = async (name: string): Promise<void> => {
    context.log(`[chat-check] approved client ${name}: issuing a paired model request`);
    const measured = await probeApprovedClientModel(context, name, input.model);
    result.probes.push(measured);
    result.checks[`${name}:modelAccess`] = measured.bearer && measured.status === 200 && measured.stubReceivedProbe && measured.pairedReadReturnedReply;
    await observe(name);
  };

  const initial = await readiness();
  result.checks.approvedWithoutAKey = await connection() === "connected" && initial === "missing";
  const library = await runtimeMessage(control, { type: "fluxiq.panel.listParts" }) as { payload?: { parts?: unknown[] } };
  result.checks.keylessLibraryUsesPairedAuthority = Array.isArray(library.payload?.parts);
  // With no key set, a turn calls no model, so the loopback fixture is not asked about it.
  const pushed = await provePanelTurnPush(context, input);
  result.panelTurnPush = pushed.observation;
  Object.assign(result.checks, pushed.checks);
  await input.configureKey();
  await waitFor(readiness, (state) => state === "available");
  await probe("configured-later");

  // The approving panel session ends, but this approved browser remains independent.
  await input.signOut();
  await probe("after-panel-logout");
  await runtimeMessage(control, { type: "fluxiq.disconnect" });
  await waitFor(connection, (state) => state === "disconnected");
  await runtimeMessage(control, { type: "fluxiq.connect" });
  const reconnected = await waitFor(connection, (state) => state === "connected");
  result.checks.reconnectedWithoutReapproval = reconnected === "connected";
  await probe("after-reconnect");

  // A panel page signed in and held open across the restart: it must reopen its own change stream.
  const heldPanel = await holdPanelChatPage(context, { fluxiqOrigin: input.fluxiqOrigin, cookie: await input.signIn(), conversationId: result.panelTurnPush!.conversationId });
  try {
    await heldPanel.settled(PUSH_PROOF_OPENING_TURN);
    const restartBegan = Date.now();
    await input.restartCore();
    const restarted = await waitFor(connection, (state) => state === "connected");
    result.checks.restartedWithoutReapproval = restarted === "connected";
    await probe("after-core-restart");
    const changeText = `Written from the web panel after the Core restart ${Date.now().toString(36)}`;
    const reconnect = await heldPanel.proveReconnect(restartBegan, { caughtUpText: "Approved client access confirmed: after-core-restart", changeText, change: () => input.writePanelTurn(result.panelTurnPush!.conversationId, changeText) });
    result.panelStream = reconnect.observation;
    Object.assign(result.checks, reconnect.checks);
  } finally {
    await heldPanel.close().catch(/* best-effort: the page is only a witness */ () => undefined);
  }

  await input.signIn();
  const copy = await connectWithCredentialCopy(control, input.gatewayUrl);
  try {
    const caught = await waitFor(connection, (state) => state === "pairing");
    const snapshot = await input.gatewaySnapshot() as { payload?: TrustSnapshot } & TrustSnapshot;
    const seen = snapshot.payload ?? snapshot;
    result.checks.aCopyIsCaughtWhenTheBrowserReturns = caught === "pairing" && (seen.auditLog ?? []).some((entry) => entry.type === "credential.reuse_detected");
    result.checks.neitherHoldsTrustAfterReuse = (seen.trustedClients ?? []).length > 0 && (seen.trustedClients ?? []).every((client) => client.status !== "active");
  } finally {
    copy.close();
  }

  const cookie = await input.signIn();
  await context.session.context.addCookies([{ name: "fluxiq_session", value: cookie, url: input.fluxiqOrigin, httpOnly: true, sameSite: "Lax" }]);
  const panel = await context.session.context.newPage();
  try {
    await panel.goto(`${input.fluxiqOrigin}${KEYS_PAGE_PATH}`, { waitUntil: "domcontentloaded" });
    await runtimeMessage(control, { type: "fluxiq.connect", settings: { gatewayUrl: input.gatewayUrl, coreApiUrl: input.coreApiUrl, autoReconnect: true } });
    const dialog = panel.getByRole("dialog", { name: "Client pairing request" });
    await panel.bringToFront();
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    result.checks.approvalNeedsNoSecondPassword = await dialog.locator('input[type="password"]').count() === 0;
    await dialog.locator("[data-modal-submit]").click();
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
    await waitFor(connection, (state) => state === "connected");
    await input.selectProject();
    await context.session.scenario.bringToFront();
    await probe("approved-without-password");
    const configured = await runtimeMessage(control, { type: "fluxiq.panel.openFluxIQ", purpose: "model-key" }) as { url?: string };
    result.checks.configurationHasNoUnlockFragment = isBareKeysPageAddress(configured.url, input.coreApiUrl);
  } finally {
    await panel.close();
  }

  const beforeRevoke = input.model.calls().length;
  const lastModelCall = [...context.coreCalls()].reverse().find((call) => call.endpoint === "append-turn");
  if (!lastModelCall) throw new Error("The approved-client proof recorded no model request to check after revocation.");
  const revoked = await revokeAndProbeCredential(control, input.coreApiUrl, lastModelCall.request);
  result.revokedRequestStatus = revoked.status;
  result.checks.explicitRevokeReachesCore = revoked.forgotten;
  result.checks.revokedCredentialCannotCallModel = (revoked.status === 401 || revoked.status === 403) && input.model.calls().length === beforeRevoke;
  return result;
}

type TrustSnapshot = { auditLog?: { type?: string }[]; trustedClients?: { status?: string }[] };

async function waitFor(read: () => Promise<string>, wanted: (value: string) => boolean): Promise<string> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const value = await read();
    if (wanted(value) || Date.now() >= deadline) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
