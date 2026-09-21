/** What the quote drawer's service list offers, in its order. Two of them are replacements and one a repair. */
export const QUOTE_SERVICES = [
  "Boiler repair",
  "Boiler service",
  "Combi boiler replacement",
  "System boiler replacement",
  "Heat pump installation",
  "Bathroom plumbing",
  "Something else",
] as const;

/** The contact preferences, with Phone ticked when the drawer opens. */
export const CONTACT_OPTIONS = ["Phone", "Email", "Text message"] as const;
