import type { Product, Variant } from "../types.js";

/**
 * One filter group in the results sidebar. `key` is how the group is spelled
 * in the URL's `facet` parameter (`key:value`, joined with `||`), `legend` how
 * the sidebar titles it, and `holds` whether a product's first size, at the
 * shopper's store, carries a value. Values in one group are alternatives;
 * groups narrow one another.
 */
export type FacetGroup = {
  key: string;
  legend: string;
  values(products: readonly Product[]): string[];
  holds(product: Product, variant: Variant, storeId: string, value: string): boolean;
};

const distinct = (values: readonly string[]) => [...new Set(values)];
const pickup = (variant: Variant, storeId: string) => variant.pickup[storeId] ?? "none";

/**
 * The sidebar's groups, in its order. "Speed" is the store's own notion of
 * fastest: an item the home store can only hand over tomorrow still counts as
 * "Today" when its delivery is today, which is how a shopper who ticks
 * Pickup and Today still sees items they cannot pick up today.
 */
export const FACET_GROUPS: readonly FacetGroup[] = [
  { key: "dept", legend: "Department", values: (products) => distinct(products.map((product) => product.department)), holds: (product, _variant, _store, value) => product.department === value },
  {
    key: "fulfillment_method", legend: "Fulfillment", values: () => ["Pickup", "Delivery", "Shipping"],
    holds: (_product, variant, storeId, value) => (value === "Pickup" ? pickup(variant, storeId) !== "none" : value === "Delivery" ? variant.delivery !== "none" : value === "Shipping" && variant.shipping !== ""),
  },
  {
    key: "fulfillment_speed", legend: "Speed", values: () => ["Today", "Tomorrow"],
    holds: (_product, variant, storeId, value) => [pickup(variant, storeId), variant.delivery].includes(value.toLowerCase() as "today" | "tomorrow"),
  },
  { key: "retailer_type", legend: "Retailer", values: () => ["ValueRidge"], holds: (product, _variant, _store, value) => product.seller === value },
  { key: "brand", legend: "Brand", values: (products) => distinct(products.map((product) => product.brand)).sort(), holds: (product, _variant, _store, value) => product.brand === value },
  {
    key: "customer_rating", legend: "Customer Rating", values: () => ["4 & up", "3 & up"],
    holds: (product, _variant, _store, value) => product.rating >= Number.parseInt(value, 10),
  },
  { key: "special_offers", legend: "Special Offers", values: () => ["Rollback"], holds: (_product, variant) => variant.wasCents !== undefined },
];
