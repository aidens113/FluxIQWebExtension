import { buildClassNames } from "../../../build-classes.js";

const ID_ROLES = [
  "root", "searchInput", "searchDept", "suggest", "results", "resultsTemplate", "sentinel", "consent", "appBanner", "notify",
  "wheel", "qty", "sideSheet", "offers", "paymentFrame", "captcha", "captchaInput", "priceLow", "priceHigh", "sort",
  "newsletterEmail", "newsletterWebsite", "protection", "giftCard", "plusTrial", "addressList", "zip",
] as const;

export type StoreIdRole = (typeof ID_ROLES)[number];
export type StoreIds = Record<StoreIdRole, string>;

/**
 * Element ids the way a component framework generates them -- `:r4k2a:` --
 * so a label still points at its control, and nothing about the id says what
 * the control is or survives a different seed. They need escaping to be used
 * in a CSS selector at all, which is the point of the colons.
 */
export function storeIds(seed: number): StoreIds {
  const hashes = buildClassNames(`brightaisle-ids:${seed}`, ID_ROLES);
  return Object.fromEntries(ID_ROLES.map((role) => [role, `:r${hashes[role].slice(4, 9)}:`])) as StoreIds;
}
