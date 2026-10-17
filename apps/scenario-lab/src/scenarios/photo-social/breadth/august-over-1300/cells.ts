/**
 * The grid cells the question is about: the studio's photos and carousels of
 * August 2026 (a reel's grid count is its plays), whose like count reads 1.3K
 * or more. The grid rounds counts down to a tenth of a thousand, so a cell
 * reads 1.3K or more exactly when its post has at least 1,300 likes.
 */
export const AUGUST_OVER_1300_CELLS = `main a[role="link"][href*="/p/"]:has(img[alt*=" on August "][alt*=", 2026."]):not(:has(svg[aria-label="Clip"])):has(ul > li:first-child > span:text-matches("^([2-9]|1[.][3-9]|[1-9][0-9]+)([.][0-9])?K$|M$"))`;
