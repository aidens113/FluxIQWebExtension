/** One feed update. `promoted` carries the advertiser's line; `suggested` is a post from outside the member's network. */
export type FeedPost = {
  id: string;
  actor: string;
  actorHeadline: string;
  age: string;
  body: string;
  reactions: string;
  comments: string;
  promoted: boolean;
  suggested: boolean;
};

type PostRow = [actor: string, actorHeadline: string, age: string, body: string, reactions: string, comments: string, flag?: "promoted" | "suggested"];

/**
 * The home feed, fifteen updates delivered five at a time as the reader
 * scrolls. Counts are written the way the feed writes them: thousands with a
 * separator, large figures abbreviated.
 */
const ROWS: readonly PostRow[] = [
  ["Priya Nair", "Engineering Manager, Data at Harbourline Logistics", "2h", "We're growing the data platform team in Rotterdam. Two Data Engineer roles open: streaming and batch. DM me if you want the honest version of the job description.", "1,204", "87 comments"],
  ["Guildline Recruiter", "Promoted", "", "Hiring data engineers? Reach 2.1M engineers who are open to work. Start your free trial today.", "", "", "promoted"],
  ["Hendrik Mol", "Head of Data at Portwise", "5h", "Our port-call ETA model went from 4 hours of error to 38 minutes. Most of the gain was boring data engineering: deduplicating AIS pings across three vendors.", "642", "31 comments"],
  ["Sophie Laurent", "Data Product Owner at Northwick Analytics", "1d", "Reminder that 'data engineer' means six different jobs in six different companies. Read the stack, not the title.", "2.3K", "140 comments", "suggested"],
  ["Wouter de Boer", "Data Engineer at Northwick Analytics", "1d", "Shipped our first dbt project to production today. Tests caught three broken joins before anyone saw a dashboard.", "318", "12 comments"],
  ["Kade Energy", "Promoted", "", "Power the energy transition with data. Kade Energy is hiring in Rotterdam and Groningen.", "", "", "promoted"],
  ["Anouk Smit", "Senior Data Engineer at Northwick Analytics", "2d", "Hot take: most pipelines don't need streaming. They need a scheduler that alerts a human.", "904", "66 comments"],
  ["Mara Okafor", "Senior Data Engineer at Harbourline Logistics", "3d", "Talking about schema contracts between logistics partners at the Rotterdam Data Meetup next Thursday.", "455", "19 comments", "suggested"],
  ["Bas Timmer", "Analytics Lead at Northwick Analytics", "3d", "We're looking for a working-student analyst for the autumn. Utrecht or Rotterdam, 16 hours a week.", "210", "8 comments"],
  ["Omar Farouk", "Founder at Quayside Labs | Hiring", "4d", "Quayside Labs closed its seed round. First hire: a data engineer who likes ships more than slide decks.", "1,877", "203 comments"],
  ["Pieter Groen", "Lead Data Engineer at Kade Energy", "5d", "Grid telemetry arrives in 15-second buckets. Our warehouse used to store it in 1-minute ones. Guess which one the traders wanted.", "533", "24 comments"],
  ["Mei Lin", "Data Engineer at Harbourline Logistics", "6d", "Passed the cloud data engineer certification this week. The exam is mostly about IAM, which tracks.", "771", "58 comments"],
  ["TalentBridge Recruitment", "Promoted", "", "Sanne and Lars from TalentBridge place data engineers across the Randstad. Book a call.", "", "", "promoted"],
  ["Ricardo Alves", "Data Engineer | Kafka · Flink", "1w", "Flink savepoints saved us during last night's upgrade. Write the runbook before you need it.", "389", "15 comments"],
  ["Hendrik Mol", "Head of Data at Portwise", "1w", "Portwise Engineering Notes, issue 14: how we test pipelines against yesterday's data without copying it.", "1,020", "44 comments"],
];

export const FEED_POSTS: readonly FeedPost[] = ROWS.map(([actor, actorHeadline, age, body, reactions, comments, flag], index) => ({
  id: `urn:gl:activity:${7_199_880_441 + index * 1_009}`,
  actor,
  actorHeadline,
  age,
  body,
  reactions,
  comments,
  promoted: flag === "promoted",
  suggested: flag === "suggested",
}));

/** How many updates one load of the feed delivers. */
export const FEED_BATCH = 5;
