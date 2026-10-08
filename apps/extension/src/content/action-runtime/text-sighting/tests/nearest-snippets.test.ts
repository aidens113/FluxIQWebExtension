// How the shown text beside a failed text wait is ranked and cut (t369).

import assert from "node:assert/strict";
import test from "node:test";
import { nearestSnippets } from "../nearest-snippets";

test("the snippets most like the awaited text come first, at most three, and nothing unrelated", () => {
  const near = nearestSnippets("Cart (3)", ["Deals", "Cart", "Your cart is empty. Start shopping!", "View cart", "Sign in", "Cart (0)"]);
  assert.equal(near.length, 3);
  assert.equal(near[0], "Cart (0)");
  assert.ok(near.includes("Cart"));
  assert.ok(!near.includes("Deals") && !near.includes("Sign in"));
});

test("text sharing nothing with the awaited text is never returned", () => {
  assert.deepEqual(nearestSnippets("zq", ["Deals", "Sign in"]), []);
});

test("repeats and whitespace collapse to one snippet", () => {
  assert.deepEqual(nearestSnippets("Order placed", ["Order  placed\n", "Order placed", "Order placed"]), ["Order placed"]);
});

test("a long snippet is cut to 80 characters around the first awaited word", () => {
  const long = `${"Free shipping on every order over forty euros, ".repeat(3)}your Cart (2) is waiting for you at checkout today`;
  const [cut] = nearestSnippets("Cart (3)", [long]);
  assert.ok(cut !== undefined);
  assert.ok(cut.length <= 80, `${cut.length} characters`);
  assert.ok(cut.includes("Cart (2)"), cut);
  assert.ok(cut.startsWith("…"));
});

test("a lone digit shared with a product title does not make it near", () => {
  assert.deepEqual(nearestSnippets("Cart (0)", ["USB C Hub 4 Port USB 3.0 Slim Aluminium Data Hub", "Cart"]), ["Cart"]);
});
