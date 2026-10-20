import type { ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { collapseDockSteps, openingSteps } from "../steps/index.js";
import { newestLikesExpected } from "./expected.js";

const ROOT = "/scenarios/photo-social/";
/** The three most recent posts, newest first. */
const NEWEST = ["D1OKDvAEHfa", "DgYZxS8LJOe", "DPIEH3I491a"] as const;
/** The post's own heart, in its actions row; every comment carries a heart of its own outside that row. */
const heart = (label: "Like" | "Unlike") => `article section > [role="button"]:has(> svg[aria-label="${label}"])`;

function likeOn(code: string, index: number): ScenarioStep[] {
  return [
    { id: `newest-likes-open-${index}`, operation: "navigate", path: `${ROOT}p/${code}/` },
    ...(index === 0 ? collapseDockSteps("newest-likes") : []),
    { id: `newest-likes-like-${index}`, operation: "click", target: heart("Like") },
    { id: `newest-likes-liked-${index}`, operation: "waitForState", target: heart("Unlike"), timeoutMs: 3000 },
  ];
}

/**
 * Like the studio's three most recent posts. Each is liked on its own page,
 * and the next page opens only once the heart has turned, which it does when
 * the server has the like; then the profile's grid, where the pinned posts
 * come first, is read from the fourth cell to the sixth: the three newest,
 * newest first.
 */
export const newestLikesWorkflow: ScenarioWorkflow = {
  id: "newest-likes",
  recordingDescription: "Demonstrates liking a profile's most recent posts and reading their addresses off its grid.",
  description: "Like the verified studio's three most recent posts, which sit after the three pinned posts on its grid, and read their addresses newest first.",
  recordingScript: [
    ...openingSteps("newest-likes"),
    ...NEWEST.flatMap((code, index) => likeOn(code, index)),
    { id: "newest-likes-open-profile", operation: "navigate", path: `${ROOT}harbourlight.studio/` },
    { id: "extract-newest-likes", operation: "extract", target: `main a[role="link"][href*="/p/"]:nth-child(n+4):nth-child(-n+6)`, fields: { link: "@href" } },
    { id: "newest-likes-read", operation: "checkpoint" },
  ],
  expected: newestLikesExpected,
};
