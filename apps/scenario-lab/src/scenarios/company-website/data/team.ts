/** One line of a card's credentials: `Gas Safe ID` and `4518203`, or `Registration pending`. */
export type Credential = { label: string; value: string };

/**
 * A card on the team page. Most are people; one is a job advert the page
 * builder styles exactly like a person, with a role, a branch and a Gas Safe
 * line of its own.
 */
export type TeamCard = {
  kind: "person" | "hiring";
  id: string;
  name: string;
  role: string;
  branchId: string;
  credentials: readonly Credential[];
  bio: string;
  leadership?: true;
};

const gasSafe = (value: string): Credential => ({ label: "Gas Safe ID", value });
const PENDING = gasSafe("Registration pending");

/**
 * Everyone, in the order "Everyone" lists them: grouped by branch in the
 * site's branch order, most senior first within a branch. Two people share a
 * name at different branches, the four leadership cards are repeated in the
 * leadership strip above the grid, one engineer's Gas Safe ID is his second
 * credential rather than his first, and apprentices carry a Gas Safe line
 * that holds no number.
 */
export const TEAM: readonly TeamCard[] = [
  { kind: "person", id: "gareth-pell", name: "Gareth Pell", role: "Managing Director", branchId: "wrenfield", credentials: [], bio: "Joined his father's firm as an apprentice in 1991 and has run it since 2008.", leadership: true },
  { kind: "person", id: "helen-marsh-okafor", name: "Helen Marsh-Okafor", role: "Operations Director", branchId: "wrenfield", credentials: [], bio: "Keeps forty vans on the road and every job on time.", leadership: true },
  { kind: "person", id: "dafydd-rees", name: "Dafydd Rees", role: "Senior Heating Engineer", branchId: "wrenfield", credentials: [gasSafe("2984410")], bio: "Twenty years on combi and system boilers." },
  { kind: "person", id: "nadia-baptiste", name: "Nadia Baptiste", role: "Office Manager", branchId: "wrenfield", credentials: [], bio: "The voice you hear when you ring head office." },
  { kind: "person", id: "callum-firth", name: "Callum Firth", role: "Heating Engineer", branchId: "wrenfield", credentials: [gasSafe("5521087")], bio: "Powerflush specialist." },
  { kind: "person", id: "rhian-taverner", name: "Rhian Taverner", role: "Apprentice Heating Engineer", branchId: "wrenfield", credentials: [PENDING], bio: "Second year of her apprenticeship." },
  { kind: "person", id: "sian-pritchard", name: "Siân Pritchard", role: "Head of Customer Care", branchId: "corve-bridge", credentials: [], bio: "Reads every review, good and bad.", leadership: true },
  { kind: "person", id: "marcus-oyelaran", name: "Marcus Oyelaran", role: "Plumbing & Heating Engineer", branchId: "corve-bridge", credentials: [gasSafe("4410236"), { label: "WaterSafe card", value: "WS-20931" }], bio: "Bathrooms, cylinders and anything in between." },
  { kind: "person", id: "leah-dunmore", name: "Leah Dunmore", role: "Oil Heating Technician", branchId: "corve-bridge", credentials: [{ label: "OFTEC reg.", value: "C4471" }], bio: "Our rural oil boiler expert." },
  { kind: "person", id: "jonah-stirling", name: "Jonah Stirling", role: "Service Planner", branchId: "corve-bridge", credentials: [], bio: "Builds the rota that gets an engineer to you." },
  { kind: "person", id: "ewan-halloran", name: "Ewan Halloran", role: "Senior Heating Engineer", branchId: "sallowmere", credentials: [gasSafe("3398120")], bio: "Leads the Sallowmere team." },
  { kind: "person", id: "james-whitlock-sallowmere", name: "James Whitlock", role: "Apprentice Heating Engineer", branchId: "sallowmere", credentials: [PENDING], bio: "First year, and already the fastest on a radiator swap." },
  { kind: "person", id: "amira-haddad", name: "Amira Haddad", role: "Heat Pump Engineer", branchId: "sallowmere", credentials: [{ label: "F-Gas cert.", value: "20417" }, { label: "MCS installer", value: "Yes" }], bio: "Designs and commissions our air source systems." },
  { kind: "person", id: "tomasz-wierzbicki", name: "Tomasz Wierzbicki", role: "Technical Director", branchId: "eastmoor", credentials: [gasSafe("3170942")], bio: "Signs off every installation we do.", leadership: true },
  { kind: "person", id: "priya-anand", name: "Priya Anand", role: "Senior Heating Engineer", branchId: "eastmoor", credentials: [gasSafe("4518203")], bio: "Trains our apprentices on fault finding." },
  { kind: "person", id: "james-whitlock-eastmoor", name: "James Whitlock", role: "Heating Engineer", branchId: "eastmoor", credentials: [gasSafe("6092315")], bio: "No relation to the other one. Honestly." },
  { kind: "person", id: "kofi-mensah-boateng", name: "Kofi Mensah-Boateng", role: "Plumber", branchId: "eastmoor", credentials: [{ label: "WaterSafe card", value: "WS-31177" }], bio: "Leaks, taps, toilets and tanks." },
  { kind: "person", id: "grace-lindqvist", name: "Grace Lindqvist", role: "Heating Engineer", branchId: "eastmoor", credentials: [gasSafe("5870034")], bio: "Moved to us from a national installer in 2022." },
  { kind: "person", id: "bethan-crowe", name: "Bethan Crowe", role: "Service Coordinator", branchId: "eastmoor", credentials: [], bio: "Books your annual service and reminds you when it is due." },
  { kind: "person", id: "ollie-pratchett", name: "Ollie Pratchett", role: "Apprentice Heating Engineer", branchId: "eastmoor", credentials: [PENDING], bio: "Joined us straight from college." },
  { kind: "person", id: "owen-castellane", name: "Owen Castellane", role: "Senior Heating Engineer", branchId: "hollins-cross", credentials: [gasSafe("2750618")], bio: "Opened the Hollins Cross branch in March." },
  { kind: "person", id: "farah-qureshi", name: "Farah Qureshi", role: "Heating Engineer", branchId: "hollins-cross", credentials: [gasSafe("6634907")], bio: "Unvented cylinder specialist." },
  { kind: "hiring", id: "hiring-hollins-cross", name: "Could this be you?", role: "Gas Safe Heating Engineer", branchId: "hollins-cross", credentials: [gasSafe("Required")], bio: "We are hiring at Hollins Cross: a van, tools, a training budget and no weekend call-outs unless you want them." },
  { kind: "person", id: "declan-moyes", name: "Declan Moyes", role: "Plumber", branchId: "hollins-cross", credentials: [{ label: "WaterSafe card", value: "WS-40218" }], bio: "Bathroom fitting and general plumbing." },
  { kind: "person", id: "ruth-abernethy", name: "Ruth Abernethy", role: "Heating Engineer", branchId: "hollins-cross", credentials: [gasSafe("4097755")], bio: "Twelve years with us across three branches." },
  { kind: "person", id: "stefan-novak", name: "Stefan Novak", role: "Heat Pump & Heating Engineer", branchId: "hollins-cross", credentials: [{ label: "F-Gas cert.", value: "31866" }, gasSafe("7012384")], bio: "Works on gas and heat pumps alike." },
  { kind: "person", id: "tariq-bello", name: "Tariq Bello", role: "Office Administrator", branchId: "hollins-cross", credentials: [], bio: "Answers the Hollins Cross phone." },
  { kind: "person", id: "megan-ashdown", name: "Megan Ashdown", role: "Apprentice Heating Engineer", branchId: "hollins-cross", credentials: [PENDING], bio: "Started in September." },
];

/** Cards the grid adds per request. */
export const TEAM_BATCH_SIZE = 8;

/**
 * Batches the grid loads on its own as its end scrolls into view; after that
 * it shows a "Show more people" button instead.
 */
export const TEAM_AUTO_BATCHES = 3;

/**
 * The counts the filter chips show. They come from a cache the page builder
 * refreshes nightly and were last refreshed before the two newest starters
 * joined, so three of them are wrong: there are 27 people, 7 at Eastmoor and
 * 7 at Hollins Cross.
 */
export const CHIP_COUNTS: Readonly<Record<string, number>> = {
  all: 26, wrenfield: 6, "corve-bridge": 4, sallowmere: 3, eastmoor: 6, "hollins-cross": 6,
};

/** The cards a filter shows, in page order: `all` or a branch id. */
export function teamCardsFor(filter: string): TeamCard[] {
  return TEAM.filter((card) => filter === "all" || card.branchId === filter);
}
