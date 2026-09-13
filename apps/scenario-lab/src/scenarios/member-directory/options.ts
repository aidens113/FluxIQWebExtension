/**
 * The two filter selects the toolbar offers, as option values and the labels
 * the page shows for them. A select's value is the slug; the label is the text
 * a row's cell carries, which is what the filter compares against.
 */
export type FilterOption = { value: string; label: string };

/** The toolbar's Role select: an option value, and the role it keeps. */
export const ROLE_OPTIONS: readonly FilterOption[] = [
  { value: "", label: "All roles" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "billing-admin", label: "Billing admin" },
  { value: "read-only", label: "Read only" },
];

/** The toolbar's Status select. "Invited" is a member who has never signed in. */
export const STATUS_OPTIONS: readonly FilterOption[] = [
  { value: "", label: "Any status" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
];
