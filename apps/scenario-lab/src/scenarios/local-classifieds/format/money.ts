/** A price as the marketplace prints it: "Free", "£95", "£1,250". Whole pounds only; sellers do not ask for pence. */
export function priceText(pounds: number): string {
  if (pounds === 0) return "Free";
  return `£${String(pounds).replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}`;
}
