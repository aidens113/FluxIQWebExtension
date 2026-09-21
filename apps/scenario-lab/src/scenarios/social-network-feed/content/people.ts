/** Anyone with a profile: the signed-in member, friends, strangers the feed suggests, and people asking to be friends. */
export type Person = { slug: string; name: string; hue: number };

/** A group or a page. Groups hold members' posts; pages post for a brand, advertise, or get suggested. */
export type Community = { slug: string; name: string; hue: number; kind: "group" | "page"; about: string };

/** The signed-in member. Every "you" on the site is her. */
export const MAYA: Person = { slug: "maya-lindqvist", name: "Maya Lindqvist", hue: 204 };

/**
 * Everyone the site can name, keyed by profile slug.
 *
 * Two people are called Tom Becker. One is Maya's friend and posts in her
 * feed; the other sent her a friend request from a profile whose address ends
 * in a number, the way a second account with a taken name does. Nothing but
 * the address and the mutual-friend count tells them apart. Jonas Weber also
 * appears twice: once asking to be friends, once as a stranger in "People you
 * may know", with an Add friend button that looks like Confirm.
 */
export const PEOPLE: Readonly<Record<string, Person>> = Object.freeze(Object.fromEntries([
  MAYA,
  person("aisha-khan", "Aisha Khan", 12),
  person("tom-becker", "Tom Becker", 32),
  person("elena-sokolova", "Elena Sokolova", 280),
  person("marcus-reid", "Marcus Reid", 190),
  person("hannah-okafor", "Hannah Okafor", 340),
  person("dev-patel", "Dev Patel", 150),
  person("sofia-marin", "Sofía Marín", 10),
  person("lukas-brandt", "Lukas Brandt", 60),
  person("grace-liu", "Grace Liu", 300),
  person("oliver-hughes", "Oliver Hughes", 120),
  person("nadia-rahman", "Nadia Rahman", 20),
  person("ben-carter", "Ben Carter", 220),
  person("kim-tran", "Kim Tran", 100),
  person("rosa-delgado", "Rosa Delgado", 350),
  person("idris-bello", "Idris Bello", 80),
  person("walter-grieve", "Walter Grieve", 40),
  person("june-park", "June Park", 260),
  person("tom.becker.9", "Tom Becker", 36),
  person("amara-osei", "Amara Osei", 16),
  person("priya-nair", "Priya Nair", 320),
  person("jonas-weber", "Jonas Weber", 200),
  person("diego-alvarez", "Diego Alvarez", 90),
  person("lin-zhao", "Lin Zhao", 170),
  person("freya-holm", "Freya Holm", 240),
  person("marta-kowalczyk", "Marta Kowalczyk", 130),
  person("jonas.weber.hb", "Jonas Weber", 205),
  person("noah-fischer", "Noah Fischer", 70),
  person("chloe-martin", "Chloe Martin", 310),
  person("sam-okoro", "Sam Okoro", 25),
].map((entry) => [entry.slug, entry])));

/** Groups Maya belongs to, groups the feed suggests, and the pages that post, advertise and get suggested. */
export const COMMUNITIES: Readonly<Record<string, Community>> = Object.freeze(Object.fromEntries([
  community("riverside-allotments", "Riverside Allotment Society", 132, "group", "Private group · 1.4K members"),
  community("harbourside-runners", "Harbourside Runners", 18, "group", "Public group · 3.2K members"),
  community("old-town-bakers", "Old Town Bakers' Circle", 30, "group", "Private group · 860 members"),
  community("urban-growers", "Urban Growers Network", 110, "group", "Public group · 48K members"),
  community("cycle-commuters", "Cycle Commuters of Harbourside", 200, "group", "Public group · 5.6K members"),
  community("greenleaf-seeds", "Greenleaf Seeds Co.", 100, "page", "Gardening supplies"),
  community("brightside-energy", "Brightside Energy", 45, "page", "Energy company"),
  community("tidewater-outdoor", "Tidewater Outdoor", 210, "page", "Outdoor and sporting goods"),
  community("harbourside-council", "Harbourside Council", 225, "page", "Government organisation"),
  community("kettle-and-crumb", "Kettle & Crumb", 25, "page", "Bakery · Café"),
  community("riverside-half", "Riverside Half Marathon", 355, "page", "Sports event"),
].map((entry) => [entry.slug, entry])));

export function personBySlug(slug: string): Person {
  const found = PEOPLE[slug];
  if (!found) throw new Error(`No person ${slug}`);
  return found;
}

export function communityBySlug(slug: string): Community {
  const found = COMMUNITIES[slug];
  if (!found) throw new Error(`No group or page ${slug}`);
  return found;
}

function person(slug: string, name: string, hue: number): Person {
  return { slug, name, hue };
}

function community(slug: string, name: string, hue: number, kind: Community["kind"], about: string): Community {
  return { slug, name, hue, kind, about };
}
