import type { DirectMessage, ProductCard } from "../types.js";
import { SHOP } from "./accounts.js";

/** The piece the shop's instant reply shares when a message names it. */
export const MOON_JAR_CARD: ProductCard = { slug: "speckled-moon-jar", name: "Speckled moon jar", price: "\u20ac68.00", note: "One of one \u00b7 ships in 3\u20135 days" };

/** Conversations the visitor already has, newest thread first. */
export const EXISTING_THREADS: ReadonlyArray<{ thread: string; messages: readonly DirectMessage[] }> = [
  { thread: "lena.moss", messages: [{ from: "lena.moss", date: "2026-10-03", text: "Are you going to the seconds sale on Saturday?" }] },
  { thread: SHOP, messages: [{ from: SHOP, date: "2026-09-02", text: "Thanks for following! New pieces drop most Fridays." }] },
  { thread: "kofi.ade", messages: [{ from: "me", date: "2026-09-28", text: "That bowl is great!" }, { from: "kofi.ade", date: "2026-09-28", text: "Thank you!! First one that didn't collapse" }] },
];

/** A message that names the piece: the words a person asking about it would use. */
const NAMES_MOON_JAR = /moon\s*jar/iu;

/**
 * The shop's automated instant reply. A business account answers every new
 * message at once; it shares the piece when the message says which one, and
 * otherwise asks which piece is meant, so "how much?" on its own gets no price.
 */
export function instantReply(text: string, date: string): DirectMessage {
  if (NAMES_MOON_JAR.test(text)) return { from: SHOP, date, text: "Hi! Thanks for asking. Here it is:", card: MOON_JAR_CARD };
  return { from: SHOP, date, text: "Hi! Thanks for your message. Which piece are you asking about? Send us its name and we will reply with the price." };
}
