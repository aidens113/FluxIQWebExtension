import { defineScenario } from "../../types.js";
import { renderHomePage } from "./board/index.js";
import { jobBoardManifest } from "./manifest.js";
import { routeJobBoard } from "./route.js";
import { createJobBoardState, mutateJobBoardState } from "./state.js";
import type { JobBoardState } from "./types.js";

/**
 * Rolefinch, a job board the size and mess of a real one, handing off to
 * Talentloom, the applicant-tracking system employers' careers sites embed.
 *
 * The postings, the salaries, the oracles and every rendering are authored
 * and fixed; the lab seed reaches only what a new build of a real site would
 * change -- every class name and every generated element id -- so a run under
 * any seed faces the same jobs behind different markup.
 */
export const jobBoardScenario = defineScenario<JobBoardState>({
  id: "job-board",
  title: "Job board",
  startPath: "/scenarios/job-board/",
  seed: 246,
  manifest: jobBoardManifest,
  createState: () => createJobBoardState(),
  mutate: mutateJobBoardState,
  render: renderHomePage,
  route: routeJobBoard,
});
