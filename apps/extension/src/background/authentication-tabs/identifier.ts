/** Opaque, non-secret attempt/session identity; never an authorize URL or fragment. */
export function isAuthenticationTabIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);
}
