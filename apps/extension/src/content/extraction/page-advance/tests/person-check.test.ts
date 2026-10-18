import assert from "node:assert/strict";
import test from "node:test";
import { movePage, PageMovePersonCheck, type RefusedPageHost } from "..";
import { FakeElement, nthPagerLink, STORE_ITEM, storePage } from "../../tests/store-pager";

function check(text: string): void {
  Object.defineProperty(document, "body", { value: new FakeElement("body", {}, text), configurable: true });
}

test("a marked page landing hands off a person-only check before missing-list retry or HTTP reload", async () => {
  const page = storePage(3);
  try {
    check("Please confirm you are not a robot. I'm not a robot");
    let reloads = 0;
    const host: RefusedPageHost = {
      status: () => 429,
      pause: () => Promise.reject(new Error("must not wait to reload a robot check")),
      reload: () => {
        reloads += 1;
        return Promise.resolve();
      }
    };
    const answer = await movePage({ item: STORE_ITEM }, { resume: { by: "next" }, host, timeoutMs: 1000 });
    assert.equal(answer.outcome, "needs_person");
    if (answer.outcome !== "needs_person") return;
    assert.equal(answer.sighting.outcome, "person_only");
    assert.equal(answer.sighting.waitedMs, 0);
    assert.equal(reloads, 0);
    assert.deepEqual(page.followed, []);
  } finally { page.restore(); }
});

test("after the person clears a marked landing, it answers for the completed move without another press", async () => {
  const page = storePage(3);
  try {
    check("Please confirm you are not a robot");
    assert.equal((await movePage({ item: STORE_ITEM }, { resume: { by: "following" }, timeoutMs: 1000 })).outcome, "needs_person");
    check("Results are ready");
    const resumed = await movePage({ item: STORE_ITEM }, { resume: { by: "following" }, timeoutMs: 1000 });
    assert.deepEqual(resumed, { outcome: "moved", by: "following", page: 3 });
    assert.deepEqual(page.followed, [], "the same movement mark acknowledges arrival, never moving to page four");
  } finally { page.restore(); }
});

test("a self-clearing arrival waits, then accepts its list without asking a person", async () => {
  const page = storePage(3);
  try {
    check("Checking your browser before you continue");
    const clear = setTimeout(() => check("Results are ready"), 5);
    try {
      assert.deepEqual(await movePage({ item: STORE_ITEM }, { resume: { by: "next" }, timeoutMs: 1000 }), { outcome: "moved", by: "next", page: 3 });
    } finally { clearTimeout(clear); }
    assert.deepEqual(page.followed, []);
  } finally { page.restore(); }
});

test("a self-clearing arrival that never clears hands off rather than reloading it", async () => {
  const page = storePage(3);
  try {
    check("Checking your browser before you continue");
    await assert.rejects(PageMovePersonCheck.awaitClear(Date.now(), Date.now() + 5), (error: unknown) => error instanceof PageMovePersonCheck && error.sighting.outcome === "not_cleared");
  } finally { page.restore(); }
});

test("an in-document Next that shows a check hands off before link fallback can press or navigate again", async () => {
  const page = storePage(1);
  try {
    check("Results are ready");
    const next = document.querySelector(nthPagerLink(4)) as unknown as FakeElement;
    let presses = 0;
    next.onClick = () => {
      presses += 1;
      check("Please confirm you are not a robot");
    };
    const answer = await movePage({ item: STORE_ITEM, pagination: { next: nthPagerLink(4) } }, { timeoutMs: 1000 });
    assert.equal(answer.outcome, "needs_person");
    assert.equal(presses, 1);
  } finally { page.restore(); }
});
