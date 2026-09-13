import { createScenarioManifest } from "../../types.js";
import { applyChanges, filterMembers, resultCountText, rosterFor, statsText } from "./filters.js";
import { RECORDED_MEMBER } from "./members.js";
import { buildMarkerText, DIRECTORY_BUILDS } from "./styles.js";
import type { DirectoryMember } from "./types.js";

/** The surname the filter workflow searches for. Sixteen people share it; two of them are admins. */
const SEARCH_TERM = "hollis";

const BASELINE = rosterFor("baseline");
const WITHOUT_RECORDED = rosterFor("member-left");
const BY_ACTIVITY = rosterFor("sorted-by-activity");
const INVITED = filterMembers(BASELINE, { search: "", role: "", status: "invited" });
const PROMOTED = applyChanges(BASELINE, { [RECORDED_MEMBER.id]: "Admin" }, []);
const AFTER_REMOVAL = applyChanges(BASELINE, {}, INVITED.map((member) => member.id));
const MATCHING_ADMINS = filterMembers(BASELINE, { search: SEARCH_TERM, role: "admin", status: "" });
const MATCHING_ADMINS_BY_ACTIVITY = filterMembers(BY_ACTIVITY, { search: SEARCH_TERM, role: "admin", status: "" });

/**
 * The row action button of one member, addressed the only way it can be: by
 * the row it is in. Every one of the 240 buttons has the same tag, the same
 * generated class, the same accessible name and the same markup.
 */
const ROW_MENU = `[data-member-id="${RECORDED_MEMBER.id}"] button[aria-haspopup="menu"]`;
/** Fields inside the edit dialog are addressed by form name: the `id` is generated, the `name` is the contract. */
const DIALOG_ROLE = `[data-testid="edit-dialog"] select[name="role"]`;
const DIALOG_SAVE = `[data-testid="edit-dialog"] button[type="submit"]`;
/** Only rows, never the empty-state row the table renders when a filter matches nobody. */
const MEMBER_ROWS = `[data-testid="member-rows"] > tr[data-member-id]`;

/**
 * What a person extracting this table would read. `column:` follows the header
 * rather than the column position, and the person cell's text is what it looks
 * like on a real page: the avatar's initials, then the name, then the address,
 * because an initials avatar is text in the cell like everything else.
 */
const memberFields = {
  id: "@data-member-id",
  member: "column:Member",
  role: "column:Role",
  team: "column:Team",
  status: "column:Status",
};

const stats = (members: readonly DirectoryMember[]) => ({ id: "roster-stats", subject: "member-stats", predicate: "text", value: statsText(members) });
const listed = (members: readonly DirectoryMember[]) => ({ id: "rows-listed", subject: "result-count", predicate: "text", value: resultCountText(members.length, members.length) });
const buildIs = (build: string) => ({ id: "build-marker", subject: "build-marker", predicate: "text", value: buildMarkerText(build) });
const unfiltered = { id: "no-filters", subject: "filter-summary", predicate: "exists", value: false };
const dialogClosed = { id: "dialog-closed", subject: "edit-dialog", predicate: "exists", value: false };
const noToast = { id: "no-toast", subject: "toast", predicate: "exists", value: false };
/**
 * Two controls on the page carry the accessible name "Search": the top bar's
 * and the members filter's. Both are labelled properly and neither can be told
 * from the other by its name alone.
 */
const duplicateSearchLabels = { id: "duplicate-search-labels", subject: "document", predicate: "label-count:Search", value: 2 };

/**
 * A members administration console, at the scale and with the markup of a real
 * one: 240 people, generated class names, a portalled row menu, and controls
 * whose accessibility ranges from a per-row label to no accessible name at all.
 *
 * Three workflows. The manifest's own script edits one member's role through
 * the row menu and the edit dialog; `filter-members` searches and extracts what
 * is left; `remove-invitations` selects every pending invitation and removes
 * them in bulk.
 *
 * `recordingEvents` name types without counts on purpose. No recording lane has
 * run this fixture yet, so "this type occurred" is a claim that can be made
 * honestly and an exact tally is not; a count belongs here once a run has
 * produced one.
 */
export const memberDirectoryManifest = createScenarioManifest({
  id: "member-directory",
  title: "Member directory",
  tags: ["dashboard", "table", "generated-classes", "row-actions", "modal", "bulk-actions", "overlay"],
  seed: 137,
  startPath: "/scenarios/member-directory/",
  capabilities: ["forms", "mutation", "scroll"],
  recordingScript: [
    { id: "open-row-menu", operation: "click", target: ROW_MENU },
    { id: "choose-edit", operation: "click", target: "role:menuitem:Edit member" },
    { id: "dialog-open", operation: "waitForState", target: "testid:edit-dialog", timeoutMs: 2000 },
    { id: "choose-admin", operation: "select", target: DIALOG_ROLE, value: "admin" },
    { id: "save-member", operation: "click", target: DIALOG_SAVE },
    { id: "role-saved", operation: "waitForState", target: "testid:toast", timeoutMs: 2000 },
    { id: "member-updated", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [stats(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels, buildIs(DIRECTORY_BUILDS.baseline)],
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.changed" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.select", outcome: "succeeded" }],
    finalState: [
      { id: "role-toast", subject: "toast", predicate: "text", value: `${RECORDED_MEMBER.name}'s role is now Admin` },
      dialogClosed,
      stats(PROMOTED),
    ],
    allowedConsoleErrors: [],
  },
  variants: [
    {
      id: "restyled",
      description: "The design system shipped, so every generated class name on the page is a different hash. The markup, the text, the accessible names and the roster are identical, which leaves a recorded class set as the one signal that is now wrong.",
      arm: { operation: "set-mode", payload: { mode: "restyled" } },
      expected: {
        pageFacts: [stats(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels, buildIs(DIRECTORY_BUILDS.restyled)],
        finalState: [
          { id: "role-toast", subject: "toast", predicate: "text", value: `${RECORDED_MEMBER.name}'s role is now Admin` },
          dialogClosed,
          stats(PROMOTED),
        ],
      },
    },
    {
      id: "member-left",
      description: `${RECORDED_MEMBER.name} left the workspace, so the row the click was recorded against is not in the table. The other 239 rows still carry an identical action button, which is what makes this a resolution question rather than an empty page.`,
      arm: { operation: "set-mode", payload: { mode: "member-left" } },
      expected: {
        pageFacts: [stats(WITHOUT_RECORDED), listed(WITHOUT_RECORDED), unfiltered, buildIs(DIRECTORY_BUILDS.baseline)],
        failure: { category: "target_not_found", code: "web.target.not_found" },
        finalState: [dialogClosed, noToast, stats(WITHOUT_RECORDED)],
      },
    },
  ],
  workflows: [
    {
      id: "filter-members",
      description: `Search the members table for "${SEARCH_TERM}", narrow it to admins, and extract the rows that remain.`,
      recordingScript: [
        { id: "search-members", operation: "type", target: "testid:member-search", value: SEARCH_TERM },
        { id: "filters-applied", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "filter-admins", operation: "select", target: "testid:role-filter", value: "admin" },
        { id: "extract-admins", operation: "extract", target: MEMBER_ROWS, fields: memberFields },
        { id: "admins-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [stats(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels],
        recordingEvents: [{ type: "web.element.input_changed" }, { type: "web.element.changed" }],
        actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.select", outcome: "succeeded" }],
        extracted: [{ step: "extract-admins", count: MATCHING_ADMINS.length, records: memberRecords(MATCHING_ADMINS) }],
        finalState: [
          { id: "matches-shown", subject: "result-count", predicate: "text", value: resultCountText(MATCHING_ADMINS.length, BASELINE.length) },
          { id: "filters-shown", subject: "filter-summary", predicate: "exists", value: true },
        ],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "sorted-by-activity",
        description: "The workspace default sort moved from Name to Last active. The same two admins match the same filters and the extraction returns the same records in the order the table now shows them.",
        arm: { operation: "set-mode", payload: { mode: "sorted-by-activity" } },
        expected: {
          pageFacts: [
            { id: "sorted-by-activity", subject: "sort-status", predicate: "text", value: "Sorted by Last active" },
            stats(BY_ACTIVITY),
            listed(BY_ACTIVITY),
          ],
          extracted: [{ step: "extract-admins", count: MATCHING_ADMINS_BY_ACTIVITY.length, records: memberRecords(MATCHING_ADMINS_BY_ACTIVITY) }],
        },
      }],
    },
    {
      id: "remove-invitations",
      description: "Filter the table to invitations nobody accepted, select all of them with the header checkbox, and remove them through the bulk toolbar and its confirmation.",
      recordingScript: [
        { id: "filter-invited", operation: "select", target: "testid:status-filter", value: "invited" },
        { id: "filters-applied", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "select-all", operation: "check", target: "role:checkbox:Select all members", value: true },
        { id: "open-remove", operation: "click", target: "role:button:Remove" },
        { id: "confirm-open", operation: "waitForState", target: "testid:confirm-dialog", timeoutMs: 2000 },
        { id: "confirm-remove", operation: "click", target: "role:button:Remove members" },
        { id: "removal-done", operation: "waitForState", target: "testid:toast", timeoutMs: 2000 },
        { id: "invitations-removed", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [stats(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels],
        recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.changed" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.select", outcome: "succeeded" }],
        finalState: [
          { id: "removal-toast", subject: "toast", predicate: "text", value: `${INVITED.length} members removed` },
          stats(AFTER_REMOVAL),
          { id: "selection-cleared", subject: "bulk-toolbar", predicate: "exists", value: false },
          { id: "none-left-matching", subject: "result-count", predicate: "text", value: resultCountText(0, AFTER_REMOVAL.length) },
        ],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "support-drawer",
        description: "The support widget is open, docked down the right-hand edge of the console over the right-aligned end of the bulk toolbar. Selecting the rows still works; the click on Remove lands on the drawer, and the actionability gate must refuse it rather than report a click that removed nobody.",
        arm: { operation: "set-mode", payload: { mode: "support-drawer" } },
        expected: {
          pageFacts: [
            { id: "drawer-open", subject: "support-drawer", predicate: "visible", value: true },
            stats(BASELINE),
            listed(BASELINE),
          ],
          failure: { category: "blocked_by_capability_or_policy", code: "web.action.rejected" },
          finalState: [
            { id: "nothing-removed", subject: "member-stats", predicate: "text", value: statsText(BASELINE) },
            { id: "no-confirmation", subject: "confirm-dialog", predicate: "exists", value: false },
            noToast,
          ],
        },
      }],
    },
  ],
});

/** The records the table yields for a set of members, in the page's own text. */
function memberRecords(members: readonly DirectoryMember[]): Array<Record<string, string>> {
  return members.map((member) => ({
    id: member.id,
    member: `${member.initials} ${member.name} ${member.email}`,
    role: member.role,
    team: member.team,
    status: member.status,
  }));
}
