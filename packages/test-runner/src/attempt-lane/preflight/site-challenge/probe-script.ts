import type { ScriptedModelScript, ScriptedReply } from "../../scripted-model/index.js";
import { currentPageOf, evidenceOf, toolCall } from "../../scripted-model/index.js";
import type { SiteChallengeProbeSink } from "./probe-sink.js";

const READ_CALL = "preflight-read";

/**
 * A scripted model that does the least a task can: look at the page, then read it once and say it is done. It never
 * presses, types into, reloads or looks for a way round anything, so a check on the page is met only by the product,
 * which must hand it to the person. `shows` are the words of the site's declared checks, used to tell a page that is
 * still a check from the restored site; the script records that as yes or no and never keeps a page.
 */
export function siteChallengeProbeScript(taskId: string, shows: readonly string[], sink: SiteChallengeProbeSink): ScriptedModelScript {
  const showsCheck = (page: string): boolean => shows.some((words) => page.includes(words));
  const decide: ScriptedReply = (request) => {
    sink.decisions += 1;
    const read = evidenceOf(request).find((entry) => entry.callId === READ_CALL);
    const page = currentPageOf(request);
    if (read) {
      sink.readSucceeded = read.value.ok !== false && read.value.error === undefined && read.value.code === undefined;
      sink.checkGoneAfterRead = !showsCheck(page);
      sink.readResultKeys = Object.keys(read.value).sort();
      return { kind: "evidence_tool_decision", summary: "The page is read.", decision: { kind: "complete", result: { summary: "The page is read." } } };
    }
    sink.firstPageShowedCheck = showsCheck(page);
    return toolCall("Read the page as it stands.", READ_CALL, "core.run_node", { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] }, true);
  };
  return {
    taskId,
    replies: {
      panel_command: [(request) => ({ do: "flow.createHere", with: { instruction: request.message }, process: null })],
      evidence_tool_decision: Array.from({ length: 12 }, () => decide),
    },
  };
}
