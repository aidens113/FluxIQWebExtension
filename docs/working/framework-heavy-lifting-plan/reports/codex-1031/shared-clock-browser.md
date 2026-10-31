# Shared clock realistic browser regression

Outcome: Done (prepared; not launched).
Changed: t823 `apps/extension/e2e/content/tests/extraction/tests/item-conditions.spec.ts` only, plus this report in MAIN.
Validation: Source inspection of job-board catalog/age, postings, search and card rendering; `git diff --check` -> no output, exit 0.
Not verified: Browser execution and browser bundle generation await lead coordination. No browser/test/build/provider/panel launch occurred.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1031/shared-clock-browser.md`
Notes: Real positive job-board rows; no fixture edits or synthetic page. Date.now advances at real speed with an offset; performance and timer APIs are unchanged.

## Dataset and proof

Scenario `job-board`, page `/scenarios/job-board/jobs?q=Saltmarsh+Games`. The authored catalog contains exactly two open organic matches: d1, Rust Engineer, Saltmarsh Games, postedHours 30; g7, QA Engineer, Saltmarsh Games, postedHours 205. The site's fixed reference is 2026-09-21T08:00:00Z. `postedAgeText` renders these as `Posted 1 day ago` and `Posted 8 days ago`. The spec independently asserts these exact two title/date records directly from real DOM before extraction.

With `where: [{ field: "posted", lessThan: "2026-09-21" }]`, `sort: [{field:"posted",order:"asc",as:"date"}]` and `now: Date.UTC(2026,8,21,8)`, expected complete extracted dataset is:

```json
[
  { "title": "QA Engineer", "posted": "Posted 8 days ago" },
  { "title": "Rust Engineer", "posted": "Posted 1 day ago" }
]
```

The page's Date.now is shifted to 2026-09-22T08:00:00Z while continuing to tick. The same actual content extract-list action without supplied now must return exactly the QA Engineer record: one-day-old now means September21 and is outside the strict before-September21 bound. Both datasets are nonempty; neither assertion accepts an empty scrape. The reference request also exercises real browser date sorting.

## Focused command for lead

From t823 downstream root, after Core libraries are ready and browser validation is coordinated:

```powershell
pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/extraction/tests/item-conditions.spec.ts --grep "a supplied date reference keeps the job-board row set after wall-clock midnight" --workers=1
```

The existing content runner disables Node strip-only loading, and its global setup bundles actual content/page-world scripts. Expected: one headless Chromium test, no provider/model calls, only the allowed job-board fixture. This tests browser extraction directly; native/executor metadata forwarding remains covered by prepared unit/integration tests rather than this content-only harness.
