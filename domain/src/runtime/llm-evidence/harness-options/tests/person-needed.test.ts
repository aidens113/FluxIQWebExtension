// A robot check a recovery option meets is the person's, never the repair
// model's.
//
// The authoring tools have marked such a call `personNeeded` since t197, and
// Core hands a marked call to the person. The recovery options did not: their
// refusal path returned the check as an ordinary `needs_person` refusal, so a
// check met while a failed run was being explored reached the repair model,
// which was told "that failed" and could try to act on it. Each option is
// driven here through Core's own registry against a page whose look, press or
// navigation answers `USER_INTERVENTION_REQUIRED`.

import assert from "node:assert/strict";
import test from "node:test";
import { AutomationStudioHarnessOptionRegistry, type AutomationStudioHarnessOptionResolution } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../../constants";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../../failure";
import type { WebLlmEvidenceGateway } from "../../capture";
import { present } from "../../present";
import { createWebLlmExtractionHandles } from "../../structure";
import type { WebRecoveryHarnessContext } from "../execute";
import { webAutomationRecoveryHarnessOptionBundle } from "..";

const CHECK = { code: WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, actual: "captcha: a robot check" };
const SIGN_IN = { code: WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED, actual: "sign in to continue" };

type Fails = { capture?: JsonObject; captureAfterFirst?: JsonObject; click?: JsonObject; navigate?: JsonObject };

test("a look of a robot check comes back marked personNeeded, proposing nothing", async () => {
  const { registry } = registeredWith({ capture: CHECK });

  const looked = await run(registry, "web.recovery.inspect", {}) as JsonObject;

  assert.equal(looked.personNeeded, true);
  assert.equal(looked.resultCode, "web.action.rejected.needs_person");
  assert.equal(looked.effectApplied, false);
  assert.equal("draft" in looked, false);
});

test("a press whose control raises a robot check comes back marked personNeeded", async () => {
  const { registry, commands } = registeredWith({ click: CHECK });
  await run(registry, "web.recovery.inspect", {});

  const pressed = await run(registry, "web.recovery.press", { target: "target.1", consequences: [] }) as JsonObject;

  assert.equal(pressed.personNeeded, true);
  assert.equal(pressed.resultCode, "web.action.rejected.needs_person");
  assert.equal("draft" in pressed, false);
  // Pressed once, and nothing was done about the check.
  assert.equal(commands.filter((command) => command === "web.dom.click").length, 1);
});

test("a navigation that lands on a robot check comes back marked personNeeded", async () => {
  const { registry } = registeredWith({ navigate: CHECK });

  const went = await run(registry, "web.recovery.navigate_in_scope", { url: "https://example.test/next" }) as JsonObject;

  assert.equal(went.personNeeded, true);
  assert.equal(went.resultCode, "web.action.rejected.needs_person");
});

test("a wait whose second look meets a robot check comes back marked personNeeded", async () => {
  const { registry } = registeredWith({ captureAfterFirst: CHECK });

  const waited = await run(registry, "web.recovery.wait_for_change", { maxWaitMs: 100 }) as JsonObject;

  assert.equal(waited.personNeeded, true);
});

// A sign-in is also for a person, and shares the `needs_person` code, but it is
// not a check the person completes in place and presses Continue on: it is
// reported to the model as the refusal it always was.
test("a press that meets a sign-in wall is not marked personNeeded", async () => {
  const { registry } = registeredWith({ click: SIGN_IN });
  await run(registry, "web.recovery.inspect", {});

  const pressed = await run(registry, "web.recovery.press", { target: "target.1", consequences: [] }) as JsonObject;

  assert.equal(pressed.resultCode, "web.action.rejected.needs_person");
  assert.equal("personNeeded" in pressed, false);
});

test("every other refusal is reported exactly as before, unmarked", async () => {
  const { registry } = registeredWith({});

  const refused = await run(registry, "web.recovery.press", { target: "target.1", consequences: [] }) as JsonObject;

  assert.equal(refused.resultCode, "web.action.rejected.target_unobserved");
  assert.equal("personNeeded" in refused, false);
});

function registeredWith(fails: Fails): { registry: AutomationStudioHarnessOptionRegistry; commands: string[] } {
  const commands: string[] = [];
  let captures = 0;
  let location = "https://example.test/start";
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      if (command.actionType === "web.dom.capture_snapshot") {
        captures += 1;
        if (fails.capture) return { status: "failed", failure: fails.capture, error: "no" };
        if (fails.captureAfterFirst && captures > 1) return { status: "failed", failure: fails.captureAfterFirst, error: "no" };
        return { status: "succeeded", payload: { snapshot: snapshot(location) } };
      }
      if (command.actionType === "web.browser.navigate") {
        if (fails.navigate) return { status: "failed", failure: fails.navigate, error: "no" };
        location = String(command.parameters.url);
        return { status: "succeeded" };
      }
      if (command.actionType === "web.dom.click" && fails.click) return { status: "failed", failure: fails.click, error: "no" };
      return { status: "succeeded" };
    }
  };
  const registry = new AutomationStudioHarnessOptionRegistry();
  registry.register(webAutomationRecoveryHarnessOptionBundle(present<WebRecoveryHarnessContext>({
    gateway,
    scopePolicy: { kind: "same_scope" },
    retainSelectors: () => undefined,
    extractionHandles: createWebLlmExtractionHandles(),
    sleep: async () => {}
  })));
  return { registry, commands };
}

function resolution(): AutomationStudioHarnessOptionResolution {
  return { scope: { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID }, stage: "gather", allowSideEffectsWithoutPolicy: true };
}

let callSequence = 0;

async function run(registry: AutomationStudioHarnessOptionRegistry, optionId: string, value: JsonObject): Promise<unknown> {
  callSequence += 1;
  return await registry.execute(
    { projectId: "project.one", flowId: "flow.one", callId: `call.${callSequence}`, optionId, value },
    resolution()
  );
}

function snapshot(url: string): JsonObject {
  return {
    url,
    title: "Fixture",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "#continue", role: "button", name: "Continue" },
      { tagName: "a", selector: "#next", name: "Next", href: `${new URL(url).origin}/next` }
    ]
  };
}
