import assert from "node:assert/strict";
import test from "node:test";
import { loadScenarioCatalog, selectionRules } from "../index.js";

const catalog = await loadScenarioCatalog();
const registeredIds = new Set(catalog.map(({ id }) => id));
const registeredTags = new Set(catalog.flatMap(({ tags }) => tags));

test("every scenario a rule names is registered", () => {
  for (const rule of selectionRules) {
    if (rule.scenarios === undefined || rule.scenarios === "all") continue;
    for (const id of rule.scenarios) assert.ok(registeredIds.has(id), `${rule.name} names unregistered scenario "${id}"`);
  }
});

test("every tag a rule selects by is carried by a registered manifest", () => {
  for (const rule of selectionRules) {
    for (const tag of rule.tags ?? []) assert.ok(registeredTags.has(tag), `${rule.name} selects by "${tag}", which no registered manifest carries`);
  }
});
