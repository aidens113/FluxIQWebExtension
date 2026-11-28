// The switcher's port asks the background for the list, keeps only well-formed
// projects, and rejects with the sentence a person reads when the background refuses.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelStore } from "../../state";
import { extensionProjectsPort } from "../extension-projects-port";

function requesting(reply: unknown) {
  const sent: Array<{ type: string; [key: string]: unknown }> = [];
  const request = (async (message: { type: string }) => {
    sent.push(message);
    return reply;
  }) as unknown as PanelStore["request"];
  return { sent, request };
}

test("list asks for the projects and keeps the well-formed ones", async () => {
  const { sent, request } = requesting({ ok: true, value: { ok: true, selectedProjectId: "a", projects: [{ id: "a", name: "Alpha", updatedAt: "2026-11-16T00:00:00Z" }, { id: "", name: "x" }, { id: "b", name: "Beta" }, null, { id: 3, name: "n" }] } });
  const projects = await extensionProjectsPort(request).list();
  assert.deepEqual(sent, [{ type: RUNTIME_MESSAGES.panelListProjects }]);
  assert.deepEqual(projects, [{ id: "a", name: "Alpha", updatedAt: "2026-11-16T00:00:00Z" }, { id: "b", name: "Beta" }]);
});

test("the port offers no create: projects are made by FluxIQ and managed in the FluxIQ panel", () => {
  const port = extensionProjectsPort(requesting({ ok: true, value: {} }).request);
  assert.equal("create" in port, false);
});

test("a refusal rejects with its sentence, and an unreadable reply with a plain one", async () => {
  await assert.rejects(extensionProjectsPort(requesting({ ok: false, sentence: "FluxIQ refused that." }).request).list(), /FluxIQ refused that\./u);
  await assert.rejects(extensionProjectsPort(requesting({ ok: true, value: { ok: true } }).request).list(), /could not be read/u);
});
