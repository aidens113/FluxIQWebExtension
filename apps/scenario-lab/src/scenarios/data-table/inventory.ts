/** A column of the inventory table. */
export type InventoryColumn = "product" | "category" | "price" | "stock";

/** How a column's header reads and how its displayed text sorts. */
export type InventoryColumnDefinition = { header: string; sortAs: "text" | "number" };

/** One catalog row as the page displays it. `id` is the SKU, carried by the row only. */
export type InventoryRow = { id: string; product: string; category: string; price: string; stock: string };

/**
 * Header text and sort kind per column. On the page the header text is the
 * only thing that says which column a cell belongs to.
 */
export const inventoryColumns: Readonly<Record<InventoryColumn, InventoryColumnDefinition>> = {
  product: { header: "Product", sortAs: "text" },
  category: { header: "Category", sortAs: "text" },
  price: { header: "Price", sortAs: "number" },
  stock: { header: "Stock", sortAs: "number" },
};

/** Left-to-right column order until the `column-reorder` variant is armed. */
export const defaultColumnOrder: readonly InventoryColumn[] = ["product", "category", "price", "stock"];

/**
 * The seeded catalog in its unsorted display order. Prices and stock counts
 * are distinct, and sorting their text instead of their amounts gives a
 * different order ("$129.00" sorts before "$9.50" as text).
 */
export const inventoryRows: readonly InventoryRow[] = [
  { id: "sku-1001", product: "Ceramic pour-over set", category: "Kitchen", price: "$34.00", stock: "18" },
  { id: "sku-1002", product: "Walnut desk organizer", category: "Office", price: "$48.50", stock: "7" },
  { id: "sku-1003", product: "Enamel camp mug", category: "Outdoor", price: "$12.00", stock: "64" },
  { id: "sku-1004", product: "Linen table runner", category: "Home", price: "$27.95", stock: "23" },
  { id: "sku-1005", product: "Brass desk lamp", category: "Lighting", price: "$129.00", stock: "4" },
  { id: "sku-1006", product: "Cast iron skillet", category: "Kitchen", price: "$42.00", stock: "31" },
  { id: "sku-1007", product: "Recycled notebook set", category: "Office", price: "$9.50", stock: "120" },
  { id: "sku-1008", product: "Folding camp stool", category: "Outdoor", price: "$36.75", stock: "0" },
  { id: "sku-1009", product: "Wool throw blanket", category: "Home", price: "$89.00", stock: "12" },
  { id: "sku-1010", product: "Paper pendant shade", category: "Lighting", price: "$58.25", stock: "9" },
  { id: "sku-1011", product: "Bamboo cutting board", category: "Kitchen", price: "$19.99", stock: "45" },
  { id: "sku-1012", product: "Stainless water bottle", category: "Outdoor", price: "$24.00", stock: "76" },
];
