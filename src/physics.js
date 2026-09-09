const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a);
const unit=a=>scale(a,1/(length(a)||1));
const axes=[[1,0,0],[0,1,0],[0,0,1]];
const RADIUS=.315, OFFSET=.5+RADIUS;
const rotate=(v,n,angle)=>add(add(scale(v,Math.cos(angle)),scale(cross(n,v),Math.sin(angle))),scale(n,dot(n,v)*(1-Math.cos(angle))));

/** Continuous surface gravity with inertial steering and ballistic jumps.
 * Grounded edge adhesion is limited to 3.2 units/s: faster approaches launch
 * into space. Fixed 120 Hz substeps prevent tunnelling through narrow blocks.
 */
export class SurfacePhysics {
  constructor(game){this.game=game;this.input={};this.reset();}
  reset(){const g=this.game;this.position=add(g.cell,scale(g.normal,OFFSET));this.normal=[...g.normal];this.forward=[...g.forward];this.velocity=[0,0,0];this.airborne=false;this.arc=null;this.flightTime=0;}
  jump(){if(this.airborne||this.arc)return false;this.airborne=true;this.flightTime=0;this.velocity=add(this.velocity,scale(this.normal,5.2));return true;}
  pose(){return {position:[...this.position],normal:[...this.normal],forward:[...this.forward],velocity:[...this.velocity],airborne:this.airborne};}
  update(dt){for(let remaining=dt;remaining>1e-7;){const step=Math.min(remaining,1/120);remaining-=step;this.step(step);if(this.game.cooldown>0||this.game.state!=='playing')break;}}
  step(dt){
    const g=this.game;
    if(this.arc){
      const a=this.arc;a.progress=Math.min(1,a.progress+dt/a.duration);const angle=a.progress*Math.PI/2;
      this.position=add(a.pivot,scale(rotate(a.startNormal,a.axis,angle),RADIUS));
      this.normal=rotate(a.startNormal,a.axis,angle);this.forward=rotate(a.startForward,a.axis,angle);
      if(a.progress===1){g.normal=[...a.targetNormal];this.normal=[...a.targetNormal];this.velocity=rotate(a.velocity,a.axis,Math.PI/2);this.arc=null;this.sync();g.touch();g.changed();}return;
    }
    const turn=(Number(!!this.input.left)-Number(!!this.input.right))*2.45*dt;
    this.forward=unit(rotate(this.forward,this.normal,turn));
    const thrust=Number(!!this.input.forward)-Number(!!this.input.back);
    if(this.airborne){
      this.flightTime+=dt;const old=[...this.position];
      this.velocity=add(this.velocity,add(scale(this.normal,-14*dt),scale(this.forward,thrust*1.7*dt)));
      this.position=add(this.position,scale(this.velocity,dt));
      // Resolve walls and ceilings before the downward landing sweep. Swept
      // face intersections keep fast jumps from passing through rising blocks.
      for(const cell of g.level.cubes)for(const axis of axes)for(const sign of [-1,1]){
        const face=scale(axis,sign);if(dot(face,this.normal)>.5)continue;
        const before=dot(add(old,scale(cell,-1)),face),after=dot(add(this.position,scale(cell,-1)),face);
        if(before<OFFSET-1e-7||after>=OFFSET||dot(this.velocity,face)>=0)continue;
        const fraction=(before-OFFSET)/(before-after),hit=add(old,scale(add(this.position,scale(old,-1)),fraction));
        if(axes.every(other=>Math.abs(dot(other,face))>.5||Math.abs(dot(add(hit,scale(cell,-1)),other))<OFFSET-.001)){
          this.position=add(this.position,scale(face,OFFSET-after+.0001));this.velocity=add(this.velocity,scale(face,-dot(this.velocity,face)));
        }
      }
      if(dot(this.velocity,this.normal)<0){
        for(const cell of g.level.cubes){
          const before=dot(add(old,scale(cell,-1)),this.normal),after=dot(add(this.position,scale(cell,-1)),this.normal);
          if(before>=OFFSET&&after<=OFFSET){const ratio=(before-OFFSET)/(before-after),hit=add(old,scale(add(this.position,scale(old,-1)),ratio));
            if(axes.every(axis=>Math.abs(dot(axis,this.normal))>.5||Math.abs(dot(add(hit,scale(cell,-1)),axis))<=.5)&&!g.occupied.has(add(cell,this.normal).join(','))){
              g.cell=[...cell];this.position=add(hit,scale(this.normal,OFFSET-dot(add(hit,scale(cell,-1)),this.normal)));this.velocity=add(this.velocity,scale(this.normal,-dot(this.velocity,this.normal)));this.airborne=false;this.sync();g.touch();g.changed();return;
            }
          }
        }
      }
      if(this.flightTime>2.4){g.damage('fall');}return;
    }
    this.velocity=add(scale(this.velocity,Math.exp(-1.15*dt)),scale(this.forward,thrust*8*dt));
    const speed=length(this.velocity);if(speed>4.2)this.velocity=scale(this.velocity,4.2/speed);
    this.position=add(this.position,scale(this.velocity,dt));
    for(const axis of axes){
      if(Math.abs(dot(axis,this.normal))>.5)continue;
      const offset=dot(add(this.position,scale(g.cell,-1)),axis);
      const d=scale(axis,Math.sign(offset)),across=add(g.cell,d),outer=add(across,this.normal),rising=g.occupied.has(outer.join(','));
      if(Math.abs(offset)<=(rising?.5-RADIUS:.5))continue;
      if(rising){
        // Transfer gravity when the sphere first touches the rising wall.
        // Its center stays at the intersection of the two offset planes,
        // preserving lateral position rather than snapping to a face center.
        this.position=add(this.position,scale(d,.5-RADIUS-Math.abs(offset)));
        const oldNormal=[...this.normal],axisTurn=cross(oldNormal,scale(d,-1));g.cell=outer;g.normal=scale(d,-1);this.normal=[...g.normal];this.forward=rotate(this.forward,axisTurn,Math.PI/2);this.velocity=rotate(this.velocity,axisTurn,Math.PI/2);
      }else if(g.occupied.has(across.join(','))){g.cell=across;}
      else if(length(this.velocity)>3.2){this.airborne=true;this.flightTime=0;}
      else {
        const pivot=add(add(g.cell,scale(this.normal,.5)),scale(d,.5));
        // Preserve lateral offset along the edge while following its quarter circle.
        const edge=cross(this.normal,d);const lateral=dot(add(this.position,scale(g.cell,-1)),edge);
        this.arc={pivot:add(pivot,scale(edge,lateral)),axis:cross(this.normal,d),startNormal:[...this.normal],startForward:[...this.forward],targetNormal:d,velocity:[...this.velocity],progress:0,duration:Math.max(.16,Math.min(.42,.495/(length(this.velocity)||1)))};
      }
      this.sync();g.touch();g.changed();break;
    }
    if(!this.airborne&&!this.arc){this.sync();const center=add(g.cell,scale(this.normal,OFFSET));if(length(add(this.position,scale(center,-1)))<.43){g.touch();}}
  }
  sync(){this.game.forward=[...this.forward];this.game.normal=this.normal.map(v=>Math.round(v));}
}
