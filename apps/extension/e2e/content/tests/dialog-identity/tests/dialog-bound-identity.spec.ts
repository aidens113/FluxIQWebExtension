// A saved control is never accepted on a look-alike in another dialog (t469),
// on social-network-feed through the real content-script bundle (T2 harness:
// no background worker, no Core, no model). The oracle is the Scenario Lab's
// own server state.
//
// Lane D round 8 (`run-mv5jnc5m-a47c3e59`, playback step 0062): a step saved on
// the chat panel's "Close chat" close button was replayed after the chat had
// gone, with the notifications prompt up. The prompt's own close button agrees
// with it on the tag, the role, the classes and the ✕ exactly; it scored 0.729
// against a runner-up of 0.113 and was pressed, dismissing the prompt (t465's
// headed replay). Nothing in the saved fingerprint said "in the chat panel".
//
// The rows:
//
// - capture: with the chat panel and the prompt both up, each close button's
//   descriptor carries the name of its own dialog;
// - both up: the saved Close chat, replayed after a reload drew both dialogs
//   again (fresh ids, fresh nodes), resolves to the chat's close button and
//   presses nothing in the prompt;
// - a re-rendered dialog: the saved Close chat, replayed after a reload drew
//   the chat panel again, closes it;
// - another dialog: the saved Close chat, replayed with the chat gone and the
//   prompt up, is refused and the prompt is still pending -- by the recorded
//   selector, and by the selector step 0062 carried. The second row ends with
//   its control: the same replay without the dialog presses the prompt's close
//   button, as the run did, so it is the dialog that refused;
// - a model-built step: the chat's close button as the build saves it -- the
//   content script's own snapshot read through the domain's evidence runtime,
//   the model's handle resolved into the step's parameters, each dispatch
//   through Core's normalizer and the gateway mapping -- is refused on the
//   prompt's close button once the chat is gone, and closes the chat drawn
//   again.
//
// The site never has both dialogs up at once on its own: it asks about
// notifications only once the cookie question is answered, and opens the chat
// only once that is answered. So the rows that need both read the prompt's
// markup off the page while it is up and mount it over the site's own chat
// panel (`bothDialogsUp`). The rows that press anything press the site's own,
// wired dialogs, and read the server's state.

import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputNodeId } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { TARGET_NOT_FOUND, describe, recordedElement, type Descriptor } from "../../identity-fixtures.js";

type FeedState = { notificationsPrompt: "pending" | "dismissed" | "allowed"; chat: "unopened" | "open" | "closed" };

const ROOT = "/scenarios/social-network-feed/";
const PAGE = `${ROOT}friends/requests/`;
const CHAT = "Chat with Elena Sokolova";
const PROMPT = "Turn on notifications?";
const CLOSE_CHAT = `[role="dialog"][aria-label="${CHAT}"] [role="button"][aria-label="Close chat"]`;
const PROMPT_CLOSE = '[role="dialog"][aria-modal="true"] [role="button"][aria-label="Close"]';
/** The selector step 0062 carried: written while the chat was the page's third body child. */
const STEP_0062_SELECTOR = "body > div:nth-of-type(3) > div:nth-of-type(1) > div:nth-of-type(3)";
/** A selector no element answers, so resolution falls to scoring. */
const GONE = '[data-t469-gone="yes"]';

async function apply(harness: ContentHarness, operation: string, payload: object): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

async function openAndWait(harness: ContentHarness): Promise<void> {
  await harness.page.goto(new URL(PAGE, harness.lab.origin).href);
  await expect
    .poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady"))
    .toBe(true);
}

const state = async (harness: ContentHarness): Promise<FeedState> => (await harness.finalState()).state as unknown as FeedState;

/** Marks a press on the prompt copy `bothDialogsUp` mounts, which the site did not wire. */
const PRESSED_FLAG = "data-t469-pressed";

/**
 * The notifications prompt exactly as the site draws it, read off the page:
 * the site asks only once the cookie answer is in, and opens the chat only once
 * the prompt is answered, so the two are never up together on their own. Its
 * generated ids are replaced with one no other element on the page carries, so
 * the copy's `aria-labelledby` still names it by its heading.
 */
async function siteDrawnPrompt(harness: ContentHarness): Promise<string> {
  await openAndWait(harness);
  const prompt = harness.page.getByRole("dialog", { name: PROMPT });
  await expect(prompt).toBeVisible({ timeout: 15_000 });
  const markup = await prompt.evaluate((dialog) => {
    const scrim = dialog.parentElement ?? dialog;
    const copy = scrim.cloneNode(true) as Element;
    for (const titled of copy.querySelectorAll("[id]")) titled.id = "t469-prompt-title";
    copy.querySelector("[aria-labelledby]")?.setAttribute("aria-labelledby", "t469-prompt-title");
    return copy.outerHTML;
  });
  return markup;
}

/**
 * The page with the chat panel docked, as the site draws it for an account
 * whose chat is open, and the notifications prompt mounted over it from the
 * site's own markup. The chat is the site's, wired: closing it reaches the
 * server. The prompt copy is not wired, so a press on any of its buttons is
 * marked on the document for the row to read.
 */
async function bothDialogsUp(harness: ContentHarness, promptMarkup: string): Promise<void> {
  await openAndWait(harness);
  await expect(harness.page.getByRole("dialog", { name: CHAT })).toBeVisible({ timeout: 15_000 });
  await harness.page.evaluate(([markup, flag]) => {
    const box = document.createElement("div");
    box.innerHTML = markup;
    const scrim = box.firstElementChild;
    if (!scrim) throw new Error("the prompt markup is empty");
    for (const button of scrim.querySelectorAll('[role="button"]')) {
      button.addEventListener("click", () => document.documentElement.setAttribute(flag, button.getAttribute("aria-label") ?? button.textContent ?? ""));
    }
    document.body.appendChild(scrim);
  }, [promptMarkup, PRESSED_FLAG] as const);
  await expect(harness.page.getByRole("dialog", { name: PROMPT })).toBeVisible();
}

/** The cookie question answered, the prompt still to be answered; and the prompt's markup, read off the page. */
async function promptPending(openHarness: (scenarioId: string) => Promise<ContentHarness>): Promise<{ harness: ContentHarness; promptMarkup: string }> {
  const harness = await openHarness("social-network-feed");
  await apply(harness, "consent", { choice: "all" });
  const promptMarkup = await siteDrawnPrompt(harness);
  // The chat opens for the account; the prompt is still pending on the server.
  await apply(harness, "chat", { state: "open" });
  return { harness, promptMarkup };
}

const promptPressed = (harness: ContentHarness): Promise<string | null> => harness.page.evaluate((flag) => document.documentElement.getAttribute(flag), PRESSED_FLAG);

/** What a save keeps of the chat's close button: its fingerprint and where it sat. */
async function savedCloseChat(harness: ContentHarness): Promise<Descriptor> {
  const saved = await describe(harness, CLOSE_CHAT);
  expect(saved).toMatchObject({ accessibleName: "Close chat", visibleText: "✕", context: { dialog: CHAT } });
  return saved;
}

const replay = (harness: ContentHarness, commandId: string, saved: Descriptor, selector?: string) => harness.runAction({
  commandId,
  actionType: "web.dom.click",
  selector: selector ?? saved.selector,
  timeoutMs: 6_000,
  options: recordedElement(selector ? { ...saved, selector } : saved)
});

test("each close button's descriptor names its own dialog", async ({ openHarness }) => {
  test.setTimeout(60_000);
  const { harness, promptMarkup } = await promptPending(openHarness);
  await bothDialogsUp(harness, promptMarkup);
  expect((await describe(harness, CLOSE_CHAT)).context?.dialog).toBe(CHAT);
  expect((await describe(harness, PROMPT_CLOSE)).context?.dialog).toBe(PROMPT);
  // The snapshot a build saves its steps from says the same.
  const snapshot = await harness.capture();
  const dialogsByName = Object.fromEntries(snapshot.interactiveElements
    .filter((element) => element.accessibleName === "Close chat" || element.accessibleName === "Close")
    .map((element) => [element.accessibleName, element.context?.dialog]));
  expect(dialogsByName).toEqual({ "Close chat": CHAT, Close: PROMPT });
});

test("with both dialogs up, the saved Close chat resolves to the chat's close button and never the prompt's", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const { harness, promptMarkup } = await promptPending(openHarness);
  await bothDialogsUp(harness, promptMarkup);
  const saved = await savedCloseChat(harness);

  // A reload draws both dialogs again: new nodes, new generated ids. The saved
  // selector is replaced by one that names nothing, so the answer comes from
  // the recorded fingerprint, as step 0062's did.
  await bothDialogsUp(harness, promptMarkup);
  const reply = await harness.runAction({
    commandId: "close-chat:both-up",
    actionType: "web.dom.extract",
    selector: GONE,
    timeoutMs: 6_000,
    options: recordedElement({ ...saved, selector: GONE })
  });
  expect(reply.status, reply.failure?.actual ?? "").toBe("succeeded");
  // With the chat up its own name answers; the dialog gate is not what decides
  // here, and the row pins that it does not get in the way.
  expect(["fingerprint", "scored-candidate"]).toContain(reply.resolution?.strategy);
  expect(reply.element).toMatchObject({ accessibleName: "Close chat", context: { dialog: CHAT } });
  expect(await promptPressed(harness)).toBeNull();
});

test("a saved Close chat is pressed in the chat panel drawn again", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const { harness, promptMarkup } = await promptPending(openHarness);
  await bothDialogsUp(harness, promptMarkup);
  const saved = await savedCloseChat(harness);

  // The prompt is a modal: while it is up a person cannot reach the chat
  // either. With it gone, a reload draws the chat panel again and the saved
  // step closes it.
  await openAndWait(harness);
  await expect(harness.page.getByRole("dialog", { name: CHAT })).toBeVisible({ timeout: 15_000 });
  const reply = await replay(harness, "close-chat:redrawn", saved);
  expect(reply.status, reply.failure?.actual ?? "").toBe("succeeded");
  expect(reply.element?.context?.dialog).toBe(CHAT);
  await expect(harness.page.getByRole("dialog", { name: CHAT })).toHaveCount(0);
  expect((await state(harness)).chat).toBe("closed");
});

for (const [row, selector] of [["its recorded selector", undefined], ["step 0062's selector", STEP_0062_SELECTOR]] as const) {
  test(`a saved Close chat is refused on the prompt's Close once the chat is gone, by ${row}`, async ({ openHarness }) => {
    test.setTimeout(90_000);
    const { harness, promptMarkup } = await promptPending(openHarness);
    await bothDialogsUp(harness, promptMarkup);
    const saved = await savedCloseChat(harness);

    // The chat is closed for the account; the reload shows only the prompt,
    // which the site draws on its own schedule.
    await apply(harness, "chat", { state: "closed" });
    await openAndWait(harness);
    await expect(harness.page.getByRole("dialog", { name: PROMPT })).toBeVisible({ timeout: 15_000 });
    await expect(harness.page.getByRole("dialog", { name: CHAT })).toHaveCount(0);

    const reply = await replay(harness, `close-chat:gone:${selector ? "0062" : "recorded"}`, saved, selector);
    expect(reply).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND });
    await expect(harness.page.getByRole("dialog", { name: PROMPT })).toBeVisible();
    expect((await state(harness)).notificationsPrompt).toBe("pending");
    if (!selector) return;

    // The control: step 0062's fingerprint exactly as the run carried it, with
    // no dialog. On the same page it presses the prompt's close button, which
    // is what the run did -- so the dialog is what refused it above.
    const { context: _context, ...withoutDialog } = saved;
    const unguarded = await replay(harness, "close-chat:gone:no-dialog", withoutDialog as Descriptor, selector);
    expect(unguarded.status, unguarded.failure?.actual ?? "").toBe("succeeded");
    expect(unguarded.element?.accessibleName).toBe("Close");
    expect((await state(harness)).notificationsPrompt).toBe("dismissed");
  });
}

const BASE = { projectId: "project.t469", flowId: "flow.t469", maxEvidenceBytes: 64_000 } as const;
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");

/** The command a Flow node's dispatch hands the content script: Core's normalizer, the wire target, the gateway mapping. */
function dispatched(commandId: string, parameters: JsonObject): BrowserActionCommand {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.click", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  if ("status" in command) throw new Error(`the command was refused: ${JSON.stringify(command)}`);
  return command as BrowserActionCommand;
}

test("a model-built step on Close chat is refused on the prompt's Close once the chat is gone, and closes the chat drawn again", async ({ openHarness }) => {
  test.setTimeout(120_000);
  const { harness, promptMarkup } = await promptPending(openHarness);
  await bothDialogsUp(harness, promptMarkup);

  // The build looks at the page through the domain's evidence runtime, over the content script's own snapshot.
  let look = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.t469"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `t469.look.${++look}`, actionType: request.actionType, ...request.parameters } as BrowserActionCommand);
      const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      return { status: reply.status, ...(snapshot ? { payload: { snapshot } } : {}) };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });

  // The chat's close button as the model is shown it, by its handle -- the t857 of the run.
  const view = (looked.evidence as { page?: string }).page ?? "";
  const line = view.split("\n").find((entry) => /button "Close chat"/u.test(entry));
  const handle = line === undefined ? undefined : /\b(t\d+)\b/u.exec(line)?.[1];
  expect(handle, view).toBeDefined();

  // The step the build writes with that handle, as it is saved: the dialog rides in its context.
  const resolution = await runtime.resolvePlanNodeParameters({ ...BASE, nodeDefinitionId: CLICK_NODE, parameters: { selector: { handle: handle! } }, declaredConsequences: [] });
  expect(resolution.status, JSON.stringify(resolution)).toBe("resolved");
  const saved = resolution.status === "resolved" ? resolution.parameters : {};
  expect(saved.element).toMatchObject({ accessibleName: "Close chat", context: { dialog: CHAT } });
  const step = { ...saved, timeoutMs: 6_000 };

  // Playback with the chat gone and the prompt up, as step 0062 met the page.
  await apply(harness, "chat", { state: "closed" });
  await openAndWait(harness);
  await expect(harness.page.getByRole("dialog", { name: PROMPT })).toBeVisible({ timeout: 15_000 });
  const command = dispatched("t469.play.gone", step);
  expect((command as { element?: { context?: unknown } }).element?.context).toEqual({ dialog: CHAT });
  const refused = await harness.runAction(command);
  expect(refused).toMatchObject({ status: "failed", failure: TARGET_NOT_FOUND });
  await expect(harness.page.getByRole("dialog", { name: PROMPT })).toBeVisible();
  expect((await state(harness)).notificationsPrompt).toBe("pending");

  // And with the chat panel drawn again, the same saved step closes it.
  await apply(harness, "chat", { state: "open" });
  await openAndWait(harness);
  await expect(harness.page.getByRole("dialog", { name: CHAT })).toBeVisible({ timeout: 15_000 });
  const pressed = await harness.runAction(dispatched("t469.play.redrawn", step));
  expect(pressed.status, pressed.failure?.actual ?? "").toBe("succeeded");
  await expect(harness.page.getByRole("dialog", { name: CHAT })).toHaveCount(0);
  const after = await state(harness);
  expect(after.chat).toBe("closed");
  expect(after.notificationsPrompt).toBe("pending");
});
