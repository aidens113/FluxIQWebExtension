import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { MEMBERS, RECEIVED_INVITATIONS, SENT_INVITATIONS } from "../../data/index.js";
import { PROFESSIONAL_NETWORK_LIVE_TASKS } from "../../live-tasks.js";
import { professionalNetworkManifest } from "../../manifest.js";
import { STORE_AT_START } from "../../records.js";

type Store = { received: string[]; sent: string[] };
const taskNamed = (id: string) => PROFESSIONAL_NETWORK_LIVE_TASKS.find((task) => task.id === id)!;
const workflow = (workflowId: string) => resolveScenarioWorkflow(professionalNetworkManifest, { workflowId });
const datasetOf = (workflowId: string) => workflow(workflowId).expected.extracted![0]!;
const finalStoreOf = (workflowId: string) => JSON.parse(String(workflow(workflowId).expected.finalState![0]!.value)) as Store;
const START = JSON.parse(STORE_AT_START) as Store;

test("each new task resolves to its own workflow's dataset, names every column, and starts on the untouched store", () => {
  const owners: Record<string, string> = {
    "professional-network-netherlands-data-engineers": "netherlands-engineers",
    "professional-network-connect-kade-senior-engineer": "connect-kade-senior",
    "professional-network-accept-messaged-invitations": "accept-messaged-invitations",
    "professional-network-kade-lead-contact": "kade-lead-contact",
  };
  for (const [taskId, workflowId] of Object.entries(owners)) {
    const task = taskNamed(taskId);
    assert.equal(task.judgeBy, "expected-dataset", taskId);
    assert.equal(task.variantId, undefined, `${taskId} is no drift variant`);
    const dataset = datasetOf(workflowId);
    assert.equal(task.expectedDatasetId, dataset.step, taskId);
    assert.ok(workflow(workflowId).recordingScript.some(({ id, operation }) => id === dataset.step && operation === "extract"), taskId);
    assert.equal(dataset.count, dataset.records!.length, taskId);
    for (const key of new Set(dataset.records!.flatMap((record) => Object.keys(record)))) assert.match(task.instruction, new RegExp(`\\b${key}\\b`, "u"), `${taskId} names ${key}`);
    assert.equal(workflow(workflowId).expected.pageFacts![0]!.value, STORE_AT_START, taskId);
  }
});

test("the Netherlands read is the 32 second-degree data engineers in Dutch cities, enumerated, with no first connection and neither American Rotterdam", () => {
  const dataset = datasetOf("netherlands-engineers");
  assert.equal(dataset.pages, 4);
  assert.deepEqual(dataset.records!.map(({ name }) => name), [
    "Mara Okafor", "Joost van Dijk 🚀", "Aylin Demir", "Sanne de Wit", "Ruben Klaassen", "Priyanka Raman", "Emre Yilmaz", "Tomasz Wiśniewski",
    "Femke de Graaf", "Chidi Nwosu", "Daniela Costa", "Lotte Jansen", "Sébastien Moreau", "Hana Sato, PhD", "Freya Lindqvist", "Daan Visser",
    "Olumide Adeyemi", "Isabel Fonseca", "Kees Bakker", "Julia Nowak", "Zoë Hendriks", "Sven Aalders", "Arjun Mehta", "Noor El Amrani",
    "Bram Mulder", "Lars Hoekstra", "Nadia Benali", "Ewa Kowalczyk", "Koen Verbeek", "Matteo Ricci", "Elif Kaya", "Yara Haddad",
  ]);
  for (const absent of ["Kayla Brooks", "Derek Olsen", "Priya Shah", "Marcus Webb", "Wouter de Boer", "Anouk Smit", "Guildline Member", "Thijs van Leeuwen", "Ingrid Solberg", "Fleur Brouwer"]) {
    assert.ok(!dataset.records!.some(({ name }) => name === absent), absent);
  }
  for (const record of dataset.records!) {
    const member = MEMBERS.find(({ name }) => name === record.name)!;
    assert.deepEqual(record, { name: member.name, headline: member.headline, location: member.location });
    assert.equal(member.degree, "S");
    assert.notEqual(member.city, "rotterdam-ny");
  }
  assert.deepEqual(finalStoreOf("netherlands-engineers"), START);
});

test("the connection request adds exactly one pending request, to Matteo Ricci, and touches nothing else", () => {
  const matteo = MEMBERS.find(({ name }) => name === "Matteo Ricci")!;
  assert.equal(matteo.degree, "S");
  assert.ok(!SENT_INVITATIONS.some(({ memberUrn }) => memberUrn === matteo.urn), "no request to him was pending");
  const kadeSeniors = MEMBERS.filter(({ headline, company }) => company === "Kade Energy" && /^Senior Data Engineer/u.test(headline));
  assert.deepEqual(kadeSeniors.map(({ name }) => name), ["Matteo Ricci"], "the instruction names one person");
  assert.deepEqual(datasetOf("connect-kade-senior").records, [{ name: "Matteo Ricci", headline: "Senior Data Engineer at Kade Energy" }]);
  const after = finalStoreOf("connect-kade-senior");
  assert.deepEqual(after.received, START.received);
  assert.deepEqual(after.sent.filter((urn) => !START.sent.includes(urn)), [`urn:gl:invitation:new-${matteo.urn.split(":").at(-1)}`]);
  assert.equal(after.sent.length, START.sent.length + 1);
  assert.deepEqual(taskNamed("professional-network-connect-kade-senior-engineer").permissionPoint, { consequence: "send_or_publish", control: "Send without a note" });
});

test("accepting answers exactly the three messaged connection invitations; pages, newsletters and bare invitations stay pending", () => {
  const messaged = RECEIVED_INVITATIONS.filter(({ kind, message }) => kind === "person" && message !== "");
  assert.deepEqual(datasetOf("accept-messaged-invitations").records, messaged.map(({ memberUrn, message }) => ({ name: MEMBERS.find(({ urn }) => urn === memberUrn)!.name, message })));
  assert.deepEqual(datasetOf("accept-messaged-invitations").records!.map(({ name }) => name), ["Ximena Ruiz", "Lucia Romano", "Chidi Nwosu"]);
  const after = finalStoreOf("accept-messaged-invitations");
  assert.deepEqual(after.sent, START.sent);
  assert.deepEqual(START.received.filter((urn) => !after.received.includes(urn)).sort(), messaged.map(({ urn }) => urn).sort());
  assert.equal(after.received.length, 5);
  assert.equal(taskNamed("professional-network-accept-messaged-invitations").permissionPoint, undefined, "accepting is not asked about");
});

test("the contact read is the one first-degree Lead Data Engineer at Kade Energy, and changes nothing", () => {
  const leads = MEMBERS.filter(({ company, degree, headline }) => company === "Kade Energy" && degree === "F" && /^Lead Data Engineer/u.test(headline));
  assert.deepEqual(leads.map(({ name }) => name), ["Pieter Groen"]);
  assert.deepEqual(datasetOf("kade-lead-contact").records, [{ name: "Pieter Groen", email: "pieter@example.com" }]);
  assert.deepEqual(finalStoreOf("kade-lead-contact"), START);
});
