import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{}),args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const capture=async name=>page.screenshot({path:`docs/screenshots/${name}.jpg`,type:'jpeg',quality:90});
const start=async(index,skin='glacier')=>{
 await page.evaluate(async({index,skin})=>{const a=window.__ORBIT__;a.progress.unlocked=40;await a.start(index);a.view.setSkin(skin);}, {index,skin});
 await page.waitForTimeout(1600);
};
try {
 await page.goto('http://127.0.0.1:5173/?test');await page.waitForFunction(()=>window.__ORBIT__?.view);await page.locator('#boot').waitFor({state:'hidden'});
 await page.waitForTimeout(1000);await capture('menu');
 for(const [index,name] of [[2,'aurelia'],[6,'tidal'],[12,'obsidian'],[18,'zenith']]){await start(index);await capture(name);}
 await start(31,'plasma');await capture('advanced');
 await start(39,'inferno');
 await page.evaluate(()=>{
  const {game,view}=window.__ORBIT__;const enemy=game.getEnemies()[2];
  const candidates=game.level.cubes.filter(c=>Math.abs(c[1]-(enemy.target[1]-.515))<.001&&!game.level.items.some(i=>['lava','spike'].includes(i.type)&&i.cell.every((v,j)=>v===c[j])));
  candidates.sort((a,b)=>Math.abs(Math.hypot(a[0]-enemy.target[0],a[2]-enemy.target[2])-1)-Math.abs(Math.hypot(b[0]-enemy.target[0],b[2]-enemy.target[2])-1));
  const cell=candidates[0];const dx=enemy.target[0]-cell[0],dz=enemy.target[2]-cell[2];const forward=Math.abs(dx)>Math.abs(dz)?[Math.sign(dx),0,0]:[0,0,Math.sign(dz)||-1];
  game.cell=[...cell];game.normal=[0,1,0];game.forward=forward;game.enemyGrace=10;view.setPlayer(cell,[0,1,0],forward,{instant:true});view.camera.fov=49;view.camera.updateProjectionMatrix();
 });await page.waitForTimeout(700);await capture('expedition');
 await page.evaluate(()=>{const {game,view}=window.__ORBIT__;game.enemies.time=game.enemies.entries[2].offset+3.25;game.enemies.update(0);view.camera.fov=35;view.camera.updateProjectionMatrix();});
 await page.waitForTimeout(180);await capture('sentinel');
 await page.evaluate(()=>{window.__ORBIT__.view.camera.fov=39;window.__ORBIT__.view.camera.updateProjectionMatrix();});
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
 console.log(JSON.stringify({screenshots:12,errors:[...new Set(errors)]}));
}finally{await browser.close();}
if(errors.length)process.exitCode=1;
