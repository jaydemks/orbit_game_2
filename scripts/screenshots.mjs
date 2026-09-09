import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{}),args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const capture=async name=>page.screenshot({path:`docs/screenshots/${name}.jpg`,type:'jpeg',quality:90});
const start=async(index,skin='glacier')=>{
 await page.evaluate(async({index,skin})=>{const a=window.__ORBIT__;a.progress.unlocked=32;await a.start(index);a.view.setSkin(skin);}, {index,skin});
 await page.waitForTimeout(1600);
};
try {
 await page.goto('http://127.0.0.1:5173/?test');await page.waitForFunction(()=>window.__ORBIT__?.view);await page.locator('#boot').waitFor({state:'hidden'});
 await page.waitForTimeout(1000);await capture('menu');
 for(const [index,name] of [[2,'aurelia'],[6,'tidal'],[12,'obsidian'],[18,'zenith']]){await start(index);await capture(name);}
 await start(31,'plasma');await capture('advanced');
 await start(0,'inferno');await page.keyboard.press('w');await page.waitForTimeout(750);await capture('inferno');
 await start(6,'frost');await page.keyboard.press('Space');await page.waitForTimeout(750);await capture('frost');
 await start(18,'stardust');
 await page.evaluate(()=>{
  const {game,view}=window.__ORBIT__;const keyIndices=view.items.filter(e=>e.item.type==='key').map(e=>e.index);
  keyIndices.forEach(i=>game.collected.add(i));game.keys=game.totalKeys;game.changed();view.setCollected(game.collected);
  const exit=view.items.find(e=>e.item.type==='exit').item;
  view.setPlayer(exit.cell,exit.normal,[0,0,-1],{instant:true});
  const p=exit.cell.map((v,i)=>v+exit.normal[i]*.81);p[0]+=.32;p[2]+=.28;
  view.setPhysicalPose({position:p,normal:exit.normal,forward:[0,0,-1],grounded:true});
 });
 await page.waitForTimeout(1000);await capture('portal');
 await page.evaluate(()=>window.__ORBIT__.menu());await page.getByRole('button',{name:'ATELIER',exact:true}).click();await page.waitForTimeout(250);await capture('atelier');
 console.log(JSON.stringify({screenshots:10,errors:[...new Set(errors)]}));
}finally{await browser.close();}
if(errors.length)process.exitCode=1;
