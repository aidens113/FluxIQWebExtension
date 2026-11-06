import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Browser, Page } from "@playwright/test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RECEIVED_INVITATIONS } from "../data/index.js";
import { professionalNetworkManifest } from "../index.js";
import { closeSession, factText, launchBrowser, openSession, postToSite, ROOT, type Session } from "./browser-session.js";

/**
 * A second attempt at "accept the messaged invitations" (t877). The first
 * attempt accepts the three invitations that carried a note; the site then
 * starts a conversation with each whose first message is the note as written,
 * and lists them under Connections as recently added. A second attempt reads
 * them back from there, presses nothing, and an accepted invitation can be
 * accepted no more.
 */
const ACCEPT = resolveScenarioWorkflow(professionalNetworkManifest, { workflowId: "accept-messaged-invitations" });
const EXPECTED = ACCEPT.expected.extracted![0]!.records as Array<{ name: string; message: string }>;
const FINAL = String(ACCEPT.expected.finalState![0]!.value);
const MANAGER = `${ROOT}mynetwork/invitation-manager/`;
const MESSAGED = RECEIVED_INVITATIONS.filter(({ kind, message }) => kind === "person" && message !== "");

let browser: Browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser.close(); });

async function session<T>(work: (session: Session) => Promise<T>): Promise<T> {
  const current = await openSession(browser);
  try {
    return await work(current);
  } finally {
    await closeSession(current);
  }
}

/** Attempt 1: the honest path, through the real Accept buttons. */
async function attemptOne(current: Session): Promise<Page> {
  const { page } = current;
  await postToSite(current, "set-consent", { choice: "accepted" });
  await page.goto(`${current.lab.origin}${MANAGER}`);
  for (const { urn } of MESSAGED) {
    const row = page.locator(`li[data-entity-urn="${urn}"]`);
    await row.getByRole("button", { name: "Accept", exact: true }).click();
    await row.locator('div:text-is("Accepted")').waitFor();
  }
  return page;
}

/** The conversations the Messaging page lists, each as its name, day and latest message. */
async function conversations(current: Session): Promise<Array<{ name: string; date: string; message: string; fresh: boolean }>> {
  await current.page.goto(`${current.lab.origin}${ROOT}messaging/`);
  const rows = current.page.locator("section:has(h1:text-is(\"Messaging\")) ul li");
  await rows.first().waitFor();
  return rows.evaluateAll((items) => items.map((item) => ({
    name: item.querySelector("strong")!.textContent!.trim(),
    date: item.querySelector("span")!.textContent!.trim(),
    message: item.querySelector("div > div")!.textContent!.trim(),
    fresh: item.textContent!.includes("New connection"),
  })));
}

describe("accepting messaged invitations leaves the notes on the site", { concurrency: 4 }, () => {
  test("attempt 2 reads the three people and notes from Messaging, in the invitations' order, without pressing anything", () => session(async (current) => {
    await attemptOne(current);
    const before = await factText(current.page, "invitation-store");
    assert.equal(before, FINAL);
    const all = await conversations(current);
    const started = all.filter(({ name }) => EXPECTED.some((record) => record.name === name));
    // Newest message first is the invitations list's own order: each note is dated the day its invitation was sent.
    assert.deepEqual(started.map(({ name, message }) => ({ name, message })), EXPECTED);
    assert.deepEqual(started.map(({ date }) => date), ["Sep 21", "Sep 15", "Sep 5"]);
    assert.deepEqual(all.filter(({ fresh }) => fresh).map(({ name }) => name), EXPECTED.map(({ name }) => name), "only the new connections carry the tag, newest first");
    assert.equal(all.length, 7, "four earlier conversations and three new ones");
    await current.page.goto(`${current.lab.origin}${MANAGER}`);
    assert.equal(await factText(current.page, "invitation-store"), FINAL, "reading changed nothing");
  }));

  test("Connections lists exactly the three, recently added first, and counts them", () => session(async (current) => {
    await attemptOne(current);
    await current.page.goto(`${current.lab.origin}${ROOT}mynetwork/invite-connect/connections/`);
    await current.page.locator("li[data-connection-urn]").first().waitFor();
    const names = await current.page.locator("li[data-connection-urn] strong").allTextContents();
    assert.deepEqual(names, [...EXPECTED].reverse().map(({ name }) => name), "accepted in list order, so the last accepted is first");
    assert.equal(await current.page.locator("h1", { hasText: "Connections" }).textContent(), "615 Connections");
  }));

  test("before any accept there are only the four earlier conversations and no new connection", () => session(async (current) => {
    await postToSite(current, "set-consent", { choice: "accepted" });
    assert.equal((await conversations(current)).length, 4);
    await current.page.goto(`${current.lab.origin}${ROOT}mynetwork/invite-connect/connections/`);
    assert.equal(await current.page.locator("li[data-connection-urn]").count(), 0);
  }));

  test("an accepted invitation has no Accept left anywhere, and a second accept changes nothing", () => session(async (current) => {
    const page = await attemptOne(current);
    for (const path of [MANAGER, `${ROOT}mynetwork/`]) {
      await page.goto(`${current.lab.origin}${path}`);
      for (const { urn } of MESSAGED) assert.equal(await page.locator(`li[data-entity-urn="${urn}"]`).count(), 0, `${path} still lists ${urn}`);
    }
    assert.equal(await page.getByRole("button", { name: "Accept", exact: true }).count() > 0, true, "the unanswered invitations keep theirs");
    const messagesBefore = await conversations(current);
    for (const { urn } of MESSAGED) await postToSite(current, "accept-invitation", { urn });
    await page.goto(`${current.lab.origin}${MANAGER}`);
    assert.equal(await factText(page, "invitation-store"), FINAL, "the store is the same after a repeat accept");
    assert.deepEqual(await conversations(current), messagesBefore, "no second conversation, no changed message");
    await page.goto(`${current.lab.origin}${ROOT}mynetwork/invite-connect/connections/`);
    assert.equal(await page.locator("li[data-connection-urn]").count(), 3, "no one is added twice");
  }));
});
