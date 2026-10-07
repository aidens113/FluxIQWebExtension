import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { closedJobsExpected } from "./expected.js";

export const closedJobsWorkflow: ScenarioWorkflow = {
  id: "remove-closed-saved-jobs",
  description: "remove closed saved jobs",
  recordingScript: [{"id":"closed-consent","operation":"click","target":"role:button:Accept all"},{"id":"closed-open","operation":"navigate","path":"/scenarios/job-board/myjobs"},{"id":"closed-unsave","operation":"click","target":"li[data-jk=\"21184d1fa92f3741\"] [aria-label=\"Unsave job\"]"},{"id":"closed-removed","operation":"waitForState","target":"text=Removed from saved jobs","timeoutMs":4000},{"id":"closed-refresh-list","operation":"navigate","path":"/scenarios/job-board/myjobs"},{"id":"extract-open-saved-jobs","operation":"extract","target":"main ol li","fields":{"title":"a","company":":scope > span:nth-of-type(1)","location":":scope > span:nth-of-type(2)","status":":scope > span:nth-of-type(3)"}}],
  expected: closedJobsExpected,
};
