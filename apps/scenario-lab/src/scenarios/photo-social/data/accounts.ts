import type { Account } from "../types.js";

/** The signed-in visitor. */
export const VIEWER = "tamsin.reyes";

/** The studio the extraction and collection tasks are about, and the only account of that name with a verified badge. */
export const STUDIO = "harbourlight.studio";

/** The shop whose moon jar carries no price. */
export const SHOP = "saltmarsh.goods";

const person = (handle: string, name: string, hue: number, followers = 800, bio = ""): Account =>
  ({ handle, name, verified: false, followers, following: 400, bio, category: "", link: "", hue });

/**
 * Everyone on the site. Four accounts share the studio's name: an impersonator
 * that copies its giveaway and runs it as an ad, a "prize claims" account that
 * puts a check mark character in its display name, and a fan page. Only the
 * real one carries the badge, which is an icon, not a character.
 */
export const ACCOUNTS: readonly Account[] = [
  { handle: VIEWER, name: "Tamsin Reyes", verified: false, followers: 412, following: 389, bio: "Mostly plants, pots and the odd sunrise.", category: "", link: "", hue: 18 },
  { handle: STUDIO, name: "Harbourlight Studio", verified: true, followers: 48213, following: 311, bio: "Small-batch stoneware thrown by the harbour in Portmere. Workshops, seconds sales and kiln days.", category: "Artist", link: "harbourlight.example/shop", hue: 205 },
  { handle: "harbourlight.studios", name: "Harbourlight Studio", verified: false, followers: 318, following: 7502, bio: "Official giveaway page. Winners are contacted by DM.", category: "", link: "", hue: 207 },
  { handle: "harbourlightstudio_official", name: "Harbourlight Studio \u2714", verified: false, followers: 1204, following: 5990, bio: "Prize claims through the link below.", category: "", link: "claim-prize.example", hue: 203 },
  { handle: "harbour.light.studio", name: "Harbour Light Studio (fan page)", verified: false, followers: 2310, following: 180, bio: "Fan page, not affiliated. Reposts with credit.", category: "", link: "", hue: 210 },
  { handle: SHOP, name: "Saltmarsh Goods", verified: false, followers: 6902, following: 540, bio: "Ceramics and linen from the Saltmarsh coast. One-of-one pieces. DM to buy.", category: "Shopping & retail", link: "", hue: 150 },
  { handle: "kiln.theory", name: "Kiln Theory", verified: false, followers: 12880, following: 610, bio: "Glaze chemistry for people who hate glaze chemistry.", category: "Education", link: "", hue: 28 },
  { handle: "kilnworks.shop", name: "Kilnworks", verified: true, followers: 88400, following: 12, bio: "Studio kilns, shipped.", category: "Product/service", link: "kilnworks.example", hue: 5 },
  { handle: "glazelab.supply", name: "Glaze Lab Supply", verified: false, followers: 23100, following: 45, bio: "Glazes, oxides and stains.", category: "Shopping & retail", link: "", hue: 280 },
  person("lena.moss", "Lena Moss", 120), person("kofi.ade", "Kofi Ade", 40), person("ines.vidal", "Inés Vidal", 330),
  person("oskar.brandt", "Oskar Brandt", 90), person("maya.hollis", "Maya Hollis", 300), person("priya.nair", "Priya Nair", 350),
  person("jonah.west", "Jonah West", 60), person("aiyana.cole", "Aiyana Cole", 170), person("theo.marchetti", "Theo Marchetti", 230),
  person("sofia.lindqvist", "Sofia Lindqvist", 260), person("ravi.menon", "Ravi Menon", 20), person("noor.haddad", "Noor Haddad", 190),
  person("eli.park", "Eli Park", 100), person("hana.sato", "Hana Sato", 340), person("felix.ortega", "Felix Ortega", 70),
  person("grace.adeyemi", "Grace Adeyemi", 290), person("luca.bianchi", "Luca Bianchi", 140), person("zara.qureshi", "Zara Qureshi", 310),
  person("milo.frank", "Milo Frank", 50), person("ava.kowalski", "Ava Kowalski", 220), person("sam.rivera", "Sam Rivera", 80),
  person("yuki.tanaka", "Yuki Tanaka", 0), person("dara.oconnell", "Dara O'Connell", 130), person("nell.pryce", "Nell Pryce", 160),
  person("omar.farouk", "Omar Farouk", 35), person("clara.voss", "Clara Voss", 250), person("ben.achebe", "Ben Achebe", 110),
  person("iris.nakamura", "Iris Nakamura", 270), person("tomas.reid", "Tomás Reid", 75),
];

/** Accounts the visitor follows when the fixture starts. */
export const INITIAL_FOLLOWING: readonly string[] = [STUDIO, SHOP, "kiln.theory", "lena.moss", "kofi.ade", "priya.nair", "theo.marchetti", "sofia.lindqvist", "ines.vidal", "maya.hollis"];

export function accountByHandle(handle: string): Account | undefined {
  return ACCOUNTS.find((account) => account.handle === handle);
}
