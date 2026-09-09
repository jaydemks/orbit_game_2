import { test,expect } from '@playwright/test';
async function ready(page){await page.goto('/?test');await page.waitForFunction(()=>window.__ORBIT__?.view);await expect(page.locator('#boot')).toBeHidden();}
test('real keyboard win exports a valid replay and optional GitHub submission',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'Start rolling'}).click();await expect(page.locator('#boot')).toBeHidden();
  for(let i=0;i<5;i++){await page.waitForFunction(()=>window.__ORBIT__.game.cooldown===0);await page.keyboard.press('w');}
  await expect(page.locator('#interface')).toHaveAttribute('data-screen','won');
  const verified=await page.evaluate(async()=>{const {validateReplay}=await import('/src/replay.js');const a=window.__ORBIT__;return {actual:a.game.score,verified:validateReplay(a.recorder.export()).score};});
  expect(verified.verified).toBe(verified.actual);
  await page.getByRole('button',{name:'Submit verified run'}).click();
  await page.getByRole('button',{name:'Make yourself famous',exact:true}).click();
  await page.getByLabel('Your explorer alias').fill('Star Pilot');
  await page.evaluate(()=>{window.open=(url)=>{window.submissionURL=url;return null;};});
  await page.getByRole('button',{name:'Submit verified run'}).click();
  const url=await page.evaluate(()=>window.submissionURL);
  expect(url).toContain('https://github.com/jaydemks/orbit_game_2/issues/new');
  expect(new URL(url).searchParams.get('body')).toContain('Star Pilot');
});
test('rankings show verified profile links, split modes, no invented empty rows',async({page})=>{
  await page.route('https://raw.githubusercontent.com/jaydemks/orbit_game_2/rankings/leaderboard.json',route=>route.fulfill({json:{runs:[{userId:1,username:'octocat',alias:'Space Pilot',score:1000,level:0,difficulty:'easy',version:'orbit2-2026-09-expeditions'}]}}));
  await ready(page);await page.getByRole('button',{name:'Rankings',exact:true}).click();
  await expect(page.getByText('Space Pilot')).toBeVisible();
  await expect(page.getByRole('link',{name:'Open octocat on GitHub'})).toHaveAttribute('href','https://github.com/octocat');
  await page.getByRole('group',{name:'Ranking difficulty'}).getByRole('button',{name:'Extreme'}).click();
  await expect(page.getByText('The first star could be you.')).toBeVisible();await expect(page.locator('.rankings-table tbody tr')).toHaveCount(0);
});
test('music can be muted independently of effects and persists across reloads',async({page})=>{
  await ready(page);await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('slider',{name:'Music volume'}).fill('0');await page.getByRole('slider',{name:'Sound effects volume'}).fill('80');
  await page.getByRole('button',{name:'Done'}).click();await page.getByRole('button',{name:'Start rolling'}).click();await expect(page.locator('#boot')).toBeHidden();
  expect(await page.evaluate(()=>({music:window.__ORBIT__.sound.musicBus.gain.value,effects:window.__ORBIT__.sound.effectsBus.gain.value}))).toEqual({music:0,effects:expect.closeTo(.8,4)});
  await page.reload();await page.waitForFunction(()=>window.__ORBIT__?.view);
  expect(await page.evaluate(()=>window.__ORBIT__.progress.musicVolume)).toBe(0);expect(await page.evaluate(()=>window.__ORBIT__.progress.effectsVolume)).toBe(.8);
});
test('largest level renders enemies within budget, and classic puncture differs from glass shatter',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await ready(page);
  await page.evaluate(async()=>{const a=window.__ORBIT__;a.progress.unlocked=40;await a.start(39);});
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>window.__ORBIT__.game.getEnemies().length)).toBe(3);
  expect(await page.evaluate(()=>window.__ORBIT__.view.getPerformanceStats().calls)).toBeLessThan(330);
  await page.evaluate(async()=>{const a=window.__ORBIT__;a.progress.bank=1000;await a.skin('classic');a.game.damage('enemy');});
  await page.waitForTimeout(600);
  const scale=await page.evaluate(()=>window.__ORBIT__.view.ball.scale.toArray());expect(Math.max(...scale)-Math.min(...scale)).toBeGreaterThan(.2);
  expect(errors).toEqual([]);
});

test('camera finds a clear view below the stacked expedition bridge',async({page})=>{
  await ready(page);
  await page.evaluate(async()=>{
    const a=window.__ORBIT__;a.progress.unlocked=40;await a.start(39);
    const enemy=a.game.getEnemies()[0];
    const cells=a.game.level.cubes.filter(cell=>cell[1]===0&&!a.game.level.items.some(item=>['lava','spike'].includes(item.type)&&item.cell.every((v,i)=>v===cell[i])));
    const distance=cell=>Math.abs(Math.hypot(cell[0]-enemy.target[0],cell[2]-enemy.target[2])-1);
    cells.sort((a,b)=>distance(a)-distance(b));
    const cell=cells[0],dx=enemy.target[0]-cell[0],dz=enemy.target[2]-cell[2],forward=Math.abs(dx)>Math.abs(dz)?[Math.sign(dx),0,0]:[0,0,Math.sign(dz)||-1];
    a.game.cell=cell;a.game.normal=[0,1,0];a.game.forward=forward;a.view.setPlayer(cell,a.game.normal,forward,{instant:true});
  });
  await page.waitForTimeout(600);
  const result=await page.evaluate(()=>{
    const v=window.__ORBIT__.view,direction=v.ball.position.clone().sub(v.camera.position),distance=direction.length();
    v.cameraRay.set(v.camera.position,direction.normalize());v.cameraRay.far=distance-.33;v.cameraHits.length=0;v.cameraRay.intersectObjects(v.levelGroup.children,false,v.cameraHits);
    return {distance,hits:v.cameraHits.length,projected:v.ball.position.clone().project(v.camera).toArray()};
  });
  expect(result.hits).toBe(0);expect(result.distance).toBeGreaterThan(1);expect(Math.abs(result.projected[0])).toBeLessThan(.9);expect(Math.abs(result.projected[1])).toBeLessThan(.9);
});
