// The run-artifact screen for a created Flow's authored parameters: what may be
// written into `snapshots/flow-lane.json`, which is narrower than what the
// model is shown.
//
// **Why the Lab has a screen of its own again.** Until 2026-09-30 the artifact
// used Core's `automationStudioScreenedNodeParameters` and nothing else, because
// Core's screen was then also the artifact's envelope: an absolute URL reduced
// to its origin, a string carried only under one of Core's own words for what
// it is, and every container bounded. Core's t200 (`711eab8c`, "the model sees
// the whole page", by the user's order that no limit hide page information from
// the model) rightly removed all of that from what the *model* sees. The
// artifact inherited the change: a navigation's path and query -- where an
// order number, a search term and a session token live -- and any free text a
// Flow was authored with (what it types, what it compares a cell to) started to
// land in run bundles. Run artifacts must not carry recorded page data or a
// value a person or a page supplied (AGENTS.md), and the contract this record
// is written against says so (`AuthoredFlowNode`: "never page text, never a
// value a person or a page supplied").
//
// So the two screens are composed, never merged: Core's runs first and keeps
// every decision it makes -- secrets, secret-named keys, locators and denied
// keys -- and this one then holds what survived to the artifact's envelope.
// Nothing here widens Core's screen, and nothing here changes what the model
// sees: this file writes artifacts only.
//
// **What the artifact carries.** Numbers, booleans and null; an absolute
// http(s) URL as its origin, the rest of it named as withheld; and a string of
// at most 80 characters only under a key that is one of the closed words below
// -- a classifier (`mode`, `kind`, ...) at any depth, or a naming or comparand
// key at the first two levels. Everything else is `null` with its path named.
// Containers keep the old bounds: three levels, twelve keys an object (a key
// past them is named), six list items beside the list's `count`, and sixteen
// withheld paths a node.

import { automationStudioEvidenceKey } from "fluxiq/automation-studio";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

/** What a screen produced: the values it carried and the dotted path of each value it would not. */
export type CreatedFlowScreenedParameters = { values: JsonObject; withheld: string[] };

const MAX_DEPTH = 3;
const MAX_KEYS_PER_OBJECT = 12;
const MAX_ITEMS_PER_LIST = 6;
const MAX_TEXT_LENGTH = 80;
const MAX_WITHHELD_PATHS = 16;
/** How many object levels a naming or comparand key may sit under and still be the definition's own word. */
const MAX_NAMED_KEY_DEPTH = 1;

/** Keys whose value is a closed word the definition declares: carried at any depth. */
const CLASSIFIER_KEYS: ReadonlySet<string> = new Set(["kind", "mode", "op", "operator", "is", "role", "implicitrole", "tagname", "status", "type", "unit", "handling"]);
/** Keys that name a control or a column, near the top of a node's parameters. */
const NAMING_KEYS: ReadonlySet<string> = new Set(["label", "name", "title", "caption", "heading", "placeholder", "arialabel", "accessiblename", "visibletext", "key", "field", "fieldid", "column", "columnid", "read"]);
/** Keys whose value a step compares against, near the top of a node's parameters. */
const COMPARAND_KEYS: ReadonlySet<string> = new Set(["equals", "matches", "contains", "startswith", "endswith", "expected"]);

/** The origin of an absolute http(s) URL, matched rather than parsed so nothing is thrown. */
const URL_ORIGIN = /^(https?:\/\/[A-Za-z0-9._~-]+(?::\d{1,5})?)(?=[/?#]|$)/u;
const ABSOLUTE_URL = /^https?:\/\//iu;

type Walk = { coreWithheld: ReadonlySet<string>; withheld: string[] };

/**
 * Holds Core's screened parameters to the artifact's envelope. `authored` is the
 * node's parameters as the Flow wrote them, read only to align list items with
 * Core's (which drops a withheld scalar item from `items`), so a path this
 * screen names is the authored position.
 */
export function createdFlowArtifactScreen(authored: JsonObject, core: CreatedFlowScreenedParameters): CreatedFlowScreenedParameters {
  const walk: Walk = { coreWithheld: new Set(core.withheld), withheld: [...core.withheld] };
  const values = screenedObject(authored, core.values, "", 0, 0, walk);
  return { values, withheld: walk.withheld.slice(0, MAX_WITHHELD_PATHS) };
}

function screenedObject(authored: JsonObject, core: JsonObject, prefix: string, depth: number, nameDepth: number, walk: Walk): JsonObject {
  const screened: JsonObject = {};
  let kept = 0;
  for (const [key, authoredValue] of Object.entries(authored)) {
    // A key Core dropped (denied, or a target key) stays dropped; Core named it.
    if (!Object.prototype.hasOwnProperty.call(core, key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (kept >= MAX_KEYS_PER_OBJECT) {
      note(walk, path);
      continue;
    }
    kept += 1;
    screened[key] = screenedValue(key, authoredValue, core[key] ?? null, path, depth, nameDepth, walk);
  }
  return screened;
}

function screenedValue(key: string, authored: JsonValue, core: JsonValue, path: string, depth: number, nameDepth: number, walk: Walk): JsonValue {
  if (core === null || typeof core === "boolean" || typeof core === "number") return core;
  if (typeof core === "string") return screenedText(key, core, path, nameDepth, walk);
  if (depth >= MAX_DEPTH) {
    note(walk, path);
    return null;
  }
  if (Array.isArray(authored) && isObject(core)) return screenedList(key, authored, core, path, depth + 1, nameDepth, walk);
  if (isObject(authored) && isObject(core)) return screenedObject(authored, core, path, depth + 1, nameDepth + 1, walk);
  // Core produced a shape the authored value cannot have given; carry nothing.
  note(walk, path);
  return null;
}

/**
 * Core writes a list as `{ count, items }`, with a withheld scalar item left out
 * of `items`. The authored list says which items those were, so each surviving
 * item is screened at its own authored index. A list spends a level of depth
 * but not of naming: an author cannot key a list.
 */
function screenedList(key: string, authored: JsonValue[], core: JsonObject, path: string, depth: number, nameDepth: number, walk: Walk): JsonObject {
  const coreItems = Array.isArray(core.items) ? core.items : [];
  const items: JsonValue[] = [];
  let next = 0;
  authored.forEach((item, index) => {
    const itemPath = `${path}.${index}`;
    if (!keptByCore(item, itemPath, walk)) return;
    const coreItem = coreItems[next] ?? null;
    next += 1;
    if (items.length >= MAX_ITEMS_PER_LIST) return;
    items.push(isObject(item) && isObject(coreItem)
      ? screenedObject(item, coreItem, itemPath, depth, nameDepth, walk)
      : screenedValue(key, item, coreItem, itemPath, depth, nameDepth, walk));
  });
  return { count: typeof core.count === "number" ? core.count : authored.length, ...(items.length ? { items } : {}) };
}

/** Whether Core kept a list item in `items`: it leaves out a scalar it withheld, or a number that is not finite. */
function keptByCore(item: JsonValue, path: string, walk: Walk): boolean {
  if (typeof item === "string") return !walk.coreWithheld.has(path);
  if (typeof item === "number") return Number.isFinite(item);
  return true;
}

function screenedText(key: string, value: string, path: string, nameDepth: number, walk: Walk): JsonValue {
  const origin = URL_ORIGIN.exec(value)?.[1];
  if (origin !== undefined) {
    // Carried as the site, not the page: a URL that was already bare is not
    // named, because nothing was dropped from it.
    if (value !== origin && value !== `${origin}/`) note(walk, path);
    return origin;
  }
  if (ABSOLUTE_URL.test(value) || value.length > MAX_TEXT_LENGTH || !vocabularyKey(key, nameDepth)) {
    note(walk, path);
    return null;
  }
  return value;
}

function vocabularyKey(key: string, nameDepth: number): boolean {
  const normalized = automationStudioEvidenceKey(key);
  if (CLASSIFIER_KEYS.has(normalized)) return true;
  if (nameDepth > MAX_NAMED_KEY_DEPTH) return false;
  return NAMING_KEYS.has(normalized) || COMPARAND_KEYS.has(normalized);
}

function isObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function note(walk: Walk, path: string): void {
  if (path && !walk.withheld.includes(path)) walk.withheld.push(path);
}
