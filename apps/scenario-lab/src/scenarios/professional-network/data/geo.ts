/**
 * The places a location filter can name. `cities` is what a filter on the
 * place matches: a city matches itself, a country every city inside it. Two
 * places are called Rotterdam, and a third, Schiedam, borders the first of
 * them, so choosing a location by the word alone gets it wrong.
 */
export type GeoPlace = { id: string; label: string; cities: readonly string[] };

const NETHERLANDS_CITIES = ["rotterdam-nl", "schiedam", "amsterdam", "utrecht", "the-hague", "eindhoven"] as const;

export const GEO_PLACES: readonly GeoPlace[] = [
  { id: "102890719", label: "Netherlands", cities: NETHERLANDS_CITIES },
  { id: "102011674", label: "Amsterdam, North Holland, Netherlands", cities: ["amsterdam"] },
  { id: "105668258", label: "Utrecht, Utrecht, Netherlands", cities: ["utrecht"] },
  { id: "100565514", label: "The Hague, South Holland, Netherlands", cities: ["the-hague"] },
  { id: "103035651", label: "Eindhoven, North Brabant, Netherlands", cities: ["eindhoven"] },
  { id: "106169143", label: "Rotterdam, South Holland, Netherlands", cities: ["rotterdam-nl"] },
  { id: "104305776", label: "Rotterdam, New York, United States", cities: ["rotterdam-ny"] },
  { id: "104463016", label: "Schiedam, South Holland, Netherlands", cities: ["schiedam"] },
];

/** The locations the filter offers before anything is typed. Neither Rotterdam is among them. */
export const DEFAULT_GEO_IDS: readonly string[] = ["102890719", "102011674", "105668258", "100565514", "103035651"];

export function geoById(id: string): GeoPlace | undefined {
  return GEO_PLACES.find((place) => place.id === id);
}
