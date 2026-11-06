import type { JobBoardState } from "../types.js";

/**
 * The reference of every application the employer's applicant system has
 * accepted, oldest first (`null` for one it silently dropped as spam), as a
 * readonly fact on the board's pages and on the thank-you page
 * (`job-application-references`). The reference is printed on the thank-you
 * page alone, which a run is free to leave once the application is sent.
 *
 * Self-contained, because the board page's script embeds its source.
 */
export function applicationReferences(state: JobBoardState): string {
  return JSON.stringify(state.applications.map((application) => application.reference));
}
