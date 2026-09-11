import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { recordingEventTypeForKind, recordingEventTypesByKind, UNKNOWN_KIND_EVENT_TYPE } from "../recording-event-types.js";

// dist/run-expectations/tests -> repository root, independent of the working directory.
const repositoryRoot = new URL("../../../../../", import.meta.url);

test("mirrors the domain's client-kind to recording-event-type mapping exactly", async () => {
  const constants = await readFile(new URL("domain/src/constants.ts", repositoryRoot), "utf8");
  const model = await readFile(new URL("domain/src/io/input-model.ts", repositoryRoot), "utf8");
  const eventsStart = constants.indexOf("WEB_AUTOMATION_EVENTS = {");
  assert.ok(eventsStart >= 0, "domain/src/constants.ts no longer declares WEB_AUTOMATION_EVENTS; update this mirror");
  const events = Object.fromEntries([...constants.slice(eventsStart, constants.indexOf("}", eventsStart)).matchAll(/(\w+): "([^"]+)"/gu)].map((match) => [match[1]!, match[2]!]));
  const start = model.indexOf("export function webAutomationEventTypeForClientKind");
  assert.ok(start >= 0, "domain/src/io/input-model.ts no longer defines webAutomationEventTypeForClientKind; update this mirror");
  const body = model.slice(start, model.indexOf("\n}", start));
  const domain = Object.fromEntries([...body.matchAll(/kind === "([^"]+)"\) return WEB_AUTOMATION_EVENTS\.(\w+);/gu)].map((match) => [match[1]!, events[match[2]!]]));
  assert.ok(Object.keys(domain).length > 0, "found no kind mappings in the domain function; update this mirror's parser");
  assert.deepEqual({ ...recordingEventTypesByKind }, domain);
  const fallback = /\n\s*return WEB_AUTOMATION_EVENTS\.(\w+);\s*$/u.exec(body);
  assert.equal(fallback ? events[fallback[1]!] : undefined, UNKNOWN_KIND_EVENT_TYPE);
});

test("maps recorded kinds and falls back for unknown ones", () => {
  assert.equal(recordingEventTypeForKind("dom.change"), "web.element.changed");
  assert.equal(recordingEventTypeForKind("dom.hover"), "web.client.error");
});
