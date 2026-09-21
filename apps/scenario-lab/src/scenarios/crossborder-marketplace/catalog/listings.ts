import type { Listing, ShipOrigin, Shipping } from "./types.js";

const HUBS = ["Computer & Office", "Computer Peripherals", "USB Hubs"] as const;
const STANDS = ["Computer & Office", "Laptop Accessories", "Laptop Stands"] as const;
const CHARGERS = ["Phones & Telecommunications", "Mobile Phone Accessories", "Chargers"] as const;

const FREE: Shipping = { kind: "free" };
const paid = (cents: number): Shipping => ({ kind: "paid", cents });
const freeOver = (cents: number): Shipping => ({ kind: "free-over", cents });

type Row = [id: string, title: string, storeId: string, price: number, original: number, rating: number | null, reviews: number, sold: string, origin: ShipOrigin, shipping: Shipping, choice: boolean, colors: readonly string[]];

function basic([id, title, storeId, priceCents, originalCents, rating, reviews, sold, origin, shipping, choice, colors]: Row, category: readonly string[] = HUBS): Listing {
  return { id, title, storeId, priceCents, originalCents, rating, reviews, sold, origins: [origin], shipping, choice, skuModel: "basic", colors, category };
}

/** The title both Voltbay listings carry, word for word: the lookalike copied it. */
const VOLTBAY_TITLE = "Voltbay USB C Hub Multiport Adapter Type C to HDMI 4K 60Hz USB 3.0 PD 100W SD TF Card Reader Docking Station for Laptop Tablet";

/** The listing the purchase tasks are about: three option groups, and a warehouse in each of three countries. */
export const VOLTBAY_OFFICIAL_ID = "1005008123450";
/** The same product from a different, similarly named seller, a little cheaper. */
export const VOLTBAY_LOOKALIKE_ID = "1005008719236";

const voltbayOfficial: Listing = {
  id: VOLTBAY_OFFICIAL_ID, title: VOLTBAY_TITLE, storeId: "voltbay-official", priceCents: 1249, originalCents: 2599, rating: 48, reviews: 1284,
  sold: "5,000+ sold", origins: ["China", "Spain", "Poland"], shipping: FREE, choice: true, skuModel: "hub", colors: ["Space Grey", "Silver", "Mint"], category: HUBS,
};

const voltbayLookalike: Listing = {
  id: VOLTBAY_LOOKALIKE_ID, title: VOLTBAY_TITLE, storeId: "voltbay-lookalike", priceCents: 1199, originalCents: 2499, rating: 46, reviews: 87,
  sold: "200+ sold", origins: ["China", "Spain", "Poland"], shipping: FREE, choice: false, skuModel: "hub", colors: ["Space Grey", "Silver", "Mint"], category: HUBS,
};

/**
 * Every organic result for a USB-C hub search, in the marketplace's own Best
 * Match order. The order is the ranking; the result pages cut it into pages,
 * insert the paid placements, and repeat a few results across page boundaries
 * the way a ranking that shifts between requests does (`results.ts`).
 *
 * Twenty of the forty-five can ship from Spain. Thirteen of those ship free
 * and are rated 4.5 or better; the other seven are the near misses a careful
 * reader has to tell apart -- rated 4.1 to 4.4, not rated at all, or charging
 * for shipping. Poland and the Czech Republic are EU warehouses too, and are
 * not Spain.
 */
export const ORGANIC_LISTINGS: readonly Listing[] = [
  basic(["1005008401187", "Hubsmith USB C Hub 6 in 1 Type C Docking Station HDMI 4K USB 3.0 PD 100W SD TF Reader Aluminium Adapter for Laptop", "hubsmith", 987, 2148, 49, 3120, "5,000+ sold", "China", FREE, true, ["Grey"]]),
  basic(["1005008633510", "Castellan USB C Hub 5 in 1 Ethernet RJ45 Gigabit HDMI 4K 3 USB 3.0 Ports Aluminium Adapter Plug and Play", "castellan", 1649, 2999, 48, 642, "1,000+ sold", "Spain", FREE, false, ["Grey", "Silver"]]),
  voltbayOfficial,
  basic(["1005008250944", "Qinport 4 Port USB 3.0 Hub Type C Splitter Ultra Slim 5Gbps Data Adapter for Laptop PC Accessories", "qinport", 319, 798, 46, 8840, "10,000+ sold", "China", freeOver(1000), true, ["Black", "White"]]),
  basic(["1005008577102", "Oaklane 7 in 1 USB C Docking Station Dual HDMI Triple Display 100W PD Charging Hub for Laptop", "oaklane", 2790, 4990, 47, 318, "500+ sold", "Spain", FREE, false, ["Space Grey"]]),
  basic(["1005008690415", "USB C Hub 4 in 1 USB 3.0 Adapter 5Gbps Type C Splitter Aluminium EU Stock", "keelson", 899, 1499, 43, 402, "800+ sold", "Spain", FREE, false, ["Grey", "Pink"]]),
  basic(["1005008118832", "Lumora 8 in 1 USB C Hub HDMI 4K VGA Ethernet PD Charging SD TF Card Reader Docking Station", "lumora", 1456, 3386, 47, 1506, "2,000+ sold", "China", FREE, true, ["Grey"]]),
  basic(["1005008742260", "USB C Hub 6 in 1 HDMI 4K PD 60W USB 3.0 Card Reader Fast Delivery from EU Warehouse", "vistula", 1599, 2699, 49, 211, "300+ sold", "Poland", FREE, false, ["Grey"]]),
  basic(["1005008655079", "Nordwave USB C Hub 3 Ports USB 3.0 with Gigabit Ethernet Adapter Type C to RJ45 LAN", "nordwave", 1329, 2249, 46, 377, "700+ sold", "Spain", FREE, false, ["Black"]]),
  basic(["1005008037751", "Type C Hub USB 3.0 2.0 OTG Adapter 4 Ports Mini Splitter for Phone Laptop Keyboard Mouse", "zhenfa", 147, 420, 44, 12870, "10,000+ sold", "China", paid(199), false, ["Black", "White"]]),
  basic(["1005008361297", "Tidewell 10 in 1 USB C Docking Station 4K HDMI VGA RJ45 PD 100W Audio SD TF Hub", "tidewell", 2174, 5299, 48, 944, "1,000+ sold", "China", FREE, true, ["Grey"]]),
  voltbayLookalike,
  basic(["1005008295518", "USB C Hub 7 Ports Powered USB 3.0 Hub with Individual Switches and 5V Power Adapter", "brightloop", 1805, 3610, 45, 233, "400+ sold", "China", FREE, false, ["Black"]]),
  basic(["1005008644183", "Castellan USB C to Dual HDMI Adapter Hub 8 in 1 Docking Station 4K 60Hz Laptop Dock", "castellan", 3199, 4599, 48, 57, "90 sold", "Spain", paid(249), false, ["Grey"]]),
  basic(["1005008698840", "Keelson USB C Hub 9 in 1 HDMI 4K 30Hz Ethernet 1000M PD 100W SD TF USB 3.0 Adapter", "keelson", 1995, 3495, 49, 781, "1,000+ sold", "Spain", FREE, false, ["Grey", "Silver"]]),
  basic(["1005008803376", "USB C Hub 5 in 1 Aluminium HDMI 4K 3 USB 3.0 PD 87W Adapter Ships from EU", "morava", 1290, 1990, 47, 102, "150+ sold", "Czech Republic", FREE, false, ["Grey"]]),
  basic(["1005008214467", "Sunforge Magnetic USB C Hub 6 in 1 Stackable Docking Station HDMI 4K PD USB 3.0 for Laptop", "sunforge", 1680, 4200, 46, 355, "600+ sold", "China", FREE, false, ["Grey", "Silver"]]),
  basic(["1005008578421", "Oaklane USB C Hub 4 Port USB 3.0 Slim Aluminium Data Hub with 60cm Extended Cable", "oaklane", 949, 1599, 45, 1177, "2,000+ sold", "Spain", FREE, false, ["Grey"]]),
  basic(["1005008402935", "Hubsmith 12 in 1 USB C Docking Station Triple Display Dual HDMI DP Ethernet PD 100W Dock", "hubsmith", 3842, 8990, 48, 402, "700+ sold", "China", FREE, true, ["Grey"]]),
  basic(["1005008647702", "USB C Hub 7 in 1 HDMI 4K USB 3.0 SD TF PD Charging Adapter New Arrival", "castellan", 1499, 2499, null, 0, "", "Spain", FREE, false, ["Grey"]]),
  basic(["1005008330158", "Kestrel USB C Hub HDMI Adapter 4K 60Hz 6 in 1 Type C Dongle PD 100W Card Reader", "kestrel", 763, 1908, 47, 4410, "5,000+ sold", "China", freeOver(1500), true, ["Grey"]]),
  basic(["1005008656614", "Nordwave 6 in 1 USB C Hub HDMI 4K 60Hz Ethernet PD 100W USB 3.0 Aluminium Dock", "nordwave", 2249, 3749, 47, 260, "400+ sold", "Spain", FREE, false, ["Grey"]]),
  basic(["1005008699327", "Keelson USB C to USB Adapter Hub 4 Ports USB 3.0 Portable Hub for Laptop Tablet", "keelson", 699, 1199, 41, 188, "300+ sold", "Spain", FREE, false, ["Black"]]),
  basic(["1005008467790", "Mirafone USB C Hub 5 in 1 HDMI 4K PD 100W 2 USB 3.0 Card Reader Adapter Ultra Slim", "mirafone", 820, 1863, 49, 2217, "3,000+ sold", "China", FREE, true, ["Grey", "Silver"]]),
  basic(["1005008751043", "Duvra USB C Hub 8 in 1 Ethernet HDMI 4K PD 100W SD TF 2 USB 3.0 EU Warehouse Fast Shipping", "duvra", 1799, 2799, 46, 139, "200+ sold", "Poland", FREE, false, ["Grey"]]),
  basic(["1005008645596", "Castellan USB C Hub 10 in 1 Dual HDMI Ethernet VGA PD 100W Docking Station Triple Display", "castellan", 3490, 5990, 48, 96, "150+ sold", "Spain", FREE, false, ["Grey"]]),
  basic(["1005008520367", "Pelican Peak USB 3.0 Hub 7 Ports Aluminium with Power Supply for Desktop Laptop", "pelican", 1274, 2548, 46, 520, "800+ sold", "China", paid(321), false, ["Silver"]]),
  basic(["1005008579913", "Oaklane Mini USB C Hub 3 in 1 HDMI 4K USB 3.0 PD 60W Travel Adapter", "oaklane", 1049, 1649, 46, 404, "600+ sold", "Spain", paid(199), false, ["Grey", "Pink"]]),
  basic(["1005008119640", "Lumora USB C Hub 4 in 1 USB 3.0 5Gbps Ultra Slim Splitter for Laptop Keyboard", "lumora", 289, 723, 47, 9950, "10,000+ sold", "China", FREE, true, ["Black", "White"]]),
  basic(["1005008700284", "Keelson USB C Docking Station 12 in 1 Triple Display 2 HDMI DP Ethernet PD 100W", "keelson", 4599, 7999, 47, 71, "100+ sold", "Spain", FREE, false, ["Grey"]]),
  basic(["1005008038975", "USB C Hub 8 in 1 Multiport Adapter HDMI Ethernet Card Reader PD 100W Aluminium", "zhenfa", 915, 2287, 43, 1320, "1,000+ sold", "China", FREE, false, ["Grey"]]),
  basic(["1005008657431", "Nordwave USB C Hub 7 in 1 HDMI 4K 60Hz 2 USB 3.0 USB C Data SD TF PD 100W", "nordwave", 1899, 3199, 48, 512, "900+ sold", "Spain", FREE, false, ["Grey", "Silver"]]),
  basic(["1005008251362", "Qinport USB C Hub 11 in 1 Docking Station 4K HDMI VGA Gigabit Ethernet PD 3.5mm Audio", "qinport", 1986, 4965, 48, 1402, "2,000+ sold", "China", FREE, true, ["Grey"]]),
  basic(["1005008646108", "Castellan USB C Hub 6 in 1 HDMI 4K Ethernet 3 USB 3.0 Plug and Play Aluminium", "castellan", 1549, 2599, 44, 166, "250+ sold", "Spain", FREE, false, ["Grey"]]),
  basic(["1005008743519", "Vistula USB C Hub 4K HDMI 5 in 1 with PD 100W and USB 3.0 Ports Sturdy Aluminium", "vistula", 1149, 1899, 48, 84, "120+ sold", "Poland", paid(299), false, ["Grey"]]),
  basic(["1005008580652", "Oaklane USB C Hub 8 in 1 HDMI 4K 60Hz Ethernet PD 100W SD TF 2 USB 3.0 Docking", "oaklane", 2499, 4299, 49, 205, "300+ sold", "Spain", FREE, false, ["Space Grey"]]),
  basic(["1005008296770", "Brightloop USB C Hub Stand 9 in 1 Vertical Docking Station HDMI 4K Ethernet PD", "brightloop", 2634, 6585, 45, 48, "90 sold", "China", FREE, false, ["Silver"]]),
  basic(["1005008701846", "Keelson USB C Hub 5 in 1 HDMI 4K 3 USB 3.0 PD Charging Portable Adapter", "keelson", 1199, 1899, 42, 97, "150+ sold", "Spain", paid(249), false, ["Grey"]]),
  basic(["1005008331409", "Kestrel USB C Hub 7 in 1 HDMI 4K 60Hz 100W PD USB 3.0 SD TF Aluminium Adapter", "kestrel", 1021, 2553, 48, 2689, "3,000+ sold", "China", freeOver(1000), true, ["Grey"]]),
  basic(["1005008804695", "Morava USB C Docking Station Dual Monitor HDMI DP 11 in 1 PD 100W Ethernet", "morava", 3690, 5490, 45, 22, "40 sold", "Czech Republic", paid(349), false, ["Grey"]]),
  basic(["1005008648384", "Castellan USB C Hub 4 in 1 USB 3.0 Ports 5Gbps Ultra Slim Aluminium Hub", "castellan", 799, 1299, 45, 1033, "1,000+ sold", "Spain", FREE, false, ["Grey", "Silver"]]),
  basic(["1005008362533", "Tidewell USB C Hub 3 Port USB 3.0 with SD TF Card Reader Compact Travel Adapter", "tidewell", 542, 1355, 46, 3301, "4,000+ sold", "China", FREE, false, ["Grey"]]),
  basic(["1005008752488", "Duvra USB C Hub 4 in 1 USB 3.0 Aluminium Slim Hub EU Stock", "duvra", 849, 1399, 47, 244, "350+ sold", "Poland", FREE, false, ["Grey"]]),
  basic(["1005008215873", "Sunforge USB C Hub 13 in 1 Triple Display Docking Station 2 HDMI VGA RJ45 PD 100W", "sunforge", 2968, 7420, 44, 210, "300+ sold", "China", FREE, false, ["Grey"]]),
  basic(["1005008468919", "Mirafone USB C Hub 6 in 1 HDMI 4K PD 100W USB 3.0 SD Card Reader Compact", "mirafone", 1135, 2838, 47, 690, "700+ sold", "China", FREE, false, ["Grey"]]),
];

/**
 * Listings that appear only as paid placements. Two of them are Spain-shipped,
 * free and rated above 4.5 -- they meet every criterion but one, which is that
 * a buyer asked to leave out the ads must leave them out -- and two are not
 * hubs at all, because a sponsored slot sells whatever was bid on it.
 */
export const AD_ONLY_LISTINGS: readonly Listing[] = [
  { ...basic(["1005008649861", "Castellan USB C Hub 7 in 1 HDMI 4K 60Hz PD 100W 2 USB 3.0 SD TF Card Reader", "castellan", 1799, 3299, 49, 1210, "2,000+ sold", "Spain", FREE, false, ["Grey"]]), adOnly: true },
  { ...basic(["1005008403519", "Hubsmith USB C Hub 8 in 1 Docking Station HDMI 4K 60Hz Ethernet PD 100W Aluminium", "hubsmith", 1688, 3976, 48, 760, "1,000+ sold", "China", FREE, true, ["Grey"]]), adOnly: true },
  { ...basic(["1005008120524", "Lumora Wireless Charger Stand 15W Fast Charging Dock for Phone Earbuds", "lumora", 1112, 2780, 46, 3044, "5,000+ sold", "China", FREE, true, ["Black", "White"]], CHARGERS), adOnly: true },
  { ...basic(["1005008702317", "Keelson USB C Hub 6 in 1 HDMI 4K PD 100W Ethernet Aluminium EU Stock", "keelson", 1749, 2899, 46, 318, "500+ sold", "Spain", FREE, false, ["Grey"]]), adOnly: true },
  { ...basic(["1005008521480", "Pelican Peak Laptop Stand Aluminium Adjustable Ergonomic Riser Foldable Holder", "pelican", 1390, 2780, 47, 1880, "3,000+ sold", "China", FREE, false, ["Silver", "Black"]], STANDS), adOnly: true },
];

const EVERY_LISTING: ReadonlyMap<string, Listing> = new Map([...ORGANIC_LISTINGS, ...AD_ONLY_LISTINGS].map((listing) => [listing.id, listing]));

export function listingById(id: string): Listing | undefined {
  return EVERY_LISTING.get(id);
}
