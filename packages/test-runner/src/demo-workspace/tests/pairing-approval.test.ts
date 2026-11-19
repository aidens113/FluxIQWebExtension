import assert from "node:assert/strict";
import test from "node:test";
import { approvePairingInPanel } from "../panel-navigation.js";

test("the ordinary pairing dialog confirms the matching browser without a second password", async () => {
  const actions: string[] = [];
  const dialog = {
    waitFor: async (options: { state: string }) => { actions.push(options.state); },
    isVisible: async () => true,
    getByText: (code: string) => {
      assert.equal(code, "123-456");
      return { isVisible: async () => true };
    },
    getByRole: (_role: string, options: { name: string; exact?: boolean }) => {
      assert.equal(options.name, "Confirm");
      assert.equal(options.exact, true);
      return { click: async () => { actions.push("approved"); } };
    },
    locator: () => { assert.fail("Pairing must not query a password field"); }
  };
  const page = {
    bringToFront: async () => undefined,
    getByRole: (_role: string, options: { name: string }) => {
      assert.equal(options.name, "A browser or app wants to connect");
      return dialog;
    }
  } as unknown as Parameters<typeof approvePairingInPanel>[0];
  const evidence = { step: async (_surface: string, _id: string, _description: string, run: () => Promise<void>) => run() } as unknown as Parameters<typeof approvePairingInPanel>[2];
  await approvePairingInPanel(page, "123-456", evidence);
  assert.deepEqual(actions, ["visible", "approved", "hidden"]);
});
