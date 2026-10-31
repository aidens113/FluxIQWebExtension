import type { JsonObject } from "fluxiq/core";
import { expect } from "../../../fixtures/extension-context";
import { canonicalJson, judgeLog } from "../../change-proof";
import type { BuilderTurn, InstalledBuild, ScriptedAnswer } from "../../index";
import { gridCellHandle, gridColumns, issuesIn, likedPosts, postToggle } from "../../photo-build";
import { photoToggleScenario } from "./scenario";

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/** An ordinary build: first learn the actual two states, then choose the observed state the task asks to retain. */
export function groundedPhotoBuilder(installed: InstalledBuild) {
  const answers: Record<string, JsonObject> = {};
  const pages: Record<string, string> = {};
  const judge = judgeLog({ quote: "three most recent posts", why: "older pinned posts" });
  const profile = photoToggleScenario.profile(installed.origin);
  let pending = "", finished = false, handle = "", likeHandle = "";
  let columns: { link?: string; pin?: string } = {};
  let selected: JsonObject = {}, opposite: JsonObject = {};
  let beforeRefusal: string[] = [], afterRefusal: string[] = [];
  let commandsBeforeRefusal = 0, commandsAfterRefusal = 0;
  let candidate: { revision: number; digest: string } | undefined;
  const send = (id: string, answer: ScriptedAnswer) => {
    pending = id;
    return answer;
  };
  const flow = (chosen?: JsonObject) => [
    "flow: Like the three most recent posts",
    "step profile: open the profile", "  node: web.browser.navigate", `  url: ${JSON.stringify(profile)}`,
    "step posts: list the posts that are not pinned", "  node: web.dom.extract_list",
    `  extractList: ${JSON.stringify({ handle, fields: { link: columns.link, badge: columns.pin } })}`,
    `  recordOutput: ${JSON.stringify({ datasetId: photoToggleScenario.expected.step, writeMode: "replace", process: { columns: ["link"] } })}`,
    '  extractList.where: [{"field":"badge","contains":"Pinned","not":true}]', "  extractList.maxItems: 3",
    "step open: open the post", "  node: web.browser.navigate", "  url: $row.link",
    "  repeat over: posts", "  repeat through: like", "  repeat most: 3",
    "step like: like the post", "  node: web.dom.click", `  target: ${likeHandle}`, "  consequences: modify_existing",
    ...(chosen ? [`  ensureState: ${JSON.stringify(chosen)}`] : [])
  ].join("\n");
  const builder = async (turn: BuilderTurn): Promise<ScriptedAnswer> => {
    pages[`step-${turn.step}`] = turn.shownPage();
    const previous = pending;
    if (pending) answers[pending] = record([...turn.evidence].reverse().find(entry => entry.callId === pending)?.value);
    pending = "";
    const done = () => {
      finished = true;
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    if (finished) return done();
    switch (previous) {
      case "": return send("profile", turn.node("profile", "web.output.browser-navigate", { url: profile }));
      case "profile": {
        const cell = gridCellHandle(turn.shownPage(), photoToggleScenario.pinned[0]!);
        if (!cell) throw new Error("diagnostic.grid_cell_missing");
        return send("detect", turn.call("detect", "web.detect_repeating_structure", { target: cell }));
      }
      case "detect": {
        const detection = answers.detect;
        handle = String(detection?.extraction ?? "");
        columns = gridColumns(detection);
        expect(handle).toMatch(/^extraction\.[0-9]+$/u);
        expect(columns.link).toBeTruthy();
        expect(columns.pin).toBeTruthy();
        return send("read", turn.node("read", "web.output.dom-extract_list", { extractList: { handle, fields: { link: columns.link!, badge: columns.pin! }, where: [{ field: "badge", contains: "Pinned", not: true }], maxItems: 3 } }));
      }
      case "read": return send("first", turn.node("first", "web.output.browser-navigate", { url: photoToggleScenario.url(installed.origin, photoToggleScenario.posts[0]!) }));
      case "first": {
        const control = postToggle(turn.shownPage());
        expect(control?.shows).toBe("Unlike");
        if (!control) throw new Error("diagnostic.post_control_missing");
        likeHandle = control.handle;
        return send("observe", turn.node("observe", "web.output.dom-click", { target: { handle: likeHandle } }, ["modify_existing"]));
      }
      case "observe": {
        // Both values came from the real press. Its before state was shown as Unlike, which satisfies Like in the task.
        const toggle = record(answers.observe?.toggle);
        selected = record(toggle.beforeSignature);
        opposite = record(toggle.signature);
        expect(Object.keys(selected).length).toBeGreaterThan(0);
        expect(Object.keys(opposite).length).toBeGreaterThan(0);
        expect(canonicalJson(selected)).not.toBe(canonicalJson(opposite));
        beforeRefusal = await likedPosts(installed.page);
        commandsBeforeRefusal = installed.siteCommands().length;
        return send("without.choice", turn.call("without.choice", "core.submit_subflow", { flow: flow() }));
      }
      case "without.choice": {
        afterRefusal = await likedPosts(installed.page);
        commandsAfterRefusal = installed.siteCommands().length;
        expect(issuesIn(answers[previous]).map(issue => issue.code)).toContain("candidate.toggle_state_required");
        const issueValues = record(answers[previous]?.diagnostics).issues;
        const refused = (Array.isArray(issueValues) ? issueValues : []).map(issue => String(record(issue).message ?? "")).join("\n");
        expect(refused).toContain(JSON.stringify(selected));
        expect(refused).toContain("before press");
        expect(afterRefusal).toEqual(beforeRefusal);
        // A different state is mechanically selectable too: the framework cannot replace a model choice by its vote.
        return send("opposite.choice", turn.call("opposite.choice", "core.submit_subflow", { flow: flow(opposite) }));
      }
      case "opposite.choice": {
        expect(typeof answers[previous]?.revision).toBe("number");
        return send("selected.choice", turn.call("selected.choice", "core.submit_subflow", { flow: flow(selected) }));
      }
      case "selected.choice": {
        const submitted = answers[previous]!;
        if (typeof submitted.revision !== "number" || typeof submitted.digest !== "string") throw new Error("diagnostic.grounded_submission_refused");
        candidate = { revision: submitted.revision, digest: submitted.digest };
        return send("trial", turn.call("trial", "core.test_subflow", candidate));
      }
      case "trial": return done();
      default: throw new Error("diagnostic.unexpected_builder_phase");
    }
  };
  return { builder, judge, answers, pages, selected: () => selected, opposite: () => opposite,
    refusalState: () => ({ beforeRefusal, afterRefusal, commandsBeforeRefusal, commandsAfterRefusal }), script: () => flow(selected) };
}
