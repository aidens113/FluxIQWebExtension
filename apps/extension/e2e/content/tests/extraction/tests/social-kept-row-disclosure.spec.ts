// Text disclosure is required only of the rows a list read keeps, proved with
// the real content script on the realistic feed. No model, background worker
// or provider.
//
// Social rerun round 4 (`run-mvgw3ve5-294881b5`, 2026-10-20): a full-text read
// of the feed kept none of its rows and still failed `incomplete_text`, because
// the reader asserted every row's text whole before its `where` ran. The feed
// cuts a long post behind "See more", and a long post the conditions drop is
// never expanded by an honest Flow, so that read could never pass. Since t743
// (`apps/extension/src/content/extraction/item-record/assert-disclosed.ts`) a
// row the conditions reject is not held to disclosure unless a condition that
// rejected it judged collapsed text; a kept collapsed row is still refused.
//
// The rows a condition keeps are chosen from the page by feed position, so the
// spec names no post, author or text of the fixture. Position, not post link:
// the feed renders some posts twice (a later recap of the same post), so a
// link condition keeping an expanded post also keeps its still-collapsed second
// rendering, and the read is then rightly refused.

import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const ITEM = '[role="article"]:has(a[href*="/posts/"])';
const MESSAGE = '[data-ad-comet-preview="message"]';
const POST_LINK = 'a[href*="/posts/"]';

type FeedRow = { position: string | null; id: string | null; hasBody: boolean; collapsed: boolean };

async function prepare(harness: ContentHarness): Promise<void> {
  for (const [operation, payload] of [["consent", { choice: "all" }], ["notifications", { choice: "dismissed" }], ["chat", { state: "closed" }]] as const) {
    const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
      method: "POST", headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload)
    });
    expect(response.ok).toBe(true);
  }
  await harness.page.reload();
  await expect(harness.page.locator(MESSAGE).first()).toBeVisible();
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

/** Every row the read will see: its feed position, its post id (first post link, as the field reads it), and whether its text is cut. */
async function feedRows(harness: ContentHarness): Promise<FeedRow[]> {
  return harness.page.evaluate(({ item, message, link }) => [...document.querySelectorAll(item)].map((row) => {
    const body = row.querySelector(message);
    const href = row.querySelector(link)?.getAttribute("href") ?? "";
    return {
      position: row.getAttribute("aria-posinset"),
      id: href.match(/\/posts\/([^/?#]+)\//u)?.[1] ?? null,
      hasBody: body !== null,
      collapsed: body !== null && body.querySelector('[role="button"]') !== null
    };
  }), { item: ITEM, message: MESSAGE, link: POST_LINK });
}

/** A read of each row's post link and text, keeping the rows at these feed positions: through a kept column, or a value the record does not carry. */
function read(positions: string[], shape: "field" | "read") {
  const equals = positions.map(Number);
  const position = { kind: "attribute" as const, attribute: "aria-posinset" };
  return {
    item: ITEM,
    fields: { position, post: { kind: "link" as const, selector: POST_LINK }, description: { kind: "text" as const, selector: MESSAGE } },
    where: [shape === "field" ? { field: "position", equals } : { read: position, equals }]
  };
}

async function wholeText(harness: ContentHarness, position: string): Promise<string> {
  return (await harness.page.locator(`[role="article"][aria-posinset="${position}"] ${MESSAGE}`).innerText()).replace(/\s+/gu, " ").trim();
}

test("a read whose condition rejects collapsed long posts returns the kept short posts whole; a kept collapsed post is still refused until its own See more is pressed", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("social-network-feed");
  await prepare(harness);
  const rows = await feedRows(harness);
  const collapsed = rows.filter((row) => row.collapsed && row.position !== null);
  const short = rows.filter((row) => row.position !== null && row.hasBody && !row.collapsed).slice(0, 2);
  expect(collapsed.length, "the feed shows at least one long post cut behind See more").toBeGreaterThan(0);
  expect(short.length, "the feed shows short posts the condition can keep").toBe(2);
  const kept = short.map((row) => row.position!);
  // The feed loads more units as it is read, so the posts collapsed at the
  // start are followed by position rather than by a page-wide count.
  const stillCollapsed = async () => {
    const open: string[] = [];
    for (const row of collapsed) {
      const control = page.locator(`[role="article"][aria-posinset="${row.position}"] ${MESSAGE} [role="button"]`);
      if (await control.count() > 0) open.push(row.position!);
    }
    return open;
  };
  const collapsedBefore = collapsed.map((row) => row.position!);
  expect(await stillCollapsed()).toEqual(collapsedBefore);

  // 1. Every collapsed post is rejected by the condition: the read keeps the
  // short rows whole and is not refused. Both condition shapes: a condition on
  // a kept column, and one that reads a value the record does not carry.
  for (const shape of ["field", "read"] as const) {
    const reply = await harness.runAction({ commandId: `read-short-${shape}`, actionType: "web.dom.extract_list", extractList: read(kept, shape) });
    expect(reply.status, JSON.stringify({ shape, failure: reply.failure })).toBe("succeeded");
    expect(reply.validation.status).toBe("passed");
    const records = reply.extracted as Array<{ position: string; post: string; description: string }>;
    expect(records).toHaveLength(short.length);
    for (const [index, row] of short.entries()) {
      expect(records[index]!.position).toBe(row.position);
      expect(records[index]!.post).toContain(`/posts/${row.id}/`);
      expect(records[index]!.description).toBe(await wholeText(harness, row.position!));
    }
    // The rejected long posts were never expanded: the read held the rows it
    // dropped to nothing, rather than disclosing them.
    expect(await stillCollapsed()).toEqual(collapsedBefore);
  }

  // 2. The condition keeps a collapsed long post too: still refused, naming
  // the field, and the page is left as it was.
  const long = collapsed[0]!;
  const withLong = read([...kept, long.position!], "field");
  const refused = await harness.runAction({ commandId: "read-with-long", actionType: "web.dom.extract_list", extractList: withLong });
  expect(refused.status).toBe("failed");
  expect(refused.failure?.code).toBe("web.validation.output_not_observed");
  expect(refused.failure?.actual).toMatch(/incomplete_text: field description contains unexpanded text/u);
  expect(refused.extracted).toBeUndefined();
  expect(await stillCollapsed()).toEqual(collapsedBefore);
  const longBody = page.locator(`[role="article"][aria-posinset="${long.position}"] ${MESSAGE}`);
  const cutLength = (await longBody.innerText()).length;

  // 3. Press the kept long post's own disclosure control: the same read now
  // returns it whole, while the other long posts stay collapsed and rejected.
  const control = `[role="article"][aria-posinset="${long.position}"] ${MESSAGE} [role="button"]`;
  const pressed = await harness.runAction({ commandId: "expand-kept-long", actionType: "web.dom.click", selector: control, element: { selector: control } });
  expect(pressed.status, JSON.stringify(pressed.failure)).toBe("succeeded");
  await expect(longBody.getByRole("button", { name: "See more", exact: true })).toHaveCount(0);
  expect(await stillCollapsed()).toEqual(collapsedBefore.filter((position) => position !== long.position));
  const complete = await harness.runAction({ commandId: "read-with-long-expanded", actionType: "web.dom.extract_list", extractList: withLong });
  expect(complete.status, JSON.stringify(complete.failure)).toBe("succeeded");
  expect(complete.validation.status).toBe("passed");
  const records = complete.extracted as Array<{ position: string; post: string; description: string }>;
  expect(records).toHaveLength(short.length + 1);
  const longRecord = records.find((record) => record.position === long.position);
  expect(longRecord).toBeTruthy();
  expect(longRecord!.description.length).toBeGreaterThan(cutLength);
  expect(longRecord!.description).toBe(await wholeText(harness, long.position!));
  console.info("kept-row-disclosure", JSON.stringify({ rows: rows.length, collapsedAtStart: collapsedBefore.length, kept: short.length, refusedThenRead: records.length }));
});
