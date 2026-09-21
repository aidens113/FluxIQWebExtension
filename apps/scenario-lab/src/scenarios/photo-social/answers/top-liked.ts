import { STUDIO, gridFor } from "../data/index.js";
import type { Post } from "../types.js";

/**
 * The studio's posts published in `month` (`YYYY-MM`), most liked first by
 * the exact count a post's own page shows. A post that hides its count cannot
 * be ranked, and none published in August 2026 does.
 */
export function mostLiked(month: string, count: number): Post[] {
  return gridFor(STUDIO)
    .filter((post) => post.date.startsWith(`${month}-`) && post.likes !== null)
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, count);
}
