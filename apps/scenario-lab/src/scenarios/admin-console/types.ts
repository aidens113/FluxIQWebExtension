import type { IdentifierPolicy } from "../../identifier-policy/index.js";

/**
 * The console's modes: the baseline and one per corpus variant. `set-variant`
 * switches between them, and each is a deliberate control on exactly one of the
 * properties this fixture exists to exercise.
 *
 * - `read-only`: the workspace grants read access only, so the editable cells
 *   render as plain text and no inline editor can be opened.
 * - `short-book`: the account book holds twelve customers instead of 240, so
 *   every row fits inside the list's render window and none is virtualised
 *   away. It is the control for `baseline`'s virtualised list.
 * - `light-dom-toggle`: the digest switch is rendered as an ordinary button in
 *   the light DOM instead of inside `<fx-toggle>`'s shadow root, with the same
 *   test id, role and accessible name. It is the control for the shadow root.
 */
export const adminVariants = ["baseline", "read-only", "short-book", "light-dom-toggle"] as const;

export type AdminVariant = (typeof adminVariants)[number];

/** The three settings tabs. The tab rides in the URL's `tab` query, changed by `replaceState`. */
export const settingsTabs = ["profile", "notifications", "security"] as const;

export type SettingsTab = (typeof settingsTabs)[number];

export type AdminRecord = {
  /** `CUS-0001` upward, in list order. */
  id: string;
  company: string;
  contact: string;
  email: string;
  plan: "Starter" | "Growth" | "Scale" | "Enterprise";
  status: "Active" | "Trial" | "Churn risk" | "Closed";
  owner: string;
  mrrCents: number;
  /** ISO date, derived from a fixed base day and never from the clock. */
  renewsOn: string;
};

/** The two fields the detail pane lets a person edit in place. */
export const editableFields = ["owner", "mrr"] as const;

export type EditableField = (typeof editableFields)[number];

/** One saved edit: the field, and the text the console committed for it. */
export type SavedEdit = { field: EditableField; value: string };

/** Which screen the console is showing. The client changes it without a page load. */
export type ConsoleRoute = { view: "records" | "settings"; recordId: string | null; tab: SettingsTab };

export type AdminConsoleState = {
  variant: AdminVariant;
  /**
   * How much of the console's identifier surface this rendering keeps.
   *
   * A separate axis from `variant` on purpose: a variant changes what the
   * console *is* -- a shorter book, a read-only workspace, a switch outside
   * its shadow root -- while this changes only what a recorder can see of it,
   * and the two compose. `set-identifiers` arms it.
   * See `identifier-policy/policies.ts` for what each policy removes and why.
   */
  identifiers: IdentifierPolicy;
  /** Customers the book holds under `variant`: 240, or 12 under `short-book`. */
  recordCount: number;
  /** Saved edits by record id, one entry per field. Drafts the page never saved do not reach here. */
  savedEdits: Record<string, SavedEdit[]>;
  /** Records opened in the detail pane, oldest first, capped. */
  openedRecordIds: string[];
  /** The last route the client announced, or the route a deep link served. */
  route: ConsoleRoute;
  preferences: { weeklyDigest: boolean; securityAlerts: boolean };
  /** What the server can vouch for about the rendering: the run's final-state oracle. */
  oracle: { recordCount: number; savedCount: number; weeklyDigest: boolean; routePath: string };
  lastOperation: "seeded" | "variant-set" | "record-opened" | "record-saved" | "preference-set" | "route-changed";
};
