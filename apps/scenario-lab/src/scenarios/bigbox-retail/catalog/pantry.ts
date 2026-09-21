import { pickupAt } from "./availability.js";
import { buildProduct as product, buildVariant as variant, shippedOnly } from "./build-product.js";
import type { Product } from "../types.js";

const VR = "ValueRidge";

/**
 * The rest of the aisle: the napkins the cart workflow buys, two lookalikes of
 * them, and the dish soap a shopper left in the cart on their last visit.
 * "Everyday" and "250 Count" each name more than one of these.
 */
export const PANTRY: readonly Product[] = [
  product({ id: "418831402", name: "ValueRidge Everyday Dinner Napkins", brand: "ValueRidge Essentials", department: "Napkins", seller: VR, rating: 4.6, reviews: 2812, variants: [
    variant("5530101", "100 Count", 297, "3.0 ¢/each", { pickup: pickupAt("today"), delivery: "today", shipping: "Thu, Sep 24" }),
    variant("5530102", "250 Count", 648, "2.6 ¢/each", { pickup: pickupAt("today"), delivery: "today", shipping: "Thu, Sep 24" }),
    variant("5530103", "500 Count", 1188, "2.4 ¢/each", { pickup: pickupAt("today", { "1187": "tomorrow" }), delivery: "tomorrow", shipping: "Fri, Sep 25" }),
  ] }),
  product({ id: "402918013", name: "Loftwell Dinner Napkins, 2-Ply, 250 Count", brand: "Loftwell", department: "Napkins", seller: VR, rating: 4.7, reviews: 1006, variants: [
    variant("5520501", "", 797, "3.2 ¢/each", { pickup: pickupAt("today"), delivery: "today", shipping: "Thu, Sep 24" }),
  ] }),
  product({ id: "433202210", name: "Softerra Everyday Napkins, 250 Count", brand: "Softerra", department: "Napkins", seller: VR, rating: 4.5, reviews: 734, variants: [
    variant("5540501", "", 594, "2.4 ¢/each", { pickup: pickupAt("today"), delivery: "tomorrow", shipping: "Thu, Sep 24" }),
  ] }),
  product({ id: "482214100", name: "ValueRidge Everyday Dinner Napkins, 250 Count (3-Pack)", brand: "ValueRidge Essentials", department: "Napkins", seller: "Northgate Wholesale", rating: 4.1, reviews: 58, variants: [
    variant("5590501", "", 2499, "3.3 ¢/each", shippedOnly("Mon, Sep 28")),
  ] }),
  product({ id: "418832007", name: "ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz", brand: "ValueRidge Essentials", department: "Dish Soap", seller: VR, rating: 4.7, reviews: 5120, variants: [
    variant("5530601", "", 397, "16.5 ¢/fl oz", { pickup: pickupAt("today"), delivery: "today", shipping: "Thu, Sep 24" }),
  ] }),
];
