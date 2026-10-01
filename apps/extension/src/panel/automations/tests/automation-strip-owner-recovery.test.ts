import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { SIMPLE_PANEL_MESSAGES as M } from "../../../shared/protocol";
import { statusWith } from "../../tests/status-fixture";
import { createAutomationsController } from "../controller";
import type { PanelMessage, PanelStore } from "../../state";
import type { AutomationsController, AutomationsState } from "../controller";
import { createAutomationStrip } from "../automation-strip";
async function focused(body: (doc: { activeElement: FakeElement; focusCalls: number }) => void | Promise<void>) {
  await withFakeDocument(async () => {
    const doc = document as unknown as { createElement(tag: string): FakeElement; activeElement: FakeElement; focusCalls: number };
    const make = doc.createElement;
    const idle = new FakeElement("body");
    doc.activeElement = idle;
    doc.focusCalls = 0;
    Object.assign(doc, { hasFocus: () => true });
    doc.createElement = (tag) => {
      const el = make(tag);
      Object.defineProperty(el, "ownerDocument", { value: doc });
      Object.defineProperty(el, "parentElement", { get: () => el.parentNode });
      Object.assign(el, {
        querySelectorAll: (selector: string) => el.descendants().filter((node) => node.tagName.toLowerCase() === selector),
        querySelector: (selector: string) => el.descendants().find((node) => node.tagName.toLowerCase() === selector) ?? null
      });
      el.focus = () => { if (!el.disabled) { doc.activeElement = el; doc.focusCalls++; } };
      const remove = el.removeChild.bind(el);
      el.removeChild = (node) => {
        if (node === doc.activeElement || (node instanceof FakeElement && node.descendants().includes(doc.activeElement))) doc.activeElement = idle;
        remove(node);
      };
      return el;
    };
    await body(doc);
  });
}

test("owner replacement retires strip handlers even for identical tuples", async () => focused(() => {
 let state:AutomationsState={ownerRevision:1,mode:"list",working:false,runInFlight:false,rows:[{flowId:"f",name:"A",runId:"r",lines:["Done"],datasets:[{datasetId:"d"}],running:false,exporting:false}]};const calls:unknown[][]=[];
 const controller:AutomationsController={state:()=>state,observe:()=>false,setWorking:()=>{},refresh:async()=>{},focus:async()=>{},run:async(...args)=>{calls.push(args);},exportDataset:async(...args)=>{calls.push(args);}};
 const request:PanelStore["request"]=async()=>({ok:false,sentence:"Synthetic"});const strip=createAutomationStrip(request,controller);strip.show({flowId:"f",name:"A"});const root=fake(strip.element);const oldRun=root.byClass("strip-run")[0]!;const oldExport=root.byClass("strip-exports")[0]!.descendants().find(node=>node.tagName==="BUTTON")!;
 state={...state,ownerRevision:2,rows:state.rows.map(row=>({...row,name:"B"}))};strip.draw();assert.equal(strip.element.hidden,true);strip.show({flowId:"f",name:"B"});const nextRun=root.byClass("strip-run")[0]!;assert.notEqual(oldRun,nextRun);oldRun.dispatch("click");oldExport.dispatch("click");assert.deepEqual(calls,[]);nextRun.dispatch("click");assert.deepEqual(calls,[["f",2]]);
}));

test("offline and removed tuple controls refuse retained programmatic activation",async()=>focused(()=>{
 let state:AutomationsState={ownerRevision:1,mode:"list",working:false,runInFlight:false,rows:[{flowId:"f",name:"A",runId:"r",lines:["Done"],datasets:[{datasetId:"d"}],running:false,exporting:false}]};const calls:unknown[][]=[];
 const controller:AutomationsController={state:()=>state,observe:()=>false,setWorking:()=>{},refresh:async()=>{},focus:async()=>{},run:async(...args)=>{calls.push(args);},exportDataset:async(...args)=>{calls.push(args);}};const request:PanelStore["request"]=async()=>({ok:false,sentence:"Synthetic"});const strip=createAutomationStrip(request,controller);strip.show({flowId:"f",name:"A"});const root=fake(strip.element);const old=root.byClass("strip-exports")[0]!.descendants().find(node=>node.tagName==="BUTTON")!;const run=root.byClass("strip-run")[0]!;
 state={...state,mode:"offline"};strip.draw();assert.equal(old.disabled,true);old.dispatch("click");run.dispatch("click");assert.deepEqual(calls,[]);state={...state,mode:"list",rows:state.rows.map(row=>({...row,runId:"new",datasets:[{datasetId:"d"}]}))};strip.draw();old.dispatch("click");assert.deepEqual(calls,[]);const next=root.byClass("strip-exports")[0]!.descendants().find(node=>node.tagName==="BUTTON")!;next.dispatch("click");assert.deepEqual(calls,[["f","new","d","csv",1]]);
}));

test("actual controller and strip require freshly shown owner controls before dispatch",async()=>focused(async()=>{
 const sent:string[]=[];const request:PanelStore["request"]=async<T>(message: PanelMessage)=>{sent.push(message.type);return{ok:true,value:{payload:message.type===M.listAutomations?{flows:[{flowId:"f",name:"Synthetic"}],runs:[{flowId:"f",runId:"r",status:"succeeded"}]}:message.type===M.runDetail?{runDetail:{datasets:[{datasetId:"d"}]}}:{export:{tooLarge:false,fileName:"synthetic.csv",contentType:"text/csv",body:"synthetic"}}} as T};};
 const controller=createAutomationsController(request,{onChange:()=>strip?.draw(),download:()=>{}});let strip:ReturnType<typeof createAutomationStrip>|undefined;strip=createAutomationStrip(request,controller);const status=statusWith({connectionState:"connected",paired:true,gatewayUrl:"ws://synthetic-a.invalid/client"});controller.observe(status);await controller.refresh();strip.show({flowId:"f",name:"Synthetic"});for(let i=0;i<5;i++)await Promise.resolve();const root=fake(strip.element),oldRun=root.byClass("strip-run")[0]!,oldExport=root.byClass("strip-exports")[0]!.descendants().find(node=>node.tagName==="BUTTON")!;
 controller.observe({...status,gatewayUrl:"ws://synthetic-b.invalid/client"});await controller.refresh();assert.equal(strip.element.hidden,true);strip.show({flowId:"f",name:"Synthetic"});for(let i=0;i<5;i++)await Promise.resolve();const before=sent.length;oldRun.dispatch("click");oldExport.dispatch("click");assert.equal(sent.length,before);const current=root.byClass("strip-exports")[0]!.descendants().find(node=>node.tagName==="BUTTON")!;current.dispatch("click");await Promise.resolve();assert.equal(sent.at(-1),M.exportDataset);
}));
