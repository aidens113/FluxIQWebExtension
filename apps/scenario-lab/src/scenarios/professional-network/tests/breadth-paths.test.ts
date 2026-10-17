import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Browser, Locator, Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { memberNamed, RECEIVED_INVITATIONS } from "../data/index.js";
import { professionalNetworkManifest, STORE_AT_START } from "../index.js";
import { peopleSearchHref } from "../search/index.js";
import { closeSession, factText, launchBrowser, openSession, postToSite, readingPause, ROOT, type Session } from "./browser-session.js";

/**
 * Browser-path proofs for the four breadth tasks (t705): each workflow's own
 * recording script, played step by step, reaches its dataset and final state,
 * and a plausible wrong path -- the wrong filter, the wrong row, an extra act
 * -- misses the oracle.
 */
const workflow = (workflowId: string) => resolveScenarioWorkflow(professionalNetworkManifest, { workflowId });
const CLOSE_CONVERSATION = { name: "Close your conversation with Priya Nair" } as const;
const ORGANIC = `li[data-urn^="urn:gl:member:"]:not([data-ad-slot])`;
const pageStatus = (page: Page, number: number) => page.locator(`section[aria-label="Search results"] span`, { hasText: new RegExp(`^Page ${number} of \\d+$`, "u") });
type Records = Array<Record<string, string | null>>;

let browser: Browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser.close(); });

async function session<T>(work: (session: Session) => Promise<T>): Promise<T> {
  const current = await openSession(browser);
  try {
    const result = await work(current);
    assert.deepEqual(current.offsite, [], "the site reached nothing off the machine");
    return result;
  } finally {
    await closeSession(current);
  }
}

/** A recording target as the Lab spells it: `role:<role>:<name>`, `testid:<id>`, or a selector. */
function locate(page: Page, target: string): Locator {
  const role = /^role:([a-z]+):(.+)$/u.exec(target);
  if (role) return page.getByRole(role[1] as Parameters<Page["getByRole"]>[0], { name: role[2]!, exact: true });
  if (target.startsWith("testid:")) return page.getByTestId(target.slice("testid:".length));
  return page.locator(target);
}

async function readItems(page: Page, step: ScenarioStep): Promise<Records> {
  const records: Records = [];
  for (const item of await locate(page, step.target!).all()) {
    const record: Record<string, string | null> = {};
    for (const [field, selector] of Object.entries(step.fields ?? {})) {
      const found = item.locator(selector).first();
      record[field] = (await found.count()) ? ((await found.textContent()) ?? "").trim() : null;
    }
    records.push(record);
  }
  return records;
}

/**
 * Plays a recording script in the tab and returns what its extract step read,
 * each record once. A numbered pagination turns every page by its number, at a
 * reader's pace, which is what keeps the search from asking for a check.
 */
async function play(current: Session, script: readonly ScenarioStep[]): Promise<Records> {
  const { page } = current;
  await page.goto(`${current.lab.origin}${ROOT}`);
  let records: Records = [];
  for (const step of script) {
    switch (step.operation) {
      case "waitForState":
        await locate(page, step.target!).first().waitFor({ state: "visible", timeout: step.timeoutMs ?? 5000 });
        break;
      case "click":
        await locate(page, step.target!).click();
        break;
      case "type":
        await locate(page, step.target!).fill(String(step.value));
        break;
      case "press":
        await locate(page, step.target!).press(String(step.value));
        break;
      case "check":
        await locate(page, step.target!).setChecked(step.value === true);
        break;
      case "navigate":
        await page.goto(`${current.lab.origin}${step.path!}`);
        break;
      case "extract": {
        await locate(page, step.target!).first().waitFor({ timeout: 8_000 });
        records = await readItems(page, step);
        const pagination = step.pagination;
        if (pagination?.mode === "numbered") {
          for (let number = 2; number <= pagination.maxPages; number += 1) {
            const button = page.locator(pagination.pages).filter({ hasText: new RegExp(`^${number}$`, "u") });
            if (!(await button.count())) break;
            await readingPause(page);
            await button.click();
            await pageStatus(page, number).waitFor({ timeout: 8_000 });
            records.push(...await readItems(page, step));
          }
        }
        const seen = new Set<string>();
        records = records.filter((record) => {
          const key = JSON.stringify(record);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        break;
      }
      case "checkpoint": break;
      default: throw new Error(`unexpected recording operation ${step.operation}`);
    }
  }
  return records;
}

/** Answers the cookie banner by its own request and opens `path`, as the primary paths spec does. */
async function arrive(current: Session, path: string, appPrompt: boolean): Promise<Page> {
  const { page } = current;
  await postToSite(current, "set-consent", { choice: "accepted" });
  await page.goto(`${current.lab.origin}${path}`);
  if (appPrompt) await page.locator('div:text-is("Not now")').click({ timeout: 15_000 });
  await page.getByRole("button", CLOSE_CONVERSATION).click({ timeout: 15_000 });
  return page;
}

async function until(condition: () => Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error("condition did not hold in time");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Sends a connection request without a note from a results card, waiting for the page's acknowledgement. */
async function connectFromCard(page: Page, name: string): Promise<void> {
  const member = memberNamed(name);
  await page.locator(`li[data-urn="${member.urn}"] button`).click();
  await page.getByRole("button", { name: "Send without a note", exact: true }).click();
  await page.getByText(`Your invitation to ${name} was sent.`).waitFor();
}

const NETHERLANDS = workflow("netherlands-engineers");
const CONNECT = workflow("connect-kade-senior");
const ACCEPT = workflow("accept-messaged-invitations");
const CONTACT = workflow("kade-lead-contact");
const KADE_SENIORS = peopleSearchHref({ keywords: "senior data engineer", network: [], geo: [], company: ["kade-energy"], page: 1 });
const KADE_ENGINEERS = peopleSearchHref({ keywords: "data engineer", network: [], geo: [], company: ["kade-energy"], page: 1 });
const KADE_FIRST = peopleSearchHref({ keywords: "data engineer", network: ["F"], geo: [], company: ["kade-energy"], page: 1 });
const NETHERLANDS_SECOND = peopleSearchHref({ keywords: "data engineer", network: ["S"], geo: ["102890719"], company: [], page: 1 });

describe("professional-network breadth tasks in a browser", { concurrency: 4 }, () => {
  test("the Netherlands recording reads all four pages and reaches its 32 records exactly", () => session(async (current) => {
    const records = await play(current, NETHERLANDS.recordingScript);
    assert.deepEqual(records, NETHERLANDS.expected.extracted![0]!.records);
    assert.equal(await factText(current.page, "invitation-store"), NETHERLANDS.expected.finalState![0]!.value);
  }));

  test("a reader that keeps every card on the right search -- promoted ones and repeats -- misses the Netherlands dataset", () => session(async (current) => {
    const page = await arrive(current, NETHERLANDS_SECOND, true);
    const names: string[] = [];
    const everyCard = async () => {
      await page.locator(ORGANIC).first().waitFor({ timeout: 8_000 });
      names.push(...await page.locator(`li[data-urn^="urn:gl:member:"] a[href*="/in/"] span[aria-hidden="true"]`).allTextContents());
    };
    await everyCard();
    for (const number of [2, 3, 4]) {
      await readingPause(page);
      await page.locator(`section[aria-label="Search results"] li > button`).filter({ hasText: new RegExp(`^${number}$`, "u") }).click();
      await pageStatus(page, number).waitFor({ timeout: 8_000 });
      await everyCard();
    }
    const expected = NETHERLANDS.expected.extracted![0]!.records!.map(({ name }) => name);
    assert.equal(names.length, 36, "32 people, two promoted cards, and the repeats at the top of pages 3 and 4");
    assert.notDeepEqual(names, expected);
    const firstSeen = [...new Set(names)];
    assert.equal(firstSeen.length, 32, "the same people, once each");
    assert.notDeepEqual(firstSeen, expected, "but Lars Hoekstra's promotion on page 2 puts him out of the search's order");
  }));

  test("the connection-request recording sends exactly one request, to Matteo Ricci, and reads it back from Sent", () => session(async (current) => {
    const records = await play(current, CONNECT.recordingScript);
    assert.deepEqual(records, CONNECT.expected.extracted![0]!.records);
    await until(async () => (await factText(current.page, "invitation-store")) === CONNECT.expected.finalState![0]!.value);
    await current.page.reload();
    assert.equal(await factText(current.page, "invitation-store"), CONNECT.expected.finalState![0]!.value, "the request survives a reload");
  }));

  test("a request to the wrong Kade Energy row, or one extra request, misses the connection oracle", () => session(async (current) => {
    const page = await arrive(current, KADE_ENGINEERS, true);
    await page.locator(ORGANIC).first().waitFor({ timeout: 8_000 });
    await connectFromCard(page, "Ruben Klaassen");
    const wrongRow = await factText(page, "invitation-store");
    assert.notEqual(wrongRow, CONNECT.expected.finalState![0]!.value, "Ruben Klaassen is a Data Engineer II, not the senior");
    assert.notEqual(wrongRow, STORE_AT_START);
    await readingPause(page);
    await page.goto(`${current.lab.origin}${KADE_SENIORS}`);
    await page.locator(ORGANIC).first().waitFor({ timeout: 8_000 });
    await connectFromCard(page, "Matteo Ricci");
    assert.notEqual(await factText(page, "invitation-store"), CONNECT.expected.finalState![0]!.value, "the right request beside a wrong one is still not the goal");
  }));

  test("the accept recording answers the three messaged invitations and reads who they were", () => session(async (current) => {
    const records = await play(current, ACCEPT.recordingScript);
    assert.deepEqual(records, ACCEPT.expected.extracted![0]!.records);
    await until(async () => (await factText(current.page, "invitation-store")) === ACCEPT.expected.finalState![0]!.value);
    await current.page.reload();
    assert.equal(await factText(current.page, "invitation-store"), ACCEPT.expected.finalState![0]!.value);
    assert.equal(await current.page.locator("li[data-entity-urn]").count(), 5, "five invitations still wait");
  }));

  test("accepting every connection invitation, messaged or not, misses the accept oracle", () => session(async (current) => {
    const page = await arrive(current, `${ROOT}mynetwork/invitation-manager/`, false);
    for (const invitation of RECEIVED_INVITATIONS.filter(({ kind }) => kind === "person")) {
      const row = page.locator(`li[data-entity-urn="${invitation.urn}"]`);
      await row.getByRole("button", { name: "Accept", exact: true }).click();
      await row.locator('div:text-is("Accepted")').waitFor();
    }
    const store = JSON.parse((await factText(page, "invitation-store")) ?? "{}") as { received: string[] };
    assert.equal(store.received.length, 2, "only the page and newsletter invitations are left");
    assert.notEqual(await factText(page, "invitation-store"), ACCEPT.expected.finalState![0]!.value);
  }));

  test("the contact recording reaches Pieter Groen's email through two filters and his profile", () => session(async (current) => {
    const records = await play(current, CONTACT.recordingScript);
    assert.deepEqual(records, CONTACT.expected.extracted![0]!.records);
    assert.equal(await factText(current.page, "invitation-store"), CONTACT.expected.finalState![0]!.value);
  }));

  test("the other first-degree Kade Energy engineer's contact info is the wrong row, and a second-degree one shows no email", () => session(async (current) => {
    const page = await arrive(current, KADE_FIRST, true);
    const cards = page.locator(`${ORGANIC} a[href*="/in/"] span[aria-hidden="true"]`);
    await cards.first().waitFor({ timeout: 8_000 });
    assert.deepEqual(await cards.allTextContents(), ["Ricardo Alves", "Pieter Groen"]);
    const contactStep = CONTACT.recordingScript.find(({ id }) => id === CONTACT.expected.extracted![0]!.step)!;
    const contactOf = async (name: string) => {
      await page.goto(`${current.lab.origin}${ROOT}in/${memberNamed(name).slug}/`);
      await page.getByRole("button", { name: "Contact info", exact: true }).click();
      await page.getByRole("dialog", { name: "Contact info" }).waitFor();
      return readItems(page, contactStep);
    };
    const ricardo = await contactOf("Ricardo Alves");
    assert.deepEqual(ricardo, [{ name: "Ricardo Alves", email: "ricardo@example.com" }]);
    assert.notDeepEqual(ricardo, CONTACT.expected.extracted![0]!.records);
    assert.deepEqual(await contactOf("Matteo Ricci"), [{ name: "Matteo Ricci", email: null }], "a second-degree profile shows no email");
  }));
});
