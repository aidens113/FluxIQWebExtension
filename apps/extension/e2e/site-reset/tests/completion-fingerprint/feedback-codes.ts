/** Bounded closed codes only; feedback may also contain private page evidence. */
export function feedbackCodes(value: unknown, safeCode: (value: unknown) => string | null): string[] {
  const codes = new Set<string>();
  const pending = [{ value, depth: 0 }];
  for (let inspected = 0; pending.length > 0 && inspected < 200; inspected++) {
    const next = pending.pop()!;
    if (next.value === null || typeof next.value !== "object") continue;
    for (const [key, child] of Object.entries(next.value)) {
      if (["code", "failureCode", "resultCode", "issueCodes"].includes(key)) {
        for (const candidate of Array.isArray(child) ? child : [child]) {
          const code = safeCode(candidate);
          if (code !== null && codes.size < 12) codes.add(code);
        }
      }
      if (next.depth < 5 && child !== null && typeof child === "object") pending.push({ value: child, depth: next.depth + 1 });
    }
  }
  return [...codes];
}
