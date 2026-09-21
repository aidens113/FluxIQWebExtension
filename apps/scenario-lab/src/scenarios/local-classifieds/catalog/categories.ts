/** A marketplace category, in the order the sidebar lists them. */
export type Category = { slug: string; label: string };

export const CATEGORIES = [
  { slug: "vehicles", label: "Vehicles" },
  { slug: "apparel", label: "Apparel" },
  { slug: "bicycles", label: "Bicycles" },
  { slug: "electronics", label: "Electronics" },
  { slug: "furniture", label: "Furniture" },
  { slug: "garden", label: "Garden & outdoor" },
  { slug: "home-goods", label: "Home goods" },
  { slug: "instruments", label: "Musical instruments" },
  { slug: "sport", label: "Sport & fitness" },
  { slug: "toys", label: "Toys & games" },
] as const satisfies readonly Category[];

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function categoryBySlug(slug: string): (typeof CATEGORIES)[number] | undefined {
  return CATEGORIES.find((candidate) => candidate.slug === slug);
}
