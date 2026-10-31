import type { JsonObject } from "fluxiq/core";
import { present } from "../../present";

type Target = { tag: string; name: string; id: string; inputType?: string; role?: string };
type Listing = { number: number; id: string; fields: string[]; next?: string };
type Manifest = { url: string; targets: Record<number, Target>; listings?: Listing[] };
type CapturedElement = { tagName: string; selector: string; accessibleName: string; attributes: { "data-testid": string }; inputType?: string; role?: string };
const button = (id: string, name: string): Target => ({ tag: "button", id, name });
const input = (id: string, name: string): Target => ({ tag: "input", id, name, inputType: "text" });
const read = (id: string, name: string): Target => ({ tag: "p", id, name });

// These are synthetic unit captures for the authored examples, independent of
// the parser. A number is the capture's document-order position, not a token
// discovered by scanning a script. Each example has a fresh evidence scope.
const manifests: Record<string, Manifest> = {
  "Example:": {
    url: "https://shop.test/members",
    targets: { 7: button("member-row", "Member Ada"), 2: input("member-name", "Member name") }
  },
  "Example, narrowing with a control whose words are exactly the instruction's:": {
    url: "https://desk.test/tickets",
    targets: { 4: { tag: "select", id: "ticket-status", name: "Ticket status" }, 5: button("apply-status", "Apply status") },
    listings: [{ number: 1, id: "tickets", fields: ["number", "subject", "status"] }]
  },
  "Example, two situations the run can start in:": {
    url: "https://orders.test/weekly", targets: { 9: button("close-notice", "Close notice") },
    listings: [{ number: 1, id: "orders", fields: ["number", "date", "total"] }]
  },
  "Example, acting on one item:": {
    url: "https://tasks.test/board",
    targets: {
      1: input("task-search", "Search tasks"), 2: button("close-cookies", "Close cookie banner"),
      3: { tag: "input", inputType: "checkbox", id: "high-priority", name: "High priority" },
      6: { tag: "select", id: "task-status", name: "Task status" }, 8: input("task-estimate", "Estimate hours"),
      11: button("save-task", "Save task"), 14: button("budget-review", "Budget review")
    }
  },
  "Example, reading every page of a list:": {
    url: "https://library.test/search?q=gardening", targets: {},
    listings: [{ number: 1, id: "books", fields: ["title", "year"], next: "#next-books" }]
  },
  "Example, acting on each row a listing kept:": {
    url: "https://billing.test/invoices", targets: { 21: button("remind-invoice", "Mark reminded") },
    listings: [{ number: 2, id: "invoices", fields: ["number", "status"] }]
  },
  "Example, a loop the site asked to slow down:": {
    url: "https://mail.test/inbox", targets: { 21: button("archive-message", "Archive message"), 30: button("close-cooldown", "Close slow-down notice") },
    listings: [{ number: 2, id: "messages", fields: ["subject", "sender"] }]
  },
  "Example, starting where the page already is:": {
    url: "https://permits.test/",
    targets: { 2: button("sign-in", "Sign in"), 6: button("permit-renew", "Open renewal form"), 7: input("permit-plate", "Plate"), 9: button("confirm-renewal", "Confirm renewal") }
  },
  "Example, an interruption that can come at any pass:": {
    url: "https://weather.test/stations", targets: { 12: button("export-station", "Export station readings"), 40: button("keep-session", "Keep session") },
    listings: [{ number: 1, id: "stations", fields: ["station", "reading"] }]
  },
  "Example, a second known way, checked the same:": {
    url: "https://rooms.test/planner",
    targets: {
      8: button("calendar-book", "Book Thursday at 10:00"), 11: read("booking-status", "Booked"),
      12: read("booking-reference", "Reference BR-104"), 15: button("juniper-room", "Juniper room"), 16: button("floorplan-book", "Book Thursday at 10:00 from floor plan")
    }
  },
  "Example, values read one by one, saved as one row:": {
    url: "https://account.test/settings", targets: { 3: read("plan-name", "Standard"), 4: read("renewal-date", "2030-11-01"), 5: read("plan-price", "12") }
  }
};

function element(target: Target): JsonObject {
  return present<CapturedElement>({
    tagName: target.tag, selector: `#${target.id}`, accessibleName: target.name,
    attributes: { "data-testid": target.id },
    inputType: target.inputType,
    role: target.role
  });
}

// Exact expected durable fact target, independently built from the capture
// manifest, never read back from a resolved plan or Core's normalizer.
function factTarget(name: string, number: number): JsonObject {
  const target = manifests[name]?.targets[number];
  if (!target) throw new Error(`Missing target provenance: ${name} / ${number}`);
  return {
    selector: `#${target.id}`,
    element: { tagName: target.tag, accessibleName: target.name, selector: `#${target.id}`, testId: target.id, attributes: { "data-testid": target.id } }
  };
}

export const exampleEvidenceManifests = { manifests, element, factTarget };
