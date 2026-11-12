import { BrowserHostError } from "../errors/index.js";

/** A host id or profile name that is one plain path segment: letters, digits, dot, dash, underscore, and never `.` or `..`. */
export function safeSegment(value: string, what: string): string {
  if (!/^[A-Za-z0-9._-]+$/u.test(value) || /^\.+$/u.test(value)) throw new BrowserHostError("browser_host.bad_name", `The ${what} must be letters, digits, dots, dashes or underscores.`);
  return value;
}
