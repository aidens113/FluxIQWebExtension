import type { Collection } from "../types.js";
import { NETWORK_POSTS } from "./network-posts.js";
import { STUDIO_POSTS } from "./studio-posts.js";

const studio = (date: string) => STUDIO_POSTS.find((post) => post.date === date)!.code;
const network = (author: string, date: string) => NETWORK_POSTS.find((post) => post.author === author && post.date === date && !post.sponsored)!.code;

/**
 * The visitor's collections before the run. "Studio inspo" already holds the
 * studio's celadon pour from 9 August, which is one of the three posts the
 * collection task needs: on its own page its bookmark is already filled, and
 * pressing a filled bookmark removes the post from saved and from every
 * collection holding it.
 */
export function initialCollections(): Array<{ name: string; slug: string; codes: string[] }> {
  const collections: Collection[] = [
    { name: "Kitchen", slug: "kitchen", codes: [network("saltmarsh.goods", "2026-09-24"), network("lena.moss", "2026-09-30"), network("sofia.lindqvist", "2026-09-21")] },
    { name: "Studio inspo", slug: "studio-inspo", codes: [network("kiln.theory", "2026-09-19"), network("kiln.theory", "2026-08-30"), studio("2026-08-09"), studio("2026-07-16"), studio("2026-06-21")] },
  ];
  return collections.map((collection) => ({ ...collection, codes: [...collection.codes] }));
}

/** Everything saved before the run: every collected post, plus two saved loose. */
export function initialSaved(): string[] {
  const collected = initialCollections().flatMap(({ codes }) => codes);
  return [...new Set([...collected, studio("2026-09-12"), network("theo.marchetti", "2026-09-23")])];
}
