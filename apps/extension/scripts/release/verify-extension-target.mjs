// Checks a built extension target the way a browser checks it at install time,
// without a browser: the manifest is valid for its target, every file it names
// is present, every page's script and stylesheet resolve, every script parses,
// every icon is a PNG of its declared size, and the permissions are exactly the
// reviewed set (permission-review.mjs).
//
// It runs twice: on each dist/<target>/ directory at the end of every extension
// build, and on each store ZIP after it is written, reading the archive back.
// That is how the Firefox build is loaded by an automated check here. A real
// Firefox cannot load it on this toolchain: Playwright 1.51.1 cannot install
// temporary add-ons, and its pinned Firefox revision is not the one installed
// (docs/working/automated-testing-facility-plan.md, Current State). What a real
// load adds beyond this -- the extension actually starting -- is covered for
// Chromium by the e2e suite and left to the release checklist for Firefox.

import { transform } from "esbuild";
import { REVIEWED_PERMISSIONS } from "./permission-review.mjs";

/** Firefox added `world: "MAIN"` for manifest content scripts in 128. */
const FIREFOX_MAIN_WORLD_MIN = 128;
/** Chrome needs 116 for sidePanel.setPanelBehavior and 111 for MAIN-world content scripts. */
const CHROME_MIN = 116;
const STORE_EXCLUDED = [/\.map$/, /^build-info\.json$/];

/**
 * @typedef {"chrome" | "firefox" | "e2e-chromium"} TargetKind
 * @param {{ target: TargetKind, files: ReadonlyMap<string, Buffer>, expectedVersion: string, store?: boolean, release?: boolean }} input
 *   `files` maps "/"-separated paths relative to the extension root to contents.
 *   `store` applies the rules for an archive submitted to a store; `release`
 *   additionally refuses placeholders an owner must replace before submission.
 * @returns {Promise<{ errors: string[], warnings: string[] }>}
 */
export async function verifyExtensionTarget(input) {
  const { target, files, expectedVersion } = input;
  const errors = [];
  const warnings = [];
  const manifestBytes = files.get("manifest.json");
  if (!manifestBytes) return { errors: ["manifest.json is missing from the root"], warnings };
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch (error) {
    return { errors: [`manifest.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`], warnings };
  }

  checkIdentity(manifest, expectedVersion, errors);
  const referenced = referencedFiles(manifest);
  for (const [file, role] of referenced) if (!files.has(file)) errors.push(`${role} names ${file}, which is not in the build`);
  await checkPages(manifest, files, errors);
  await checkScripts(manifest, files, errors);
  checkIcons(manifest, files, errors);
  if (target === "firefox") checkFirefox(manifest, errors, warnings, input.release === true);
  else checkChromium(manifest, target, errors);
  if (target !== "e2e-chromium") checkReviewedPermissions(manifest, target, errors);
  if (input.store) {
    for (const name of files.keys()) if (STORE_EXCLUDED.some((pattern) => pattern.test(name))) errors.push(`store package must not contain ${name}`);
    if (target === "e2e-chromium") errors.push("the e2e-chromium target is a test build and is never packaged for a store");
  }
  return { errors, warnings };
}

function checkIdentity(manifest, expectedVersion, errors) {
  if (manifest.manifest_version !== 3) errors.push(`manifest_version is ${String(manifest.manifest_version)}, expected 3`);
  if (typeof manifest.name !== "string" || manifest.name.length === 0 || manifest.name.length > 75) errors.push("name must be 1-75 characters");
  if (typeof manifest.description !== "string" || manifest.description.length === 0 || manifest.description.length > 132) errors.push("description must be 1-132 characters (Chrome Web Store limit)");
  if (typeof manifest.version !== "string" || !/^\d{1,5}(\.\d{1,5}){0,3}$/.test(manifest.version)) errors.push(`version "${String(manifest.version)}" is not 1-4 dot-separated integers`);
  else if (manifest.version !== expectedVersion) errors.push(`version ${manifest.version} does not match apps/extension/package.json ${expectedVersion}; bump both together`);
}

/** Every file the manifest names, with the key that names it. */
function referencedFiles(manifest) {
  /** @type {[string, string][]} */
  const found = [];
  const add = (file, role) => { if (typeof file === "string") found.push([file.replace(/^\.?\//, ""), role]); };
  add(manifest.background?.service_worker, "background.service_worker");
  for (const script of manifest.background?.scripts ?? []) add(script, "background.scripts");
  manifest.content_scripts?.forEach((entry, index) => {
    for (const file of entry.js ?? []) add(file, `content_scripts[${index}].js`);
    for (const file of entry.css ?? []) add(file, `content_scripts[${index}].css`);
  });
  add(manifest.action?.default_popup, "action.default_popup");
  add(manifest.side_panel?.default_path, "side_panel.default_path");
  for (const [size, file] of Object.entries(manifest.icons ?? {})) add(file, `icons.${size}`);
  for (const [size, file] of Object.entries(manifest.action?.default_icon ?? {})) add(file, `action.default_icon.${size}`);
  return found;
}

async function checkPages(manifest, files, errors) {
  const pages = [manifest.action?.default_popup, manifest.side_panel?.default_path].filter((page) => typeof page === "string");
  for (const page of pages) {
    const html = files.get(page);
    if (!html) continue;
    const directory = page.includes("/") ? page.slice(0, page.lastIndexOf("/") + 1) : "";
    const source = html.toString("utf8");
    for (const match of source.matchAll(/<(?:script[^>]*\bsrc|link[^>]*\bhref)="([^"]+)"/g)) {
      const reference = match[1];
      if (/^[a-z]+:/i.test(reference) || reference.startsWith("//")) {
        errors.push(`${page} loads remote ${reference}; MV3 pages may only load files from the package`);
        continue;
      }
      const resolved = resolveRelative(directory, reference);
      if (!files.has(resolved)) errors.push(`${page} references ${reference}, which is not in the build`);
    }
  }
}

async function checkScripts(manifest, files, errors) {
  const moduleScripts = new Set([manifest.background?.service_worker, ...(manifest.background?.scripts ?? [])].filter(Boolean));
  for (const [name, data] of files) {
    if (!name.endsWith(".js")) continue;
    const format = moduleScripts.has(name) || manifest.background?.type === "module" && name.startsWith("background/") ? "esm" : undefined;
    try {
      await transform(data.toString("utf8"), { loader: "js", ...(format ? { format } : {}), logLevel: "silent" });
    } catch (error) {
      errors.push(`${name} does not parse: ${firstLine(error)}`);
    }
  }
}

function checkIcons(manifest, files, errors) {
  const declared = [...Object.entries(manifest.icons ?? {}), ...Object.entries(manifest.action?.default_icon ?? {})];
  if (!manifest.icons?.["128"]) errors.push("icons.128 is required by both stores");
  for (const [size, file] of declared) {
    const data = files.get(String(file).replace(/^\.?\//, ""));
    if (!data) continue;
    const dimensions = pngDimensions(data);
    if (!dimensions) errors.push(`${file} is not a PNG`);
    else if (dimensions.width !== Number(size) || dimensions.height !== Number(size)) {
      errors.push(`${file} is ${dimensions.width}x${dimensions.height} but is declared as ${size}x${size}`);
    }
  }
}

function checkFirefox(manifest, errors, warnings, release) {
  const gecko = manifest.browser_specific_settings?.gecko;
  if (typeof gecko?.id !== "string" || gecko.id.length === 0) errors.push("browser_specific_settings.gecko.id is required for Firefox MV3");
  else if (/@example\.|\.local$/.test(gecko.id)) {
    const message = `gecko.id "${gecko.id}" is a placeholder; the owner must choose the permanent add-on id before the first AMO submission`;
    if (release) errors.push(message); else warnings.push(message);
  }
  if (manifest.background?.service_worker) errors.push("Firefox MV3 runs background.scripts, not background.service_worker");
  if (!Array.isArray(manifest.background?.scripts) || manifest.background.scripts.length === 0) errors.push("background.scripts is required for Firefox");
  if (manifest.side_panel || manifest.permissions?.includes("sidePanel")) errors.push("Firefox has no side panel; use action.default_popup");
  if (!manifest.action?.default_popup) errors.push("action.default_popup is the Firefox panel surface and is required");
  const minimum = Number.parseFloat(gecko?.strict_min_version ?? "0");
  const usesMainWorld = manifest.content_scripts?.some((entry) => entry.world === "MAIN");
  if (usesMainWorld && !(minimum >= FIREFOX_MAIN_WORLD_MIN)) {
    errors.push(`a content script runs in world MAIN, which Firefox supports from ${FIREFOX_MAIN_WORLD_MIN}; strict_min_version is ${gecko?.strict_min_version ?? "unset"}`);
  }
  if (!gecko?.data_collection_permissions) warnings.push("gecko.data_collection_permissions is not declared; AMO requires it for new submissions");
}

function checkChromium(manifest, target, errors) {
  if (typeof manifest.background?.service_worker !== "string") errors.push("Chromium MV3 needs background.service_worker");
  if (manifest.browser_specific_settings) errors.push("browser_specific_settings is Firefox-only and draws a Chrome Web Store warning");
  if (!manifest.side_panel?.default_path) errors.push("side_panel.default_path is the Chromium panel surface and is required");
  if (target === "chrome" && !(Number.parseInt(manifest.minimum_chrome_version ?? "0", 10) >= CHROME_MIN)) {
    errors.push(`minimum_chrome_version must be at least ${CHROME_MIN} (sidePanel.setPanelBehavior)`);
  }
}

function checkReviewedPermissions(manifest, target, errors) {
  const reviewed = new Set(REVIEWED_PERMISSIONS.filter((entry) => entry.targets.includes(target)).map((entry) => entry.permission));
  const requested = [...(manifest.permissions ?? []), ...(manifest.host_permissions ?? []), ...(manifest.optional_permissions ?? [])];
  for (const permission of requested) {
    if (!reviewed.has(permission)) errors.push(`${target} asks for "${permission}", which is not in scripts/release/permission-review.mjs; review and justify it there first`);
  }
  for (const entry of manifest.content_scripts ?? []) {
    for (const match of entry.matches ?? []) if (!reviewed.has(match)) errors.push(`content script match "${match}" is not a reviewed host permission`);
  }
}

/** @returns {{ width: number, height: number } | undefined} */
function pngDimensions(data) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < 24 || !data.subarray(0, 8).equals(signature) || data.toString("ascii", 12, 16) !== "IHDR") return undefined;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function resolveRelative(directory, reference) {
  const parts = `${directory}${reference.replace(/^\.\//, "")}`.split("/");
  const out = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part !== "." && part !== "") out.push(part);
  }
  return out.join("/");
}

function firstLine(error) {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0];
}
