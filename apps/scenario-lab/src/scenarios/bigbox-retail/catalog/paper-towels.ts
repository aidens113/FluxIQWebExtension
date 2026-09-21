import { pickupAt } from "./availability.js";
import { buildProduct as product, buildVariant as variant, shippedOnly } from "./build-product.js";
import type { Product } from "../types.js";

const VR = "ValueRidge";
const THU = "Thu, Sep 24";
const FRI = "Fri, Sep 25";
const MON = "Mon, Sep 28";
const TUE = "Tue, Sep 29";
/** Carden Falls Supercenter, the store a shopper starts with. */
const HOME = "2291";

/**
 * Everything a search for "paper towels" finds, in the search's best-match
 * order. Thirty-two listings over three pages, and the mess a real result set
 * has: the store's own brand beside four national brands, marketplace sellers
 * who ship and never stock a shelf (one of them reselling the store brand in a
 * two-pack), holders and a dispenser that match the words and are not paper
 * towels, and items the home store has only tomorrow, or only on a truck.
 *
 * The comment on each line is what it is for. "match" marks the nine that
 * ValueRidge sells, that are paper towels, that the home store can hand over
 * today, and that are rated 4.5 or better: the extraction workflow's answer.
 */
export const PAPER_TOWELS: readonly Product[] = [
  // match; three sizes, and the 12-roll size is not stocked for pickup at either Carden Falls store
  product({ id: "418830127", name: "ValueRidge Essentials Select-A-Size Paper Towels", brand: "ValueRidge Essentials", department: "Paper Towels", seller: VR, rating: 4.6, reviews: 12418, badge: "Best seller", variants: [
    variant("5510201", "6 Double Rolls", 897, "1.2 ¢/sheet", { pickup: pickupAt("today"), delivery: "today", shipping: THU }),
    variant("5510202", "12 Double Rolls", 1647, "1.1 ¢/sheet", { pickup: pickupAt("today", { "2291": "none", "5510": "none", "4419": "tomorrow" }), delivery: "tomorrow", shipping: THU }),
    variant("5510203", "8 Mega Rolls", 1394, "1.0 ¢/sheet", { pickup: pickupAt("tomorrow"), delivery: "tomorrow", shipping: FRI }),
  ] }),
  // match
  product({ id: "402917554", name: "Loftwell Ultra Strong Paper Towels, 6 Double Rolls", brand: "Loftwell", department: "Paper Towels", seller: VR, rating: 4.8, reviews: 8902, variants: [
    variant("5520101", "", 1047, "1.4 ¢/sheet", { pickup: pickupAt("today"), delivery: "today", shipping: THU }),
  ] }),
  // home store has it tomorrow, but delivers today, so "Today" as a speed still lists it
  product({ id: "433201876", name: "Softerra Pick-A-Sheet Paper Towels, 8 Triple Rolls", brand: "Softerra", department: "Paper Towels", seller: VR, rating: 4.7, reviews: 3117, variants: [
    variant("5540101", "", 1997, "1.3 ¢/sheet", { pickup: pickupAt("today", { [HOME]: "tomorrow" }), delivery: "today", shipping: THU }),
  ] }),
  // marketplace
  product({ id: "461120983", name: "Tidemark Paper Towels, 12 Mega Rolls", brand: "Tidemark", department: "Paper Towels", seller: "Pinecrest Supply Co.", rating: 4.5, reviews: 644, variants: [
    variant("5550101", "", 3249, "$2.71/roll", shippedOnly(FRI)),
  ] }),
  // rated 4.3; a Rollback
  product({ id: "417553090", name: "Hearthside Kitchen Paper Towels, 2 Rolls", brand: "Hearthside", department: "Paper Towels", seller: VR, rating: 4.3, reviews: 1208, variants: [
    variant("5560101", "", 297, "$1.49/roll", { pickup: pickupAt("today"), delivery: "today", shipping: "" }, 348),
  ] }),
  // a holder
  product({ id: "408822461", name: "ValueRidge Essentials Paper Towel Holder, Brushed Steel", brand: "ValueRidge Essentials", department: "Paper Towel Holders", seller: VR, rating: 4.4, reviews: 2031, variants: [
    variant("5510301", "", 988, "", { pickup: pickupAt("today"), delivery: "today", shipping: THU }),
  ] }),
  // ships only
  product({ id: "439018225", name: "Kindleaf Bamboo Paper Towels, 6 Rolls", brand: "Kindleaf", department: "Paper Towels", seller: VR, rating: 4.6, reviews: 955, variants: [
    variant("5570101", "", 1298, "$2.16/roll", { pickup: pickupAt("none"), delivery: "none", shipping: FRI }),
  ] }),
  // match
  product({ id: "402917571", name: "Loftwell Select-A-Size Paper Towels, 12 Double Rolls", brand: "Loftwell", department: "Paper Towels", seller: VR, rating: 4.7, reviews: 6480, variants: [
    variant("5520102", "", 1994, "1.3 ¢/sheet", { pickup: pickupAt("today"), delivery: "tomorrow", shipping: THU }),
  ] }),
  // marketplace
  product({ id: "470665312", name: "Northmere Heavy Duty Shop Paper Towels, 3 Rolls", brand: "Northmere", department: "Paper Towels", seller: "BulkBay Direct", rating: 4.8, reviews: 1776, variants: [
    variant("5580101", "", 1125, "$3.75/roll", shippedOnly(MON)),
  ] }),
  // match, at exactly 4.5; a Rollback
  product({ id: "433201844", name: "Softerra Paper Towels, 6 Double Rolls", brand: "Softerra", department: "Paper Towels", seller: VR, rating: 4.5, reviews: 5302, variants: [
    variant("5540102", "", 947, "1.3 ¢/sheet", { pickup: pickupAt("today"), delivery: "today", shipping: THU }, 1197),
  ] }),
  // the store brand, resold by a marketplace seller in a two-pack
  product({ id: "482213960", name: "ValueRidge Essentials Paper Towels, 12 Double Rolls (2-Pack)", brand: "ValueRidge Essentials", department: "Paper Towels", seller: "Northgate Wholesale", rating: 4.2, reviews: 87, variants: [
    variant("5590101", "", 4199, "1.4 ¢/sheet", shippedOnly(MON)),
  ] }),
  // home store has it tomorrow
  product({ id: "461120905", name: "Tidemark Everyday Paper Towels, 6 Rolls", brand: "Tidemark", department: "Paper Towels", seller: VR, rating: 4.6, reviews: 1450, variants: [
    variant("5550102", "", 697, "$1.16/roll", { pickup: pickupAt("today", { [HOME]: "tomorrow" }), delivery: "tomorrow", shipping: THU }),
  ] }),
  // match
  product({ id: "417553117", name: "Hearthside Paper Towels, 12 Double Rolls", brand: "Hearthside", department: "Paper Towels", seller: VR, rating: 4.6, reviews: 2764, variants: [
    variant("5560102", "", 1748, "1.2 ¢/sheet", { pickup: pickupAt("today"), delivery: "today", shipping: THU }),
  ] }),
  // a dispenser
  product({ id: "402917602", name: "Loftwell Paper Towel Dispenser, Wall Mount", brand: "Loftwell", department: "Paper Towel Holders", seller: VR, rating: 4.1, reviews: 318, variants: [
    variant("5520301", "", 1497, "", { pickup: pickupAt("today"), delivery: "tomorrow", shipping: FRI }),
  ] }),
  // marketplace
  product({ id: "439018261", name: "Kindleaf Recycled Paper Towels, 8 Rolls", brand: "Kindleaf", department: "Paper Towels", seller: "Harlow Home Goods", rating: 4.4, reviews: 203, variants: [
    variant("5570102", "", 1549, "$1.94/roll", shippedOnly(TUE)),
  ] }),
  // match
  product({ id: "433201899", name: "Softerra Pick-A-Sheet Paper Towels, 12 Triple Rolls", brand: "Softerra", department: "Paper Towels", seller: VR, rating: 4.7, reviews: 4021, variants: [
    variant("5540103", "", 2797, "1.2 ¢/sheet", { pickup: pickupAt("today"), delivery: "today", shipping: THU }),
  ] }),
  // marketplace
  product({ id: "470665348", name: "Northmere Paper Towels, 30 Rolls, Bulk", brand: "Northmere", department: "Paper Towels", seller: "Pinecrest Supply Co.", rating: 4.6, reviews: 512, variants: [
    variant("5580102", "", 5499, "$1.83/roll", shippedOnly(MON)),
  ] }),
  // home store has it tomorrow
  product({ id: "418830166", name: "ValueRidge Essentials Paper Towels, 1 Roll", brand: "ValueRidge Essentials", department: "Paper Towels", seller: VR, rating: 4.5, reviews: 938, variants: [
    variant("5510204", "", 128, "$1.28/roll", { pickup: pickupAt("today", { [HOME]: "tomorrow" }), delivery: "tomorrow", shipping: "" }),
  ] }),
  // rated 4.4
  product({ id: "402917630", name: "Loftwell Paper Towels, Prints, 6 Double Rolls", brand: "Loftwell", department: "Paper Towels", seller: VR, rating: 4.4, reviews: 1187, variants: [
    variant("5520103", "", 1097, "1.5 ¢/sheet", { pickup: pickupAt("today"), delivery: "today", shipping: THU }),
  ] }),
  // a holder, from a marketplace seller
  product({ id: "461121011", name: "Tidemark Paper Towel Holder with Tension Arm", brand: "Tidemark", department: "Paper Towel Holders", seller: "Harlow Home Goods", rating: 4.0, reviews: 156, variants: [
    variant("5550301", "", 1899, "", shippedOnly(TUE)),
  ] }),
  // not stocked for pickup anywhere
  product({ id: "417553152", name: "Hearthside Paper Towels, 6 Mega Rolls", brand: "Hearthside", department: "Paper Towels", seller: VR, rating: 4.7, reviews: 1902, variants: [
    variant("5560103", "", 1247, "1.2 ¢/sheet", { pickup: pickupAt("none"), delivery: "tomorrow", shipping: THU }),
  ] }),
  // marketplace
  product({ id: "433201920", name: "Softerra Paper Towels, 2 Double Rolls", brand: "Softerra", department: "Paper Towels", seller: "BulkBay Direct", rating: 4.3, reviews: 77, variants: [
    variant("5540104", "", 649, "$3.25/roll", shippedOnly(MON)),
  ] }),
  // match, at exactly 4.5
  product({ id: "439018290", name: "Kindleaf Unbleached Paper Towels, 4 Rolls", brand: "Kindleaf", department: "Paper Towels", seller: VR, rating: 4.5, reviews: 1344, variants: [
    variant("5570103", "", 748, "$1.87/roll", { pickup: pickupAt("today"), delivery: "tomorrow", shipping: FRI }),
  ] }),
  // home store has it tomorrow, but delivers today
  product({ id: "470665371", name: "Northmere Paper Towels, 12 Rolls", brand: "Northmere", department: "Paper Towels", seller: VR, rating: 4.6, reviews: 2215, variants: [
    variant("5580103", "", 1397, "$1.16/roll", { pickup: pickupAt("today", { [HOME]: "tomorrow" }), delivery: "today", shipping: THU }),
  ] }),
  // match
  product({ id: "418830190", name: "ValueRidge Essentials Paper Towels Value Pack, 15 Rolls", brand: "ValueRidge Essentials", department: "Paper Towels", seller: VR, rating: 4.7, reviews: 7733, badge: "Popular pick", variants: [
    variant("5510205", "", 1588, "$1.06/roll", { pickup: pickupAt("today"), delivery: "today", shipping: THU }),
  ] }),
  // a holder
  product({ id: "402917655", name: "Loftwell Countertop Paper Towel Holder, Bamboo", brand: "Loftwell", department: "Paper Towel Holders", seller: VR, rating: 4.6, reviews: 2409, variants: [
    variant("5520302", "", 1297, "", { pickup: pickupAt("today"), delivery: "today", shipping: THU }),
  ] }),
  // home store has it tomorrow
  product({ id: "461121040", name: "Tidemark Paper Towels, 8 Double Rolls", brand: "Tidemark", department: "Paper Towels", seller: VR, rating: 4.5, reviews: 1066, variants: [
    variant("5550103", "", 1294, "1.3 ¢/sheet", { pickup: pickupAt("today", { [HOME]: "tomorrow" }), delivery: "tomorrow", shipping: THU }),
  ] }),
  // marketplace
  product({ id: "433201951", name: "Softerra Paper Towels, Case of 24 Rolls", brand: "Softerra", department: "Paper Towels", seller: "Northgate Wholesale", rating: 4.8, reviews: 129, variants: [
    variant("5540105", "", 4499, "$1.87/roll", shippedOnly(TUE)),
  ] }),
  // match, the last page's only one
  product({ id: "417553188", name: "Hearthside Select-A-Size Paper Towels, 8 Double Rolls", brand: "Hearthside", department: "Paper Towels", seller: VR, rating: 4.9, reviews: 3590, variants: [
    variant("5560104", "", 1447, "1.1 ¢/sheet", { pickup: pickupAt("today"), delivery: "today", shipping: THU }),
  ] }),
  // marketplace
  product({ id: "439018312", name: "Kindleaf Compostable Paper Towels, 2 Rolls", brand: "Kindleaf", department: "Paper Towels", seller: "Harlow Home Goods", rating: 4.2, reviews: 41, variants: [
    variant("5570104", "", 899, "$4.50/roll", shippedOnly(TUE)),
  ] }),
  // ships only
  product({ id: "470665399", name: "Northmere Paper Towels, 6 Rolls", brand: "Northmere", department: "Paper Towels", seller: VR, rating: 4.3, reviews: 861, variants: [
    variant("5580104", "", 797, "$1.33/roll", { pickup: pickupAt("none"), delivery: "none", shipping: FRI }),
  ] }),
  // home store has it tomorrow
  product({ id: "402917688", name: "Loftwell Paper Towels, 1 Roll", brand: "Loftwell", department: "Paper Towels", seller: VR, rating: 4.6, reviews: 402, variants: [
    variant("5520104", "", 197, "$1.97/roll", { pickup: pickupAt("today", { [HOME]: "tomorrow" }), delivery: "tomorrow", shipping: "" }),
  ] }),
];
