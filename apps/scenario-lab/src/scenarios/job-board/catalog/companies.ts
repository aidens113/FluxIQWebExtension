/**
 * Every employer on the board, as its careers slug, display name, the rating
 * the pane prints beside it, and the paragraph its postings end with. All of
 * them are invented; two are named to be confused with another (Quillmark and
 * Quillmark Labs, Halvard Systems and Halvard Labs), as real ones are.
 */
export type Company = { slug: string; name: string; rating: string; about: string };

export const COMPANIES: readonly Company[] = [
  { slug: "quillmark", name: "Quillmark", rating: "4.2", about: "Quillmark makes invoicing and accounts-receivable software for 40,000 small businesses across the UK and Ireland." },
  { slug: "quillmark-labs", name: "Quillmark Labs", rating: "3.6", about: "Quillmark Labs is a four-person studio making study apps. We are not affiliated with any other Quillmark." },
  { slug: "halvard", name: "Halvard Systems", rating: "3.9", about: "Halvard Systems runs the warehouse management platform behind 3,000 warehouses in eleven countries." },
  { slug: "halvard-labs", name: "Halvard Labs", rating: "4.4", about: "Halvard Labs builds booking and membership software for independent gyms." },
  { slug: "copperline", name: "Copperline Payments", rating: "4.0", about: "Copperline Payments moves money for marketplaces and platforms in twelve currencies." },
  { slug: "saltmarsh", name: "Saltmarsh Games", rating: "4.3", about: "Saltmarsh Games is an independent studio of 90 people making online co-operative games." },
  { slug: "northgate", name: "Northgate Mobility", rating: "3.8", about: "Northgate Mobility builds the ticketing and journey-planning apps for six regional transport networks." },
  { slug: "pinecrest", name: "Pinecrest Retail", rating: "3.4", about: "Pinecrest Retail runs an online marketplace for independent homeware makers." },
  { slug: "kestrel", name: "Kestrel & Vane", rating: "4.1", about: "Kestrel & Vane builds market data and pricing systems for European exchanges." },
  { slug: "parsec", name: "Parsec Grid", rating: "4.5", about: "Parsec Grid balances supply and demand on the electricity grid using home batteries and heat pumps." },
  { slug: "lumen", name: "Lumen Harbor", rating: "3.9", about: "Lumen Harbor is an observability company headquartered in Portland, Oregon." },
  { slug: "ashgrove", name: "Ashgrove Bank", rating: "3.2", about: "Ashgrove Bank is a UK challenger bank serving 1.2 million customers." },
  { slug: "tidewell", name: "Tidewell Energy", rating: "4.0", about: "Tidewell Energy installs and operates battery storage for councils and housing associations." },
  { slug: "marlowe", name: "Marlowe Freight", rating: "3.5", about: "Marlowe Freight delivers parcels for 2,000 online shops across Great Britain." },
  { slug: "castellan", name: "Castellan Health", rating: "3.7", about: "Castellan Health makes appointment and records software for GP surgeries." },
  { slug: "brightwater", name: "Brightwater Analytics", rating: "4.1", about: "Brightwater Analytics helps utilities forecast demand from smart-meter data." },
  { slug: "orbisat", name: "Orbisat", rating: "4.6", about: "Orbisat operates a network of ground stations for Earth-observation satellites." },
  { slug: "oakridge", name: "Oakridge Freight", rating: "3.3", about: "Oakridge Freight runs cross-docking warehouses along the M62 corridor." },
  { slug: "verity", name: "Verity Legal Tech", rating: "4.2", about: "Verity Legal Tech processes contracts and court bundles for 600 law firms." },
];

/** The company a posting names. Every name on the board is in `COMPANIES`, so an unknown one is a fixture defect. */
export function companyByName(name: string): Company {
  const company = COMPANIES.find((candidate) => candidate.name === name);
  if (!company) throw new Error(`job-board: no company named ${name}`);
  return company;
}

/** The company a careers-site slug names, or `undefined` for a slug no employer uses. */
export function companyBySlug(slug: string): Company | undefined {
  return COMPANIES.find((candidate) => candidate.slug === slug);
}
