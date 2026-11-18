import { AuthenticationTabsError } from "./failure";
import type { AuthenticationTabRoute } from "./model";

function pathname(value: string): string {
  return decodeURIComponent(value).replace(/\/+$/u, "") || "/";
}

/** Authentication exclusion only. Callers retain their ordinary page/scheme eligibility rules. */
export class AuthenticationTabRoutePolicy {
  private readonly routes: readonly AuthenticationTabRoute[];

  constructor(routes: readonly AuthenticationTabRoute[]) {
    try {
      this.routes = routes.map((route) => {
        const origin = new URL(route.origin);
        const path = new URL(route.pathname, origin.origin);
        if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password
          || origin.pathname !== "/" || origin.search || origin.hash || !route.pathname.startsWith("/")
          || path.origin !== origin.origin || path.pathname !== route.pathname || path.search || path.hash
          || (route.includeDescendants !== undefined && typeof route.includeDescendants !== "boolean")) {
          throw new AuthenticationTabsError("invalid_route");
        }
        return { origin: origin.origin, pathname: pathname(path.pathname), includeDescendants: route.includeDescendants === true };
      });
    } catch {
      throw new AuthenticationTabsError("invalid_route");
    }
  }

  allows(value: string | undefined): boolean {
    if (!value) return false;
    try {
      const url = new URL(value);
      const path = pathname(url.pathname);
      return !this.routes.some((route) => route.origin === url.origin
        && (path === route.pathname || (route.includeDescendants && path.startsWith(route.pathname === "/" ? "/" : `${route.pathname}/`))));
    } catch {
      return false;
    }
  }
}
