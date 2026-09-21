/** A person or shop selling on the marketplace, as the listing page introduces them. */
export type Seller = { id: string; name: string; joined: number; rating: number; reviews: number; replies: string };

export const SELLERS = [
  { id: "morgan-tate", name: "Morgan Tate", joined: 2019, rating: 4.9, reviews: 31, replies: "Usually responds within an hour" },
  { id: "jordan-pike", name: "Jordan Pike", joined: 2016, rating: 4.7, reviews: 58, replies: "Usually responds within a day" },
  { id: "ridgeline-deals", name: "Ridgeline Deals", joined: 2026, rating: 3.1, reviews: 4, replies: "Usually responds within a few minutes" },
  { id: "leila-farah", name: "Leila Farah", joined: 2021, rating: 5, reviews: 12, replies: "Usually responds within an hour" },
  { id: "fergus-lyle", name: "Fergus Lyle", joined: 2018, rating: 4.4, reviews: 9, replies: "Usually responds within a day" },
  { id: "imogen-blake", name: "Imogen Blake", joined: 2020, rating: 4.8, reviews: 22, replies: "Usually responds within an hour" },
  { id: "owen-bracegirdle", name: "Owen Bracegirdle", joined: 2015, rating: 4.6, reviews: 77, replies: "Usually responds within a few hours" },
  { id: "tomasz-wrona", name: "Tomasz Wrona", joined: 2022, rating: 4.9, reviews: 15, replies: "Usually responds within an hour" },
  { id: "niamh-doherty", name: "Niamh Doherty", joined: 2017, rating: 4.5, reviews: 40, replies: "Usually responds within a day" },
  { id: "beatrix-fell", name: "Beatrix Fell", joined: 2023, rating: 5, reviews: 3, replies: "Usually responds within a few hours" },
  { id: "kwame-asante", name: "Kwame Asante", joined: 2019, rating: 4.8, reviews: 26, replies: "Usually responds within an hour" },
  { id: "casey-moreno", name: "Casey Moreno", joined: 2024, rating: 4.2, reviews: 6, replies: "Usually responds within a day" },
  { id: "harper-quinlan", name: "Harper Quinlan", joined: 2014, rating: 4.9, reviews: 103, replies: "Usually responds within an hour" },
  { id: "dana-whitlock", name: "Dana Whitlock", joined: 2020, rating: 4.3, reviews: 18, replies: "Usually responds within a few hours" },
  { id: "ellis-carver", name: "Ellis Carver", joined: 2018, rating: 4.7, reviews: 35, replies: "Usually responds within a day" },
  { id: "priya-nandakumar", name: "Priya Nandakumar", joined: 2021, rating: 4.9, reviews: 20, replies: "Usually responds within an hour" },
  { id: "alex-rowe", name: "Alex Rowe", joined: 2017, rating: 4.6, reviews: 48, replies: "Usually responds within a few hours" },
  { id: "sam-ellery", name: "Sam Ellery", joined: 2022, rating: 4.8, reviews: 11, replies: "Usually responds within a day" },
  { id: "rosa-lindqvist", name: "Rosa Lindqvist", joined: 2016, rating: 4.5, reviews: 64, replies: "Usually responds within a few hours" },
  { id: "gideon-marsh", name: "Gideon Marsh", joined: 2025, rating: 4, reviews: 2, replies: "Usually responds within a day" },
] as const satisfies readonly Seller[];

export type SellerId = (typeof SELLERS)[number]["id"];

export function sellerById(id: SellerId): Seller {
  const seller = SELLERS.find((candidate) => candidate.id === id);
  if (!seller) throw new Error(`Unknown seller ${id}`);
  return seller;
}
