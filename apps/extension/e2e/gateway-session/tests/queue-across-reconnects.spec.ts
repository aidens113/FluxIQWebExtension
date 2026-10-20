// The offline queue across reconnects, and the host lease after them, in a real
// Chromium with the real built extension, against a stand-in gateway on
// loopback and the everything store's home page from the Scenario Lab
// (lane G, `docs/working/extension-core-boundary-audit/reports/lane-g.md`,
// "Queue semantics").
//
// One session, in order: the browser connects by token; a leased command types
// into the store's search box; the gateway starts a recording and the page is
// used, so recording events arrive live. The socket drops and the page is used
// again, so those events are queued under the trust lineage, project and
// recording they belong to; the browser reconnects by token -- the same trust --
// and the queued events arrive, in queue order. It drops again, the page is
// used, and this time the browser has to pair (`server.pairing_required`, then
// `server.session_ready`): a new trust, so the events queued under the old one
// never arrive, while the page's next events do. Last, a higher epoch granted
// to another holder is adopted and the old holder's late command is refused
// with `host_lease.stale`, the page untouched.
//
// The oracles are the page and what the gateway received; the session-storage
// queue is read only to name which events were queued, by id and binding,
// never by content. Typed text is synthetic and input values are not captured.

import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { startScenarioLab } from "../../../../scenario-lab/src/server.js";
import { expect, restartServiceWorker, test } from "../../fixtures/extension-context.js";
import type { ExtensionSession } from "../../fixtures/extension-context.js";
import { startStandInGateway, type ClientMessage, type Lease, type ReceivedMessage, type StandInGateway } from "./stand-in-gateway.js";

/** The scenario's own seed, which its class names and generated ids are drawn from. */
const SEED = 241;
const STORE_PATH = "/scenarios/everything-store/";
/** The header's search box; the honeypot beside it is named `field-keywords`. */
const SEARCH = 'input[name="k"]';
const CLIENT_ID = "extension-e2e-queue-lineage";
const RESOURCE_KEY = `web.automation:${CLIENT_ID}`;
const RECORDING_ID = "e2e-recording-queue";
const PROJECT_ID = "e2e-project-queue";
const FIRST_TOKEN = "e2e-pairing-token";

const lease = (epoch: number, briefId: string): Lease => ({ resourceKey: RESOURCE_KEY, epoch, holder: { role: "builder", briefId } });

type Binding = { session: string; projectId: string | null; recordingId: string | null };
type QueuedEntry = { type: string; eventId?: string; binding: Binding };
type QueueView = { lineage?: string; entries: QueuedEntry[] };
type Status = { connectionState?: string; recordingState?: string; queueSize?: number };

/** The offline queue as ids and bindings only: no payload content leaves the page. */
const queueView = (session: ExtensionSession): Promise<QueueView> =>
  session.extensionPage.evaluate(async () => {
    const stored = (await chrome.storage.session.get("fluxiq.outbox"))["fluxiq.outbox"] as
      { lineage?: string; entries?: Array<{ binding: Binding; message: { type: string; payload?: { eventId?: unknown } } }> } | undefined;
    return {
      ...(stored?.lineage !== undefined ? { lineage: stored.lineage } : {}),
      entries: (stored?.entries ?? []).map((entry) => ({
        type: entry.message.type,
        ...(typeof entry.message.payload?.eventId === "string" ? { eventId: entry.message.payload.eventId } : {}),
        binding: entry.binding
      }))
    };
  });

const status = async (session: ExtensionSession): Promise<Status> =>
  await session.extensionPage.evaluate(async () => ((await chrome.runtime.sendMessage({ type: "fluxiq.getStatus" })) as { status?: Status }).status ?? {});

const tabIdShowing = (session: ExtensionSession, url: string): Promise<number | undefined> =>
  session.extensionPage.evaluate(async (wanted) => (await chrome.tabs.query({})).find((tab) => tab.url === wanted)?.id, url);

/** Recording events the gateway received, with the socket each came over. */
const recordingEvents = (gateway: StandInGateway, socket?: number): Array<{ socket: number; eventId: string; recordingId: unknown; eventType: unknown }> =>
  gateway.received()
    .filter((entry) => entry.message.type === "client.recording_event" && (socket === undefined || entry.socket === socket))
    .map((entry) => ({ socket: entry.socket, eventId: String(entry.message.payload.eventId), recordingId: entry.message.payload.recordingId, eventType: entry.message.payload.eventType }));

const hellos = (gateway: StandInGateway): ReceivedMessage[] => gateway.received().filter((entry) => entry.message.type === "client.hello");

/** The token a hello carried, compared only against the synthetic fixtures this spec issued. */
const helloToken = (entry: ReceivedMessage | undefined): unknown => entry?.message.payload.token;

async function answerTo(gateway: StandInGateway, commandId: string): Promise<ClientMessage["payload"]> {
  const find = () => gateway.received().find((entry) => entry.message.type === "client.action_result" && entry.message.payload.commandId === commandId);
  await expect.poll(() => find() !== undefined, { timeout: 20_000, message: `an answer to ${commandId}` }).toBe(true);
  return find()!.message.payload;
}

/** A person using the store: clicks the search box, replaces its text, and tabs away. */
async function usePage(store: Page, text: string): Promise<void> {
  await store.bringToFront();
  const box = store.locator(SEARCH);
  await box.click();
  await box.press("Control+A");
  await box.pressSequentially(text, { delay: 40 });
  await box.press("Tab");
}

/** The queue once its recording events have stopped growing for `quietMs`. */
async function settledQueue(session: ExtensionSession, quietMs = 1_500): Promise<QueueView> {
  let last = await queueView(session);
  let since = Date.now();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await session.extensionPage.waitForTimeout(250);
    const now = await queueView(session);
    if (now.entries.length !== last.entries.length) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= quietMs) {
      return now;
    }
  }
  throw new Error("The offline queue did not settle within 20 s.");
}

const queuedEventIds = (view: QueueView): string[] =>
  view.entries.filter((entry) => entry.type === "client.recording_event" && entry.eventId !== undefined).map((entry) => entry.eventId!);

test("queued events reach FluxIQ after a reconnect by token, never after a reconnect that had to pair; a higher epoch takes the lease over", async ({ extensionSession }) => {
  test.setTimeout(240_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: SEED });
  const gateway = await startStandInGateway();
  try {
    let store!: Page;
    // Counts and event kinds only, for the run's report: no ids, values or tokens.
    const evidence: Record<string, unknown> = {};
    const kindsOf = (eventIds: string[]): unknown[] => eventIds.map((eventId) => recordingEvents(gateway).find((event) => event.eventId === eventId)?.eventType ?? "not received");

    await test.step("connect: the hello carries the token and is answered by server.session_ready", async () => {
      await extensionSession.extensionPage.evaluate(async ({ gatewayUrl, clientId, token }) => {
        await chrome.storage.local.set({
          "fluxiq.clientId": clientId,
          "fluxiq.session": { clientId, token },
          "fluxiq.settings": { gatewayUrl, coreApiUrl: "http://127.0.0.1:9/", autoReconnect: true, captureMutations: false, captureInputValues: false, captureSnapshots: false }
        });
      }, { gatewayUrl: gateway.url, clientId: CLIENT_ID, token: FIRST_TOKEN });
      await restartServiceWorker(extensionSession);
      await expect.poll(() => hellos(gateway).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
      expect(helloToken(hellos(gateway)[0]) === FIRST_TOKEN, "the first hello resumes by the stored token").toBe(true);
      await expect.poll(async () => (await status(extensionSession)).connectionState, { timeout: 15_000 }).toBe("connected");
    });

    await test.step("a leased command opens the store and types into its search box", async () => {
      const storeUrl = new URL(STORE_PATH, lab.origin).href;
      gateway.command("queue-open", "web.browser.navigate", { url: storeUrl }, lease(5, "brief-1"));
      const opened = await answerTo(gateway, "queue-open");
      expect(opened.status, String(opened.message)).toBe("succeeded");
      await expect.poll(() => tabIdShowing(extensionSession, storeUrl)).toBeDefined();
      const page = extensionSession.context.pages().find((candidate) => candidate.url() === storeUrl);
      if (!page) throw new Error(`No Playwright page shows ${storeUrl}`);
      store = page;
      // The store interrupts a shopper the way real ones do (a notifications
      // prompt, a cookie banner); a person dismisses them and carries on.
      await store.addLocatorHandler(store.getByRole("button", { name: "Not now", exact: true }), async (button) => { await button.click(); });
      await store.addLocatorHandler(store.getByRole("button", { name: "Decline", exact: true }), async (button) => { await button.click(); });
      await expect(store.locator(SEARCH)).toBeVisible();
      gateway.command("queue-type", "web.dom.type", { selector: SEARCH, text: "kettle" }, lease(5, "brief-1"));
      const typed = await answerTo(gateway, "queue-type");
      expect(typed.status, String(typed.message)).toBe("succeeded");
      expect(await store.locator(SEARCH).inputValue()).toBe("kettle");
    });

    await test.step("the gateway starts a recording and the page's events arrive live", async () => {
      await store.bringToFront();
      // The leased commands above already sent their own runtime events, which name no recording.
      const beforeRecording = recordingEvents(gateway, 1).length;
      gateway.send("server.start_recording", { recordingId: RECORDING_ID, projectId: PROJECT_ID });
      await expect.poll(async () => (await status(extensionSession)).recordingState, { timeout: 15_000 }).toBe("recording");
      // The recording's start marker is passive evidence, never an executable
      // input: it crosses as a `client.state_update` naming the tab kind and the
      // recording, not as a `client.recording_event`.
      const startMarkers = () => gateway.received()
        .filter((entry) => entry.socket === 1 && entry.message.type === "client.state_update")
        .map((entry) => (entry.message.payload.metadata ?? {}) as Record<string, unknown>)
        .filter((metadata) => metadata.clientKind === "browser.tab" && metadata.recordingState === "started");
      await expect.poll(() => startMarkers().length, { timeout: 15_000, message: "the start marker arrives as a state update" }).toBe(1);
      expect(startMarkers()[0], "the start marker names its recording as recording evidence").toMatchObject({ reason: "recording-evidence", recordingId: RECORDING_ID });
      const startAsEvent = gateway.received().filter((entry) =>
        entry.message.type === "client.recording_event" &&
        ((entry.message.payload.metadata ?? {}) as Record<string, unknown>).recordingState === "started");
      expect(startAsEvent.length, "no start marker crosses as a recording event").toBe(0);
      const before = recordingEvents(gateway, 1).length;
      await usePage(store, "lamp");
      await expect.poll(() => recordingEvents(gateway, 1).length, { timeout: 15_000, message: "the page's events arrive live" }).toBeGreaterThan(before);
      evidence.liveEventKinds = recordingEvents(gateway, 1).slice(before).map((event) => event.eventType);
      expect(recordingEvents(gateway, 1).slice(beforeRecording).filter((event) => event.recordingId !== RECORDING_ID).map(({ eventType, recordingId }) => ({ eventType, recordingId })), "every event since the start names the recording").toEqual([]);
    });

    let firstLineage = "";
    let queuedWhileDown: string[] = [];
    let queuedTypesWhileDown: string[] = [];
    await test.step("the socket drops; the page's events are queued under the lineage, project and recording", async () => {
      gateway.setMood("offline");
      gateway.drop();
      await expect.poll(async () => (await status(extensionSession)).connectionState, { timeout: 15_000 }).not.toBe("connected");
      const sentBefore = new Set(recordingEvents(gateway).map((event) => event.eventId));
      await usePage(store, "towel");
      await expect.poll(async () => queuedEventIds(await queueView(extensionSession)).length, { timeout: 15_000, message: "recording events are queued" }).toBeGreaterThan(0);
      const view = await settledQueue(extensionSession);
      expect(view.lineage, "the queue keeps a lineage").toEqual(expect.any(String));
      firstLineage = view.lineage!;
      queuedWhileDown = queuedEventIds(view);
      queuedTypesWhileDown = view.entries.map((entry) => entry.type);
      evidence.firstDropQueuedTypes = view.entries.map((entry) => entry.type);
      for (const entry of view.entries) {
        expect(entry.binding.session, `${entry.type}: bound to the current lineage`).toBe(firstLineage);
        expect(entry.binding.projectId, `${entry.type}: bound to the recording's project`).toBe(PROJECT_ID);
      }
      for (const entry of view.entries.filter((candidate) => candidate.type === "client.recording_event")) {
        expect(entry.binding.recordingId, "a queued recording event is bound to its recording").toBe(RECORDING_ID);
      }
      expect(queuedWhileDown.some((eventId) => sentBefore.has(eventId)), "nothing queued had already been sent").toBe(false);
    });

    let resumedSocket = 0;
    await test.step("the browser reconnects by token: the queued events arrive, in queue order", async () => {
      const tokenIssued = "e2e-token-1";
      const acceptedBefore = gateway.socketsAccepted();
      gateway.setMood("ready");
      await expect.poll(() => gateway.socketsAccepted(), { timeout: 45_000, message: "the browser reconnects" }).toBeGreaterThan(acceptedBefore);
      resumedSocket = gateway.socketsAccepted();
      await expect.poll(() => hellos(gateway).some((entry) => entry.socket === resumedSocket), { timeout: 15_000 }).toBe(true);
      expect(helloToken(hellos(gateway).find((entry) => entry.socket === resumedSocket)) === tokenIssued, "the reconnect resumes by the token FluxIQ issued").toBe(true);
      await expect.poll(() => recordingEvents(gateway, resumedSocket).filter((event) => queuedWhileDown.includes(event.eventId)).length, { timeout: 20_000, message: "every queued event arrives" }).toBe(queuedWhileDown.length);
      const arrived = recordingEvents(gateway, resumedSocket).map((event) => event.eventId).filter((eventId) => queuedWhileDown.includes(eventId));
      expect(arrived, "queued events arrive in queue order, each once").toEqual(queuedWhileDown);
      evidence.resume = { socket: resumedSocket, refusedUpgradesWhileDown: gateway.refusedUpgrades(), arrivedKinds: kindsOf(arrived) };
      expect(recordingEvents(gateway).filter((event) => queuedWhileDown.includes(event.eventId)).every((event) => event.socket === resumedSocket), "none arrived over another socket").toBe(true);
      await expect.poll(async () => (await queueView(extensionSession)).entries.length, { timeout: 10_000, message: "the queue is empty after the flush" }).toBe(0);
      // Every queued entry, snapshots included, arrives in queue order: the only
      // other traffic on the resumed socket before the page is used again is the
      // hello and the browser state sent on session_ready.
      const flushed = gateway.received()
        .filter((entry) => entry.socket === resumedSocket && entry.message.type !== "client.hello" && entry.message.type !== "client.state_update")
        .map((entry) => entry.message.type);
      expect(flushed, "the resumed socket carries the queued entries, in queue order, and nothing else of theirs").toEqual(queuedTypesWhileDown);
      expect((await queueView(extensionSession)).lineage, "a resume keeps the lineage").toBe(firstLineage);
    });

    let queuedUnderOldTrust: string[] = [];
    await test.step("the socket drops again and the page's events are queued", async () => {
      gateway.setMood("offline");
      gateway.drop();
      await expect.poll(async () => (await status(extensionSession)).connectionState, { timeout: 15_000 }).not.toBe("connected");
      await usePage(store, "blanket");
      await expect.poll(async () => queuedEventIds(await queueView(extensionSession)).length, { timeout: 15_000, message: "recording events are queued" }).toBeGreaterThan(0);
      const view = await settledQueue(extensionSession);
      expect(view.lineage, "still the first lineage while down").toBe(firstLineage);
      queuedUnderOldTrust = queuedEventIds(view);
      evidence.secondDropQueuedTypes = view.entries.map((entry) => entry.type);
      expect(view.entries.every((entry) => entry.binding.session === firstLineage), "queued under the old trust").toBe(true);
    });

    let pairedSocket = 0;
    await test.step("the browser reconnects through server.pairing_required then server.session_ready: the old trust's events never arrive", async () => {
      const acceptedBefore = gateway.socketsAccepted();
      gateway.setMood("pair");
      await expect.poll(() => gateway.socketsAccepted(), { timeout: 45_000, message: "the browser reconnects" }).toBeGreaterThan(acceptedBefore);
      pairedSocket = gateway.socketsAccepted();
      await expect.poll(async () => (await status(extensionSession)).connectionState, { timeout: 15_000 }).toBe("pairing");
      // Nothing is flushed or dropped before the session is ready.
      expect(queuedEventIds(await queueView(extensionSession)), "the queue waits for session_ready").toEqual(queuedUnderOldTrust);
      gateway.approve();
      await expect.poll(async () => (await status(extensionSession)).connectionState, { timeout: 15_000 }).toBe("connected");
      await expect.poll(async () => (await queueView(extensionSession)).entries.length, { timeout: 10_000, message: "the old trust's entries leave the queue" }).toBe(0);
      const lineage = (await queueView(extensionSession)).lineage;
      expect(lineage, "pairing starts a new lineage").toEqual(expect.any(String));
      expect(lineage === firstLineage, "pairing replaced the lineage").toBe(false);
      // Give a flush that slipped through time to land before judging that none did.
      await store.waitForTimeout(2_000);
      expect(recordingEvents(gateway).filter((event) => queuedUnderOldTrust.includes(event.eventId)), "no event queued under the old trust reached FluxIQ").toEqual([]);
      // Nor any other queued entry (the snapshots carry no event id): before the page
      // is used again, the paired socket carries only the hello and the browser state.
      const sinceReady = gateway.received()
        .filter((entry) => entry.socket === pairedSocket && entry.message.type !== "client.hello" && entry.message.type !== "client.state_update")
        .map((entry) => entry.message.type);
      expect(sinceReady, "nothing queued under the old trust was flushed to the paired socket").toEqual([]);
      // And the channel is alive: the page's next events arrive over the new socket.
      const before = recordingEvents(gateway, pairedSocket).length;
      await usePage(store, "pillow");
      await expect.poll(() => recordingEvents(gateway, pairedSocket).length, { timeout: 15_000, message: "the page's next events arrive live" }).toBeGreaterThan(before);
      evidence.paired = {
        socket: pairedSocket,
        oldTrustEventsQueued: queuedUnderOldTrust.length,
        oldTrustEventsReceived: recordingEvents(gateway).filter((event) => queuedUnderOldTrust.includes(event.eventId)).length,
        liveKindsAfterPairing: recordingEvents(gateway, pairedSocket).slice(before).map((event) => event.eventType)
      };
    });

    await test.step("lease takeover: a higher epoch for another holder is adopted; the old holder's late command is refused and changes nothing", async () => {
      gateway.command("queue-takeover", "web.dom.type", { selector: SEARCH, text: "travel mug" }, lease(6, "brief-2"));
      const takeover = await answerTo(gateway, "queue-takeover");
      expect(takeover.status, String(takeover.message)).toBe("succeeded");
      expect(await store.locator(SEARCH).inputValue()).toBe("travel mug");

      await store.waitForTimeout(1_000);
      const recordedBefore = recordingEvents(gateway).length;
      gateway.command("queue-late", "web.dom.type", { selector: SEARCH, text: "stale holder text" }, lease(5, "brief-1"));
      const late = await answerTo(gateway, "queue-late");
      expect(late).toMatchObject({
        commandId: "queue-late",
        status: "failed",
        failure: { category: "blocked_by_capability_or_policy", code: "host_lease.stale", retryable: false, stage: "dispatch", effect: "unacted" },
        payload: { commandId: "queue-late", status: "refused", code: "host_lease.stale" }
      });
      // Give a command that slipped through time to reach the page before judging that none did.
      await store.waitForTimeout(1_500);
      expect(await store.locator(SEARCH).inputValue(), "the page is unchanged").toBe("travel mug");
      expect(gateway.received().filter((entry) => JSON.stringify(entry.message.payload).includes('"queue-late"')).map((entry) => entry.message.type), "the refusal is all the browser sent about it").toEqual(["client.action_result"]);
      expect(recordingEvents(gateway).length, "nothing recorded for the refused command").toBe(recordedBefore);
      evidence.lease = { takeover: takeover.status, late: (late.failure as { code?: unknown } | undefined)?.code };
      evidence.messageTypesPerSocket = gateway.received().reduce<Record<string, Record<string, number>>>((all, entry) => {
        const socket = (all[String(entry.socket)] ??= {});
        socket[entry.message.type] = (socket[entry.message.type] ?? 0) + 1;
        return all;
      }, {});
      console.log(`gateway-session evidence ${JSON.stringify(evidence)}`);
    });
  } finally {
    await gateway.close();
    await lab.close();
  }
});
