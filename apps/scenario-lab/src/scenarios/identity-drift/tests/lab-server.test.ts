import assert from "node:assert/strict";
import test from "node:test";
import { startScenarioLab } from "../../../server.js";
import { identityDriftScenario as scenario } from "../scenario.js";
import type { IdentityDriftState } from "../state.js";

/**
 * The record-then-arm sequence the retired browser spec drove, over HTTP: save
 * in the baseline, arm each variant through the mutation endpoint, and check
 * the oracle and the page the next request serves. Locating the drifted
 * control in a live layout is fixture behaviour no browser test may open.
 */

const workspaceName = "Aurora Field Team";

test("over HTTP, every variant's arm clears the baseline save, serves its drifted page, and records which control was pressed", async () => {
  const lab = await startScenarioLab({ runToken: "identity-drift-lab-server-token", seed: 42 });
  const authorization = `Bearer ${lab.runToken}`;
  const post = async (operation: string, payload: unknown) => {
    const response = await fetch(`${lab.origin}/api/identity-drift/${operation}`, {
      method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    assert.equal(response.status, 200, operation);
    await response.text();
  };
  const state = async () => ((await (await fetch(`${lab.origin}/__control/final-state?scenario=identity-drift`, { headers: { authorization } })).json()) as { state: IdentityDriftState }).state;
  const page = async () => (await fetch(`${lab.origin}${scenario.manifest.startPath}`)).text();
  try {
    await post("save", { displayName: workspaceName });
    assert.deepEqual([(await state()).savedDisplayName, (await state()).savedInMode], [workspaceName, "baseline"]);
    assert.match(await page(), new RegExp(`id="display-name"[^>]*value="${workspaceName}"`), "a reload shows the saved name");

    for (const variant of scenario.manifest.variants ?? []) {
      await post("set-mode", { mode: "baseline" });
      await post("save", { displayName: workspaceName });
      await post(variant.arm.operation, variant.arm.payload);
      const armed = await state();
      assert.deepEqual([armed.mode, armed.savedDisplayName, armed.saveCount, armed.savedInMode], [variant.id, null, 0, null], variant.id);
      const html = await page();
      assert.doesNotMatch(html, /data-testid="save-changes"/, variant.id);
      assert.match(html, /id="display-name"[^>]*value="Workspace 42"/, variant.id);

      const pressed = variant.id === "save-and-exit" ? "save-and-exit" : "save";
      await post(pressed, { displayName: workspaceName });
      const after = await state();
      if (pressed === "save") {
        assert.deepEqual([after.savedDisplayName, after.saveCount, after.savedInMode, after.saveAndExitCount], [workspaceName, 1, variant.id, 0], variant.id);
      } else {
        assert.deepEqual([after.savedDisplayName, after.saveCount, after.savedInMode, after.saveAndExitCount], [null, 0, null, 1], variant.id);
      }
    }

    await post("set-mode", { mode: "renamed-redesign" });
    await post("discard", {});
    const discarded = await state();
    assert.deepEqual([discarded.savedDisplayName, discarded.saveCount, discarded.discardCount, discarded.status], [null, 0, 1, "Changes discarded"]);
  } finally {
    await lab.close();
  }
});
