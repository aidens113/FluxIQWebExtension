import { redactText } from "@fluxiq-web-extension/test-evidence";
import { screenUrl } from "../extension-start-trace/index.js";

/**
 * A photographed page's location as the review keeps it: its origin and path,
 * with the run's secrets and token patterns redacted, and never its query or
 * fragment. Unlike the extension-start trace it keeps the path, which is what
 * says which fixture page a picture shows (`screenText` turned a fixture path
 * into `[long]` in the second validation run). An extension page keeps only its
 * path under a placeholder id (`screenUrl`), as the extension-start trace does.
 */
export function screenLocation(url: string, secrets: readonly string[]): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return screenUrl(url);
    return `${parsed.origin}${redactText(parsed.pathname, { secrets })}`;
  } catch {
    return screenUrl(url);
  }
}
