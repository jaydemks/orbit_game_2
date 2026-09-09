import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
const run=(game,seconds,step=1/120)=>{for(let t=0;t<seconds-1e-9;t+=step)game.update(Math.min(step,seconds-t));};
const extreme=(index=0)=>{const g=new Game();g.setDifficulty('extreme');g.start(index);return g;};
const speed=g=>Math.hypot(...g.getPhysicalPose().velocity);

test('Easy remains the default discrete game; Extreme accelerates continuously and coasts',()=>{
 const easy=new Game();easy.start();assert.equal(easy.getSnapshot().difficulty,'easy');assert.equal(easy.getPhysicalPose(),null);assert(easy.move('forward'));assert.deepEqual(easy.cell,[0,0,-1]);
 const g=extreme();g.setInput({forward:true});run(g,.15);const first=speed(g);assert(first>0&&first<2);run(g,.15);assert(speed(g)>first);const z=g.getPhysicalPose().position[2];g.setInput({});run(g,.12);assert(g.getPhysicalPose().position[2]<z);assert(speed(g)>0);
});

test('steering changes heading while lateral inertia requires correction',()=>{
 const g=extreme();g.setInput({forward:true});run(g,.2);g.setInput({left:true});run(g,.18);const p=g.getPhysicalPose();assert(p.forward[0]<-.3);assert(Math.abs(p.velocity[0])<.01);assert(p.velocity[2]<0);
});

test('jump range depends on approach velocity; a stationary jump returns to its block',()=>{
 const stationary=extreme();assert(stationary.jump());assert.equal(stationary.jump(),false);run(stationary,.8);assert.equal(stationary.getPhysicalPose().airborne,false);assert(Math.abs(stationary.getPhysicalPose().position[2])<.001);
 const moving=extreme();moving.setInput({forward:true});run(moving,.38);moving.setInput({});const z=moving.getPhysicalPose().position[2];assert(moving.jump());run(moving,.8);assert.equal(moving.lives,3);assert.equal(moving.getPhysicalPose().airborne,false);assert(z-moving.getPhysicalPose().position[2]>1.5);
});

test('a carefully paced jump crosses the mandatory island gap',()=>{
 const g=extreme(1);g.physics.position=[0,.815,-1.9];g.cell=[0,0,-2];g.physics.velocity=[0,0,-2.85];assert(g.jump());run(g,.8);assert.equal(g.lives,3);assert.equal(g.getPhysicalPose().airborne,false);assert.equal(g.cell[2],-4);
});

test('low speed wraps gravity around a convex edge; excessive speed falls and respawns',()=>{
 const slow=extreme();slow.physics.forward=[1,0,0];slow.forward=[1,0,0];slow.physics.position=[.49,.815,0];slow.physics.velocity=[1.5,0,0];run(slow,.48);assert.deepEqual(slow.normal,[1,0,0]);assert.equal(slow.lives,3);
 const fast=extreme();fast.physics.forward=[1,0,0];fast.forward=[1,0,0];fast.physics.position=[.49,.815,0];fast.physics.velocity=[4,0,0];run(fast,.1);assert.equal(fast.getPhysicalPose().airborne,true);run(fast,2.4);assert.equal(fast.lives,2);assert.deepEqual(fast.getPhysicalPose().position,[0,.815,0]);assert(fast.cooldown>1);assert.equal(speed(fast),0);
});

test('physics is consistent at different rendering frame rates and pause freezes movement',()=>{
 const a=extreme(),b=extreme();a.setInput({forward:true});b.setInput({forward:true});run(a,.4,1/30);run(b,.4,1/120);assert(Math.abs(a.getPhysicalPose().position[2]-b.getPhysicalPose().position[2])<1e-8);
 const pose=a.getPhysicalPose();a.pause();run(a,.3);assert.deepEqual(a.getPhysicalPose(),pose);
});

test('physical contact triggers hazards and resets momentum with respawn grace',()=>{
 const g=extreme(2);g.setInput({forward:true});run(g,.55);assert.equal(g.lives,2);assert.equal(speed(g),0);assert(g.cooldown>1);assert.deepEqual(g.getPhysicalPose().position,[0,.815,0]);
});

test('a low ceiling blocks a jump instead of allowing the ball through geometry',()=>{
 const g=extreme();g.level={...g.level,cubes:[[0,0,0],[0,2,0]],items:[]};g.occupied=new Set(g.level.cubes.map(c=>c.join(',')));g.jump();let peak=0;
 for(let i=0;i<120;i++){g.update(1/120);peak=Math.max(peak,g.getPhysicalPose().position[1]);}
 assert(peak<=1.186);assert.equal(g.getPhysicalPose().airborne,false);assert.equal(g.lives,3);
});

test('Extreme can circle a real campaign block, collect underneath, steer back and win with inputs only',()=>{
 const g=extreme();const step=()=>g.update(1/120);
 const turn=action=>{g.setInput({[action]:true});run(g,Math.PI/2/2.45);};
 turn('left');let underside=false,returned=false;
 // Pulse acceleration to control corner speed, then brake before steering.
 for(let i=0;i<1600;i++){
   g.setInput({forward:speed(g)<1.2});step();
   if(g.normal[1]===-1)underside=true;
   if(underside&&g.normal[1]===1&&Math.abs(g.getPhysicalPose().position[0])<.1){returned=true;break;}
 }
 assert(underside&&returned);assert(g.coins>=1,'the underside pickup must be collected');
 g.setInput({back:true});for(let i=0;i<60&&speed(g)>.08;i++)step();
 g.setInput({});turn('right');g.setInput({forward:true});
 for(let i=0;i<1200&&g.state==='playing';i++)step();
 assert.equal(g.state,'won');assert.equal(g.lives,3);assert.equal(g.keys,g.totalKeys);
});

test('slow physical movement reaches every adjacent exposed face across stairs, concave folds and underside edges',()=>{
 const axes=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 const add=(a,b)=>a.map((v,i)=>v+b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);let checked=0;
 for(const index of [0,2,29]){
   const easy=new Game(),g=extreme(index);easy.start(index);easy.touch=g.touch=()=>{};
   for(const cell of g.level.cubes)for(const normal of axes){
     if(g.occupied.has(add(cell,normal).join(',')))continue;
     for(const forward of axes.filter(a=>dot(a,normal)===0)){
       easy.cell=[...cell];easy.normal=[...normal];easy.forward=[...forward];easy.cooldown=0;easy.move('forward');
       g.cell=[...cell];g.normal=[...normal];g.forward=[...forward];g.physics.reset();g.physics.velocity=forward.map(v=>v*1.5);g.cooldown=0;g.state='playing';g.time=999;g.lives=3;
       let reached=false;for(let step=0;step<240;step++){
         g.update(1/120);
         if(g.cell.join(',')===easy.cell.join(',')&&g.normal.join(',')===easy.normal.join(',')){reached=true;break;}
       }
       assert(reached,`Level ${index+1}: ${cell} / ${normal} toward ${forward}`);assert.equal(g.lives,3);checked++;
     }
   }
 }
 assert(checked>800);
});

test('concave gravity transfer preserves the center position and lateral offset at first wall contact',()=>{
 const g=extreme();g.level={...g.level,cubes:[[0,0,0],[0,0,-1],[0,1,-1]],items:[]};g.occupied=new Set(g.level.cubes.map(c=>c.join(',')));
 g.physics.position=[.12,.815,-.18];g.physics.velocity=[0,0,-1.2];const before=g.getPhysicalPose().position;g.update(1/120);
 const after=g.getPhysicalPose().position;assert(Math.hypot(...after.map((v,i)=>v-before[i]))<.012);
 assert.equal(after[0],.12);assert.equal(after[1],.815);assert(Math.abs(after[2]+.185)<1e-8);assert.equal(g.normal.join(','),'0,0,1');
});
