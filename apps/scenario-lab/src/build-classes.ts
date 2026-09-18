/**
 * Generated class names, the way a CSS-in-JS build emits them.
 *
 * A shipped console has no authored class names. Every class on the page is a
 * content hash -- `css-1x7ab3f` -- derived from the build, so two properties
 * follow that a hand-written fixture never reproduces. A class is a *style*,
 * not a role: the design system's one icon button carries the same hash on the
 * notification bell and on all 320 row action buttons at once, so a class set
 * is evidence about which component was used and never about which control was
 * clicked. And because the hash comes from the build, shipping any style change
 * renames every class on the page at once.
 *
 * Three fixtures render that way, so the emitter lives here rather than being
 * copied into each of them: `member-directory`, `support-desk` and
 * `order-operations`. Each owns its own role list and its own build strings.
 */
export function buildClassNames<TRole extends string>(build: string, roles: readonly TRole[]): Record<TRole, string> {
  return Object.fromEntries(roles.map((role) => [role, `css-${hash(`${build}:${role}`)}`])) as Record<TRole, string>;
}

/** FNV-1a in base 36: seven characters, indistinguishable from an emotion or styled-components build. */
function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(36).padStart(7, "0").slice(0, 7);
}
