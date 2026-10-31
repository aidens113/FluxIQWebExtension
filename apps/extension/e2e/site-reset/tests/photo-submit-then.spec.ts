import type { JsonObject } from "fluxiq/core";
import { STUDIO } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { closeExtensionSession, expect, launchExtensionSession, test, type ExtensionSession } from "../../fixtures/extension-context";
import { bindInstrumentedRuntime, bindScriptedProvider, keepDiagnostic, projectBuild, startInstalledBuild, type BuilderTurn, type ScriptedAnswer } from "../index";
import { twoPartPlan } from "../offline-first-build";
import { PHOTO_ROOT, openPhotoProfile } from "../photo-build";
import type { SupervisorTurn } from "../scripted-provider";

const OPEN = "Open the studio's profile";
const READ = "read the page and leave that profile open";
const TASK = `${OPEN} and ${READ}.`;
const FROM_STEP_FIRST = "subflow.trial_from_step_first";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const returned = (answer: JsonObject | undefined): JsonObject => record((answer?.returns as unknown[] | undefined)?.[0]);

/**
 * The same provider-free photo-social build twice, once with separate saves
 * and tests and once with `then`. The second part fails at `second`, refuses
 * another whole run, repairs live, checks from that script label, and tests
 * whole once more. Both versions must finish automatically after a yes.
 * Neither run scrapes data or changes the fixture's lasting state.
 */
test("installed folded submissions preserve repair, chat lines and completion while saving provider decisions", async ({}, testInfo) => {
  test.setTimeout(600_000);
  const { automationStudioActivityHub } = await import("fluxiq/automation-studio");
  const compare = async (folded: boolean) => {
    const extensionSession = await launchExtensionSession(`photo-submit-${folded ? "folded" : "separate"}`);
    try {
      await testInfo.attach(`extension-build-${folded ? "folded" : "separate"}.json`, { body: Buffer.from(JSON.stringify(extensionSession.metadata, null, 2)), contentType: "application/json" });
      return await runComparison(folded, extensionSession);
    } finally {
      try {
        extensionSession.networkGuard.assertClean();
        extensionSession.scenarioGuard.assertClean();
      } finally {
        await closeExtensionSession(extensionSession);
      }
    }
  };
  const runComparison = async (folded: boolean, extensionSession: ExtensionSession) => {
    const installed = await startInstalledBuild(extensionSession);
    const profile = new URL(`${PHOTO_ROOT}${STUDIO}/`, installed.origin).href;
    const wrong = new URL(`${PHOTO_ROOT}no-such-page/`, installed.origin).href;
    const build = projectBuild(installed, `Submit then ${folded ? "folded" : "separate"}`, TASK);
    const answers: Record<string, JsonObject> = {};
    const dispatches: Record<string, JsonObject> = {};
    const siteActs: Record<string, string[]> = {};
    const activity: Array<{ ref: string | undefined; text: string | undefined; status: string | undefined }> = [];
    const sent: string[] = [];
    let brief = "", pending = "", startedAt = 0;
    const unsubscribe = automationStudioActivityHub.subscribe(event => {
      if (event.detail) activity.push({ ref: event.detail.ref, text: event.detail.text, status: event.detail.status });
    });
    try {
      await openPhotoProfile(installed.page, installed.origin, profile);
      await installed.pair();
      bindInstrumentedRuntime(installed);
      const openFlow = ["flow: Open the profile", "part open: open the studio's profile", "  step profile: open the profile", "    node: web.browser.navigate", `    url: ${JSON.stringify(profile)}`, "end"].join("\n");
      const readFlow = (address: string) => [
        "flow: Read the profile", "part read: read the profile and leave it open",
        "  step first: read the profile", "    node: web.dom.capture_snapshot",
        "  step second: leave the studio's profile open", "    node: web.browser.navigate", `    url: ${JSON.stringify(address)}`, "end"
      ].join("\n");
      const send = (callId: string, made: ScriptedAnswer) => {
        pending = callId;
        startedAt = installed.siteCommands().length;
        sent.push(callId);
        return made;
      };
      const settle = (evidence?: BuilderTurn["evidence"]) => {
        const previous = pending;
        if (previous) {
          const answer = evidence?.find(entry => entry.callId === previous)?.value;
          if (answer) answers[previous] = record(answer);
          siteActs[previous] = installed.siteCommands().slice(startedAt);
          pending = "";
        }
        return previous;
      };
      const supervisor = (turn: SupervisorTurn): ScriptedAnswer => {
        settle();
        switch (turn.step) {
          case 1:
            return turn.call("plan", "project.write_plan", twoPartPlan(turn.plan(), [
              { key: "open", name: "Open the profile", quote: OPEN, goal: "The studio's profile is open" },
              { key: "read", name: "Read the profile", quote: READ, goal: "The profile was read and is open" }
            ]));
          case 2:
            brief = "open";
            return turn.call("dispatch.open", "project.dispatch", { reason: "Build the opening part.", briefs: [{ subflowKey: "open", entry: { caseId: "observed-current", predecessors: [] }, permittedActs: [], maxIterations: 16 }] });
          case 3:
            dispatches.open = returned(turn.last("project.dispatch"));
            brief = "read";
            return turn.call("dispatch.read", "project.dispatch", { reason: "Build the reading part.", briefs: [{ subflowKey: "read", entry: { caseId: "observed-current", predecessors: ["open"] }, permittedActs: [], maxIterations: 24 }] });
          case 4:
            dispatches.read = returned(turn.last("project.dispatch"));
            return turn.call("assemble", "project.assemble", {});
          case 5:
            return turn.call("whole", "core.test_candidate", {});
          default:
            return turn.complete(record(turn.last("project.assemble")?.complete));
        }
      };
      const builder = (turn: BuilderTurn): ScriptedAnswer => {
        const previous = settle(turn.evidence);
        const { node, call } = turn;
        if (brief === "open") {
          if (!previous) return send("open.navigate", node("open.navigate", "web.output.browser-navigate", { url: profile }));
          if (previous === "open.navigate") return send("open.submit", call("open.submit", "core.submit_subflow", { flow: openFlow, ...(folded ? { then: "test_whole" } : {}) }));
          if (!folded && previous === "open.submit") return send("open.test", call("open.test", "core.test_subflow", {}));
          throw new Error("diagnostic.provider_asked_after_open_yes");
        }
        const failed = folded ? "submit-failed" : "test-failed";
        const refused = folded ? "submit-refused" : "test-refused";
        const from = folded ? "submit-fixed" : "from-step";
        if (!previous) return send("read.navigate", node("read.navigate", "web.output.browser-navigate", { url: profile }));
        if (previous === "read.navigate") return send("read.look", node("read.look", "web.output.dom-capture_snapshot", {}));
        if (previous === "read.look") return send("submit-failed", call("submit-failed", "core.submit_subflow", { flow: readFlow(wrong), ...(folded ? { then: "test_whole" } : {}) }));
        if (!folded && previous === "submit-failed") return send("test-failed", call("test-failed", "core.test_subflow", {}));
        if (previous === failed) return send(refused, call(refused, folded ? "core.submit_subflow" : "core.test_subflow", folded ? { flow: readFlow(`${wrong}changed/`), then: "test_whole" } : {}));
        if (previous === refused) return send("repair", node("repair", "web.output.browser-navigate", { url: profile }));
        if (previous === "repair") return send("submit-fixed", call("submit-fixed", "core.submit_subflow", { flow: readFlow(profile), ...(folded ? { then: { from: "second" } } : {}) }));
        if (!folded && previous === "submit-fixed") return send("from-step", call("from-step", "core.test_subflow", { from: "second" }));
        if (previous === from) return send("test-passing", call("test-passing", "core.test_subflow", {}));
        throw new Error("diagnostic.provider_asked_after_read_yes");
      };
      const provider = bindScriptedProvider(installed, { task: TASK, permitted: [], instructionSourceId: build.instructionSourceId, maxIterations: 24, maxCallsPerRun: 80, builder, supervisor });
      const { ending, failure } = await build.run();
      settle();
      const failed = folded ? record(answers["submit-failed"]?.tested) : answers["test-failed"] ?? {};
      const refused = folded ? record(answers["submit-refused"]?.tested) : answers["test-refused"] ?? {};
      const from = folded ? record(answers["submit-fixed"]?.tested) : answers["from-step"] ?? {};
      const completed = activity.filter(event => event.text?.includes("Core finished this part of the task because the latest version passed its test, so nothing was left to decide."));
      const result = { folded, ending, failure, decides: provider.builderSteps(), supervisorDecides: provider.supervisorSteps(), sent, dispatches, failed, refused, from, siteActs, coreCompletions: completed.length, activity, gatewayErrors: installed.gatewayErrors };
      await keepDiagnostic(testInfo, `photo-submit-${folded ? "folded" : "separate"}.json`, result);
      expect(ending).toBe("proposed");
      expect(failure).toEqual({});
      expect(failed.verdict).toBe("execution_failed");
      expect(record(record(failed.feedback).stoppedBy).label).toBe("leave the studio's profile open");
      expect(refused).toMatchObject({ ok: false, code: FROM_STEP_FIRST });
      expect(siteActs[folded ? "submit-refused" : "test-refused"]).toEqual([]);
      expect(from).toMatchObject({ fromStep: true, passed: true });
      expect(from.from).toMatch(/^s\d+$/u);
      expect(from.passedKeys).toEqual([from.from]);
      const fromCommands = siteActs[folded ? "submit-fixed" : "from-step"]!;
      expect(fromCommands.some(type => type === "web.browser.navigate")).toBe(true);
      const wholeCommands = siteActs[folded ? "submit-failed" : "test-failed"]!;
      expect(fromCommands.length).toBeLessThan(wholeCommands.length);
      for (const returned of Object.values(dispatches)) expect(returned).toMatchObject({ outcome: "done", trialsAnswered: expect.arrayContaining([expect.objectContaining({ verdict: "yes" })]) });
      expect(record(dispatches.read?.proposal).revision).toBe(folded ? 3 : 2);
      expect(completed).toHaveLength(2);
      expect(installed.page.url()).toBe(profile);
      if (folded) {
        expect(answers["submit-fixed"]?.testedWith).toMatchObject({ from: "second" });
        expect(activity.some(event => event.text?.includes("because the submission asked for it"))).toBe(true);
        expect(sent).not.toContain("open.test");
      }
      return result;
    } finally {
      unsubscribe();
      await build.stop();
      await installed.close();
    }
  };
  const separate = await compare(false);
  const folded = await compare(true);
  const counts = { separate: separate.decides, folded: folded.decides, saved: separate.decides - folded.decides };
  console.log(JSON.stringify({ submitThenDecideCounts: counts }));
  expect(counts.saved).toBe(3);
  expect(folded.supervisorDecides).toBe(separate.supervisorDecides);
});
