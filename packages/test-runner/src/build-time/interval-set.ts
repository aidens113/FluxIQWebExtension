import type { Interval } from "./types.js";

/** A set of wall-time instants as sorted, disjoint, non-empty intervals. Immutable. */
export class IntervalSet {
  private constructor(readonly spans: readonly Interval[]) {}

  static readonly empty = new IntervalSet([]);

  /** The union of any intervals; empty and reversed ones are dropped. */
  static of(intervals: Iterable<Interval>): IntervalSet {
    const sorted = [...intervals].filter(span => span.end > span.start).sort((a, b) => a.start - b.start);
    const merged: Interval[] = [];
    for (const span of sorted) {
      const last = merged[merged.length - 1];
      if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
      else merged.push({ start: span.start, end: span.end });
    }
    return new IntervalSet(merged);
  }

  get totalMs(): number {
    return this.spans.reduce((sum, span) => sum + (span.end - span.start), 0);
  }

  union(other: IntervalSet): IntervalSet {
    return IntervalSet.of([...this.spans, ...other.spans]);
  }

  intersect(other: IntervalSet): IntervalSet {
    const out: Interval[] = [];
    let i = 0;
    let j = 0;
    while (i < this.spans.length && j < other.spans.length) {
      const a = this.spans[i]!;
      const b = other.spans[j]!;
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) out.push({ start, end });
      if (a.end < b.end) i += 1;
      else j += 1;
    }
    return new IntervalSet(out);
  }

  subtract(other: IntervalSet): IntervalSet {
    const out: Interval[] = [];
    for (const span of this.spans) {
      let start = span.start;
      for (const cut of other.spans) {
        if (cut.end <= start || cut.start >= span.end) continue;
        if (cut.start > start) out.push({ start, end: cut.start });
        start = Math.max(start, cut.end);
      }
      if (start < span.end) out.push({ start, end: span.end });
    }
    return new IntervalSet(out);
  }
}
