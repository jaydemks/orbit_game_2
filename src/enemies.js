const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const ENEMY_TIMING=Object.freeze({patrol:3,warning:1.25,attack:.32,cooldown:2,cycle:6.57});

/** Deterministic sentinels attack authored surface zones, never tracking the
 * player. Their warning is long enough to leave, wait or jump over the pulse.
 */
export class EnemySimulation {
  constructor(game){this.game=game;this.time=0;this.entries=(game.level.enemies||[]).map(def=>({...def,phase:'patrol',cycle:-1,hitCycle:-1}));}
  snapshots(){return this.entries.map(enemy=>this.snapshot(enemy));}
  snapshot(enemy){
    const n=enemy.normal,tangent=cross(n,Math.abs(n[1])<.9?[0,1,0]:[0,0,1]),side=cross(n,tangent);
    const wander=enemy.phase==='patrol'?1:enemy.phase==='cooldown'?.35:0;
    const target=add(enemy.cell,scale(n,.515));
    const position=add(add(add(enemy.cell,scale(n,1.85)),scale(tangent,Math.sin(this.time*1.5+enemy.offset)*.65*wander)),scale(side,Math.cos(this.time*1.2+enemy.offset)*.45*wander));
    return {id:enemy.id,position,normal:[...n],phase:enemy.phase,target,radius:enemy.radius};
  }
  update(dt){
    this.time+=dt;const g=this.game;
    for(const enemy of this.entries){
      const clock=Math.max(0,this.time-enemy.offset),cycle=Math.floor(clock/ENEMY_TIMING.cycle),phaseTime=clock-cycle*ENEMY_TIMING.cycle;
      const phase=phaseTime<3?'patrol':phaseTime<4.25?'warning':phaseTime<4.57?'attack':'cooldown';
      if(phase!==enemy.phase||cycle!==enemy.cycle){enemy.phase=phase;enemy.cycle=cycle;if(phase==='warning'||phase==='attack')g.emit('enemy-'+phase,{enemy:this.snapshot(enemy)});}
      if(phase!=='attack'||enemy.hitCycle===cycle||g.enemyGrace>0||g.state!=='playing')continue;
      const pose=g.getEnemyCollisionPose();if(dot(pose.normal,enemy.normal)<.99)continue;
      const delta=add(pose.position,scale(enemy.cell,-1)),height=dot(delta,enemy.normal),tangent=add(delta,scale(enemy.normal,-height));
      // Being airborne alone is not immunity: the ball must clear the pulse.
      if(height>=.45&&height<=1.065&&Math.hypot(...tangent)<=enemy.radius){enemy.hitCycle=cycle;g.damage('enemy');}
    }
  }
}
