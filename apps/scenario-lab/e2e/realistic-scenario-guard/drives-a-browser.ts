import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DRIVER = /^(?:@playwright\/test|playwright(?:-core)?|puppeteer(?:-core)?)$/u;
const LAUNCH = /\b(?:chromium|firefox|webkit)\.launch(?:PersistentContext|Server)?\(|\blaunchPersistentContext\(/u;
const IMPORT = /\b(?:import|export)\s+([^;]*?)\s*from\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']|\brequire\(\s*["']([^"']+)["']/gu;

/**
 * Whether the source file at `file` drives a real browser: it imports a value
 * (not only types) from Playwright or Puppeteer, calls a browser launch, or
 * imports a value from a test kit (a module inside a `tests` folder) that
 * does, at any depth. A unit test whose Playwright import is type-only drives
 * a fake page and opens no browser. Production modules are not followed: a
 * test of a browser launcher usually hands it a fake, which no static reading
 * can tell apart. `cache` is shared across calls, keyed by absolute path.
 */
export function drivesABrowser(file: string, cache: Map<string, boolean>): boolean {
  const known = cache.get(file);
  if (known !== undefined) return known;
  cache.set(file, false); // An import cycle back to this file adds nothing.
  const source = readFileSync(file, "utf8");
  const imports = valueImports(source);
  const result = LAUNCH.test(source)
    || imports.some((specifier) => DRIVER.test(specifier))
    || imports.some((specifier) => {
      const target = specifier.startsWith(".") ? resolveRelative(file, specifier) : null;
      return target !== null && isInTestsFolder(target) && drivesABrowser(target, cache);
    });
  cache.set(file, result);
  return result;
}

/** The specifiers this source imports a value from; `import type` and an all-`type` brace list are left out. */
function valueImports(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT)) {
    const [, clause, fromSpecifier, dynamicSpecifier, requireSpecifier] = match;
    if (fromSpecifier === undefined) {
      const specifier = dynamicSpecifier ?? requireSpecifier;
      if (specifier !== undefined) specifiers.push(specifier);
      continue;
    }
    const trimmed = (clause ?? "").trim();
    if (/^type\b/u.test(trimmed)) continue;
    const members = /^\{([^}]*)\}$/u.exec(trimmed)?.[1]?.split(",").map((member) => member.trim()).filter(Boolean);
    if (members !== undefined && members.length > 0 && members.every((member) => /^type\b/u.test(member))) continue;
    specifiers.push(fromSpecifier);
  }
  return specifiers;
}

/** A relative specifier as TypeScript resolves it under NodeNext: `./x.js` names `./x.ts`. */
function resolveRelative(from: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(from), specifier);
  const candidates = [base, base.replace(/\.js$/u, ".ts"), base.replace(/\.mjs$/u, ".mts"), base.replace(/\.js$/u, ".tsx"), `${base}.ts`, path.join(base, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function isInTestsFolder(file: string): boolean {
  return file.split(path.sep).includes("tests");
}
