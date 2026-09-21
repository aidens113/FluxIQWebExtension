import type { Seller } from "../types.js";

/**
 * Everyone selling in the fixture's slice of the marketplace. The usernames
 * are the kind a marketplace actually has -- underscores, dots, hyphens, one
 * shop name in Dutch and one in German -- and all of them are invented.
 */
export const SELLERS: readonly Seller[] = [
  { id: "harrow_cameras", location: "Harrow, United Kingdom", feedback: 2318, positive: "99.7%", since: 2011 },
  { id: "tinhorn.film", location: "Leeds, United Kingdom", feedback: 861, positive: "100%", since: 2016 },
  { id: "oldgrain", location: "Bristol, United Kingdom", feedback: 412, positive: "99.5%", since: 2014 },
  { id: "rust_and_brass", location: "Norwich, United Kingdom", feedback: 1502, positive: "99.9%", since: 2009 },
  { id: "shutterbug_brum", location: "Birmingham, United Kingdom", feedback: 97, positive: "98.9%", since: 2021 },
  { id: "the_camera_loft", location: "Hebden Bridge, United Kingdom", feedback: 5530, positive: "99.8%", since: 2006 },
  { id: "northgate_photo", location: "Sheffield, United Kingdom", feedback: 233, positive: "100%", since: 2018 },
  { id: "sprocket-and-spool", location: "Brighton, United Kingdom", feedback: 1188, positive: "99.6%", since: 2012 },
  { id: "fotokiste-utrecht", location: "Utrecht, Netherlands", feedback: 3071, positive: "99.8%", since: 2010 },
  { id: "vinfilm.nl", location: "Groningen, Netherlands", feedback: 644, positive: "99.4%", since: 2015 },
  { id: "kameraboden", location: "Leipzig, Germany", feedback: 2204, positive: "99.9%", since: 2008 },
  { id: "atelier-sillage", location: "Lyon, France", feedback: 318, positive: "99.1%", since: 2019 },
  { id: "pinewood.optics", location: "Portland, Oregon, United States", feedback: 4410, positive: "99.8%", since: 2007 },
];

export function sellerById(id: string): Seller {
  const seller = SELLERS.find((candidate) => candidate.id === id);
  if (!seller) throw new Error(`Unknown seller ${id}`);
  return seller;
}
