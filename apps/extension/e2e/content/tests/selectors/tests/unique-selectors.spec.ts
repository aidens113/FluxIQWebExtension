// Every element a snapshot describes carries a selector that names exactly that
// element, on the page as captured.
//
// Why this is its own spec: a plan written by a model targets an element by an
// opaque handle, and the web domain resolves the handle to the selector the
// snapshot recorded (`domain/src/runtime/llm-evidence/plan-resolution/`). When
// several described elements share one selector -- every result card's title
// link, every "Add to cart" -- the resolver has to
// refuse the handle as `web.handle.not_unique`, because acting on it would
// click the first match whatever the model meant. So the property measured
// here is the resolver's precondition:
//
// - on the realistic sites' list pages (the everything store's results, the job
//   board's fifty cards, the social feed), whose every class and id is
//   generated, no two described elements share a selector;
// - each selector matches one element, and it is the element described --
//   checked against the descriptor's own xpath and tag, not merely a count;
// - a page that offers no unique anchor still gets a unique selector (duplicate
//   ids, repeated test ids with no unique container above them; no realistic
//   site repeats an id, so those rows are injected into the store's results);
// - a selector never quotes a value or text, so a sensitive region's contents
//   cannot reach one.
//
// What it does not prove: selectors inside a shadow root. Every realistic site
// draws a chat widget or a consent wall in one, and the snapshot describes
// their controls with a selector and xpath relative to the root and no
// `shadowHosts`, so at document scope the everything store's chat bubble is
// `button`, which names seventeen elements there (and three inside its own
// root); the job board's is `div:nth-of-type(1)`. Those are found in the page,
// left out of the claim and listed in a `shadow-root` annotation; an element
// described with its hosts is checked inside its root. Nor does it prove
// stability across a re-render that reorders a list -- a positional selector
// then names a different card, which is what the identity veto and scoring are
// for.

import type { Page } from "@playwright/test";
import type { DomElementDescriptor, DomSnapshot } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** The everything store's Plus wireless-earbud search, the live instruction task's own page. */
const STORE_SEARCH = "/scenarios/everything-store/s?k=wireless+earbuds&rh=plus";
/** A drawn result card; the placeholders carry the container attribute and no listing id. */
const STORE_CARD = '[data-component="search-result"][data-sku]';
/** React's `useId` shape, which the store's generated ids take. A selector must never quote one. */
const GENERATED_TOKEN = /:r[0-9a-z]*:/iu;

/** One site operation, sent as the site's own scripts send it. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** Opens a page of the harness's site and waits for the content script to announce itself in it. */
async function open(harness: ContentHarness, path: string): Promise<void> {
  await harness.page.goto(new URL(path, harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

/** The store's results with its consent, nudges and first-visit check answered through its own operations, and its cards drawn. */
async function openStoreResults(harness: ContentHarness): Promise<void> {
  await apply(harness, "consent", { choice: "accept" });
  await apply(harness, "dismiss-nudge", { nudge: "app-banner" });
  await apply(harness, "dismiss-nudge", { nudge: "notifications" });
  await apply(harness, "pass-soft-check");
  await open(harness, STORE_SEARCH);
  await expect(harness.page.locator(STORE_CARD).first()).toBeVisible();
}

/** The job board's fifty-result page, its consent wall, alert offer and chat answered. */
async function openJobResults(harness: ContentHarness): Promise<void> {
  await apply(harness, "consent", { choice: "rejected" });
  await apply(harness, "dismiss-alert-offer");
  await apply(harness, "minimise-chat");
  await open(harness, "/scenarios/job-board/jobs?limit=50");
  await expect(harness.page.locator("ol > li > article").first()).toBeVisible();
}

/** The social feed's home, its consent, notifications prompt and chat answered, with its first posts drawn. */
async function openFeed(harness: ContentHarness): Promise<void> {
  await apply(harness, "consent", { choice: "all" });
  await apply(harness, "notifications", { choice: "dismissed" });
  await apply(harness, "chat", { state: "closed" });
  await open(harness, "/scenarios/social-network-feed/");
  await expect(harness.page.locator('[role="feed"] [role="article"]').first()).toBeVisible();
}

/** Element kinds a plan clicks: the resolver's handle targets that matter most. */
const CLICKABLE_TAGS = new Set(["a", "button", "input", "select", "textarea", "summary", "label", "option"]);
const CLICKABLE_ROLES = new Set(["button", "link", "tab", "menuitem", "checkbox", "radio", "option", "switch", "row", "gridcell", "columnheader"]);

function clickable(descriptor: DomElementDescriptor): boolean {
  return CLICKABLE_TAGS.has(descriptor.tagName) ||
    Boolean(descriptor.hasClickHandler) ||
    (descriptor.role !== undefined && CLICKABLE_ROLES.has(descriptor.role));
}

type SelectorVerdict = {
  selector: string;
  tagName: string;
  matches: number;
  /** The one match is the element described, by every identity check that applied -- and at least one did. */
  sameElement: boolean;
  tagMatches: boolean;
  /**
   * The element sits inside an open shadow root that its descriptor does not
   * name: no `shadowHosts`, a selector and xpath relative to the root (and
   * the selector need not name one element even there). Found by asking every
   * open root on the page for an element of the described tag matching the
   * selector, at the described geometry or under a root-relative xpath. See the
   * header: not this spec's claim.
   */
  unnamedShadow: boolean;
  /** An SVG element with no box of its own, which neither oracle can place: an xpath name test misses SVG's namespace. */
  unplaceable: boolean;
};

/**
 * For each described element: how many elements its selector matches, and
 * whether the one match is the element described.
 *
 * "The element described" is established two independent ways, because the
 * selector under test cannot be its own oracle:
 *
 * - the descriptor's xpath, when it names exactly one node, evaluated exactly
 *   as recorded. It used to be rewritten here before evaluation, because
 *   `xpathFor` wrote an id anchor as `/*[@id="x"]` -- an absolute step, which
 *   XPath reads as "the document element, if its id is x" -- so no id-anchored
 *   xpath resolved and this oracle silently fell back to geometry alone for
 *   every element carrying an id. The anchor is now `//*[@id="x"]` and the
 *   recorded string is evaluated untouched.
 * - the descriptor's page geometry, when the match has a box of its own: the
 *   match must sit exactly where the described element sat.
 *
 * An element described with its hosts (`shadowHosts`) is asked for inside the
 * innermost root they name, where its selector names it, and its geometry is
 * checked there; an xpath cannot cross a shadow boundary and is not consulted.
 */
async function verdicts(page: Page, descriptors: readonly DomElementDescriptor[]): Promise<SelectorVerdict[]> {
  return await page.evaluate((entries) => entries.map(({ selector, xpath, tagName, bounds, hosts }) => {
    let root: Document | ShadowRoot | null = document;
    for (const host of hosts) {
      try { root = root?.querySelector(host)?.shadowRoot ?? null; } catch { root = null; }
    }
    let matched: Element[] = [];
    try { matched = root ? [...root.querySelectorAll(selector)] : []; } catch { matched = []; }
    const match = matched.length === 1 ? matched[0]! : undefined;
    let checks = 0;
    let agrees = match !== undefined;
    if (match && xpath && hosts.length === 0) {
      const byXpath = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      if (byXpath.snapshotLength === 1) {
        checks += 1;
        agrees &&= byXpath.snapshotItem(0) === match;
      }
    }
    if (match && bounds) {
      const rect = match.getBoundingClientRect();
      if (rect.width >= 2 && rect.height >= 2) {
        checks += 1;
        const close = (a: number, b: number) => Math.abs(a - b) <= 0.5;
        agrees &&= close(rect.left + window.scrollX, bounds.x) && close(rect.top + window.scrollY, bounds.y) &&
          close(rect.width, bounds.width) && close(rect.height, bounds.height);
      }
    }
    const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
    const at = (element: Element) => {
      if (!bounds) return false;
      const rect = element.getBoundingClientRect();
      return near(rect.left + window.scrollX, bounds.x) && near(rect.top + window.scrollY, bounds.y) &&
        near(rect.width, bounds.width) && near(rect.height, bounds.height);
    };
    const openRoots = hosts.length > 0 ? [] : [...document.querySelectorAll("*")]
      .map((element) => element.shadowRoot)
      .filter((shadow): shadow is ShadowRoot => shadow !== null);
    const unnamedShadow = !(agrees && checks > 0) && openRoots.some((shadow) => {
      let inRoot: Element[] = [];
      try { inRoot = [...shadow.querySelectorAll(selector)]; } catch { inRoot = []; }
      // A root-relative xpath ("/button[1]") is what the snapshot writes for such an element; a document's starts at html or an id.
      const rootRelative = xpath !== undefined && !xpath.startsWith("/html") && !xpath.startsWith("//");
      const ofTag = inRoot.filter((element) => element.tagName.toLowerCase() === tagName);
      return ofTag.length > 0 && (ofTag.some(at) || rootRelative);
    });
    return {
      selector,
      tagName,
      matches: matched.length,
      sameElement: agrees && checks > 0,
      tagMatches: match !== undefined && match.tagName.toLowerCase() === tagName,
      unnamedShadow,
      unplaceable: match !== undefined && checks === 0 && match.namespaceURI === "http://www.w3.org/2000/svg"
    };
  }), descriptors.map((descriptor) => ({
    selector: descriptor.selector,
    xpath: descriptor.xpath,
    tagName: descriptor.tagName,
    bounds: descriptor.documentBounds,
    hosts: shadowHostsOf(descriptor)
  })));
}

/**
 * The shadow hosts a descriptor names on the way to its element. Descriptors
 * carry none today (see the annotation on shadow-root controls), so this reads
 * the field without assuming the type has it: the claim tightens by itself
 * once the snapshot starts sending one.
 */
function shadowHostsOf(descriptor: DomElementDescriptor): string[] {
  const hosts: unknown = Reflect.get(descriptor, "shadowHosts");
  return Array.isArray(hosts) ? hosts.filter((host): host is string => typeof host === "string") : [];
}

function duplicates(descriptors: readonly DomElementDescriptor[]): string[] {
  const seen = new Map<string, number>();
  for (const descriptor of descriptors) {
    const address = [...shadowHostsOf(descriptor), descriptor.selector].join(" >>> ");
    seen.set(address, (seen.get(address) ?? 0) + 1);
  }
  return [...seen].filter(([, count]) => count > 1).map(([selector, count]) => `${count}x ${selector}`);
}

async function measure(harness: ContentHarness): Promise<{ snapshot: DomSnapshot; results: SelectorVerdict[]; captureMs: number }> {
  const started = Date.now();
  const snapshot = await harness.capture();
  const captureMs = Date.now() - started;
  const results = await verdicts(harness.page, snapshot.interactiveElements);
  return { snapshot, results, captureMs };
}

function expectAllUnique(snapshot: DomSnapshot, results: readonly SelectorVerdict[], label: string): void {
  const described = snapshot.interactiveElements;
  expect(described.length, `${label}: the snapshot describes elements`).toBeGreaterThan(0);
  expect(duplicates(described), `${label}: no two described elements share a selector`).toEqual([]);
  const wrong = results.filter((result) => !result.unnamedShadow &&
    (result.matches !== 1 || !result.tagMatches || !(result.sameElement || result.unplaceable)));
  expect(wrong, `${label}: every selector matches exactly the element described`).toEqual([]);
  const shadowed = results.filter((result) => result.unnamedShadow);
  if (shadowed.length > 0) {
    test.info().annotations.push({
      type: "shadow-root",
      description: `${label}: ${shadowed.length} described element(s) inside an open shadow root carry a root-relative selector and no shadowHosts: ` +
        shadowed.map((result) => result.selector).join(" | ")
    });
  }
}

const LIST_PAGES = [
  { scenarioId: "everything-store", minClickables: 12, openPage: openStoreResults },
  { scenarioId: "job-board", minClickables: 50, openPage: openJobResults },
  { scenarioId: "social-network-feed", minClickables: 10, openPage: openFeed }
] as const;

for (const { scenarioId, minClickables, openPage } of LIST_PAGES) {
  test(`${scenarioId}: every described element, and so every clickable, has a selector naming exactly that element`, async ({ openHarness }) => {
    test.setTimeout(90_000);
    const harness = await openHarness(scenarioId);
    await openPage(harness);
    const { snapshot, results } = await measure(harness);
    const clickables = snapshot.interactiveElements.filter(clickable);
    expect(clickables.length, `${scenarioId}: clickables are described`).toBeGreaterThanOrEqual(minClickables);
    expectAllUnique(snapshot, results, scenarioId);
    test.info().annotations.push({
      type: "measurement",
      description: `${scenarioId}: ${snapshot.interactiveElements.length} described, ${clickables.length} clickable, ` +
        `${results.filter((result) => result.matches === 1 && result.sameElement).length} resolve to exactly the element described`
    });
  });
}

test("everything-store: each result's title link gets its own selector, and none quotes a generated id", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  await openStoreResults(harness);
  const snapshot = await harness.capture();
  const titleLink = await harness.page.evaluate(({ descriptors, title }) => descriptors.map((selector) => {
    try { return document.querySelector(selector)?.matches(title) ?? false; } catch { return false; }
  }), { descriptors: snapshot.interactiveElements.map((descriptor) => descriptor.selector), title: `${STORE_CARD} h2 a` });
  const links = snapshot.interactiveElements.filter((_, index) => titleLink[index]);
  expect(links.length, "the results' title links are described").toBe(await harness.page.locator(`${STORE_CARD} h2 a`).count());
  expect(links.length).toBeGreaterThanOrEqual(12);
  expect(new Set(links.map((link) => link.selector)).size).toBe(links.length);
  for (const link of links) expect(link.selector, "the store regenerates every id on its next rendering").not.toMatch(GENERATED_TOKEN);
  const hrefs = await harness.page.evaluate((selectors) => selectors.map((selector) =>
    (document.querySelector(selector) as HTMLAnchorElement | null)?.href ?? null), links.map((link) => link.selector));
  expect(hrefs).toEqual(links.map((link) => link.href ?? null));
});

test("an element whose own anchor is unique keeps the short selector it always had", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  await openStoreResults(harness);
  const { snapshot, results } = await measure(harness);
  const selectors = snapshot.interactiveElements.map((descriptor) => descriptor.selector);
  // The store's search submit carries its own test id.
  expect(selectors).toContain(`[data-testid="nav-search-submit"]`);
  // And the search box keeps its own name, scoped by the header when the page needs that to name one element.
  expect(selectors.filter((selector) => selector.endsWith(`input[name="k"]`))).toHaveLength(1);
  expectAllUnique(snapshot, results, "anchored controls");
});

test("an element whose id is a stable author-named one keeps that id as its anchor", async ({ openHarness }) => {
  // Hammerline's vendor chat is the one realistic control tree under a stable,
  // author-named id rather than a generated one.
  const harness = await openHarness("auction-marketplace");
  await apply(harness, "consent", { choice: "rejected" });
  await apply(harness, "dismiss-promo");
  await open(harness, "/scenarios/auction-marketplace/");
  await expect(harness.page.locator("#hal-assist")).toBeAttached();
  const { snapshot, results } = await measure(harness);
  const underChat = snapshot.interactiveElements.filter((descriptor) => descriptor.selector.startsWith("#hal-"));
  expect(underChat.length, "the chat's controls are addressed through its id").toBeGreaterThan(0);
  expectAllUnique(snapshot, results, "id-anchored controls");
});

test("repeated anchors with no unique container, and duplicate ids, still get selectors naming one element each", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  await openStoreResults(harness);
  await harness.page.evaluate(() => {
    const rows = [1, 2, 3].map((number) =>
      `<div class="fx-row"><span>Row ${number}</span><button data-testid="fx-edit">Edit ${number}</button>` +
      `<button id="fx-dup">Delete ${number}</button><input name="fx-qty" aria-label="Quantity ${number}"></div>`).join("");
    // Two lists with the same shape and no identifier anywhere above the rows.
    document.body.insertAdjacentHTML("beforeend", `<div>${rows}</div><div>${rows}</div>`);
  });
  const { snapshot, results } = await measure(harness);
  const injected = snapshot.interactiveElements.filter((descriptor) =>
    descriptor.testId === "fx-edit" || descriptor.id === "fx-dup" || descriptor.attributes?.["name"] === "fx-qty");
  expect(injected.length, "all eighteen injected controls are described").toBe(18);
  expectAllUnique(snapshot, results, "repeated anchors");
});

test("a selector never quotes page text or a value, so a sensitive field's contents cannot reach one", async ({ openHarness }) => {
  // Framelight's subscribe page asks for a card number; a secret typed into it
  // must reach no selector and no evidence.
  const harness = await openHarness("photo-social");
  await apply(harness, "consent", { choice: "essential" });
  await apply(harness, "notifications");
  await open(harness, "/scenarios/photo-social/verified/subscribe/");
  const secret = "4111111111111111";
  await harness.page.locator('input[autocomplete="cc-number"]').fill(secret);
  const { snapshot, results } = await measure(harness);
  expectAllUnique(snapshot, results, "card form");
  expect(snapshot.interactiveElements.some((descriptor) => descriptor.tagName === "input"), "the card field is described").toBe(true);
  for (const descriptor of snapshot.interactiveElements) expect(descriptor.selector).not.toContain(secret);
  const evidence = JSON.stringify(snapshot.evidence ?? {});
  expect(evidence).not.toContain(secret);
});

// The five shapes `xpathFor` can write, resolved in a real browser against the
// element each was written for. The unit test
// (`src/content/tests/element-finder.test.ts`) pins the exact text of each;
// what only Chromium can say is whether the text is an expression its XPath
// engine accepts and points at the right node -- which is the half that was
// wrong. An id-anchored path resolved to nothing, and an id holding a quote was
// not an expression at all: `"say\"hi"` made `document.evaluate` throw, and it
// is called on the replay path with no `try` around it, so a page that named a
// control that way failed the action outright rather than missing the xpath and
// carrying on to the next strategy.
const QUOTED_IDS = [
  { label: "fx-x-plain", id: "fx-x-plain-id" },
  { label: "fx-x-double", id: `fx-x say"hi"` },
  { label: "fx-x-single", id: `fx-x it's` },
  { label: "fx-x-both", id: `fx-x it's a "quote"` }
] as const;

test("every xpath shape resolves, in the browser, to exactly the element it was written for", async ({ openHarness }) => {
  // The shapes need ids no realistic site writes (quotes inside them), so they
  // are built into the store's results page.
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  await openStoreResults(harness);
  // Built through the DOM rather than as markup, so an id carrying a quote is
  // the id intended and not whatever the HTML parser made of it.
  await harness.page.evaluate((ids) => {
    const container = document.createElement("div");
    const button = (label: string) => {
      const element = document.createElement("button");
      element.type = "button";
      // `title` is on the descriptor's attribute allowlist, so it is how a
      // described element is paired back to the case that made it.
      element.title = label;
      element.textContent = label;
      return element;
    };
    for (const { label, id } of ids) {
      const element = button(label);
      element.setAttribute("id", id);
      container.append(element);
    }
    // An id on an ancestor rather than on the element: the anchor is the
    // ancestor's, and the steps below it have to be kept.
    const ancestor = document.createElement("div");
    ancestor.id = "fx-x-ancestor";
    ancestor.append(document.createElement("span"), button("fx-x-ancestor-child"));
    // And no id anywhere above it, which is the one shape that stays absolute.
    container.append(ancestor, button("fx-x-no-id"));
    document.body.append(container);
  }, QUOTED_IDS);

  const snapshot = await harness.capture();
  const labels = [...QUOTED_IDS.map((quoted) => quoted.label), "fx-x-ancestor-child", "fx-x-no-id"];
  const described = labels.map((label) => {
    const descriptor = snapshot.interactiveElements.find((element) => element.attributes?.["title"] === label);
    expect(descriptor, `${label} is described`).toBeDefined();
    expect(descriptor!.xpath, `${label} carries an xpath`).toBeDefined();
    return { label, xpath: descriptor!.xpath! };
  });

  // An id is unique, so the anchored form is what an id-bearing element must
  // get; the descendant `//` is the part that was broken.
  for (const { label, xpath } of described) {
    if (label === "fx-x-no-id") expect(xpath.startsWith("//"), `${label}: no id above it, so the path stays absolute`).toBe(false);
    else expect(xpath, `${label}: anchored on the id, as a descendant step`).toMatch(/^\/\/\*\[@id=/);
  }

  const resolved = await harness.page.evaluate((entries) => entries.map(({ label, xpath }) => {
    const intended = document.querySelector(`[title="${label}"]`);
    try {
      const found = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      return { label, matches: found.snapshotLength, isIntended: found.snapshotItem(0) === intended, threw: null as string | null };
    } catch (error) {
      // An invalid expression throws rather than missing, which is why this is
      // caught and reported as a result instead of failing the page call.
      return { label, matches: -1, isIntended: false, threw: String(error) };
    }
  }), described);

  expect(resolved).toEqual(described.map(({ label }) => ({ label, matches: 1, isIntended: true, threw: null })));
});

// The premise behind the guard in `element-finder.ts`, checked against a real
// XPath engine rather than asserted: the form the old writer emitted for an id
// holding a double quote does not miss, it *throws*. That is why a stored xpath
// is inspected before it is evaluated -- a throw leaves `resolveTarget`
// entirely and fails the action, where a strategy finding nothing would have
// let the id, test id, name and class-set lookups below it run.
test("the form an id with a quote used to be recorded in throws in the browser rather than missing", async ({ openHarness }) => {
  const harness = await openHarness("company-website");
  const outcomes = await harness.page.evaluate(() => {
    const attempt = (xpath: string) => {
      try {
        document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return "evaluated";
      } catch {
        return "threw";
      }
    };
    return {
      // What a recording made before the fix carries for the id `say"hi`.
      stored: attempt(`/*[@id="say\\"hi"]`),
      // And what the same id is written as now.
      written: attempt(`//*[@id='say"hi']`),
      // A backslash beside a quote is ordinary, not an escape: this one is read.
      backslash: attempt(`//*[@id='a\\"b']`)
    };
  });
  expect(outcomes).toEqual({ stored: "threw", written: "evaluated", backslash: "evaluated" });
});

// How much of a real page the broken anchor covered, measured rather than
// argued: every id-anchored xpath on Hammerline's home page -- its vendor chat
// sits under stable author-named ids -- is evaluated as recorded and again in
// the form it used to be written in. The second number is what the
// replay fallback was actually getting for those elements.
test("on a real page, the anchored xpaths resolve where the form they used to be written in resolved nothing", async ({ openHarness }) => {
  const harness = await openHarness("auction-marketplace");
  await apply(harness, "consent", { choice: "rejected" });
  await apply(harness, "dismiss-promo");
  await open(harness, "/scenarios/auction-marketplace/");
  await expect(harness.page.locator("#hal-assist")).toBeAttached();
  const snapshot = await harness.capture();
  const anchored = snapshot.interactiveElements
    .filter((descriptor) => descriptor.xpath?.startsWith("//*[@id=") ?? false)
    .map((descriptor) => ({ selector: descriptor.selector, xpath: descriptor.xpath! }));
  expect(anchored.length, "the page describes elements whose xpath is id-anchored").toBeGreaterThan(0);

  const counts = await harness.page.evaluate((entries) => {
    const resolve = (xpath: string): Element | null => {
      try {
        const found = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return found.snapshotLength === 1 ? found.snapshotItem(0) as Element : null;
      } catch {
        // The old form was still a valid expression whenever the id held no
        // quote, so nothing here is thrown; an id with a quote is the case
        // that threw, and the row above covers it.
        return null;
      }
    };
    let now = 0;
    let before = 0;
    for (const { selector, xpath } of entries) {
      const intended = document.querySelector(selector);
      if (resolve(xpath) === intended) now += 1;
      // The single-slash form this xpath used to be written as.
      if (resolve(xpath.slice(1)) === intended) before += 1;
    }
    return { now, before, total: entries.length };
  }, anchored);

  expect(counts.now, "every id-anchored xpath now resolves to the element it names").toBe(counts.total);
  expect(counts.before, "and none of them did in the form they used to be written in").toBe(0);
  test.info().annotations.push({
    type: "measurement",
    description: `auction-marketplace: ${counts.total} of ${snapshot.interactiveElements.length} described elements carry an id-anchored xpath; ` +
      `${counts.now} resolve as recorded, ${counts.before} resolved in the old single-slash form`
  });
});

// Blocked on the identity-capture regression (supervisor-assigned task, 2026-10-19):
// each snapshot descriptor is built through `describeElement`, whose identity capture
// (`src/content/identity/control-row.ts`) walks up to 3 x 2,000 nodes per element, so
// this capture takes about 43 s. The 5 s bound stays: raising it would hide that.
test("a large page is described with unique selectors without making the snapshot slow", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("job-board");
  await openJobResults(harness);
  // The board's fifty cards, plus a grid of 1,200 repeated, unanchored controls
  // no realistic site draws at this size.
  await harness.page.evaluate(() => {
    const cells = Array.from({ length: 1_200 }, (_, index) => `<div class="fx-cell"><a href="#c${index}">Cell ${index}</a></div>`).join("");
    document.body.insertAdjacentHTML("beforeend", `<div class="fx-grid">${cells}</div>`);
  });
  const { snapshot, results, captureMs } = await measure(harness);
  expectAllUnique(snapshot, results, "large page");
  test.info().annotations.push({ type: "measurement", description: `large page: ${snapshot.interactiveElements.length} described, capture ${captureMs} ms` });
  expect(captureMs, "the capture round trip stays interactive").toBeLessThan(5_000);
});
