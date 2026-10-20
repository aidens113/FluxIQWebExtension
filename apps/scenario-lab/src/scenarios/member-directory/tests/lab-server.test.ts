import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { filterMembers, rosterFor } from "../filters.js";
import { RECORDED_MEMBER } from "../members.js";
import { memberDirectoryScenario } from "../scenario.js";
import type { MemberDirectoryState } from "../types.js";

/**
 * The directory's server side, driven over HTTP exactly as its client script
 * and the Testing Lab drive it: the edit dialog's and the bulk toolbar's
 * operations, and every variant's arm, through `/api/member-directory/<operation>`,
 * and the oracle through `/__control/final-state`. These replace the
 * server-side halves of the retired browser spec; its browser halves (sticky
 * header and help launcher painting over row buttons, the portalled row menu,
 * the bulk toolbar appearing) are fixture behaviour no browser test may open.
 */

const SCENARIO = "member-directory";
const START = memberDirectoryScenario.startPath;
const manifest = memberDirectoryScenario.manifest;

async function withLab(run: (io: ReturnType<typeof client>) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: "member-directory-lab-server-token", seed: 42 });
  try { await run(client(lab)); } finally { await lab.close(); }
}

function client(lab: RunningScenarioLab) {
  const authorization = `Bearer ${lab.runToken}`;
  return {
    page: async () => (await fetch(`${lab.origin}${START}`)).text(),
    post: async (operation: string, payload: unknown, headers: Record<string, string> = { authorization }) => {
      const response = await fetch(`${lab.origin}/api/${SCENARIO}/${operation}`, {
        method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      if (response.status !== 200) return { status: response.status, mutation: "none" };
      const body = await response.json() as { mutation: { status: string } };
      return { status: response.status, mutation: body.mutation.status };
    },
    arm: async (selection: { workflowId?: string; variantId: string }) => {
      const { variant } = resolveScenarioWorkflow(manifest, selection);
      assert.ok(variant, selection.variantId);
      const response = await fetch(`${lab.origin}/api/${SCENARIO}/${variant.arm.operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(variant.arm.payload ?? {}),
      });
      assert.equal(response.status, 200, `arming ${selection.variantId}`);
    },
    state: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=${SCENARIO}`, { headers: { authorization } });
      assert.equal(response.status, 200);
      return (await response.json() as { state: MemberDirectoryState }).state;
    },
  };
}

test("over HTTP, a mutation without the run token is refused and changes nothing", async () => withLab(async (io) => {
  const promote = { id: RECORDED_MEMBER.id, role: "Admin" };
  assert.equal((await io.post("update-role", promote, {})).status, 401);
  assert.equal((await io.post("update-role", promote, { authorization: "Bearer wrong-token" })).status, 401);
  assert.deepEqual((await io.state()).roles, {});
}));

test("over HTTP, the primary workflow's role change reaches the oracle and the page the next request serves", async () => withLab(async (io) => {
  assert.deepEqual(await io.post("update-role", { id: RECORDED_MEMBER.id, role: "Admin" }), { status: 200, mutation: "changed" });
  const state = await io.state();
  assert.deepEqual([state.mode, state.roles, state.removed, state.oracle], [
    "baseline", { [RECORDED_MEMBER.id]: "Admin" }, [], { memberCount: 240, adminCount: 44, pendingCount: 32 },
  ]);
  assert.match(await io.page(), /data-testid="member-stats">240 members · 44 admins · 32 pending</);
  // A role the workspace does not grant is refused server side, whatever a client posts.
  assert.deepEqual(await io.post("update-role", { id: RECORDED_MEMBER.id, role: "Superuser" }), { status: 200, mutation: "no_change" });
}));

test("over HTTP, the remove-invitations bulk removal empties the pending line", async () => withLab(async (io) => {
  const invited = filterMembers(rosterFor("baseline"), { search: "", role: "", status: "invited" }).map(({ id }) => id);
  assert.equal(invited.length, 32);
  assert.deepEqual(await io.post("remove-members", { ids: invited }), { status: 200, mutation: "changed" });
  const state = await io.state();
  assert.deepEqual(state.oracle, { memberCount: 208, adminCount: 38, pendingCount: 0 });
  assert.deepEqual(state.roles, {});
  assert.deepEqual(await io.post("remove-members", { ids: invited }), { status: 200, mutation: "no_change" }, "a second removal of the same people is no write");
}));

test("over HTTP, each variant's arm is accepted and changes what the next request serves", async () => withLab(async (io) => {
  await io.post("update-role", { id: RECORDED_MEMBER.id, role: "Admin" });
  await io.arm({ variantId: "member-left" });
  const left = await io.state();
  assert.deepEqual([left.mode, left.roles, left.oracle], ["member-left", {}, { memberCount: 239, adminCount: 43, pendingCount: 32 }], "arming clears the earlier run");
  assert.equal((await io.page()).includes(`data-member-id="${RECORDED_MEMBER.id}"`), false);
  assert.equal((await io.post("update-role", { id: RECORDED_MEMBER.id, role: "Admin" })).mutation, "no_change", "a member who left cannot be promoted");

  await io.arm({ workflowId: "remove-invitations", variantId: "support-drawer" });
  assert.match(await io.page(), /data-testid="support-drawer"/);
  assert.deepEqual((await io.state()).oracle, { memberCount: 240, adminCount: 43, pendingCount: 32 });

  await io.arm({ variantId: "restyled" });
  assert.match(await io.page(), /data-testid="build-marker">Meridian Console · build 24\.7\.2</);

  await io.arm({ workflowId: "filter-members", variantId: "sorted-by-activity" });
  assert.match(await io.page(), /data-testid="sort-status">Sorted by Last active</);
  assert.deepEqual(await io.post("set-mode", { mode: "bogus" }), { status: 200, mutation: "no_change" });
}));

test("the toolbar's filters narrow the roster to the counts the console reports", () => {
  const roster = rosterFor("baseline");
  assert.equal(filterMembers(roster, { search: "hollis", role: "", status: "" }).length, 16);
  assert.equal(filterMembers(roster, { search: "hollis", role: "", status: "suspended" }).length, 1);
  assert.equal(filterMembers(roster, { search: "", role: "", status: "" }).length, 240);
});
