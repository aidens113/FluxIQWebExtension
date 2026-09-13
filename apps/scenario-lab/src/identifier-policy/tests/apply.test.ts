import assert from "node:assert/strict";
import test from "node:test";
import { applyIdentifierPolicy, identifierPolicies } from "../index.js";

/**
 * A page with everything the transform has to survive: test ids in markup and
 * in the script that queries them, an id referenced by `for`, one referenced by
 * `aria-labelledby`, one reached by a same-document link, an attribute whose
 * name merely contains a test id's name, and an id a client script composes at
 * runtime and this transform therefore cannot see.
 */
const PAGE = `<!doctype html><html><body>
<h2 id="people-heading">People</h2>
<section aria-labelledby="people-heading" data-testid="people">
  <label for="search">Search</label>
  <input id="search" name="q" data-testid="member-search" data-cy="search-box">
  <button data-testid="apply" data-test="apply-legacy" aria-describedby="apply-hint">Apply</button>
  <p id="apply-hint">Filters the list.</p>
  <a href="#people-heading">Back to top</a>
  <a href="#nowhere">Elsewhere</a>
  <fx-toggle data-control-testid="digest"></fx-toggle>
</section>
<script type="module">
const search = document.querySelector('[data-testid="member-search"]');
row.innerHTML = '<div id="' + memberId + '" data-testid="row"></div>';
</script>
</body></html>`;

const idsIn = (html: string) => [...html.matchAll(/\sid="([^"]*)"/gu)].map(([, id]) => id ?? "");
const count = (html: string, needle: string) => html.split(needle).length - 1;

test("as-authored changes nothing at all", () => {
  assert.equal(applyIdentifierPolicy(PAGE, "as-authored"), PAGE);
});

test("no-test-ids removes every attribute a recorder reads as a test id, and keeps every id", () => {
  const built = applyIdentifierPolicy(PAGE, "no-test-ids");
  for (const attribute of ["data-testid", "data-test", "data-cy"]) {
    assert.equal(count(built, `${attribute}=`), 0, attribute);
  }
  assert.deepEqual(idsIn(built), idsIn(PAGE), "a production build has no reason to touch an id");
  // The page still works: the hook the script queries is the one the markup
  // now carries, which is why the attribute is renamed and not deleted.
  assert.equal(count(built, 'data-fx-node="member-search"'), 2, "once in the markup, once in the query that finds it");
  assert.equal(count(built, `querySelector('[data-fx-node="member-search"]')`), 1);
  assert.equal(count(built, 'data-fx-node="row"'), 1, "markup the client builds is rewritten too");
  // Each source attribute keeps a name of its own, so nothing is written twice.
  assert.match(built, /<input id="search" name="q" data-fx-node="member-search" data-fx-ref="search-box">/u);
  assert.match(built, /<button data-fx-node="apply" data-fx-alt="apply-legacy"/u);
  // An attribute whose name merely contains one is not one.
  assert.equal(count(built, 'data-control-testid="digest"'), 1);
});

test("no-identifiers leaves no author-stable id, and every reference still resolves", () => {
  const built = applyIdentifierPolicy(PAGE, "no-identifiers");
  const ids = idsIn(built);
  assert.deepEqual(ids.filter((id) => /^:r\d+:$/u.test(id)), [":r0:", ":r1:", ":r2:"]);
  assert.equal(count(built, "data-testid="), 0, "no-identifiers includes everything no-test-ids does");
  for (const authored of ["people-heading", "search", "apply-hint"]) {
    assert.equal(count(built, `"${authored}"`), 0, authored);
  }
  // The accessibility tree is unchanged: the name still comes from the heading,
  // the label still labels the input, the hint still describes the button.
  assert.match(built, /<h2 id=":r0:">People<\/h2>/u);
  assert.match(built, /aria-labelledby=":r0:"/u);
  assert.match(built, /<label for=":r1:">/u);
  assert.match(built, /<input id=":r1:"/u);
  assert.match(built, /aria-describedby=":r2:"/u);
  assert.match(built, /<p id=":r2:">/u);
  assert.match(built, /href="#:r0:"/u, "a same-document link follows the id it points at");
  assert.match(built, /href="#nowhere"/u, "a link to no id on this page is left alone");
});

test("an id a client script composes at runtime is out of reach, and is left whole", () => {
  const built = applyIdentifierPolicy(PAGE, "no-identifiers");
  assert.match(built, /id="' \+ memberId \+ '"/u);
});

test("every reference in every policy points at an id the document declares", () => {
  for (const policy of identifierPolicies) {
    const built = applyIdentifierPolicy(PAGE, policy);
    const declared = new Set(idsIn(built));
    const referenced = [...built.matchAll(/\s(?:for|aria-labelledby|aria-describedby|aria-controls)="([^"]*)"/gu)]
      .flatMap(([, value]) => (value ?? "").split(/\s+/u));
    for (const reference of referenced) {
      assert.ok(declared.has(reference), `${policy}: ${reference} is referenced but not declared`);
    }
  }
});
