type FailureCode = "storage_unavailable" | "invalid_state" | "invalid_owner" | "ownership_conflict" | "invalid_route";

const MESSAGES: Record<FailureCode, string> = {
  storage_unavailable: "Authentication-tab session storage is unavailable.",
  invalid_state: "Authentication-tab session state is invalid.",
  invalid_owner: "Authentication-tab ownership is invalid.",
  ownership_conflict: "Authentication tab belongs to another attempt.",
  invalid_route: "Authentication-tab route configuration is invalid."
};

/** Fixed text only: storage errors and supplied values may contain authentication data. */
export class AuthenticationTabsError extends Error {
  constructor(readonly code: FailureCode) {
    super(MESSAGES[code]);
    this.name = "AuthenticationTabsError";
  }
}
