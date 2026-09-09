import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { EnemySimulation } from '../src/enemies.js';
import { LEVELS } from '../src/levels.js';
const run=(g,seconds)=>{for(let t=0;t<seconds-1e-9;t+=1/60)g.update(Math.min(1/60,seconds-t));};
function fixture(extreme=false,events=[]){
 const g=new Game({onEvent:e=>events.push(e)});if(extreme)g.setDifficulty('extreme');g.start();
 g.level={...g.level,cubes:Array.from({length:5},(_,i)=>[0,0,-i]),items:[],enemies:[{id:'test-sentinel',cell:[0,0,-2],normal:[0,1,0],offset:0,radius:.68}]};
 g.occupied=new Set(g.level.cubes.map(c=>c.join(',')));g.enemies=new EnemySimulation(g);return g;
}
const place=(g,cell)=>{g.cell=[...cell];g.normal=[0,1,0];g.forward=[0,0,-1];g.physics?.reset();};

test('sentinels warn before striking; remaining in the marked zone costs one life',()=>{
 const events=[],g=fixture(false,events);place(g,[0,0,-2]);run(g,3.05);
 assert.equal(g.getEnemies()[0].phase,'warning');assert.equal(g.lives,3);assert(events.some(e=>e.type==='enemy-warning'&&e.enemy.target[2]===-2));
 run(g,1.22);assert.equal(g.getEnemies()[0].phase,'attack');assert.equal(g.lives,2);assert(events.some(e=>e.type==='damage'&&e.reason==='enemy'));
 run(g,.3);assert.equal(g.lives,2,'one pulse cannot repeatedly damage');
});

test('dodging a warning and waiting outside the zone is safe',()=>{
 const g=fixture();place(g,[0,0,-2]);run(g,3.2);assert(g.move('forward'));run(g,2);assert.equal(g.lives,3);assert.equal(g.getEnemies()[0].phase,'cooldown');
});

test('a timed Easy jump clears the attack pulse while crossing its zone',()=>{
 const g=fixture();place(g,[0,0,-1]);run(g,4.15);assert(g.jump());run(g,.6);assert.equal(g.lives,3);assert.deepEqual(g.cell,[0,0,-3]);
});

test('Extreme jump height matters: clearing the pulse works, airborne at surface height does not',()=>{
 const high=fixture(true);place(high,[0,0,-2]);run(high,4.05);assert(high.jump());run(high,.55);assert.equal(high.lives,3);
 const low=fixture(true);run(low,4.26);place(low,[0,0,-2]);low.physics.airborne=true;low.physics.velocity=[0,0,0];run(low,1/60);assert.equal(low.lives,2);
});

test('respawn grace protects against concurrent attacks and pause freezes sentinel clocks',()=>{
 const g=fixture();g.level.enemies.push({...g.level.enemies[0],id:'second'});g.enemies=new EnemySimulation(g);place(g,[0,0,-2]);run(g,4.3);assert.equal(g.lives,2);
 place(g,[0,0,-2]);run(g,.2);assert.equal(g.lives,2);const snapshot=g.getEnemies();g.pause();run(g,3);assert.deepEqual(g.getEnemies(),snapshot);
});

test('the same fixed-step inputs produce identical enemy phases, events and game results',()=>{
 const eventsA=[],eventsB=[],a=fixture(false,eventsA),b=fixture(false,eventsB);
 for(let tick=0;tick<1200;tick++)for(const g of [a,b]){if(tick===30)g.move('forward');if(tick===220)g.jump();if(tick===350)g.move('back');g.update(1/60);}
 assert.deepEqual(a.getSnapshot(),b.getSnapshot());assert.deepEqual(a.getEnemies(),b.getEnemies());assert.deepEqual(eventsA,eventsB);
});

test('late campaign levels are substantially larger and authored enemy zones preserve safe objectives',()=>{
 assert.equal(LEVELS.length,40);assert(LEVELS.slice(0,16).every(l=>l.enemies.length===0));assert(LEVELS[16].enemies.length>0);
 for(const level of LEVELS.slice(32)){assert(level.cubes.length>=65);assert.equal(level.items.filter(i=>i.type==='key').length,4);assert(level.enemies.length>=2);}
 for(const level of LEVELS)for(const enemy of level.enemies){
   const face=item=>item.cell.join(',')===enemy.cell.join(',')&&item.normal.join(',')===enemy.normal.join(',');
   assert(!face(level.start));assert(!level.items.filter(i=>['key','exit','lava','spike'].includes(i.type)).some(face));
 }
});
