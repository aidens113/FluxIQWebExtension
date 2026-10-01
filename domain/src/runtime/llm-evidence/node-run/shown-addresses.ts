// Where a build may navigate: only to an address it was shown.
//
// **The problem this closes.** On live run 28 (`run-munvvc3z-3eadc185`,
// bigbox-retail) the build never opened the first instructed product's page:
// its search never reached a results page, and the product is on no home rail.
// It navigated instead to an address it wrote itself -- that product's slug
// with the *second* product's item id. The site routes by the id, so the page
// that opened was the second product, the Flow kept that address as its "first
// product" step, and the goal missed three facts. Crossborder runs 15-19
// navigated seven to eleven times each to search and item addresses the model
// wrote. The origin check (`./run.ts`, `crossOrigin`) passed every one.
//
// **What counts as shown.** Everything below is something this build was
// handed, or a page it stood on:
// - the start location Core carried in for the build;
// - every packet the build was shown (`../tools.ts`, `shown`): the page's
//   location, and every link's href on it with the query the packet shows
//   (`../location.ts`) -- so a page reached by pressing is a page it has been
//   on;
// - every address-shaped string in what a reading node read and returned to the
//   model (an extraction's `url` column), with its query, because the model was
//   shown the query.
//
// **How an address is compared.** By origin, by path with any trailing slash
// dropped, and by the query's keys; the fragment is ignored. Since t200 a
// packet carries a location's and a link's query, with a secret-named value
// withheld (`../location.ts`). A navigation that writes a query is allowed
// only when one of two things holds:
// - a read returned that address, or the page, a link on it or the start
//   location had it, with the same keys and the same values; or
// - it is a site search this build ran itself, again with other words: a page
//   the build stood on had the same path and the same keys, and each value
//   that differs was, on that page, text this build typed. Every other value
//   must be the same. A store id, a sort order or an item id is never a word
//   the build typed, so it cannot be varied this way.
//
// **What is not touched.** Replaying the draft and running a saved Flow go to
// what the step holds (`./replay.ts`), which this rule already let through when
// the step first ran. A build's opening call forgets the last build of the same
// flow, as arrival does (`./arrival.ts`).

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { rejectionDetail, type WebLlmToolRejectionDetail } from "../tool-rejection";
import { webNodeOpensBuild, type WebNodeBuildKey } from "./arrival";
import type { WebRunnableNode } from "./catalog";
import { WEB_NAVIGATION_ACTION } from "./start-location";

/** How many builds are remembered at once, as arrival remembers them. */
const REMEMBERED_BUILDS = 16;
// A build remembers every address it was shown, every text it typed and every
// address a read returned, for as long as the build lasts (a new build of the
// flow forgets them, `opening`). Until 2026-09-30 it kept the newest 512
// addresses, 16 typed texts and the first 256 address strings of a read six
// levels deep. Now that a packet carries the whole page, a page with more links
// than that pushed earlier ones out, and a navigation to a link the model had
// been shown was refused as unshown.
const TYPE_ACTION = "web.dom.type";

/**
 * The two ways to get where the refused navigation meant to go, in this
 * domain's own words and never the page's.
 */
const INSTEAD = [
  'web.output.dom-click with target: {"handle": "tN"} of the link that goes there, from the packet',
  "web.output.browser-navigate with url: an address from the evidence -- a link's href, a page's location, a read's address, or the start location"
];

type Query = ReadonlyArray<readonly [string, string]>;
type Address = { path: string; query: Query };
type BuildMemory = { addresses: Map<string, Address>; typed: string[] };

export type WebNodeShownAddresses = {
  /** Forget what the last build of this flow was shown, when this call opens a new one. */
  opening(build: WebNodeBuildKey, callId: string): void;
  /** A packet this build has been shown. */
  saw(build: WebNodeBuildKey, page: WebLlmSnapshotBinding): void;
  /** A node that ran in this build: what it typed, and what it read and returned. */
  ran(build: WebNodeBuildKey, step: { actionType: string; parameters: JsonObject; read: JsonValue | undefined; location: string | undefined }): void;
  /** Whether this call is a navigation to an address this build was not shown. */
  refuses(build: WebNodeBuildKey, node: WebRunnableNode, parameters: JsonObject, where: { location: string | undefined; startLocation: string | undefined }): boolean;
};

export function createWebNodeShownAddresses(): WebNodeShownAddresses {
  const builds = new Map<string, BuildMemory>();
  const key = (build: WebNodeBuildKey): string => `${build.sessionId}\u0000${build.projectId}\u0000${build.flowId}`;
  const memory = (build: WebNodeBuildKey): BuildMemory => {
    const slot = key(build);
    const found = builds.get(slot) ?? { addresses: new Map<string, Address>(), typed: [] };
    builds.delete(slot);
    builds.set(slot, found);
    for (const oldest of builds.keys()) {
      if (builds.size <= REMEMBERED_BUILDS) break;
      builds.delete(oldest);
    }
    return found;
  };
  return {
    opening(build, callId) {
      if (webNodeOpensBuild(callId)) builds.delete(key(build));
    },
    saw(build, page) {
      const held = memory(build);
      // The page's own query rides with its location: the page is one the build stood on.
      remember(held, parsed(page.evidence.location, undefined), page.pageQuery ?? []);
      // A link's query is shown with it, so it is remembered with it.
      for (const element of page.evidence.elements) {
        if (element.href === undefined) continue;
        const link = parsed(element.href, undefined);
        remember(held, link, link === undefined ? [] : [...link.searchParams]);
      }
    },
    ran(build, step) {
      const held = memory(build);
      const text = step.actionType === TYPE_ACTION ? step.parameters.text : undefined;
      if (typeof text === "string" && normalised(text) !== "") {
        held.typed = [normalised(text), ...held.typed.filter((typed) => typed !== normalised(text))];
      }
      if (step.read === undefined) return;
      for (const written of addressStrings(step.read)) {
        const url = parsed(written, step.location);
        if (url) remember(held, url, [...url.searchParams]);
      }
    },
    refuses(build, node, parameters, where) {
      if (node.actionType !== WEB_NAVIGATION_ACTION || typeof parameters.url !== "string") return false;
      const target = addressOf(parameters.url, where.location ?? where.startLocation);
      // Not an address this rule can read: left to the origin check and the page.
      if (target === undefined) return false;
      const held = memory(build);
      const start = where.startLocation === undefined ? undefined : parsed(where.startLocation, undefined);
      const known = [...held.addresses.values()];
      if (start) known.push({ path: pathKey(start), query: [...start.searchParams] });
      return !known.some((shown) => shown.path === target.path && sameQuery(shown.query, target.query, held.typed));
    }
  };
}

/** The refusal for a navigation to an address this build was not shown. */
export function webUnshownAddressRefusal(startLocation: string | undefined): WebLlmToolRejectionDetail {
  return rejectionDetail({ reason: "address_not_shown", instead: INSTEAD, startLocation });
}

/** Keep an address for the rest of the build. */
function remember(held: BuildMemory, url: URL | undefined, query: Query): void {
  if (url === undefined) return;
  const address: Address = { path: pathKey(url), query: [...query] };
  held.addresses.set(`${address.path}?${JSON.stringify(address.query)}`, address);
}

/**
 * Whether a navigation's query is the shown one: no query where none was
 * written, and otherwise the same keys, each value the same or, where it
 * differs, one that was text this build typed.
 *
 * A navigation with no query matches any address on its path, because the path
 * alone is what a packet shows.
 */
function sameQuery(shown: Query, target: Query, typed: readonly string[]): boolean {
  if (target.length === 0) return true;
  if (shown.length !== target.length) return false;
  const order = (query: Query) => [...query].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const was = order(shown);
  const now = order(target);
  return was.every(([key, value], index) => {
    const [targetKey, targetValue] = now[index]!;
    return key === targetKey && (value === targetValue || typed.includes(normalised(value)));
  });
}

/** A navigation's destination as this rule compares it, or nothing when it is not an address it reads. */
function addressOf(written: string, base: string | undefined): Address | undefined {
  const url = parsed(written, base);
  return url === undefined ? undefined : { path: pathKey(url), query: [...url.searchParams] };
}

/**
 * An HTTP(S) address, absolute or written from the site's root, or nothing.
 *
 * Only these two shapes: a bare word would resolve against any page into an
 * address of it, which would make this rule judge a string that was never an
 * address at all.
 */
function parsed(written: string, base: string | undefined): URL | undefined {
  if (!/^https?:\/\//iu.test(written) && !(written.startsWith("/") && !written.startsWith("//"))) return undefined;
  try {
    const url = new URL(written, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch (error) {
    // A string that does not parse as an address is not an address; anything else is a fault.
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

/** Origin and path, a trailing slash dropped, so `/store/` and `/store` are one place. */
function pathKey(url: URL): string {
  return `${url.origin}${url.pathname.replace(/\/+$/u, "") || "/"}`;
}

/** Text as it is compared with a query value: case, spacing and the ends ignored. */
function normalised(text: string): string {
  return text.replace(/\s+/gu, " ").trim().toLowerCase();
}

/**
 * Every string of a read that could be an address, at any depth. Walked with a
 * stack rather than by recursion, so a deeply nested read cannot overflow it.
 */
function addressStrings(value: JsonValue): string[] {
  const found: string[] = [];
  const pending: JsonValue[] = [value];
  while (pending.length > 0) {
    const entry = pending.pop()!;
    if (entry === null) continue;
    if (typeof entry === "string") {
      if (entry.startsWith("/") || /^https?:\/\//iu.test(entry)) found.push(entry);
      continue;
    }
    if (typeof entry !== "object") continue;
    for (const child of Array.isArray(entry) ? entry : Object.values(entry)) pending.push(child as JsonValue);
  }
  return found;
}
