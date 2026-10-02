// Every control a person can see is in the page view the model reads, named
// as a person would name it and with the state a person can see (t229).
//
// Lane A's crossborder runs (2026-10-01) showed the view hiding what a person
// sees. The home page's search box read `field "Autumn Mega Sale: up to 70%
// off"` -- its promotional placeholder as its name, and nothing saying it is a
// search box -- and its 237 lines held no control the page drew as a `<div>`:
// the search's magnifier, the consent answers, the region picker. On the item
// page the quantity box was named after the "−" beside it, and the colour
// swatches, image-only `<div>`s with a `title`, were not in the view at all.
// The model searched the page for what it could not see 74 times in one run.
//
// The oracle is the browser, not the capture: before the page's scripts run,
// `addEventListener` is watched, and every element that is given a press
// listener is remembered. After the capture, every visible element a person
// can operate -- a link, button, field, select, checkbox, an element whose
// role says it is one, one with an `onclick`, one the page listens to presses
// on -- must have a line of its own in the view, as a control rather than as
// plain text, the real domain view built from the real content script's
// capture. An element the page listens to only to hear presses on the
// controls inside it -- a feed list delegating its "see more" buttons -- is
// not itself one: what a person presses is inside it, and must have a line. The rows run on the ten realistic
// scenarios' start pages and on the crossborder item page.

import { writeFile } from "node:fs/promises";
import type { JsonObject } from "fluxiq/core";
import { publishedWebLlmPage, sanitizeWebLlmSnapshotWithBindings } from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const REALISTIC_SCENARIOS = [
  "everything-store", "crossborder-marketplace", "bigbox-retail", "job-board", "local-classifieds",
  "auction-marketplace", "photo-social", "social-network-feed", "company-website", "professional-network"
] as const;

/** What the browser says about one element a person can operate. */
type Operable = {
  /** The view's handle for it, or `null` when the capture's packet has no element at its address. */
  target: string | null;
  tag: string;
  /** Why it counts as operable: its tag, its role, `onclick`, or a press listener. */
  why: string;
  /** Its outer HTML's head, to say which element a failure is about. */
  html: string;
  /** A form field: an input that is not a button, a textarea, a select. */
  field: boolean;
  /** Its placeholder, when no label, `aria-label`, `aria-labelledby` or `title` names it. */
  bareplaceholder: string | null;
  /** It has no words of its own but an `aria-label`, a `title` or an image's alt names it. */
  imageName: string | null;
  /** A search box, by type, role, a search landmark or form, or a `q`/`search` name or id. */
  search: boolean;
  /** The states the page wrote, as the view's tokens. */
  states: string[];
};

const PRESS_EVENTS = ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"];

/** Runs before any page script: remembers every element a press listener is added to. */
function watchPressListeners(events: string[]): void {
  const pressed = new WeakSet<EventTarget>();
  const presses = new Set(events);
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function watched(this: EventTarget, type: string, ...rest: unknown[]) {
    if (presses.has(type) && this instanceof Element) pressed.add(this);
    return (add as (...args: unknown[]) => void).call(this, type, ...rest);
  } as typeof EventTarget.prototype.addEventListener;
  Object.defineProperty(window, "__t229Pressed", { value: pressed });
}

/** Every visible operable element, in the page, held for `resolveOperables`. */
function collectOperables(): number {
  const pressed = (window as unknown as { __t229Pressed?: WeakSet<EventTarget> }).__t229Pressed;
  const ROLES = new Set(["button", "link", "checkbox", "radio", "switch", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "combobox", "textbox", "searchbox", "slider", "spinbutton", "listbox", "treeitem"]);
  const why = (element: Element): string | undefined => {
    const tag = element.tagName.toLowerCase();
    if (tag === "a" && element.hasAttribute("href")) return "a[href]";
    if (["button", "select", "textarea", "summary"].includes(tag)) return tag;
    if (tag === "input") return (element.getAttribute("type") ?? "").toLowerCase() === "hidden" ? undefined : "input";
    const role = element.getAttribute("role")?.trim().split(/\s+/u)[0]?.toLowerCase();
    if (role !== undefined && ROLES.has(role)) return `role=${role}`;
    if (element.hasAttribute("onclick") || typeof (element as HTMLElement).onclick === "function") return "onclick";
    if (pressed?.has(element) === true && element !== document.documentElement && element !== document.body) return "press listener";
    return undefined;
  };
  const visible = (element: Element): boolean => {
    if (typeof element.checkVisibility === "function" && !element.checkVisibility({ checkVisibilityCSS: true })) return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.right + window.scrollX > 0 && box.bottom + window.scrollY > 0;
  };
  const delegates = (element: Element): boolean => [...element.querySelectorAll("*")].some((inside) => why(inside) !== undefined);
  const found: Array<{ element: Element; why: string }> = [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const element of root.querySelectorAll("*")) {
      const reason = why(element);
      if (reason !== undefined && visible(element) && !(reason === "press listener" && delegates(element))) found.push({ element, why: reason });
      if (element.shadowRoot) walk(element.shadowRoot);
    }
  };
  walk(document);
  (window as unknown as { __t229Operables: typeof found }).__t229Operables = found;
  return found.length;
}

/** Names each held element by the packet's handle for it, and says what the page wrote on it. */
function resolveOperables(addresses: Array<[string, string, string[]]>): Operable[] {
  const held = (window as unknown as { __t229Operables: Array<{ element: Element; why: string }> }).__t229Operables;
  const targets = new Map<Element, string>();
  for (const [target, selector, hosts] of addresses) {
    let root: Document | ShadowRoot | null = document;
    for (const host of hosts) root = root?.querySelector(host)?.shadowRoot ?? null;
    let element: Element | null = null;
    try { element = root?.querySelector(selector) ?? null; } catch { element = null; }
    if (element !== null && !targets.has(element)) targets.set(element, target);
  }
  const words = (value: string | null | undefined): string | null => {
    const trimmed = value?.replace(/\s+/gu, " ").trim();
    return trimmed ? trimmed : null;
  };
  return held.map(({ element, why }) => {
    const tag = element.tagName.toLowerCase();
    const type = (element.getAttribute("type") ?? "").toLowerCase();
    const field = tag === "textarea" || tag === "select" || (tag === "input" && !["button", "submit", "reset", "image", "checkbox", "radio", "range", "color", "file"].includes(type));
    const labelled = words(element.getAttribute("aria-label")) ?? words(element.getAttribute("title")) ?? (element.hasAttribute("aria-labelledby") ? "labelledby" : null)
      ?? words([...((element as HTMLInputElement).labels ?? [])].map((label) => label.textContent).join(" "));
    const placeholder = words(element.getAttribute("placeholder"));
    const ownWords = words(element.textContent);
    const imageAlt = words([...element.querySelectorAll("img[alt]")].map((image) => image.getAttribute("alt")).join(" "));
    const imageName = !field && ownWords === null ? words(element.getAttribute("aria-label")) ?? words(element.getAttribute("title")) ?? words(element.getAttribute("alt")) ?? imageAlt : null;
    const form = element.closest("form");
    const role = element.getAttribute("role")?.toLowerCase();
    const nameOrId = [element.getAttribute("name"), element.id].map((value) => value?.toLowerCase());
    const search = field && tag !== "select" && (type === "search" || role === "searchbox"
      || element.closest("search, [role=search]") !== null
      || (form !== null && (/search/iu.test(form.getAttribute("action") ?? "") || form.getAttribute("role") === "search"))
      || nameOrId.some((value) => value === "q" || value === "search"));
    const states: string[] = [];
    const aria = (name: string): string | undefined => element.getAttribute(name)?.trim().toLowerCase();
    if (aria("aria-pressed") === "true") states.push("pressed");
    if (aria("aria-selected") === "true") states.push("selected");
    const current = aria("aria-current");
    if (current !== undefined && current !== "false" && current !== "") states.push("current");
    if (aria("aria-checked") === "true" || (element instanceof HTMLInputElement && (type === "checkbox" || type === "radio") && element.checked)) states.push("checked");
    return {
      target: targets.get(element) ?? null,
      tag,
      why,
      html: element.outerHTML.replace(/\s+/gu, " ").slice(0, 160),
      field,
      bareplaceholder: field && labelled === null ? placeholder : null,
      imageName,
      search,
      states
    };
  });
}

/** The capture, the page view built from it, and every visible operable element the browser knows of. */
async function viewAndOperables(harness: ContentHarness): Promise<{ lines: string[]; operables: Operable[] }> {
  const { page } = harness;
  await page.waitForLoadState("networkidle");
  // The pages stamp their pop-ups on a timer -- the latest at three and a half
  // seconds -- and the oracle and the capture must look at the same page.
  await page.waitForTimeout(4_000);
  await page.evaluate(collectOperables);
  const snapshot = JSON.parse(JSON.stringify(await harness.capture())) as JsonObject;
  const binding = sanitizeWebLlmSnapshotWithBindings(snapshot);
  const addresses: Array<[string, string, string[]]> = [...binding.selectors].map(([target, selector]) => [target, selector, [...(binding.shadowHosts?.get(target) ?? [])]]);
  const operables = await page.evaluate(resolveOperables, addresses);
  return { lines: publishedWebLlmPage(binding.evidence).page.split("\n"), operables };
}

/** Every way the view misses or misreports an operable element, one line each. */
function defects(lines: readonly string[], operables: readonly Operable[]): string[] {
  const byTarget = new Map<string, string>();
  for (const line of lines) {
    const handle = /^(t\d+) /u.exec(line)?.[1];
    if (handle !== undefined) byTarget.set(handle, line);
  }
  const found: string[] = [];
  for (const operable of operables) {
    const about = `${operable.why} ${operable.html}`;
    if (operable.target === null) { found.push(`not in the packet: ${about}`); continue; }
    const line = byTarget.get(operable.target);
    if (line === undefined) { found.push(`no line: ${operable.target} ${about}`); continue; }
    if (/^t\d+ (?:h[1-6] )?"/u.test(line)) { found.push(`shown as text, not as a control: ${line} -- ${about}`); continue; }
    const shape = /^t\d+ (?:h[1-6] )?(\S+)(?: "((?:[^"\\]|\\.)*)")?(.*)$/u.exec(line);
    const kind = shape?.[1] ?? "";
    const quoted = shape?.[2];
    const rest = shape?.[3] ?? "";
    if (operable.field && quoted !== undefined && !/[\p{L}\p{N}]/u.test(quoted)) found.push(`a field named by a glyph: ${line} -- ${about}`);
    if (operable.bareplaceholder !== null) {
      if (quoted === operable.bareplaceholder) found.push(`a placeholder printed as the name: ${line}`);
      if (!rest.includes(`placeholder "${operable.bareplaceholder.replace(/"/gu, "\\\"")}"`)) found.push(`no placeholder token: ${line}`);
    }
    if (operable.search && kind !== "field[search]") found.push(`a search box not marked field[search]: ${line}`);
    if (operable.imageName !== null && quoted === undefined) found.push(`an image-only control without its name "${operable.imageName}": ${line}`);
    for (const state of operable.states) {
      if (!new RegExp(`(?:^| )${state}(?: |$)`, "u").test(rest)) found.push(`state ${state} not shown: ${line}`);
    }
  }
  return found;
}

/** The view's lines for a set of handles, for a failure message or a report. */
function linesFor(lines: readonly string[], pattern: RegExp): string[] {
  return lines.filter((line) => pattern.test(line));
}

for (const scenario of REALISTIC_SCENARIOS) {
  test(`${scenario} start page: every visible control has a line, named, with its state`, async ({ openHarness, page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(watchPressListeners, PRESS_EVENTS);
    const harness = await openHarness(scenario);
    const { lines, operables } = await viewAndOperables(harness);
    expect(operables.length, "the oracle found the page's controls").toBeGreaterThan(0);
    expect(defects(lines, operables), lines.join("\n")).toEqual([]);
  });
}

test("crossborder item page: swatches, option chips and the quantity box are in the view, named, with their state", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(watchPressListeners, PRESS_EVENTS);
  const harness = await openHarness("crossborder-marketplace");
  await page.goto(new URL("/scenarios/crossborder-marketplace/item/1005008118832", harness.lab.origin).href);
  const { lines, operables } = await viewAndOperables(harness);
  await writeFile(test.info().outputPath("crossborder-item-view.txt"), lines.join("\n"));
  expect(defects(lines, operables), lines.join("\n")).toEqual([]);
  expect(linesFor(lines, /field[^ ]* "−"/u), "the quantity box is not named after the minus beside it").toEqual([]);
});

test("crossborder home: the search box is a search field with its placeholder apart, and its magnifier is a control", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(watchPressListeners, PRESS_EVENTS);
  const harness = await openHarness("crossborder-marketplace");
  const { lines } = await viewAndOperables(harness);
  // Kept beside the run's other output, so the lines a report quotes are the lines this run saw.
  await writeFile(test.info().outputPath("crossborder-home-view.txt"), lines.join("\n"));
  const search = lines.findIndex((line) => / field\[search\] placeholder "Autumn Mega Sale: up to 70% off"/u.test(line));
  expect(search, lines.join("\n")).toBeGreaterThanOrEqual(0);
  // Covered, after four seconds, by the welcome-coupon modal the page stamps at two.
  expect(lines[search + 1], "the magnifier follows the search box, a control without words").toMatch(/^t\d+ clickable(?: covered-by \S+)?$/u);
  for (const answer of ["Manage choices", "Reject non-essential", "Accept all"]) {
    expect(linesFor(lines, new RegExp(`^t\\d+ clickable "${answer}"`, "u")), answer).toHaveLength(1);
  }
});
