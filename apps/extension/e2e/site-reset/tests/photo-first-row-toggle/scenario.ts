import type { Page } from "@playwright/test";
import { PHOTO_SOCIAL_LIVE_TASKS } from "../../../../../scenario-lab/src/scenarios/photo-social/live-tasks.js";
import { newestLikesExpected } from "../../../../../scenario-lab/src/scenarios/photo-social/breadth/index.js";
import { STUDIO, gridFor } from "../../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect } from "../../../fixtures/extension-context";
import { PHOTO_ROOT, likedPosts, openPhotoProfile } from "../../photo-build";

const task = PHOTO_SOCIAL_LIVE_TASKS.find(entry => entry.id === "photo-social-newest-likes")!;
const expected = newestLikesExpected.extracted![0]!;
const posts = expected.records!.map(row => /\/p\/([^/]+)\//u.exec(String(row.link))![1]!);
const heart = (label: string) => `article section > [role="button"]:has(> svg[aria-label="${label}"])`;
const url = (origin: string, code: string) => new URL(`${PHOTO_ROOT}p/${code}/`, origin).href;

/** The unchanged realistic oracle and UI preparation of its isolated mixed initial state. */
export const photoToggleScenario = {
  task: task.instruction,
  expected,
  posts,
  pinned: gridFor(STUDIO).filter(post => post.pinned).map(post => post.code),
  profile: (origin: string) => new URL(`${PHOTO_ROOT}${STUDIO}/`, origin).href,
  url,
  async prepare(page: Page, origin: string) {
    const profile = this.profile(origin);
    await openPhotoProfile(page, origin, profile);
    const shown: Array<{ post: string; state: string }> = [];
    for (const [index, code] of posts.entries()) {
      await page.goto(url(origin, code));
      await expect(page.locator(heart("Like"))).toBeVisible();
      if (index === 0) {
        await page.locator(heart("Like")).click();
        await expect(page.locator(heart("Unlike"))).toBeVisible();
      }
      shown.push({ post: code, state: index === 0 ? "Unlike" : "Like" });
    }
    expect(await likedPosts(page)).toEqual([posts[0]]);
    await page.goto(profile);
    return shown;
  },
  async assertFinal(page: Page) {
    for (const fact of newestLikesExpected.finalState!) {
      await expect.poll(async () => (await page.getByTestId(fact.subject).first().textContent())?.trim()).toEqual(fact.value);
    }
    const liked = await likedPosts(page);
    expect([...liked].sort()).toEqual([...posts].sort());
    expect(liked.filter(code => this.pinned.includes(code))).toEqual([]);
  }
};
