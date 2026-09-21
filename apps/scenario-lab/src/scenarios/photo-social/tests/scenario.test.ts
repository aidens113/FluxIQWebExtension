import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { LIVE_INSTRUCTION_TASKS, LIVE_REPAIR_TASKS } from "../../index.js";
import { friendsTagged, giveawayEntries, mostLiked } from "../answers/index.js";
import { COPIED_GIVEAWAY_COMMENTS, GIVEAWAY_COMMENTS, GIVEAWAY_POST, MOON_JAR_POST, STUDIO, STUDIO_POSTS, gridFor, initialCollections } from "../data/index.js";
import { photoLook } from "../look/index.js";
import { COLLECTIONS_AFTER, GLAZE_COLLECTION, PRICE_QUESTION } from "../manifest.js";
import { compactCount } from "../pages/index.js";
import { collectionsText } from "../relay.js";
import { photoSocialScenario as scenario } from "../scenario.js";
import type { PhotoState } from "../types.js";

const manifest = scenario.manifest;
const context = { runToken: "photo-social-unit-token-0001", seed: 238 };
const fresh = () => scenario.createState(scenario.seed);
const apply = (state: PhotoState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const route = (state: PhotoState, subpath: string, query = "") => scenario.route!(state, { subpath, query: new URLSearchParams(query), method: "GET" }, context);
const august = (day: string) => STUDIO_POSTS.find((post) => post.date === `2026-08-${day}`)!.code;
/** The document without its script, which quotes selectors and class names that are not markup. */
const markupOf = (html: string) => html.slice(0, html.indexOf(`<script type="module">`));

test("the manifest is valid, with the collection as its primary workflow and two further workflows, each variant arming one mode", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["giveaway-entries", "ask-price"]);
  assert.deepEqual(manifest.variants?.map(({ id, arm }) => ({ id, arm })), [{ id: "consent-redesign", arm: { operation: "set-mode", payload: { mode: "consent-redesign" } } }]);
  assert.deepEqual(manifest.workflows?.[0]?.variants?.map(({ id, arm }) => ({ id, arm })), [{ id: "verified-upsell", arm: { operation: "set-mode", payload: { mode: "verified-upsell" } } }]);
});

test("the giveaway's valid entries are the thirteen a careful reader finds, in the order they appear", () => {
  assert.deepEqual(giveawayEntries(GIVEAWAY_COMMENTS), [
    { entrant: "sam.rivera", comment: "Last minute entry! @yuki.tanaka @dara.oconnell", date: "2026-09-27" },
    { entrant: "omar.farouk", comment: "@clara.voss @ben.achebe @nell.pryce \u{1F64C}", date: "2026-09-26" },
    { entrant: "theo.marchetti", comment: "@sofia.lindqvist @ravi.menon these would look great on our shelf", date: "2026-09-24" },
    { entrant: "priya.nair", comment: "@jonah.west @maya.hollis", date: "2026-09-23" },
    { entrant: "ines.vidal", comment: "@ines.vidal forgot one: @maya.hollis @jonah.west", date: "2026-09-22" },
    { entrant: "grace.adeyemi", comment: "@luca.bianchi @felix.ortega @zara.qureshi", date: "2026-09-22" },
    { entrant: "oskar.brandt", comment: "@kiln.theory @noor.haddad", date: "2026-09-21" },
    { entrant: "lena.moss", comment: "So pretty @kofi.ade @priya.nair", date: "2026-09-21" },
    { entrant: "clara.voss", comment: "@ben.achebe and @iris.nakamura, look!", date: "2026-09-21" },
    { entrant: "maya.hollis", comment: "@priya.nair @ines.vidal", date: "2026-09-20" },
    { entrant: "sofia.lindqvist", comment: "First! @theo.marchetti @ravi.menon", date: "2026-09-20" },
    { entrant: "iris.nakamura", comment: "@clara.voss @ben.achebe", date: "2026-09-20" },
    { entrant: "ben.achebe", comment: "@clara.voss @iris.nakamura count me in", date: "2026-09-20" },
  ]);
  const { expected } = resolveScenarioWorkflow(manifest, { workflowId: "giveaway-entries" });
  assert.deepEqual(expected.extracted?.[0]?.records, giveawayEntries(GIVEAWAY_COMMENTS));
});

test("each trap in the giveaway thread is one a rule excludes, not an accident of the data", () => {
  const author = (handle: string) => GIVEAWAY_COMMENTS.filter((comment) => comment.author === handle);
  assert.deepEqual(friendsTagged(author("kofi.ade")[0]!), ["lena.moss"], "one friend tagged twice is one friend");
  assert.deepEqual(friendsTagged(author("hana.sato")[0]!), ["eli.park"], "tagging yourself does not count");
  assert.deepEqual(friendsTagged(author("eli.park")[0]!), ["hana.sato"], "tagging the studio does not count");
  assert.equal(author("zara.qureshi")[0]!.date, "2026-09-28", "two friends, one day late");
  assert.equal(author("lena.moss").length, 2, "an entrant who entered twice counts once");
  const entries = giveawayEntries(GIVEAWAY_COMMENTS);
  assert.equal(entries.find((entry) => entry.entrant === "lena.moss")?.date, "2026-09-21", "at her first qualifying comment");
  assert.equal(entries.find((entry) => entry.entrant === "grace.adeyemi")?.date, "2026-09-22");
  assert.ok(entries.every((entry) => !entry.entrant.startsWith("harbour")), "no impersonator is an entrant");
  // Reading every comment with two tags, or the impersonator's copy, gives a different, plausible answer.
  const naive = GIVEAWAY_COMMENTS.filter((comment) => (comment.text.match(/@/gu) ?? []).length >= 2).map(({ author }) => author);
  assert.notDeepEqual(naive, entries.map(({ entrant }) => entrant));
  assert.notDeepEqual(giveawayEntries(COPIED_GIVEAWAY_COMMENTS), entries);
});

test("the three most-liked August posts can only be told apart on their own pages", () => {
  const top = mostLiked("2026-08", 3);
  assert.deepEqual(top.map(({ date, likes }) => [date, likes]), [["2026-08-21", 1249], ["2026-08-09", 1236], ["2026-08-03", 1212]]);
  const augustPosts = gridFor(STUDIO).filter((post) => post.date.startsWith("2026-08-"));
  const reading12K = augustPosts.filter((post) => post.likes !== null && compactCount(post.likes) === "1.2K");
  assert.equal(reading12K.length, 4, "four posts read 1.2K on the grid");
  assert.deepEqual(augustPosts.slice(0, 3).map(({ date }) => date), ["2026-08-30", "2026-08-27", "2026-08-24"], "the first three August cells are not the answer");
  const pinnedAugust = gridFor(STUDIO).find((post) => post.pinned && post.date.includes("-08-"))!;
  assert.equal(pinnedAugust.date, "2025-08-14");
  assert.ok((pinnedAugust.likes ?? 0) > top[0]!.likes!, "the pinned post from August 2025 out-likes them all");
  const reel = augustPosts.find((post) => post.kind === "reel")!;
  assert.ok(reel.plays > 10_000 && (reel.likes ?? 0) < 1000, "the reel's grid count is plays, not likes");
  assert.equal(gridFor(STUDIO).findIndex((post) => post.code === august("03")), 24, "the third post sits past the session check");
  assert.ok(initialCollections().some(({ codes }) => codes.includes(august("09"))), "the second is already in another collection");
});

test("state starts the same under every seed, and set-mode starts an armed run from a fresh visit", () => {
  assert.deepEqual(scenario.createState(1), scenario.createState(999));
  const touched = apply(apply(fresh(), "consent", { choice: "all" }), "save", { code: august("21"), saved: true });
  const armed = apply(touched, "set-mode", { mode: "consent-redesign" });
  assert.deepEqual({ ...armed, activity: [] }, { ...scenario.createState(1), mode: "consent-redesign", activity: [] });
  const state = fresh();
  assert.equal(apply(state, "set-mode", { mode: "nonsense" }), state);
  assert.equal(apply(state, "no-such-operation", {}), state);
  assert.equal(apply(state, "consent", { choice: "maybe" }), state);
  assert.equal(apply(state, "save", "not an object"), state);
});

test("unsaving a post takes it out of every collection; collections are created, toggled and filled from saved", () => {
  const celadon = august("09");
  const unsaved = apply(fresh(), "save", { code: celadon, saved: false });
  assert.ok(!unsaved.saved.includes(celadon));
  assert.ok(unsaved.collections.every(({ codes }) => !codes.includes(celadon)), "the filled bookmark destroys the post's place in Studio inspo");
  let state = apply(fresh(), "collection-create", { name: "  Glaze   ideas ", codes: [august("21")] });
  assert.deepEqual(state.collections.at(-1), { name: GLAZE_COLLECTION, slug: "glaze-ideas", codes: [august("21")] });
  assert.ok(state.saved.includes(august("21")), "a post put in a collection is saved as well");
  assert.equal(apply(state, "collection-create", { name: "glaze IDEAS", codes: [august("03")] }), state, "a name already in use is refused");
  state = apply(state, "collection-toggle", { slug: "glaze-ideas", code: august("03") });
  state = apply(state, "collection-add", { slug: "glaze-ideas", codes: [celadon, "not-a-code"] });
  assert.equal(state.relay.collections, COLLECTIONS_AFTER);
  const toggledOff = apply(state, "collection-toggle", { slug: "glaze-ideas", code: august("03") });
  assert.notEqual(toggledOff.relay.collections, COLLECTIONS_AFTER, "pressing a collection row twice takes the post back out");
  assert.equal(apply(fresh(), "collection-add", { slug: "kitchen", codes: [august("21")] }).relay.collections, collectionsText(initialCollections()), "only saved posts can be added from saved");
});

test("a message to the shop draws its instant reply, and one sent with the hidden field filled blocks the account", () => {
  const vague = apply(fresh(), "send-message", { thread: "saltmarsh.goods", text: "How much?", trap: "" });
  assert.equal(vague.messages.length, 2);
  assert.equal(vague.messages[1]!.card, undefined, "a message that names no piece gets no price");
  const named = apply(fresh(), "send-message", { thread: "saltmarsh.goods", text: PRICE_QUESTION, trap: "" });
  assert.deepEqual(named.messages[1]!.card, { slug: "speckled-moon-jar", name: "Speckled moon jar", price: "€68.00", note: "One of one · ships in 3–5 days" });
  assert.equal(named.relay.outbox, "saltmarsh.goods 1");
  const bot = apply(fresh(), "send-message", { thread: "saltmarsh.goods", text: PRICE_QUESTION, trap: "Moon jar" });
  assert.equal(bot.relay.blocked, "blocked");
  assert.deepEqual(bot.messages, []);
  assert.equal(apply(bot, "send-message", { thread: "saltmarsh.goods", text: PRICE_QUESTION, trap: "" }), bot, "a blocked account stays blocked");
  assert.equal(apply(fresh(), "send-message", { thread: "nobody.here", text: "hi" }).messages.length, 0);
});

test("the seed renames every class and generated id, and the markup carries no test id but the consent vendor's and the oracle's", () => {
  const home = scenario.render(fresh(), context);
  const other = scenario.render(fresh(), { ...context, seed: 7 });
  const classes = (html: string) => new Set([...markupOf(html).matchAll(/class="([^"]*)"/gu)].flatMap((match) => match[1]!.split(" ")));
  const shared = [...classes(home)].filter((name) => classes(other).has(name));
  assert.deepEqual(shared, [], "no class survives a change of seed");
  assert.ok([...classes(home)].every((name) => /^x[0-9a-z]+$/u.test(name)), "every class is an atomic hash");
  assert.notEqual(photoLook(238).hook.card, photoLook(239).hook.card);
  const testIds = (html: string) => [...markupOf(html).matchAll(/data-testid="([^"]*)"/gu)].map((match) => match[1]).sort();
  assert.deepEqual(testIds(home), ["cookie-policy-manage-dialog-accept-button", "cookie-policy-manage-dialog-decline-button", "fl-relay-blocked", "fl-relay-collections", "fl-relay-consent", "fl-relay-outbox"]);
  const answered = apply(fresh(), "consent", { choice: "essential" });
  assert.deepEqual(testIds(scenario.render(answered, context)), ["fl-relay-blocked", "fl-relay-collections", "fl-relay-consent", "fl-relay-outbox"]);
  const redesigned = scenario.render(apply(fresh(), "set-mode", { mode: "consent-redesign" }), context);
  assert.ok(!redesigned.includes("cookie-policy-manage-dialog-decline-button") && redesigned.includes("Only allow essential cookies"));
  assert.ok(redesigned.indexOf("Allow all cookies") < redesigned.indexOf("Only allow essential cookies"), "the accept control moved first");
});

test("every page serves, fragments load in batches, and the grid's third screen waits behind the session check", () => {
  const state = fresh();
  const status = (subpath: string, query = "") => route(state, subpath, query)?.status;
  for (const subpath of ["harbourlight.studio/", "harbourlight.studio/reels/", "harbourlight.studio/tagged/", `p/${GIVEAWAY_POST.code}/`, "direct/inbox/", "direct/t/saltmarsh.goods/", "tamsin.reyes/saved/", "tamsin.reyes/saved/kitchen/", "explore/", "reels/", "accounts/login/", "verified/subscribe/", "l/", "saltmarsh.goods/shop/speckled-moon-jar/"]) {
    assert.equal(status(subpath), 200, subpath);
  }
  assert.equal(route(state, "nobody.at.all/"), undefined);
  assert.equal(route(state, "p/NOPE/"), undefined);
  assert.equal(route(state, "harbourlight.studio/saved/"), undefined, "only the visitor has a saved page");
  assert.equal(status("harbourlight.studio/grid", "offset=12"), 200);
  assert.equal(status("harbourlight.studio/grid", "offset=24"), 401);
  assert.equal(route(apply(state, "session", {}), "harbourlight.studio/grid", "offset=24")?.status, 200);
  assert.equal(status("harbourlight.studio/grid", "offset=48"), 204);
  const cells = (body: string | undefined) => (body ?? "").split(`href="/scenarios/photo-social/p/`).length - 1;
  assert.equal(cells(route(state, "harbourlight.studio/grid", "offset=12")?.body), 12);
  const post = route(state, `p/${GIVEAWAY_POST.code}/`)!.body!;
  assert.equal((post.match(/\/c\/\d+\/"/gu) ?? []).length, 13, "the pinned rules and twelve comments");
  assert.ok(post.includes(`aria-label="Load more comments"`));
  const later = (offset: number) => route(state, `p/${GIVEAWAY_POST.code}/comments`, `offset=${offset}`)!.body!;
  assert.equal((later(12).match(/\/c\/\d+\/"/gu) ?? []).length, 12);
  assert.ok(!later(36).includes("Load more comments"), "the last batch has no control for another");
  const parent = GIVEAWAY_COMMENTS.find((comment) => comment.author === "ines.vidal")!;
  assert.ok(route(state, `p/${GIVEAWAY_POST.code}/c/${parent.id}/replies`)!.body!.includes("forgot one"));
  assert.ok(!post.includes("forgot one"), "replies are not in the page until they are opened");
  assert.ok(!route(state, `p/${MOON_JAR_POST.code}/`)!.body!.includes("€68"), "the price is nowhere on the post");
});

test("search puts the impersonator first, and the real studio is the one with the badge", () => {
  const body = route(fresh(), "explore/search", "q=harbourlight")!.body!;
  const handles = [...body.matchAll(/href="\/scenarios\/photo-social\/([^/"]+)\/"/gu)].map((match) => match[1]);
  assert.deepEqual(handles.slice(0, 2), ["harbourlight.studios", "harbourlight.studio"]);
  const rows = body.split(`<a class=`).slice(1);
  assert.equal(rows.filter((row) => row.includes(`aria-label="Verified"`)).length, 1);
  assert.ok(rows[1]!.includes(`aria-label="Verified"`));
});

test("a new message comes back as markup the page inserts as it is", () => {
  const state = apply(fresh(), "send-message", { thread: "saltmarsh.goods", text: PRICE_QUESTION, trap: "" });
  const fresh2 = JSON.parse(route(state, "direct/t/saltmarsh.goods/messages", "from=0")!.body!) as Array<{ mine: boolean; html: string }>;
  assert.deepEqual(fresh2.map(({ mine }) => mine), [true, false]);
  assert.ok(fresh2[1]!.html.includes(`/saltmarsh.goods/shop/speckled-moon-jar/"`));
  assert.equal(JSON.parse(route(state, "direct/t/saltmarsh.goods/messages", "from=2")!.body!).length, 0);
});

test("the catalog carries the three jobs, the upsell twin and the repair task, each pointing where the manifest says", () => {
  const tasks = LIVE_INSTRUCTION_TASKS.filter(({ scenarioId }) => scenarioId === "photo-social");
  assert.deepEqual(tasks.map(({ id, judgeBy, expectedDatasetId, variantId }) => ({ id, judgeBy, expectedDatasetId, variantId })), [
    { id: "photo-social-glaze-collection", judgeBy: "playback-goal", expectedDatasetId: undefined, variantId: undefined },
    { id: "photo-social-giveaway-entries", judgeBy: "expected-dataset", expectedDatasetId: "extract-giveaway-entries", variantId: undefined },
    { id: "photo-social-giveaway-entries-verified-upsell", judgeBy: "expected-dataset", expectedDatasetId: "extract-giveaway-entries", variantId: "verified-upsell" },
    { id: "photo-social-moon-jar-price", judgeBy: "expected-dataset", expectedDatasetId: "extract-moon-jar-price", variantId: undefined },
  ]);
  assert.ok(!/message|dm\b|send/iu.test(tasks[3]!.instruction), "the price task never asks for a message to be sent");
  assert.deepEqual(LIVE_REPAIR_TASKS.filter(({ scenarioId }) => scenarioId === "photo-social").map(({ id, variantId, expect }) => ({ id, variantId, expect })), [
    { id: "photo-social-repair-consent-redesign", variantId: "consent-redesign", expect: "repair" },
  ]);
  assert.equal(resolveScenarioWorkflow(manifest, { variantId: "consent-redesign" }).expected.finalState?.[0]?.value, "essential");
});
