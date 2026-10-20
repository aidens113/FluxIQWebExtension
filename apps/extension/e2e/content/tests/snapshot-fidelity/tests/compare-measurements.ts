// How far an offline measurement agrees with the live one. Counts, element
// roles, tag and attribute NAMES only: nothing returned here carries page
// text, a value or a URL, so it can be printed and reported.
//
// - Page view: elements matched by tag, role, accessible name, test id, id,
//   name, href path and input type; a missing element is put in the first
//   category that explains it. Matched pairs are compared field by field.
// - List read: row count, column set, and cells equal.
// - Targets: resolved live, resolved offline, and resolved to the element at
//   the same place in both trees, by full and by anchored path (element-path.ts).

import type { DomElementDescriptor } from "../../../../../src/shared/protocol.js";
import type { PageCensus } from "./page-census.js";
import type { PageMeasurement, TargetCategory } from "./measure-page.js";

export type Agreement = {
  pageView: {
    live: number;
    offline: number;
    matched: number;
    missing: number;
    extra: number;
    missingByCategory: Record<string, number>;
    missingByTag: Record<string, number>;
    extraByTag: Record<string, number>;
    fieldDisagreements: Record<string, number>;
  };
  detection: { liveItem: boolean; offlineOk: boolean; sameItem: boolean; liveFields: number; offlineFields: number };
  read: { status: string; liveStatus: string; liveFailureCode: string | null; liveRows: number; offlineRows: number; liveColumns: number; offlineColumns: number; sameColumns: boolean; cellsEqual: number; cellsCompared: number; equal: boolean; failureCode: string | null };
  targets: {
    sampled: number;
    liveResolved: number;
    offlineResolved: number;
    sameElement: number;
    sameElementAnchored: number;
    byCategory: Record<TargetCategory, { sampled: number; offlineSame: number; offlineSameAnchored: number }>;
    offlineStrategies: Record<string, number>;
  };
  census: Record<keyof PageCensus, [number, number]>;
};

export function compareMeasurements(live: PageMeasurement, offline: PageMeasurement): Agreement {
  return {
    pageView: comparePageView(live.elements, offline.elements),
    detection: {
      liveItem: live.detection.ok,
      offlineOk: offline.detection.ok,
      sameItem: live.detection.item !== undefined && live.detection.item === offline.detection.item,
      liveFields: live.detection.fieldCount ?? 0,
      offlineFields: offline.detection.fieldCount ?? 0
    },
    read: compareRead(live, offline),
    targets: compareTargets(live, offline),
    census: Object.fromEntries(Object.keys(live.census).map((key) => [key, [live.census[key as keyof PageCensus], offline.census[key as keyof PageCensus]]])) as Agreement["census"]
  };
}

function hrefPath(href: string | undefined): string {
  if (!href) return "";
  try {
    const url = new URL(href);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

function key(element: DomElementDescriptor): string {
  return [
    element.tagName.toLowerCase(), element.role ?? element.implicitRole ?? "", element.accessibleName ?? "", element.testId ?? "",
    element.id ?? "", element.name ?? "", hrefPath(element.href), element.inputType ?? ""
  ].join("\u0001");
}

function increment(counts: Record<string, number>, name: string): void {
  counts[name] = (counts[name] ?? 0) + 1;
}

function missingCategory(element: DomElementDescriptor): string {
  const tag = element.tagName.toLowerCase();
  if (element.context?.shadowHosts?.length) return "shadow DOM";
  if (tag === "canvas") return "canvas";
  if (tag === "iframe" || tag === "frame") return "iframe";
  if (tag === "img" || tag === "picture" || tag === "svg") return "image";
  if (tag.includes("-")) return "custom element";
  if (element.hasClickHandler && !["a", "button", "input", "select", "textarea", "summary"].includes(tag) && !element.role) return "script-attached listener";
  if (element.frontLayer) return "fixed or sticky layer";
  return "other";
}

const FIELDS = ["text", "visibleText", "value", "checked", "hasValue", "selectedValue", "isVisibleOnViewport", "hasClickHandler", "frontLayer", "hidden", "repeatCount", "label", "drawing"] as const;

function comparePageView(live: DomElementDescriptor[], offline: DomElementDescriptor[]): Agreement["pageView"] {
  const pool = new Map<string, DomElementDescriptor[]>();
  for (const element of offline) {
    const group = pool.get(key(element)) ?? [];
    group.push(element);
    pool.set(key(element), group);
  }
  const missingByCategory: Record<string, number> = {};
  const missingByTag: Record<string, number> = {};
  const fieldDisagreements: Record<string, number> = {};
  let matched = 0;
  for (const element of live) {
    const twin = pool.get(key(element))?.shift();
    if (!twin) {
      increment(missingByCategory, missingCategory(element));
      increment(missingByTag, element.tagName.toLowerCase());
      continue;
    }
    matched += 1;
    for (const field of FIELDS) {
      if (JSON.stringify(element[field] ?? null) !== JSON.stringify(twin[field] ?? null)) increment(fieldDisagreements, field);
    }
    const a = element.documentBounds ?? element.bounds;
    const b = twin.documentBounds ?? twin.bounds;
    if (a && b && (Math.abs(a.x - b.x) > 2 || Math.abs(a.y - b.y) > 2 || Math.abs(a.width - b.width) > 2 || Math.abs(a.height - b.height) > 2)) increment(fieldDisagreements, "geometry>2px");
    if (Boolean(a) !== Boolean(b)) increment(fieldDisagreements, "geometry presence");
  }
  const extraByTag: Record<string, number> = {};
  for (const group of pool.values()) for (const element of group) increment(extraByTag, element.tagName.toLowerCase());
  const extra = Object.values(extraByTag).reduce((sum, count) => sum + count, 0);
  return { live: live.length, offline: offline.length, matched, missing: live.length - matched, extra, missingByCategory, missingByTag, extraByTag, fieldDisagreements };
}

function compareRead(live: PageMeasurement, offline: PageMeasurement): Agreement["read"] {
  const rows = Math.min(live.read.rows.length, offline.read.rows.length);
  let cellsEqual = 0;
  let cellsCompared = 0;
  for (let index = 0; index < rows; index += 1) {
    for (const column of live.read.columns) {
      cellsCompared += 1;
      if (JSON.stringify(live.read.rows[index]![column] ?? null) === JSON.stringify(offline.read.rows[index]![column] ?? null)) cellsEqual += 1;
    }
  }
  const sameColumns = JSON.stringify(live.read.columns) === JSON.stringify(offline.read.columns);
  return {
    status: offline.read.status,
    liveStatus: live.read.status,
    liveFailureCode: live.read.failureCode,
    liveRows: live.read.rows.length,
    offlineRows: offline.read.rows.length,
    liveColumns: live.read.columns.length,
    offlineColumns: offline.read.columns.length,
    sameColumns,
    cellsEqual,
    cellsCompared,
    equal: sameColumns && live.read.rows.length === offline.read.rows.length && cellsEqual === live.read.rows.length * live.read.columns.length,
    failureCode: offline.read.failureCode
  };
}

function compareTargets(live: PageMeasurement, offline: PageMeasurement): Agreement["targets"] {
  const byCategory = {} as Agreement["targets"]["byCategory"];
  const offlineStrategies: Record<string, number> = {};
  let sameElement = 0;
  let sameElementAnchored = 0;
  live.targets.forEach((target, index) => {
    const twin = offline.targets[index];
    const entry = byCategory[target.category] ??= { sampled: 0, offlineSame: 0, offlineSameAnchored: 0 };
    entry.sampled += 1;
    if (twin?.resolved) increment(offlineStrategies, twin.strategy ?? "unreported");
    if (!target.resolved || !twin?.resolved || !target.path || !twin.path) return;
    if (target.path.full === twin.path.full) {
      sameElement += 1;
      entry.offlineSame += 1;
    }
    if (target.path.anchored === twin.path.anchored) {
      sameElementAnchored += 1;
      entry.offlineSameAnchored += 1;
    }
  });
  return {
    sampled: live.targets.length,
    liveResolved: live.targets.filter((target) => target.resolved).length,
    offlineResolved: offline.targets.filter((target) => target.resolved).length,
    sameElement,
    sameElementAnchored,
    byCategory,
    offlineStrategies
  };
}
