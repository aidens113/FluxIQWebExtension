// The library's port for this build, and the mount over it.

import assert from "node:assert/strict";
import test from "node:test";
import { createFakeSubflowLibraryPort, withFakeDocument } from "@fluxiq/ui-components/testing";
import type { PanelMessage, PanelStore } from "../../state";
import { createExtensionLibrary, extensionLibraryPort } from "../index";

const host = { askAbout: () => undefined };

test("the build has a port, and it asks the background for the library's parts", async () => {
  const sent: PanelMessage[] = [];
  const request = (async (message: PanelMessage) => {
    sent.push(message);
    return { ok: false, sentence: "no" };
  }) as PanelStore["request"];
  const port = extensionLibraryPort(request);
  await port.list({ projectId: "p1" });
  assert.deepEqual(sent, [{ type: "fluxiq.panel.listParts", projectId: "p1" }]);
});

test("a port the caller has mounts the library screen", async () => {
  await withFakeDocument(() => {
    const screen = createExtensionLibrary((async () => ({ ok: false, sentence: "no" })) as PanelStore["request"], createFakeSubflowLibraryPort(), host);
    assert.ok(screen);
    assert.equal(typeof screen.render, "function");
    assert.equal(typeof screen.search, "function");
    assert.equal(typeof screen.setActive, "function");
    assert.equal(typeof screen.onMatches, "function");
  });
});
