import assert from "node:assert/strict";
import test from "node:test";
import { SIMPLE_PANEL_MESSAGES as M } from "../../../shared/protocol";
import type { PanelMessage, PanelResult, PanelStore } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { createAutomationsController } from "../controller";
const status = (gatewayUrl = "ws://synthetic-a.invalid/client") => statusWith({ connectionState: "connected", paired: true, gatewayUrl });
const ok = (payload: unknown): PanelResult<unknown> => ({ ok: true, value: { payload } });
const list = (name = "Synthetic A") => ok({ flows: [{ flowId: "f", name }], runs: [{ flowId: "f", runId: "r", status: "succeeded" }] });
const detail = () => ok({ runDetail: { datasets: [{ datasetId: "d", label: "Synthetic data" }] } });
function deferred() { let resolve!: (v: PanelResult<unknown>) => void, reject!: (reason: unknown) => void; const promise = new Promise<PanelResult<unknown>>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(answer: (message: PanelMessage) => PanelResult<unknown> | Promise<PanelResult<unknown>>) { const sent: PanelMessage[] = [], saved: unknown[][] = []; let changes = 0; const request = (async (message: PanelMessage) => { sent.push(message); return answer(message); }) as PanelStore["request"]; const controller = createAutomationsController(request, { onChange: () => changes++, download: (...args) => saved.push(args) }); return { controller, sent, saved, changes: () => changes }; }
test("connected address replacement immediately masks foreign rows and requests a new read", async () => { const { controller } = fixture(() => list()); controller.observe(status()); await controller.refresh(); assert.equal(controller.state().rows.length, 1); assert.equal(controller.observe(status("ws://synthetic-b.invalid/client")), true); assert.equal(controller.state().rows.length, 0); assert.equal(controller.state().mode, "loading"); });
test("old list completion cannot overwrite same-id new-owner rows", async () => { const old = deferred(); let reads = 0; const { controller } = fixture(() => ++reads === 1 ? old.promise : list("Synthetic B")); controller.observe(status()); const reading = controller.refresh(); controller.observe(status("ws://synthetic-b.invalid/client")); await controller.refresh(); old.resolve(list("Synthetic A")); await reading; assert.equal(controller.state().rows[0]?.name, "Synthetic B"); });
test("offline export sends nothing despite retained same-owner tuples", async () => { const { controller, sent } = fixture(message => message.type === M.listAutomations ? list() : detail()); controller.observe(status()); await controller.refresh(); await controller.focus("f"); controller.observe({ ...status(), connectionState: "disconnected" }); const before = sent.length; await controller.exportDataset("f", "r", "d", "csv"); assert.equal(sent.length, before); });

const exported = () => ok({ export: { tooLarge: false, fileName: "synthetic.csv", contentType: "text/csv", body: "synthetic" } });
const runReply = () => ok({ runSummary: { flowId: "f", runId: "r", status: "succeeded" } });

for (const summary of [
  { flowId: "f", runId: "other-run", status: "succeeded" },
  { flowId: "other-flow", runId: "r", status: "succeeded" }
]) test("explicit mismatching run detail summary is withheld and can be retried: " + summary.flowId + "/" + summary.runId, async () => {
  let malformed = true;
  const { controller, sent, saved } = fixture(message => message.type === M.listAutomations ? list()
    : message.type === M.runDetail ? (malformed ? ok({ runDetail: { summary, datasets: [{ datasetId: "d" }] } }) : detail()) : exported());
  controller.observe(status());
  await controller.refresh();
  await controller.focus("f");
  assert.deepEqual(controller.state().rows[0]?.datasets, []);
  const before = sent.length;
  await controller.exportDataset("f", "r", "d", "csv");
  assert.equal(sent.length, before);
  assert.equal(saved.length, 0);
  malformed = false;
  await controller.focus("f");
  assert.equal(controller.state().rows[0]?.datasets.length, 1, "omitted legacy summary is still accepted");
  await controller.exportDataset("f", "r", "d", "csv");
  assert.equal(saved.length, 1);
});
const replace = (controller: ReturnType<typeof createAutomationsController>, kind: "owner" | "reconnect") => {
 if (kind === "owner") controller.observe(status("ws://synthetic-b.invalid/client"));
 else { controller.observe({ ...status(), connectionState: "disconnected" }); controller.observe(status()); }
};
for (const kind of ["owner", "reconnect"] as const) {
 test(kind + " fences pending detail and lets same-id current detail retry", async () => {
  const old=deferred();let details=0;
  const {controller}=fixture(message=>message.type===M.listAutomations?list("Current"):++details===1?old.promise:ok({runDetail:{datasets:[{datasetId:"new"}]}}));
  controller.observe(status());await controller.refresh();const pending=controller.focus("f");replace(controller,kind);await controller.refresh();await controller.focus("f");old.resolve(detail());await pending;
  assert.deepEqual(controller.state().rows[0]?.datasets.map(data=>data.datasetId),["new"]);
 });
 test(kind + " old run finally cannot release new same-id run lock or follow up", async () => {
  const old=deferred(),next=deferred();let runs=0;
  const {controller,sent}=fixture(message=>message.type===M.listAutomations?list():message.type===M.runAutomation?(++runs===1?old.promise:next.promise):detail());
  controller.observe(status());await controller.refresh();const pending=controller.run("f");replace(controller,kind);await controller.refresh();const current=controller.run("f");const before=sent.length;
  old.resolve(runReply());await pending;assert.equal(controller.state().runInFlight,true);assert.equal(sent.length,before);await controller.run("f");assert.equal(runs,2);
  next.resolve(runReply());await current;assert.equal(controller.state().runInFlight,false);
 });
 test(kind + " old export cannot download or clear current same-id lock", async () => {
  const old=deferred(),next=deferred();let exports=0;
  const {controller,saved}=fixture(message=>message.type===M.listAutomations?list():message.type===M.runDetail?detail():(++exports===1?old.promise:next.promise));
  controller.observe(status());await controller.refresh();await controller.focus("f");const pending=controller.exportDataset("f","r","d","csv");replace(controller,kind);await controller.refresh();await controller.focus("f");const current=controller.exportDataset("f","r","d","json");old.resolve(exported());await pending;
  assert.equal(saved.length,0);assert.equal(controller.state().rows[0]?.exporting,true);await controller.exportDataset("f","r","d","csv");assert.equal(exports,2);next.resolve(exported());await current;assert.equal(saved.length,1);assert.equal(controller.state().rows[0]?.exporting,false);
 });
 test(kind + " old rejected export cannot add notice or release current lock", async () => {
  const old=deferred(),next=deferred();let exports=0;
  const {controller}=fixture(message=>message.type===M.listAutomations?list():message.type===M.runDetail?detail():(++exports===1?old.promise:next.promise));
  controller.observe(status());await controller.refresh();await controller.focus("f");const pending=controller.exportDataset("f","r","d","csv");replace(controller,kind);await controller.refresh();await controller.focus("f");const current=controller.exportDataset("f","r","d","csv");old.reject(new Error("synthetic-private-error"));await pending;assert.equal(controller.state().rows[0]?.notice,undefined);assert.equal(controller.state().rows[0]?.exporting,true);next.resolve(exported());await current;
 });
}
test("same owner partial settings and runtime/session churn retain metadata and held working",async()=>{
 const {controller,changes}=fixture(()=>list());const configured={...status(),settings:{coreApiUrl:"https://synthetic-a.invalid",gatewayUrl:"ws://synthetic-a.invalid/client",autoReconnect:true,captureMutations:true,captureInputValues:false,captureSnapshots:true}};
 controller.observe(configured);await controller.refresh();controller.setWorking(true);const before=changes(),owner=controller.state().ownerRevision;
 for(let i=0;i<5;i++)assert.equal(controller.observe({...status(),sessionId:"session"+i,eventCount:i,queueSize:i,runtime:{state:i%2?"running":"idle"}}),false);
 assert.equal(controller.state().ownerRevision,owner);assert.equal(controller.state().rows.length,1);assert.equal(controller.state().working,true);assert.equal(changes(),before);
 controller.observe({...configured,settings:{...configured.settings!,coreApiUrl:"https://synthetic-b.invalid"}});assert.equal(controller.state().rows.length,0);assert.equal(controller.state().working,true);
});
for(const field of ["clientId","projectId"] as const)test(field+" replacement masks confirmed metadata",async()=>{
 const {controller}=fixture(()=>list());controller.observe(status());await controller.refresh();controller.observe({...status(),[field]:"synthetic-next"});assert.equal(controller.state().rows.length,0);
});
test("pairing loss clears owner facts, rejects old lease and resets capabilities for replacement",async()=>{
 const {controller,sent}=fixture(()=>list());controller.observe(status());await controller.refresh();const owner=controller.state().ownerRevision;controller.observe({...status(),paired:false});assert.equal(controller.state().mode,"offline");assert.equal(controller.state().rows.length,0);await controller.run("f",owner);assert.equal(sent.length,1);controller.observe(status());await controller.refresh();await controller.run("f",owner);assert.equal(sent.length,2);
});
test("unsupported capabilities stay quiet for same owner and retry for new owner; offline wins",async()=>{
 let unsupported=true;const {controller,sent}=fixture(()=>unsupported?{ok:false,sentence:"Unsupported",unsupported:true}:list());controller.observe(status());await controller.refresh();controller.observe({...status(),connectionState:"disconnected"});assert.equal(controller.state().mode,"offline");controller.observe(status());await controller.refresh();assert.equal(sent.length,1);unsupported=false;controller.observe(status("ws://synthetic-b.invalid/client"));await controller.refresh();assert.equal(controller.state().mode,"list");assert.equal(sent.length,2);
});
test("unknown flow or stale run/dataset tuple cannot dispatch",async()=>{
 const {controller,sent}=fixture(message=>message.type===M.listAutomations?list():detail());controller.observe(status());await controller.refresh();await controller.focus("f");const before=sent.length;await controller.run("unknown");for(const [flow,run,data]of [["unknown","r","d"],["f","old","d"],["f","r","old"]])await controller.exportDataset(flow!,run!,data!,"csv");assert.equal(sent.length,before);
});
test("current list removal blocks stale tuple and pending export delivery",async()=>{
 const pending=deferred();let removed=false;const {controller,saved,sent}=fixture(message=>message.type===M.listAutomations?(removed?ok({flows:[],runs:[]}):list()):message.type===M.runDetail?detail():pending.promise);controller.observe(status());await controller.refresh();await controller.focus("f");const exporting=controller.exportDataset("f","r","d","csv");removed=true;await controller.refresh();const before=sent.length;await controller.run("f");await controller.exportDataset("f","r","d","csv");assert.equal(sent.length,before);pending.resolve(exported());await exporting;assert.equal(saved.length,0);
});
test("current rejected reads, detail, run and export recover with fixed local feedback",async()=>{
 let failing: string|undefined;const {controller,saved}=fixture(message=>{if(message.type===failing)return Promise.reject(new Error("synthetic-private-error"));return message.type===M.listAutomations?list():message.type===M.runDetail?detail():message.type===M.runAutomation?runReply():exported();});controller.observe(status());await controller.refresh();failing=M.listAutomations;await controller.refresh();assert.match(controller.state().readError?.sentence??"",/Try again/);assert.equal(controller.state().rows.length,1);failing=M.runDetail;await controller.focus("f");assert.match(controller.state().rows[0]?.notice?.sentence??"",/details/);failing=undefined;await controller.focus("f");failing=M.runAutomation;await controller.run("f");assert.match(controller.state().rows[0]?.notice?.sentence??"",/Couldn't run/);assert.equal(controller.state().runInFlight,false);failing=M.exportDataset;await controller.exportDataset("f","r","d","csv");assert.equal(controller.state().rows[0]?.exporting,false);assert.equal(JSON.stringify(controller.state()).includes("synthetic-private-error"),false);failing=undefined;await controller.exportDataset("f","r","d","csv");assert.equal(saved.length,1);
});
test("focus replacement rejects old detail publication and allows explicit return",async()=>{
 const pending=deferred();let asks=0;const {controller}=fixture(message=>message.type===M.listAutomations?list():++asks===1?pending.promise:detail());controller.observe(status());await controller.refresh();const old=controller.focus("f");await controller.focus(undefined);pending.resolve(detail());await old;assert.deepEqual(controller.state().rows[0]?.datasets,[]);await controller.focus("f");assert.equal(asks,2);assert.equal(controller.state().rows[0]?.datasets.length,1);
});
test("list channel releases before focused detail so a new list read is possible",async()=>{
 const pending=deferred();let asks=0;const {controller,sent}=fixture(message=>message.type===M.listAutomations?list():++asks===1?pending.promise:detail());controller.observe(status());await controller.focus("f");const initial=controller.refresh();await Promise.resolve();await controller.refresh();assert.equal(sent.filter(message=>message.type===M.listAutomations).length,2);pending.resolve(detail());await initial;
});

for(const answer of ["unsupported","reject"] as const)test("obsolete "+answer+" list cannot poison new owner or release pending read",async()=>{
 const old=deferred(),next=deferred();let reads=0;const {controller}=fixture(()=>++reads===1?old.promise:next.promise);controller.observe(status());const pending=controller.refresh();controller.observe(status("ws://synthetic-b.invalid/client"));const current=controller.refresh();if(answer==="unsupported")old.resolve({ok:false,sentence:"Unsupported",unsupported:true});else old.reject(new Error("synthetic-private-error"));await pending;await controller.refresh();assert.equal(reads,2);assert.equal(controller.state().mode,"loading");assert.equal(controller.state().readError,undefined);next.resolve(list("B"));await current;assert.equal(controller.state().mode,"list");
});
test("old unsupported detail cannot disable current owner detail capability",async()=>{
 const old=deferred();let asks=0;const {controller}=fixture(message=>message.type===M.listAutomations?list():++asks===1?old.promise:detail());controller.observe(status());await controller.refresh();const pending=controller.focus("f");controller.observe(status("ws://synthetic-b.invalid/client"));await controller.refresh();await controller.focus("f");old.resolve({ok:false,sentence:"Unsupported",unsupported:true});await pending;assert.equal(controller.state().rows[0]?.datasets.length,1);
});
test("run and detail unsupported flags reset only on owner replacement",async()=>{
 let unsupported=true;const {controller,sent}=fixture(message=>message.type===M.listAutomations?list():unsupported?{ok:false,sentence:"Unsupported",unsupported:true}:message.type===M.runAutomation?runReply():detail());controller.observe(status());await controller.refresh();await controller.focus("f");await controller.run("f");const before=sent.length;await controller.focus("f");await controller.run("f");assert.equal(sent.length,before);unsupported=false;controller.observe(status("ws://synthetic-b.invalid/client"));await controller.refresh();await controller.focus("f");await controller.run("f");assert.equal(controller.state().rows[0]?.notice,undefined);assert.equal(controller.state().rows[0]?.datasets.length,1);
});
test("stale owner lease rejects focus, run and export before lock mutation",async()=>{
 const {controller,sent}=fixture(message=>message.type===M.listAutomations?list():detail());controller.observe(status());await controller.refresh();const owner=controller.state().ownerRevision;controller.observe(status("ws://synthetic-b.invalid/client"));await controller.refresh();await controller.focus("f");const before=sent.length;await controller.focus("f",owner);await controller.run("f",owner);await controller.exportDataset("f","r","d","csv",owner);assert.equal(sent.length,before);assert.equal(controller.state().runInFlight,false);assert.equal(controller.state().rows[0]?.exporting,false);
});
test("reentrant owner change in run/export start notification prevents unissued mutation",async()=>{
 for(const channel of ["run","export"] as const){const sent:PanelMessage[]=[];let replaceOnChange=false;const request=(async(message:PanelMessage)=>{sent.push(message);return message.type===M.listAutomations?list():detail();}) as PanelStore["request"];const controller=createAutomationsController(request,{onChange(){if(replaceOnChange){replaceOnChange=false;controller.observe(status("ws://synthetic-b.invalid/client"));}},download(){assert.fail("No stale delivery");}});controller.observe(status());await controller.refresh();await controller.focus("f");const before=sent.length;replaceOnChange=true;if(channel==="run")await controller.run("f");else await controller.exportDataset("f","r","d","csv");assert.equal(sent.length,before);assert.equal(controller.state().rows.length,0);}
});
