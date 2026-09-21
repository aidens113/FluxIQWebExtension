import type { JobType, Posting, Salary, Workplace } from "../types.js";
import { companyByName } from "./companies.js";
import { jobKey } from "./job-key.js";
import { daily, unstated, yearly } from "./salary.js";

type Authored = {
  id: string;
  title: string;
  company: string;
  location: string;
  workplace: Workplace;
  jobType?: JobType;
  salary: Salary;
  postedHours: number;
  snippet: string;
  /** A requisition on the employer's Talentloom careers site, or `easy` for Rolefinch's own quick apply. */
  apply: string;
  closed?: true;
  fresh?: true;
};

const REMOTE_UK = "Remote (UK)";

/**
 * Every posting on the board, in the order the relevance ranking lists them.
 *
 * The remote Rust roles are the extraction task's ground: seven of them are
 * fully remote in the UK with a yearly salary starting at £70,000 or more, and
 * around them sit the roles a careless read takes by mistake -- a day rate, a
 * ceiling with no floor, a floor of £69,500, a remote role in Europe priced in
 * euros with German separators, one in the US, a "Trust & Safety" role that a
 * substring search returns for "rust", a Go role that mentions Rust, a manager
 * of a Rust team, and a same-titled role at Quillmark Labs, which is not
 * Quillmark. The hours are chosen so that the tenth result of the natural
 * searches is always one of the seven: when the fresh posting goes live
 * between page one and page two, that result is shown on both.
 */
const AUTHORED: readonly Authored[] = [
  { id: "m1", title: "Senior Rust Engineer", company: "Quillmark", location: REMOTE_UK, workplace: "remote", salary: yearly("£85,000 – £100,000 a year", 85_000, 100_000), postedHours: 20, snippet: "Own the ledger services behind Quillmark's invoicing API, written in Rust and running on Kubernetes.", apply: "QM-4471" },
  { id: "d1", title: "Rust Engineer", company: "Saltmarsh Games", location: REMOTE_UK, workplace: "remote", salary: yearly("£65,000 – £80,000 a year", 65_000, 80_000), postedHours: 30, snippet: "Build the matchmaking and replay services for our online titles in Rust.", apply: "SG-208" },
  { id: "f1", title: "Rust Engineer (Developer Tooling)", company: "Northgate Mobility", location: REMOTE_UK, workplace: "remote", salary: yearly("£65,000 – £80,000 a year", 65_000, 80_000), postedHours: 2, snippet: "Build the build and test tooling our 200 engineers use every day, mostly in Rust.", apply: "NM-7730", fresh: true },
  { id: "m2", title: "Rust Engineer, Settlement Systems", company: "Copperline Payments", location: REMOTE_UK, workplace: "remote", salary: yearly("£72k – £80k per annum", 72_000, 80_000), postedHours: 44, snippet: "Settle card and bank transfers across twelve currencies in near real time.", apply: "CP-1193" },
  { id: "d4", title: "Trust & Safety Engineer", company: "Pinecrest Retail", location: REMOTE_UK, workplace: "remote", salary: yearly("£75,000 – £85,000 a year", 75_000, 85_000), postedHours: 50, snippet: "Detect fraud and abuse across the Pinecrest marketplace before buyers ever see it.", apply: "easy" },
  { id: "m5", title: "Backend Engineer – Rust", company: "Halvard Systems", location: REMOTE_UK, workplace: "remote", salary: yearly("£90,000 a year", 90_000, 90_000), postedHours: 76, snippet: "Move the stock-reservation engine behind 3,000 warehouses from Java to Rust.", apply: "HS-3305" },
  { id: "d2", title: "Senior Rust Engineer", company: "Kestrel & Vane", location: "Remote (Europe)", workplace: "remote", salary: yearly("€85.000 – €100.000 a year", 85_000, 100_000, "EUR"), postedHours: 60, snippet: "Work from anywhere in the EU on our low-latency market data platform.", apply: "KV-5520" },
  { id: "m3", title: "Staff Rust Engineer", company: "Parsec Grid", location: REMOTE_UK, workplace: "remote", salary: yearly("From £95,000 a year", 95_000, null), postedHours: 98, snippet: "Set the technical direction for the grid-balancing platform that keeps the lights on.", apply: "PG-3018" },
  { id: "d3", title: "Rust Engineer", company: "Lumen Harbor", location: "Remote (US)", workplace: "remote", salary: yearly("$150,000 – $175,000 a year", 150_000, 175_000, "USD"), postedHours: 95, snippet: "Build storage engines for our observability platform. US time zones only.", apply: "LH-0442" },
  { id: "d6", title: "Rust Contractor – Trading Systems", company: "Ashgrove Bank", location: REMOTE_UK, workplace: "remote", jobType: "Contract", salary: daily("£650 – £750 a day", 650, 750), postedHours: 97, snippet: "Six-month contract outside IR35 on the bank's equities order router.", apply: "AB-9901" },
  { id: "m4", title: "Rust Developer (Embedded)", company: "Tidewell Energy", location: REMOTE_UK, workplace: "remote", salary: yearly("£70,000 – £78,000 a year", 70_000, 78_000), postedHours: 146, snippet: "Write firmware for battery storage controllers deployed across 400 sites.", apply: "TE-2764" },
  { id: "d7", title: "Senior Rust Engineer", company: "Marlowe Freight", location: REMOTE_UK, workplace: "remote", salary: yearly("Up to £95,000 a year", null, 95_000), postedHours: 130, snippet: "Route 40,000 parcels a day through the planning engine you will help rebuild in Rust.", apply: "easy" },
  { id: "d5", title: "Senior Go Engineer", company: "Castellan Health", location: REMOTE_UK, workplace: "remote", salary: yearly("£80,000 – £95,000 a year", 80_000, 95_000), postedHours: 90, snippet: "Go services for patient scheduling. Rust experience is a plus.", apply: "CH-6610" },
  { id: "d8", title: "Rust Engineer", company: "Brightwater Analytics", location: REMOTE_UK, workplace: "remote", salary: unstated(), postedHours: 150, snippet: "Help us rewrite our forecasting query engine in Rust.", apply: "easy" },
  { id: "d11", title: "Rust Engineer", company: "Kestrel & Vane", location: REMOTE_UK, workplace: "remote", salary: yearly("£69,500 – £90,000 a year", 69_500, 90_000), postedHours: 170, snippet: "Join the UK team building our Rust pricing library.", apply: "KV-5531" },
  { id: "m6", title: "Principal Engineer (Rust, Distributed Systems)", company: "Orbisat", location: REMOTE_UK, workplace: "remote", salary: yearly("£110,000 – £130,000 a year", 110_000, 130_000), postedHours: 220, snippet: "Lead the ground-station scheduling system that talks to 180 satellites.", apply: "OS-1207" },
  { id: "d12", title: "Senior Rust Engineer (Contract)", company: "Quillmark", location: REMOTE_UK, workplace: "remote", jobType: "Contract", salary: daily("£600 – £700 a day", 600, 700), postedHours: 200, snippet: "Six-month contract to help migrate the billing engine to Rust.", apply: "QM-4475" },
  { id: "d9", title: "Rust Engineer, Graduate Programme", company: "Oakridge Freight", location: REMOTE_UK, workplace: "remote", salary: yearly("£38,000 a year", 38_000, 38_000), postedHours: 240, snippet: "Two-year graduate programme with a Rust-first backend team.", apply: "easy" },
  { id: "d15", title: "Senior Rust Engineer", company: "Quillmark Labs", location: REMOTE_UK, workplace: "remote", salary: yearly("£60,000 – £75,000 a year", 60_000, 75_000), postedHours: 260, snippet: "Build the offline sync engine for our study apps in Rust.", apply: "easy" },
  { id: "m7", title: "Rust Platform Engineer", company: "Verity Legal Tech", location: REMOTE_UK, workplace: "remote", salary: yearly("£75,000 – £88,000 a year", 75_000, 88_000), postedHours: 316, snippet: "Keep our document-processing platform fast, observable and boring.", apply: "VL-0815" },
  { id: "d13", title: "Engineering Manager, Payments Platform", company: "Copperline Payments", location: REMOTE_UK, workplace: "remote", salary: yearly("£120,000 – £140,000 a year", 120_000, 140_000), postedHours: 190, snippet: "Lead three teams building our Rust payments platform.", apply: "CP-1201" },
  { id: "h1", title: "Senior Rust Engineer", company: "Quillmark", location: "Hybrid (London)", workplace: "hybrid", salary: yearly("£90,000 – £105,000 a year", 90_000, 105_000), postedHours: 26, snippet: "Join the London payments squad two days a week in our Clerkenwell office.", apply: "QM-4480" },
  { id: "h3", title: "Rust Developer", company: "Castellan Health", location: "Hybrid (Manchester)", workplace: "hybrid", salary: yearly("£75,000 a year", 75_000, 75_000), postedHours: 180, snippet: "Three days a week in our Manchester office, building the records sync service.", apply: "CH-6622" },
  // Halvard Systems and the roles a search for it also returns.
  { id: "hv1", title: "Site Reliability Engineer", company: "Halvard Systems", location: "Hybrid (Leeds)", workplace: "hybrid", salary: yearly("£65,000 – £75,000 a year", 65_000, 75_000), postedHours: 22, snippet: "Keep the warehouse platform up for 3,000 sites and a very demanding Black Friday.", apply: "HS-3312" },
  { id: "hl1", title: "Platform Engineer", company: "Halvard Labs", location: REMOTE_UK, workplace: "remote", salary: yearly("£70,000 – £82,000 a year", 70_000, 82_000), postedHours: 52, snippet: "Run the booking systems independent gyms depend on, on infrastructure we design ourselves.", apply: "easy" },
  { id: "dx1", title: "Warehouse Systems Analyst", company: "Oakridge Freight", location: "Hybrid (Leeds)", workplace: "hybrid", salary: yearly("£45,000 – £52,000 a year", 45_000, 52_000), postedHours: 40, snippet: "Previous experience with Halvard Systems WMS is a strong plus.", apply: "easy" },
  { id: "hv2", title: "Product Designer", company: "Halvard Systems", location: "Leeds", workplace: "onsite", salary: yearly("£55,000 – £62,000 a year", 55_000, 62_000), postedHours: 100, snippet: "Design the handheld tools warehouse teams use on the floor.", apply: "HS-3290" },
  { id: "h2", title: "Rust Engineer", company: "Halvard Systems", location: "Leeds", workplace: "onsite", salary: yearly("£70,000 – £80,000 a year", 70_000, 80_000), postedHours: 124, snippet: "Five days a week at our Leeds engineering centre, on the robotics control plane.", apply: "HS-3301" },
  { id: "hv3", title: "Data Engineer", company: "Halvard Systems", location: REMOTE_UK, workplace: "remote", salary: yearly("£68,000 – £78,000 a year", 68_000, 78_000), postedHours: 226, snippet: "Build the pipelines behind our demand forecasts.", apply: "HS-3270" },
  { id: "hv4", title: "Engineering Manager", company: "Halvard Systems", location: "Leeds", workplace: "onsite", salary: unstated(), postedHours: 890, snippet: "Lead the warehouse robotics team of nine engineers.", apply: "HS-3150" },
  { id: "px", title: "Frontend Engineer", company: "Pinecrest Retail", location: REMOTE_UK, workplace: "remote", salary: yearly("£60,000 – £70,000 a year", 60_000, 70_000), postedHours: 1_010, snippet: "Build the seller dashboard in TypeScript and React.", apply: "easy", closed: true },
  // The rest of the board.
  { id: "g1", title: "Senior Frontend Engineer (React)", company: "Verity Legal Tech", location: REMOTE_UK, workplace: "remote", salary: yearly("£70,000 – £85,000 a year", 70_000, 85_000), postedHours: 34, snippet: "Build the review tools lawyers use to mark up 2,000-page bundles.", apply: "VL-0820" },
  { id: "g2", title: "Data Scientist", company: "Brightwater Analytics", location: "Hybrid (Bristol)", workplace: "hybrid", salary: yearly("£55,000 – £65,000 a year", 55_000, 65_000), postedHours: 58, snippet: "Forecast half-hourly demand for four regional utilities.", apply: "easy" },
  { id: "g3", title: "Product Manager, Payments", company: "Copperline Payments", location: "London", workplace: "onsite", salary: yearly("£85,000 – £95,000 a year", 85_000, 95_000), postedHours: 80, snippet: "Own payouts for our largest marketplace customers.", apply: "CP-1188" },
  { id: "g4", title: "DevOps Engineer", company: "Tidewell Energy", location: REMOTE_UK, workplace: "remote", salary: yearly("£60,000 – £72,000 a year", 60_000, 72_000), postedHours: 102, snippet: "Look after the fleet that talks to our battery sites.", apply: "TE-2770" },
  { id: "g5", title: "Customer Success Manager", company: "Quillmark", location: REMOTE_UK, workplace: "remote", salary: yearly("£45,000 – £50,000 a year", 45_000, 50_000), postedHours: 128, snippet: "Help accountancy practices get the most out of Quillmark.", apply: "QM-4460" },
  { id: "g6", title: "Python Developer", company: "Orbisat", location: "Hybrid (Cambridge)", workplace: "hybrid", salary: yearly("£60,000 – £70,000 a year", 60_000, 70_000), postedHours: 160, snippet: "Write the orbit planning tools our operators rely on.", apply: "OS-1199" },
  { id: "g7", title: "QA Engineer", company: "Saltmarsh Games", location: REMOTE_UK, workplace: "remote", salary: yearly("£42,000 – £50,000 a year", 42_000, 50_000), postedHours: 205, snippet: "Break our games before our players do.", apply: "easy" },
  { id: "g8", title: "iOS Engineer", company: "Northgate Mobility", location: REMOTE_UK, workplace: "remote", salary: yearly("£75,000 – £90,000 a year", 75_000, 90_000), postedHours: 250, snippet: "Build the ticketing app two million passengers open every morning.", apply: "NM-7712" },
  { id: "g9", title: "Security Engineer", company: "Ashgrove Bank", location: "London", workplace: "onsite", salary: yearly("£95,000 – £115,000 a year", 95_000, 115_000), postedHours: 280, snippet: "Defend a bank that has never had a branch.", apply: "AB-9880" },
  { id: "g10", title: "Technical Writer", company: "Parsec Grid", location: REMOTE_UK, workplace: "remote", salary: yearly("£50,000 – £58,000 a year", 50_000, 58_000), postedHours: 300, snippet: "Explain grid balancing to engineers, installers and regulators.", apply: "easy" },
];

export const POSTINGS: readonly Posting[] = AUTHORED.map(toPosting);

/** A posting by its authored id; every id a fixture names is authored here, so an unknown one is a defect. */
export function postingById(id: string): Posting {
  const posting = POSTINGS.find((candidate) => candidate.id === id);
  if (!posting) throw new Error(`job-board: no posting ${id}`);
  return posting;
}

/** A posting by its job key, or `undefined` for a key the board never issued. */
export function postingByKey(key: string): Posting | undefined {
  return POSTINGS.find((candidate) => candidate.key === key);
}

function toPosting(entry: Authored): Posting {
  const company = companyByName(entry.company);
  const jobType = entry.jobType ?? "Full-time";
  const where = entry.location.startsWith("Remote") ? "remotely" : `in ${entry.location.replace(/^Hybrid \((.*)\)$/u, "$1")}`;
  const posting: Posting = {
    id: entry.id,
    key: jobKey(entry.id),
    title: entry.title,
    company: entry.company,
    location: entry.location,
    workplace: entry.workplace,
    jobType,
    salary: entry.salary,
    postedHours: entry.postedHours,
    snippet: entry.snippet,
    description: [entry.snippet, company.about, `This is a ${jobType.toLowerCase()} role based ${where}.`],
    apply: entry.apply === "easy" ? { kind: "easy" } : { kind: "company", careersSlug: company.slug, requisition: entry.apply },
  };
  if (entry.closed) posting.closed = true;
  if (entry.fresh) posting.fresh = true;
  return posting;
}
