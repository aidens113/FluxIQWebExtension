/** A neighbourhood a listing can be collected from, and how far it is from the centre of Kelford. */
export type Place = { id: string; name: string; miles: number };

/**
 * Kelford and the places around it, nearest first. The default search radius,
 * 20 miles, takes in everything up to Castle Dunmore; Pellingford is outside
 * it. A 10-mile radius stops at Ashby Moor and a 5-mile radius at Saltmarsh
 * Row, which is where the tasks' distance limits fall.
 */
export const PLACES = [
  { id: "kelford-centre", name: "Kelford Centre", miles: 0.6 },
  { id: "kelford-harbour", name: "Kelford Harbour", miles: 1.8 },
  { id: "upper-kelford", name: "Upper Kelford", miles: 2.9 },
  { id: "saltmarsh-row", name: "Saltmarsh Row", miles: 4.2 },
  { id: "brackwater", name: "Brackwater", miles: 6.7 },
  { id: "ashby-moor", name: "Ashby Moor", miles: 8.9 },
  { id: "hallam-cross", name: "Hallam Cross", miles: 11.4 },
  { id: "wendle-green", name: "Wendle Green", miles: 14.8 },
  { id: "castle-dunmore", name: "Castle Dunmore", miles: 18.6 },
  { id: "pellingford", name: "Pellingford", miles: 23.5 },
] as const satisfies readonly Place[];

export type PlaceId = (typeof PLACES)[number]["id"];

export function placeById(id: PlaceId): Place {
  const place = PLACES.find((candidate) => candidate.id === id);
  if (!place) throw new Error(`Unknown place ${id}`);
  return place;
}
