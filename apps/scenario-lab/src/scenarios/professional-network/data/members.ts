import type { Degree, Member } from "../types.js";

type Row = [name: string, headline: string, location: string, city: string, degree: Degree, mutual: string, company: string, extra?: Partial<Pick<Member, "pronouns" | "current" | "action" | "hidden">>];

const RDAM = "Rotterdam, South Holland, Netherlands";
const RDAM_NY = "Rotterdam, New York, United States";
const AMS = "Amsterdam, North Holland, Netherlands";
const UTR = "Utrecht, Utrecht, Netherlands";
const HAGUE = "The Hague, South Holland, Netherlands";
const SCHIEDAM = "Schiedam, South Holland, Netherlands";
const EINDHOVEN = "Eindhoven, North Brabant, Netherlands";

/**
 * Every member the site knows, in the search's relevance order. The people
 * search matches a keyword against a headline word it begins, so "data
 * engineer" also returns an analytics engineer and a data engineering manager,
 * and never a data analyst. The rows are interleaved the way a relevance
 * ranking interleaves them: first-degree colleagues, the other Rotterdam, the
 * town next door and out-of-network members sit between the people a
 * Rotterdam, second-degree search returns.
 */
const ROWS: readonly Row[] = [
  ["Mara Okafor", "Senior Data Engineer at Harbourline Logistics", RDAM, "rotterdam-nl", "S", "Wouter de Boer and 11 other mutual connections", "Harbourline Logistics"],
  ["Wouter de Boer", "Data Engineer at Northwick Analytics", RDAM, "rotterdam-nl", "F", "", "Northwick Analytics", { action: "Message" }],
  ["Joost van Dijk 🚀", "Data Engineer | Spark · Kafka · Airflow | Building the port's data platform", RDAM, "rotterdam-nl", "S", "Anouk Smit and 3 other mutual connections", "Portwise"],
  ["Kayla Brooks", "Data Engineer at Mohawk Valley Health", RDAM_NY, "rotterdam-ny", "S", "Priya Shah is a mutual connection", "Mohawk Valley Health", { pronouns: "She/Her" }],
  ["Aylin Demir", "Lead Data Engineer @ Maasvlakte Terminals", "Rotterdam, Netherlands", "rotterdam-nl", "S", "38 mutual connections", "Maasvlakte Terminals", { action: "Follow" }],
  ["Sanne de Wit", "Senior Data Engineer | Hiring for TalentBridge", AMS, "amsterdam", "S", "Lars Hoekstra and 22 other mutual connections", "TalentBridge Recruitment"],
  ["Ruben Klaassen", "Data Engineer II at Kade Energy", RDAM, "rotterdam-nl", "S", "Pieter Groen, Mei Lin and 4 other mutual connections", "Kade Energy", { current: "Current: Data Engineer II at Kade Energy" }],
  ["Guildline Member", "Data Engineer at a logistics scale-up", RDAM, "rotterdam-nl", "O", "", "", { hidden: true }],
  ["Priyanka Raman", "Analytics Engineer | dbt, Data Modelling, Looker", RDAM, "rotterdam-nl", "S", "Mara Okafor is a mutual connection", "Veldhuis Bank", { pronouns: "She/Her" }],
  ["Emre Yilmaz", "Data Engineer at Schiedam Port Services", SCHIEDAM, "schiedam", "S", "Ruben Klaassen and 2 other mutual connections", "Schiedam Port Services"],
  ["Tomasz Wiśniewski", "Software Engineer, Data Platform — Veldhuis Bank", RDAM, "rotterdam-nl", "S", "Isabel Fonseca and 7 other mutual connections", "Veldhuis Bank", { current: "Current: Software Engineer at Veldhuis Bank" }],
  ["Anouk Smit", "Senior Data Engineer at Northwick Analytics", RDAM, "rotterdam-nl", "F", "", "Northwick Analytics", { action: "Message" }],
  ["Femke de Graaf", "Freelance Data Engineer | Azure · Databricks | Open to projects", "Rotterdam", "rotterdam-nl", "S", "Joost van Dijk 🚀 is a mutual connection", ""],
  ["Derek Olsen", "Senior Data Engineer", RDAM_NY, "rotterdam-ny", "S", "2 mutual connections", "Hudson Grid"],
  ["Chidi Nwosu", "Data Engineering Manager at Harbourline Logistics", RDAM, "rotterdam-nl", "S", "Mara Okafor and 15 other mutual connections", "Harbourline Logistics"],
  ["Daniela Costa", "Data Engineer at Canal Street Media", AMS, "amsterdam", "S", "5 mutual connections", "Canal Street Media"],
  ["Lotte Jansen", "Junior Data Engineer · Trainee at Portwise", "Rotterdam, Zuid-Holland, Nederland", "rotterdam-nl", "S", "Joost van Dijk 🚀 and 1 other mutual connection", "Portwise"],
  ["Ricardo Alves", "Data Engineer | Kafka · Flink", RDAM, "rotterdam-nl", "F", "", "Kade Energy", { action: "Message" }],
  ["Sébastien Moreau", "Staff Data Engineer | Streaming & real-time analytics", RDAM, "rotterdam-nl", "S", "21 mutual connections", "Northsea Freight", { action: "Follow" }],
  ["Guildline Member", "Senior Data Engineer", RDAM, "rotterdam-nl", "O", "", "", { hidden: true }],
  ["Hana Sato, PhD", "Machine Learning & Data Engineer at Erasmus Health Data Lab", RDAM, "rotterdam-nl", "S", "Priyanka Raman and 9 other mutual connections", "Erasmus Health Data Lab", { current: "Current: Research Data Engineer at Erasmus Health Data Lab" }],
  ["Freya Lindqvist", "Data Engineer at Rijnmond Water", UTR, "utrecht", "S", "3 mutual connections", "Rijnmond Water"],
  ["Daan Visser", "Big Data Engineer bij Kade Energy", RDAM, "rotterdam-nl", "S", "Ruben Klaassen and 5 other mutual connections", "Kade Energy"],
  ["Mei Lin", "Data Engineer at Harbourline Logistics", RDAM, "rotterdam-nl", "F", "", "Harbourline Logistics", { action: "Message" }],
  ["Olumide Adeyemi", "Data Engineer | GCP Professional Data Engineer | Python", RDAM, "rotterdam-nl", "S", "12 mutual connections", "Northsea Freight"],
  ["Priya Shah", "Data Engineer", RDAM_NY, "rotterdam-ny", "S", "Kayla Brooks is a mutual connection", "Mohawk Valley Health"],
  ["Isabel Fonseca", "Senior Data Engineer — Payments at Veldhuis Bank", RDAM, "rotterdam-nl", "S", "Tomasz Wiśniewski and 8 other mutual connections", "Veldhuis Bank", { action: "Message" }],
  ["Thijs van Leeuwen", "Data Engineer", RDAM, "rotterdam-nl", "O", "", "Maasvlakte Terminals"],
  ["Kees Bakker", "Engineer, Data & Integration at Gemeente Rotterdam", RDAM, "rotterdam-nl", "S", "Yara Haddad and 3 other mutual connections", "Gemeente Rotterdam"],
  ["Julia Nowak", "Data Engineer at Canal Street Media", AMS, "amsterdam", "S", "1 mutual connection", "Canal Street Media"],
  ["Zoë Hendriks", "Data Engineer at Portwise | Ex-Maasvlakte Terminals", RDAM, "rotterdam-nl", "S", "Lotte Jansen and 6 other mutual connections", "Portwise"],
  ["Sven Aalders", "Data Engineer at Hofstad Digital", HAGUE, "the-hague", "S", "4 mutual connections", "Hofstad Digital"],
  ["Arjun Mehta", "Cloud Data Engineer | AWS · Terraform · Snowflake", RDAM, "rotterdam-nl", "S", "17 mutual connections", "Northsea Freight"],
  ["Pieter Groen", "Lead Data Engineer at Kade Energy", RDAM, "rotterdam-nl", "F", "", "Kade Energy", { action: "Message" }],
  ["Noor El Amrani", "Data Engineer & Data Steward | Harbourline Logistics", "Rotterdam, Netherlands", "rotterdam-nl", "S", "Mara Okafor and 2 other mutual connections", "Harbourline Logistics"],
  ["Marcus Webb", "Data Engineer II", RDAM_NY, "rotterdam-ny", "S", "1 mutual connection", "Hudson Grid"],
  ["Bram Mulder", "Principal Data Engineer at Northsea Freight", RDAM, "rotterdam-nl", "S", "Arjun Mehta and 10 other mutual connections", "Northsea Freight", { current: "Current: Principal Data Engineer at Northsea Freight", action: "Follow" }],
  ["Guildline Member", "Data Engineer | Python | SQL", RDAM, "rotterdam-nl", "O", "", "", { hidden: true }],
  ["Lars Hoekstra", "Data Engineer at TalentBridge Recruitment (we're hiring!)", RDAM, "rotterdam-nl", "S", "Sanne de Wit and 30 other mutual connections", "TalentBridge Recruitment"],
  ["Nadia Benali", "Data Engineer", EINDHOVEN, "eindhoven", "S", "2 mutual connections", "Brainport Mobility"],
  ["Ewa Kowalczyk", "Data Engineer | Kafka Streams | Open to relocation", RDAM, "rotterdam-nl", "S", "6 mutual connections", ""],
  ["Koen Verbeek", "Data Engineer at Schiedam Port Services", SCHIEDAM, "schiedam", "S", "3 mutual connections", "Schiedam Port Services"],
  ["Matteo Ricci", "Senior Data Engineer at Kade Energy", RDAM, "rotterdam-nl", "S", "Daan Visser and 4 other mutual connections", "Kade Energy"],
  ["Elif Kaya", "Data Engineer", UTR, "utrecht", "S", "7 mutual connections", "Rijnmond Water"],
  ["Yara Haddad", "Data Engineer (m/v/x) bij Gemeente Rotterdam", "Rotterdam", "rotterdam-nl", "S", "Kees Bakker is a mutual connection", "Gemeente Rotterdam"],
  ["Ingrid Solberg", "Data Engineer at Hofstad Digital", HAGUE, "the-hague", "O", "", "Hofstad Digital"],
  // Rotterdam, second degree, and not what the search returns: each headline misses one of the two words.
  ["Fleur Brouwer", "Data Analyst at Harbourline Logistics", RDAM, "rotterdam-nl", "S", "Mara Okafor is a mutual connection", "Harbourline Logistics"],
  ["Hamza Ouali", "Database Administrator at Veldhuis Bank", RDAM, "rotterdam-nl", "S", "3 mutual connections", "Veldhuis Bank"],
  ["Rosa Meijer", "Engineering Manager, Payments at Veldhuis Bank", RDAM, "rotterdam-nl", "S", "Isabel Fonseca and 2 other mutual connections", "Veldhuis Bank"],
  ["Stefan Vos", "Data Scientist at Kade Energy", RDAM, "rotterdam-nl", "S", "Daan Visser is a mutual connection", "Kade Energy"],
  // People the signed-in member invites, messages, or hears from, whose headlines no data-engineer search returns.
  ["Aoife Brennan", "Talent Acquisition Partner at TalentBridge Recruitment", AMS, "amsterdam", "S", "Sanne de Wit is a mutual connection", "TalentBridge Recruitment"],
  ["Grace Mbeki", "Talent Partner, Technology at Kade Energy", RDAM, "rotterdam-nl", "S", "Pieter Groen is a mutual connection", "Kade Energy"],
  ["Tobias Keller", "Head of Platform at Veldhuis Bank", RDAM, "rotterdam-nl", "S", "4 mutual connections", "Veldhuis Bank"],
  ["Niamh Collins", "People Partner | Tech hiring across Benelux", AMS, "amsterdam", "S", "2 mutual connections", "Canal Street Media"],
  ["Rahul Verma", "Engineering Lead, Integrations at Portwise", RDAM, "rotterdam-nl", "S", "Zoë Hendriks is a mutual connection", "Portwise"],
  ["Chloé Martin", "Recruitment Consultant — Data & AI", UTR, "utrecht", "S", "5 mutual connections", "Northbound Search"],
  ["Oskar Nilsson", "Director of Analytics at Northsea Freight", RDAM, "rotterdam-nl", "S", "Bram Mulder and 1 other mutual connection", "Northsea Freight"],
  ["Lieke Postma", "Hiring Manager, Data Platform at Gemeente Rotterdam", RDAM, "rotterdam-nl", "S", "Kees Bakker is a mutual connection", "Gemeente Rotterdam"],
  ["Mehmet Arslan", "Solutions Architect at Hudson Grid", RDAM_NY, "rotterdam-ny", "S", "1 mutual connection", "Hudson Grid"],
  ["Ines Carvalho", "Technical Recruiter at Brainport Mobility", EINDHOVEN, "eindhoven", "S", "2 mutual connections", "Brainport Mobility"],
  ["Marit Dekker", "Engineering Manager at Hofstad Digital", HAGUE, "the-hague", "S", "3 mutual connections", "Hofstad Digital"],
  ["Sophie Laurent", "Data Product Owner at Northwick Analytics", "Utrecht, Netherlands", "utrecht", "F", "", "Northwick Analytics", { action: "Message" }],
  ["Bas Timmer", "Analytics Lead at Northwick Analytics", "Utrecht, Netherlands", "utrecht", "F", "", "Northwick Analytics", { action: "Message" }],
  ["Ximena Ruiz", "Senior Recruiter at Northbound Search", AMS, "amsterdam", "S", "6 mutual connections", "Northbound Search"],
  ["Pavel Novák", "Platform Engineer at Kade Energy", RDAM, "rotterdam-nl", "S", "Matteo Ricci and 2 other mutual connections", "Kade Energy"],
  ["Omar Farouk", "Founder at Quayside Labs | Hiring", RDAM, "rotterdam-nl", "S", "9 mutual connections", "Quayside Labs"],
  ["Lucia Romano", "Product Manager at Canal Street Media", AMS, "amsterdam", "S", "1 mutual connection", "Canal Street Media"],
  ["Priya Nair", "Engineering Manager, Data at Harbourline Logistics", RDAM, "rotterdam-nl", "F", "", "Harbourline Logistics", { action: "Message" }],
  ["Hendrik Mol", "Head of Data at Portwise", RDAM, "rotterdam-nl", "F", "", "Portwise", { action: "Message" }],
];

/** Lowercase ASCII words of a display name, so "Zoë Hendriks" is zoe-hendriks and "Joost van Dijk 🚀" is joost-van-dijk. */
function kebab(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/gu, "").toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

/** Six hex digits from the row, so every profile address carries the suffix a real one does and two namesakes never share one. */
function suffix(text: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(16).padStart(8, "0").slice(0, 6);
}

export const MEMBERS: readonly Member[] = ROWS.map(([name, headline, location, city, degree, mutual, company, extra], index) => ({
  urn: `urn:gl:member:${48_213 + index * 37}`,
  slug: `${kebab(name)}-${suffix(`${index}:${name}`)}`,
  name,
  pronouns: extra?.pronouns ?? "",
  headline,
  location,
  city,
  degree,
  mutual,
  current: extra?.current ?? "",
  company,
  action: extra?.action ?? "Connect",
  hidden: extra?.hidden ?? false,
}));
