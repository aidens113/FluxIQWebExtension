// The one named seam, and the mount over it. While the parts messages have not landed there is no library, and
// nothing asks the background for one.

import assert from "node:assert/strict";
import test from "node:test";
import { createFakeSubflowLibraryPort, withFakeDocument } from "@fluxiq/ui-components/testing";
import type { PanelMessage, PanelStore } from "../../state";
import { createExtensionLibrary, extensionLibraryPort } from "../index";

const host = { askAbout: () => undefined };

test("while the library has not landed the build has no port, and nothing is sent", () => {
  const sent: PanelMessage[] = [];
  const request = (async (message: PanelMessage) => {
    sent.push(message);
    return { ok: false, sentence: "no" };
  }) as PanelStore["request"];
  assert.equal(extensionLibraryPort(request), undefined);
  assert.equal(createExtensionLibrary(request, undefined, host), undefined);
  assert.deepEqual(sent, []);
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
