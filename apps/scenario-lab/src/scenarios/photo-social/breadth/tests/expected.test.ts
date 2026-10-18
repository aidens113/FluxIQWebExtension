import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { ALL_POSTS, GIVEAWAY_COMMENTS, STUDIO, gridFor, initialSaved, postByCode } from "../../data/index.js";
import { mostLiked } from "../../answers/index.js";
import { PHOTO_SOCIAL_LIVE_TASKS } from "../../live-tasks.js";
import { studioUnionAccountFacts } from "../../qualification/index.js";
import { photoSocialScenario as scenario } from "../../scenario.js";
import { createPhotoState, mutatePhotoState } from "../../state.js";
import type { PhotoState } from "../../types.js";
import { UNTOUCHED_ACCOUNT, augustOver1300Expected, kilnNotesExpected, newestLikesExpected, priyaTagsExpected } from "../index.js";

/**
 * Each breadth oracle is written out by hand; these derive the same answer
 * from the fixture's data and state, so a literal that drifted from the data
 * fails here rather than in a paid live run.
 */
const account = (state: PhotoState) => studioUnionAccountFacts(state);
const finalAccount = (facts: typeof priyaTagsExpected.finalState) => facts!.find(({ subject }) => subject === "photo-studio-account")!.value;
const records = (expected: typeof priyaTagsExpected) => expected.extracted![0]!.records;
const MENTION = /@([a-z0-9._]+[a-z0-9_])/gu;

test("the untouched account is the fixture's starting account, and every breadth oracle starts there", () => {
  assert.equal(JSON.stringify(UNTOUCHED_ACCOUNT), account(createPhotoState()));
  for (const expected of [priyaTagsExpected, newestLikesExpected, augustOver1300Expected, kilnNotesExpected]) {
    assert.equal(expected.pageFacts!.find(({ subject }) => subject === "photo-studio-account")!.value, account(createPhotoState()));
  }
});

test("priya-tags: every comment and reply that tags @priya.nair, in thread order, and none that only bears her name as author", () => {
  const thread = GIVEAWAY_COMMENTS.flatMap((comment) => [comment, ...comment.replies]);
  const tagging = thread.filter((comment) => [...comment.text.matchAll(MENTION)].some((match) => match[1] === "priya.nair"));
  assert.deepEqual(records(priyaTagsExpected), tagging.map(({ author, text, date }) => ({ author, comment: text, date })));
  const priyaOwn = thread.filter((comment) => comment.author === "priya.nair");
  assert.ok(priyaOwn.length > 0 && priyaOwn.every((comment) => !tagging.includes(comment)), "her own comment does not tag her");
  const firstScreen = GIVEAWAY_COMMENTS.slice(0, 12);
  assert.ok(firstScreen.every((comment) => !tagging.includes(comment)), "nothing on the first screen tags her: the read has to load more");
  assert.equal(tagging.filter((comment) => GIVEAWAY_COMMENTS.includes(comment)).length, 3, "two of the five are replies");
  assert.equal(finalAccount(priyaTagsExpected.finalState), account(createPhotoState()), "a read changes nothing");
});

test("newest-likes: the three most recent studio posts sit after the pinned ones, and only liking exactly them holds the oracle", () => {
  const grid = gridFor(STUDIO);
  const newest = grid.filter((post) => !post.pinned).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  assert.deepEqual(records(newestLikesExpected), newest.map(({ code }) => ({ link: `/scenarios/photo-social/p/${code}/` })));
  assert.deepEqual(grid.slice(3, 6), newest, "the fourth to sixth cells are the newest");
  assert.ok(newest.some((post) => post.kind === "reel"), "a reel is among the three newest");
  assert.match(PHOTO_SOCIAL_LIVE_TASKS.find(({ id }) => id === "photo-social-newest-likes")!.instruction, /reels included/u, "so the instruction says reels count as posts");
  assert.ok(grid.slice(0, 3).every((post) => post.pinned), "the first three cells are pinned");
  assert.ok(grid.slice(0, 3).every((post) => post.date < newest[2]!.date), "every pinned post is older than the third newest");
  const like = (codes: readonly string[]) => codes.reduce((state, code) => mutatePhotoState(state, "like", { code, liked: true }), createPhotoState());
  assert.equal(account(like(newest.map(({ code }) => code))), finalAccount(newestLikesExpected.finalState));
  assert.notEqual(account(like(grid.slice(0, 3).map(({ code }) => code))), finalAccount(newestLikesExpected.finalState), "liking the first three cells fails");
  const extra = mutatePhotoState(like(newest.map(({ code }) => code)), "follow", { handle: "kilnworks.shop", following: true });
  assert.notEqual(account(extra), finalAccount(newestLikesExpected.finalState), "an act nobody asked for fails");
});

test("august-over-1300: one studio post of August 2026 passed1,300 likes; wrong years, accounts and plays are excluded", () => {
  assert.deepEqual(records(augustOver1300Expected), [{ date: "August 21", likes: "1,349" }]);
  assert.equal(augustOver1300Expected.extracted![0]!.count, 1);
  assert.equal(mostLiked("2026-08", 1)[0]!.likes, 1349);
  const august2026 = gridFor(STUDIO).filter((post) => post.date.startsWith("2026-08-"));
  assert.deepEqual(august2026.filter((post) => (post.likes ?? 0) > 1300).map(({ date, likes }) => ({ date, likes })), [{ date: "2026-08-21", likes: 1349 }]);
  assert.ok(august2026.some((post) => post.kind === "reel" && post.plays > 1300), "the reel's grid count is plays, above the line");
  assert.ok(gridFor(STUDIO).some((post) => post.date.startsWith("2025-08-") && (post.likes ?? 0) > 1300), "the pinned post of August 2025 is above it");
  const otherAccounts = ALL_POSTS.filter((post) => post.author !== STUDIO && !post.sponsored && post.date.startsWith("2026-08-") && (post.likes ?? 0) > 1300).map(({ author }) => author).sort();
  assert.deepEqual(otherAccounts, ["harbourlight.studios", "kiln.theory"], "the impersonator and Kiln Theory are above it");
  assert.equal(finalAccount(augustOver1300Expected.finalState), account(createPhotoState()), "a read changes nothing");
});

test("kiln-notes: the new collection holds exactly the saved Kiln Theory posts, and the table is every collection in the Saved page's order", () => {
  const kiln = initialSaved().filter((code) => postByCode(code)!.author === "kiln.theory");
  assert.equal(kiln.length, 2);
  const made = mutatePhotoState(createPhotoState(), "collection-create", { name: "Kiln Theory notes", codes: kiln });
  assert.equal(account(made), finalAccount(kilnNotesExpected.finalState));
  assert.deepEqual(records(kilnNotesExpected), made.collections.map(({ name, codes }) => ({ collection: name, posts: String(codes.length) })));
  const kilnPhoto = initialSaved().find((code) => postByCode(code)!.author === STUDIO && postByCode(code)!.subject === "kiln")!;
  assert.ok(kilnPhoto, "a saved studio photo of a kiln is there to be picked by mistake");
  assert.notEqual(account(mutatePhotoState(createPhotoState(), "collection-create", { name: "Kiln Theory notes", codes: [...kiln, kilnPhoto] })), finalAccount(kilnNotesExpected.finalState));
  const unsavedFirst = mutatePhotoState(mutatePhotoState(createPhotoState(), "save", { code: kiln[0], saved: false }), "save", { code: kiln[0], saved: true });
  const viaBookmark = mutatePhotoState(unsavedFirst, "collection-create", { name: "Kiln Theory notes", codes: kiln });
  assert.notEqual(account(viaBookmark), finalAccount(kilnNotesExpected.finalState), "pressing the filled bookmark takes the post out of Studio inspo");
});

test("each breadth task names its dataset's columns, owns its workflow's extract step, and declares no permission point", () => {
  const manifest = scenario.manifest;
  const ids = ["photo-social-priya-tags", "photo-social-newest-likes", "photo-social-august-over-1300", "photo-social-kiln-notes"];
  const workflows = ["priya-tags", "newest-likes", "august-over-1300", "kiln-notes"];
  ids.forEach((id, index) => {
    const task = PHOTO_SOCIAL_LIVE_TASKS.find((entry) => entry.id === id)!;
    assert.ok(task, id);
    assert.equal(task.permissionPoint, undefined);
    assert.equal(task.variantId, undefined);
    const { expected, recordingScript } = resolveScenarioWorkflow(manifest, { workflowId: workflows[index]! });
    const entry = expected.extracted!.find(({ step }) => step === task.expectedDatasetId)!;
    assert.ok(entry && recordingScript.some((step) => step.operation === "extract" && step.id === entry.step), id);
    assert.equal(entry.count, entry.records!.length);
    const extract = recordingScript.find((step) => step.id === entry.step)!;
    for (const column of Object.keys(extract.fields!)) assert.match(task.instruction, new RegExp(`\\b${column}\\b`, "u"), `${id} names ${column}`);
  });
});
