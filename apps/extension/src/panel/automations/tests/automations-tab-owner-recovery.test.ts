import assert from "node:assert/strict";
import test from "node:test";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { statusWith } from "../../tests/status-fixture";
import type { PanelStore } from "../../state";
import { createAutomationsTab } from "../automations-tab";
const status = (gatewayUrl = "ws://synthetic-a.invalid/client") => statusWith({ connectionState: "connected", paired: true, gatewayUrl });
const settle = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
test("retained owner-A row cannot navigate same-id owner-B while new row can", async () => withFakeDocument(async () => {
 let name="A"; const chosen: string[]=[];
 const request: PanelStore["request"] = async <T>() => ({ok:true,value:{payload:{flows:[{flowId:"f",name}],runs:[]}} as T});
 const tab=createAutomationsTab({surface:"sidepanel",store:{request,current:()=>status(),subscribe:()=>()=>{}}},{choose:row=>chosen.push(row.name),review:document.createElement("div"),newAutomation:document.createElement("div")});
 try { tab.render(status());tab.setActive(true);await settle();const old=fake(tab.element).byClass("automation-row")[0]!;name="B";tab.render(status("ws://synthetic-b.invalid/client"));await settle();const next=fake(tab.element).byClass("automation-row")[0]!;old.dispatch("click");assert.deepEqual(chosen,[]);assert.notEqual(old,next);next.dispatch("click");assert.deepEqual(chosen,["B"]); } finally {tab.setActive(false);}
}));
test("new owner recovers fallback and owns one unchanged 30s timer", async () => withFakeDocument(async () => {
 const originalSet=globalThis.setInterval,originalClear=globalThis.clearInterval;
 const timers=new Map<number,()=>void>();let id=0,unsupported=true,reads=0;
 globalThis.setInterval=((fn:()=>void,delay:number)=>{assert.equal(delay,30000);timers.set(++id,fn);return id;}) as unknown as typeof setInterval;
 globalThis.clearInterval=((key:number)=>{timers.delete(key);}) as unknown as typeof clearInterval;
 const request:PanelStore["request"]=async<T>()=>{reads++;return unsupported?{ok:false,sentence:"Unsupported",unsupported:true}:{ok:true,value:{payload:{flows:[],runs:[]}} as T};};
 const tab=createAutomationsTab({surface:"sidepanel",store:{request,current:()=>status(),subscribe:()=>()=>{}}},{choose:()=>{},review:document.createElement("div"),newAutomation:document.createElement("div")});
 try {tab.render(status());tab.setActive(true);await settle();assert.equal(timers.size,0);unsupported=false;tab.render(status("ws://synthetic-b.invalid/client"));await settle();assert.equal(reads,2);assert.equal(timers.size,1);tab.render(status("ws://synthetic-b.invalid/client"));assert.equal(timers.size,1);for(const fn of timers.values())fn();await settle();assert.equal(reads,3);Object.assign(document,{visibilityState:"hidden"});for(const fn of timers.values())fn();await settle();assert.equal(reads,3);tab.setActive(false);assert.equal(timers.size,0);} finally {tab.setActive(false);globalThis.setInterval=originalSet;globalThis.clearInterval=originalClear;}
}));

test("inactive and hidden owner changes issue no reads or timers", async () => withFakeDocument(async()=>{
 let reads=0;const request:PanelStore["request"]=async<T>()=>{reads++;return{ok:true,value:{payload:{flows:[],runs:[]}} as T};};
 const tab=createAutomationsTab({surface:"sidepanel",store:{request,current:()=>status(),subscribe:()=>()=>{}}},{choose:()=>{},review:document.createElement("div"),newAutomation:document.createElement("div")});
 try{tab.render(status());await settle();assert.equal(reads,0);Object.assign(document,{visibilityState:"hidden"});tab.setActive(true);tab.render(status("ws://synthetic-b.invalid/client"));await settle();assert.equal(reads,0);tab.setActive(false);Object.assign(document,{visibilityState:"visible"});tab.setActive(true);await settle();assert.equal(reads,1);}finally{tab.setActive(false);}
}));
test("removed current-owner row handler cannot navigate after authoritative removal",async()=>withFakeDocument(async()=>{
 let removed=false;const chosen:string[]=[];const request:PanelStore["request"]=async<T>()=>({ok:true,value:{payload:{flows:removed?[]:[{flowId:"f",name:"A"}],runs:[]}} as T});const tab=createAutomationsTab({surface:"sidepanel",store:{request,current:()=>status(),subscribe:()=>()=>{}}},{choose:row=>chosen.push(row.flowId),review:document.createElement("div"),newAutomation:document.createElement("div")});
 try{tab.render(status());tab.setActive(true);await settle();const old=fake(tab.element).byClass("automation-row")[0]!;removed=true;tab.setActive(false);tab.setActive(true);await settle();old.dispatch("click");assert.deepEqual(chosen,[]);}finally{tab.setActive(false);}
}));
