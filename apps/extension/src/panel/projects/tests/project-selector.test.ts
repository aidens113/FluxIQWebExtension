// The header's switcher names the current project from the first status, and reads the name from the
// list when the status carries only the id.

import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectsPort } from "@fluxiq/ui-components";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelStore } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { createProjectSelector } from "../project-selector";

const request = (async () => ({ ok: true, value: {} })) as unknown as PanelStore["request"];

test("the status's project name shows at once, with no list read", async () => {
  await withFakeDocument(async () => {
    let reads = 0;
    const port: ProjectsPort = {
      async list() {
        reads += 1;
        return [];
      }
    };
    const selector = createProjectSelector(request, port, { openAll: () => {} });
    selector.render(statusWith({ projectId: "p1", projectName: "Alpha" }));
    assert.match(fake(selector.element).textContent, /Alpha/u);
    assert.equal(reads, 0);
  });
});

test("an id without a name is named from the list", async () => {
  await withFakeDocument(async () => {
    const port: ProjectsPort = {
      async list() {
        return [{ id: "p1", name: "Alpha" }];
      }
    };
    const selector = createProjectSelector(request, port, { openAll: () => {} });
    selector.render(statusWith({ projectId: "p1" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(fake(selector.element).textContent, /Alpha/u);
  });
});

test("a later status that names only the id keeps the name already shown, never falling back to Project", async () => {
  await withFakeDocument(async () => {
    let reads = 0;
    const port: ProjectsPort = {
      async list() {
        reads += 1;
        return [];
      }
    };
    const selector = createProjectSelector(request, port, { openAll: () => {} });
    selector.render(statusWith({ projectId: "p1", projectName: "Alpha" }));
    selector.render(statusWith({ projectId: "p1" }));
    assert.match(fake(selector.element).textContent, /Alpha/u);
    assert.doesNotMatch(fake(selector.element).textContent, /Project\b/u);
    assert.equal(reads, 0);
  });
});
