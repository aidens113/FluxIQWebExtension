// Three saves of three jobs, each undone once, through the real content-script
// and page-world bundles on job-board and the domain runtime a build explores
// with (T2 harness: no background worker, no Core, no model) -- rerun round 6
// slot 2 (`run-mvrj7qg9-b6dc94f6`) and t772 w11's two defects, fixed in t778.
//
// - **One subject for every save.** The heart on a job's pane sits beside the
//   employer's "Apply on company site" link, and the save's subject was read
//   from that link, so all three saves declared one subject. Each now declares
//   its own job's title, the same words its row on My jobs is about
//   (`identity/control-bar.ts`). The oracle is what the permission check is
//   told: the save's subject token, and the unsave's for the same job.
// - **An undo pressed twice.** My jobs commits an Unsave on the server,
//   repaints the heart and keeps the row until the page loads again, and its
//   notice still reads "Removed from saved jobs" from the undo before. The
//   domain read "nothing changed" as "it did not happen" and pressed Unsave a
//   second time, which saved the job again (t513). A lasting press is now
//   never made again on the domain's look (`press-effect/repeat-press.ts`).
//   The oracle is the page's own traffic -- one unsave request per undo and no
//   save -- and the board's stored saved list, then the list as it loads again.

import type { JsonObject } from "fluxiq/core";
import type { AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import { createWebAutomationLlmEvidenceRuntime, type WebLlmEvidenceGateway } from "@fluxiq-web-extension/domain";
import { postingById } from "../../../../../../scenario-lab/src/scenarios/job-board/catalog/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const ROOT = "/scenarios/job-board/";
/** The task's three jobs (slot 2: Quillmark's remote UK roles). */
const JOBS = ["m1", "d12", "g5"].map((id) => postingById(id)!);

async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

type Declared = { lasting: boolean; subject: string | undefined };

/** The domain runtime over the harness's page, as a build's exploration runs it, with every declaration Core would be asked about. */
function explorer(harness: ContentHarness) {
  let command = 0;
  const declared: Declared[] = [];
  const clicks: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["job.browser"],
    executeAction: async (_session, request) => {
      if (request.actionType === "web.dom.click") clicks.push(String((request.parameters as { selector?: string }).selector));
      const reply = await harness.runAction({ commandId: `job.${++command}`, actionType: request.actionType, ...request.parameters } as Parameters<typeof harness.runAction>[0]);
      return {
        status: reply.status,
        payload: { sourceId: "tab:1:frame:0", ...(reply.snapshot ? { snapshot: JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject } : {}) },
        ...(reply.failure ? { failure: JSON.parse(JSON.stringify(reply.failure)) as JsonObject } : {})
      } as Awaited<ReturnType<WebLlmEvidenceGateway["executeAction"]>>;
    }
  };
  const permission: AutomationStudioActionPermissionCheck = async (declaration) => {
    declared.push({ lasting: declaration.consequences.length > 0, subject: declaration.control.subject });
    return { permitted: true };
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const request = { projectId: "job", flowId: "job", permission };
  const look = async (): Promise<string> => {
    const shown = await runtime.executeTool({ ...request, callId: `look.${++command}`, toolId: "core.run_node", value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
    return String((shown.evidence as JsonObject).page);
  };
  const press = async (handle: string): Promise<JsonObject> => {
    const result = await runtime.executeTool({ ...request, callId: `press.${++command}`, toolId: "core.run_node", value: { node: "web.output.dom-click", parameters: { target: { handle } }, consequences: ["modify_existing"] } });
    expect((result.evidence as JsonObject).ok, JSON.stringify(result.evidence).slice(0, 600)).toBe(true);
    return result.evidence as JsonObject;
  };
  return { look, press, declared, clicks };
}

/** The handle of the one line of `page` that `matches`, failing with the page's lines where there is not exactly one. */
function handleOn(page: string, matches: (line: string) => boolean, what: string): string {
  const lines = page.split("\n").filter((line) => /^t\d+ /u.test(line.trim()) && matches(line));
  expect(lines, `${what}: one line of\n${page}`).toHaveLength(1);
  return lines[0]!.trim().split(" ")[0]!;
}

test("three jobs saved from their own pages declare three subjects, and each Unsave on My jobs is pressed once", async ({ openHarness, page }) => {
  test.setTimeout(180_000);
  const harness = await openHarness("job-board");
  await apply(harness, "consent", { choice: "accepted" });
  await apply(harness, "dismiss-wall");
  await apply(harness, "dismiss-alert-offer");
  const traffic: string[] = [];
  await page.route(`**/api/${harness.scenarioId}/*`, async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").pop()!;
    if (operation === "save" || operation === "unsave") traffic.push(operation);
    await route.continue();
  });
  const explore = explorer(harness);
  const before = ((await harness.finalState()).state as { saved: string[] }).saved;

  // Save each job from its own page, by the heart beside "Apply on company site".
  for (const job of JOBS) {
    await page.goto(new URL(`${ROOT}viewjob?jk=${job.key}`, harness.lab.origin).href, { waitUntil: "load" });
    await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
    const view = await explore.look();
    const apply = view.split("\n").findIndex((line) => line.includes("Apply on company site"));
    expect(apply, `the pane's apply link on\n${view}`).toBeGreaterThan(-1);
    // The heart is the control drawn right after the apply link in the pane's actions.
    const heart = view.split("\n").slice(apply + 1).find((line) => /^t\d+ /u.test(line.trim()));
    expect(heart, `the heart after the apply link on\n${view}`).toBeTruthy();
    await explore.press(heart!.trim().split(" ")[0]!);
    await expect.poll(async () => ((await harness.finalState()).state as { saved: string[] }).saved.includes(job.key), { timeout: 15_000 }).toBe(true);
  }
  const saves = explore.declared.filter((entry) => entry.lasting);
  const saveSubjects = [...new Set(saves.map((entry) => entry.subject))];
  expect(saveSubjects.every((subject) => subject !== undefined), JSON.stringify(saves)).toBe(true);
  expect(saveSubjects, "one subject per job saved").toHaveLength(JOBS.length);

  // Undo each from My jobs, one after another, while the list keeps its rows.
  await page.goto(new URL(`${ROOT}myjobs`, harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  traffic.length = 0;
  const firstUnsave = explore.declared.length;
  const answers: JsonObject[] = [];
  for (const job of JOBS) {
    const view = await explore.look();
    const row = view.split("\n").findIndex((line) => line.includes(job.title) && line.includes("link"));
    expect(row, `${job.title}'s row on\n${view}`).toBeGreaterThan(-1);
    const unsave = view.split("\n").slice(row + 1).find((line) => line.includes("Unsave job"));
    expect(unsave, `${job.title}'s Unsave on\n${view}`).toBeTruthy();
    answers.push(await explore.press(unsave!.trim().split(" ")[0]!));
  }
  console.log(JSON.stringify(answers.map((answer) => ({ status: answer.status, pressedAgain: answer.pressedAgain, effectUncertain: answer.effectUncertain !== undefined, changed: answer.changed }))));
  expect(answers.every((answer) => answer.pressedAgain === undefined), "no Unsave was pressed a second time").toBe(true);
  expect(traffic, "the page's own requests: one unsave per undo, and no save").toEqual(JOBS.map(() => "unsave"));
  expect(((await harness.finalState()).state as { saved: string[] }).saved).toEqual(before);
  // Each unsave is about the job its save was about.
  const unsaveSubjects = explore.declared.slice(firstUnsave).filter((entry) => entry.lasting).map((entry) => entry.subject);
  expect(unsaveSubjects).toEqual(saveSubjects);

  // The list draws the removals only once it loads again.
  await page.reload({ waitUntil: "load" });
  for (const job of JOBS) await expect(page.locator(`li[data-jk="${job.key}"]`)).toHaveCount(0);
  await expect(page.locator("li[data-jk]")).toHaveCount(before.length);
});
