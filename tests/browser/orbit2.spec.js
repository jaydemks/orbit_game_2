import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/?test'); await page.waitForFunction(() => window.__ORBIT__?.view);
  await expect(page.locator('#boot')).toBeHidden();
}

test('ORBIT 2 saves are separate and Extreme accelerates, coasts, and pauses', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('orbit.progress.v1',JSON.stringify({bank:999,unlocked:24})));
  await ready(page);
  expect(await page.evaluate(() => window.__ORBIT__.progress.bank)).toBe(0);
  await page.locator('[data-difficulty="extreme"]').click();
  await page.getByRole('button',{name:'Start rolling'}).click();
  await expect(page.locator('#boot')).toBeHidden();
  await page.keyboard.down('w'); await page.waitForTimeout(180); await page.keyboard.up('w');
  const first = await page.evaluate(() => window.__ORBIT__.game.getPhysicalPose().position);
  await page.waitForTimeout(180);
  const second = await page.evaluate(() => window.__ORBIT__.game.getPhysicalPose().position);
  expect(second[2]).toBeLessThan(first[2]);
  await expect(page.locator('#speed-meter')).toBeVisible();
  await page.keyboard.press('Escape');
  const stopped = await page.evaluate(() => window.__ORBIT__.game.getPhysicalPose());
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__ORBIT__.game.getPhysicalPose())).toEqual(stopped);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('orbit.progress.v1')).bank)).toBe(999);
  await page.reload();await page.waitForFunction(() => window.__ORBIT__?.view);
  expect(await page.evaluate(() => window.__ORBIT__.progress.difficulty)).toBe('extreme');
});

test('death and portal absorption finish in 3D before the result dialog', async ({page}) => {
  await ready(page);await page.evaluate(() => window.__ORBIT__.start(0));
  await page.evaluate(() => window.__ORBIT__.game.damage('burn'));
  expect(await page.evaluate(() => window.__ORBIT__.view.sequence.kind)).toBe('burn');
  await expect(page.getByRole('button',{name:'Pause game'})).toBeDisabled();
  await expect(page.locator('#interface')).toHaveAttribute('data-screen','playing');
  await page.waitForTimeout(1700);
  expect(await page.evaluate(() => window.__ORBIT__.view.ball.visible)).toBe(true);
  await page.evaluate(() => {
    const {game} = window.__ORBIT__,exit = game.level.items.find(i=>i.type==='exit');
    game.cell=[...exit.cell]; game.normal=[...exit.normal];game.keys=game.totalKeys;game.touch();game.changed();
  });
  expect(await page.evaluate(() => window.__ORBIT__.view.sequence.kind)).toBe('won');
  await expect(page.locator('#interface')).toHaveAttribute('data-screen','playing');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__ORBIT__.view.ball.scale.x)).toBeLessThan(.9);
  await expect(page.locator('#interface')).toHaveAttribute('data-screen','won');
});

test('new skins emit pooled particles and leave surface marks in advanced worlds',async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page);
  await page.evaluate(async()=>{const a=window.__ORBIT__;a.progress.bank=3000;a.progress.unlocked=32;await a.skin('frost');await a.start(24);});
  await page.keyboard.press('Space');await page.waitForTimeout(600);
  await page.keyboard.press('w');await page.waitForTimeout(500);
  const stats=await page.evaluate(()=>{
    const {view,game}=window.__ORBIT__;
    return {particles:Array.from(view.effects.life).filter(x=>x>0).length,marks:Array.from(view.effects.trailAge).filter(x=>x>0).length,calls:view.getPerformanceStats().calls,advanced:game.level.emissive};
  });
  expect(stats.particles).toBeGreaterThan(10);expect(stats.marks).toBeGreaterThan(1);expect(stats.calls).toBeLessThan(300);expect(stats.advanced).toBe(true);
  expect(errors).toEqual([]);
});

test('portrait touch supports simultaneous steering and throttle without sticky inputs',async ({browser}) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();await ready(page);
  await page.locator('[data-difficulty="extreme"]').click();await page.getByRole('button',{name:'Start rolling'}).click();await expect(page.locator('#boot')).toBeHidden();
  await expect(page.locator('.touch-controls')).toBeVisible();
  const cdp=await context.newCDPSession(page);
  const forward=await page.locator('[data-control="forward"]').boundingBox(),left=await page.locator('[data-control="left"]').boundingBox();
  const throttle={x:forward.x+forward.width/2,y:forward.y+forward.height/2,id:11},steer={x:left.x+left.width/2,y:left.y+left.height/2,id:12};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[throttle]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[throttle,steer]});
  await page.waitForTimeout(150);
  expect(await page.evaluate(()=>window.__ORBIT__.game.input)).toMatchObject({forward:true,left:true});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[steer]});
  await page.waitForTimeout(80);
  expect(await page.evaluate(()=>window.__ORBIT__.game.input)).toMatchObject({forward:true,left:false});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.waitForTimeout(80);
  expect(await page.evaluate(()=>window.__ORBIT__.game.input)).toMatchObject({forward:false,left:false});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await context.close();
});

test('optional music overlaps tracks with gain fades and returns to fallback safely',async ({page})=>{
  await ready(page);await page.getByRole('button',{name:'Start rolling'}).click();await expect(page.locator('#boot')).toBeHidden();
  const result=await page.evaluate(async()=>{
    const {MusicDeck}=await import('/src/music.js');
    const rate=8000,samples=rate*12,buffer=new ArrayBuffer(44+samples*2),v=new DataView(buffer);
    const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
    str(0,'RIFF');v.setUint32(4,36+samples*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples*2,true);
    const urls=[0,1].map(()=>URL.createObjectURL(new Blob([buffer],{type:'audio/wav'})));
    const {context,master}=window.__ORBIT__.sound,deck=new MusicDeck(context,master,urls);deck.start();
    const until=async condition=>{for(let i=0;i<50&&!condition();i++)await new Promise(r=>setTimeout(r,50));};
    await until(()=>deck.current);const first=deck.current;
    first.audio.currentTime=8;deck.tick();await until(()=>deck.current!==first);
    const overlap=deck.slots.length,changed=deck.current!==first,retiring=first.retiring;
    await new Promise(r=>setTimeout(r,300));const incomingGain=deck.current.gain.gain.value;
    deck.dispose();urls.forEach(url=>URL.revokeObjectURL(url));
    return {overlap,changed,retiring,incomingGain,remaining:deck.slots.length};
  });
  expect(result.overlap).toBe(2);expect(result.changed).toBe(true);expect(result.retiring).toBe(true);expect(result.incomingGain).toBeGreaterThan(0);expect(result.incomingGain).toBeLessThan(.32);expect(result.remaining).toBe(0);
});

