// `web.dom.extract_list` against the sensitive-input fixture: what a read may
// never carry off the page, and what it may.
//
// What these rows are really proving:
// - a field that resolves to a sensitive control, or to an element inside one
//   such as its option, refuses the whole read;
// - a text field skips the contents of sensitive controls inside it, keeping
//   the words around them;
// - an excluded field is never read, so excluding a sensitive control's value
//   leaves the read to succeed while reading it refuses the whole read (D12);
// - an ordinary control beside a sensitive one is still read in full, so a
//   blanket drop fails these rows as surely as a leak does.
//
// Every row searches the whole reply, its page snapshot included, for the
// fixture's own secrets and for any it injected.

import { expect, test } from "../../../index.js";

/** The sensitive-input fixture's own pre-filled secrets: the password, the card, and the multi-token billing card. */
const FIXTURE_SECRETS = ["SYNTHETIC_PASSWORD_DO_NOT_USE", "4111111111111111", "4222222222222220"];
const SENSITIVE_FORM = '[data-testid="sensitive-form"]';
const SENSITIVE_LABELS = `${SENSITIVE_FORM} label`;
/** The email the sensitive-input fixture pre-fills, which is ordinary page content, not a secret. */
const FIXTURE_EMAIL = "synthetic-user@example.test";

test.describe("on sensitive-input", () => {
  test("a field that resolves to a sensitive control refuses the whole read", async ({ openHarness }) => {
    const harness = await openHarness("sensitive-input");
    const reply = await harness.runAction({
      commandId: "extract-sensitive-fields",
      actionType: "web.dom.extract_list",
      extractList: { item: SENSITIVE_LABELS, fields: { value: "input@value" } }
    });
    expect(reply).toMatchObject({
      status: "failed",
      failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }
    });
    expect(reply).not.toHaveProperty("extracted");
    const wire = JSON.stringify(reply);
    for (const secret of FIXTURE_SECRETS) expect(wire).not.toContain(secret);
  });

  test("a field that resolves inside a sensitive control, such as one of its options, refuses the whole read", async ({ openHarness, page }) => {
    const harness = await openHarness("sensitive-input");
    // An option carries its sensitive select's value and label, so reading the
    // option is reading the control (decision D2).
    await page.evaluate(() => {
      const list = document.createElement("ul");
      list.dataset.testid = "security-answers";
      list.insertAdjacentHTML(
        "beforeend",
        '<li>Security answer <select data-sensitive="true"><option value="SYNTHETIC_OPTION_VALUE">SYNTHETIC_OPTION_LABEL</option></select></li>'
      );
      document.body.append(list);
    });
    const reads = [
      { why: "an option's text", item: '[data-testid="security-answers"] li', fields: { answer: "option" } },
      { why: "an option's value attribute", item: '[data-testid="security-answers"] li', fields: { answer: "option@value" } },
      { why: "an item that is itself an option", item: '[data-testid="security-answers"] option', fields: { answer: "" } }
    ];
    for (const [index, { why, item, fields }] of reads.entries()) {
      const reply = await harness.runAction({
        commandId: `extract-inside-sensitive-${index}`,
        actionType: "web.dom.extract_list",
        extractList: { item, fields }
      });
      expect(reply, why).toMatchObject({
        status: "failed",
        failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }
      });
      expect(reply, why).not.toHaveProperty("extracted");
      const wire = JSON.stringify(reply);
      for (const secret of [...FIXTURE_SECRETS, "SYNTHETIC_OPTION_VALUE", "SYNTHETIC_OPTION_LABEL"]) expect(wire, why).not.toContain(secret);
    }
  });

  test("a text field skips the contents of sensitive controls inside it", async ({ openHarness, page }) => {
    const harness = await openHarness("sensitive-input");
    await page.evaluate((labels) => {
      const form = document.querySelector(labels.replace(/ label$/u, ""));
      if (!form) throw new Error("the sensitive form is missing");
      form.insertAdjacentHTML(
        "beforeend",
        '<label>Recovery note <textarea data-sensitive="true">SYNTHETIC_RECOVERY_NOTE</textarea></label>' +
          '<label>Security answer <select data-sensitive="true"><option>SYNTHETIC_ANSWER_LABEL</option></select></label>'
      );
    }, SENSITIVE_LABELS);
    const reply = await harness.runAction({
      commandId: "extract-label-text",
      actionType: "web.dom.extract_list",
      extractList: { item: SENSITIVE_LABELS, fields: { label: "" } }
    });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.extracted).toEqual(
      ["Email", "Password", "Test card", "Billing card", "Recovery note", "Security answer"].map((label) => ({ label }))
    );
    // The whole reply, its page snapshot included: no element descriptor quotes
    // a sensitive control's contents either.
    const wire = JSON.stringify(reply);
    for (const secret of [...FIXTURE_SECRETS, "SYNTHETIC_RECOVERY_NOTE", "SYNTHETIC_ANSWER_LABEL"]) expect(wire).not.toContain(secret);
  });

  test("a value field refuses a sensitive control and reads an ordinary one", async ({ openHarness }) => {
    const harness = await openHarness("sensitive-input");
    const refused = await harness.runAction({
      commandId: "extract-sensitive-value",
      actionType: "web.dom.extract_list",
      extractList: { item: SENSITIVE_FORM, fields: { password: { kind: "value", selector: '[data-testid="password"]' } } }
    });
    expect(refused).toMatchObject({ status: "failed", failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" } });
    expect(refused).not.toHaveProperty("extracted");
    for (const secret of FIXTURE_SECRETS) expect(JSON.stringify(refused)).not.toContain(secret);

    const read = await harness.runAction({
      commandId: "extract-ordinary-value",
      actionType: "web.dom.extract_list",
      extractList: { item: SENSITIVE_FORM, fields: { username: { kind: "value", selector: 'input[name="username"]' } } }
    });
    expect(read).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(read.extracted).toEqual([{ username: FIXTURE_EMAIL }]);
  });

  test("an excluded field is never read, so excluding a sensitive control leaves the read to succeed", async ({ openHarness }) => {
    const harness = await openHarness("sensitive-input");
    const reply = await harness.runAction({
      commandId: "extract-excluded-sensitive",
      actionType: "web.dom.extract_list",
      extractList: {
        item: SENSITIVE_FORM,
        fields: {
          username: { kind: "value", selector: 'input[name="username"]' },
          password: { kind: "value", selector: '[data-testid="password"]', handling: "exclude" },
          card: { kind: "value", selector: '[data-testid="payment"]', handling: "exclude" }
        }
      }
    });
    // Reading either excluded field would refuse the whole read, as the row
    // above shows. The read succeeding is what proves they were never read.
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: "at least 1 record, each carrying username" },
      extraction: { recordCount: 1, fieldNames: ["username"] }
    });
    expect(reply.extracted).toEqual([{ username: FIXTURE_EMAIL }]);
    const wire = JSON.stringify(reply);
    for (const secret of FIXTURE_SECRETS) expect(wire).not.toContain(secret);
  });
});
