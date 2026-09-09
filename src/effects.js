import * as THREE from 'three';

const COLORS = {inferno:[0xff6320,0xffd45a],frost:[0x48cfff,0xc9ffff],plasma:[0xba44ff,0xff78dd],stardust:[0xffd76c,0xffffff]};
// One fixed GPU point pool, one instanced decal pool. No particle creates a draw call.
export class BallEffects {
 constructor(scene){
  this.count=240;this.cursor=0;this.accumulator=0;this.skin='glacier';this.last=new THREE.Vector3();
  this.p=new Float32Array(this.count*3);this.v=new Float32Array(this.count*3);this.life=new Float32Array(this.count);this.max=new Float32Array(this.count);this.colors=new Float32Array(this.count*3);this.sizes=new Float32Array(this.count);
  this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(this.p,3).setUsage(THREE.DynamicDrawUsage));this.geometry.setAttribute('color',new THREE.BufferAttribute(this.colors,3));this.geometry.setAttribute('aSize',new THREE.BufferAttribute(this.sizes,1).setUsage(THREE.DynamicDrawUsage));
  this.material=new THREE.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uPixel:{value:600}},vertexShader:`attribute float aSize; varying vec3 vColor; uniform float uPixel; void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(aSize*uPixel/max(1.,-p.z),0.,48.);}`,fragmentShader:`varying vec3 vColor;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;if(r>1.)discard;float a=pow(1.-r,1.7);gl_FragColor=vec4(vColor*1.6,a*.85);}`});
  this.points=new THREE.Points(this.geometry,this.material);this.points.frustumCulled=false;scene.add(this.points);
  this.trailGeo=new THREE.CircleGeometry(.14,12);this.trailMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});this.trails=new THREE.InstancedMesh(this.trailGeo,this.trailMat,96);this.trails.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.trails.frustumCulled=false;scene.add(this.trails);this.trailAge=new Float32Array(96);this.trailPositions=Array.from({length:96},()=>new THREE.Vector3());this.trailRotations=Array.from({length:96},()=>new THREE.Quaternion());this.trailCursor=0;this.dummy=new THREE.Object3D();this.color=new THREE.Color();this.normal=new THREE.Vector3(0,1,0);this.reset();
 }
 reset(){this.life.fill(0);this.sizes.fill(0);this.trailAge.fill(0);this.last.set(999,999,999);for(let i=0;i<96;i++){this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.trails.setMatrixAt(i,this.dummy.matrix);}this.trails.instanceMatrix.needsUpdate=true;}
 setSkin(id){this.skin=id;this.reset();}
 burst(position,normal,count=100){for(let i=0;i<count;i++)this.spawn(position,normal,true);}
 spawn(position,normal,burst=false){const i=this.cursor++%this.count,j=i*3;const angle=Math.random()*Math.PI*2,z=Math.random()*2-1,r=Math.sqrt(1-z*z)*.33;this.p[j]=position.x+Math.cos(angle)*r;this.p[j+1]=position.y+z*.33;this.p[j+2]=position.z+Math.sin(angle)*r;const speed=burst?3:.65;for(let a=0;a<3;a++)this.v[j+a]=(Math.random()-.5)*speed;this.v[j]+=normal.x*.65;this.v[j+1]+=normal.y*.65;this.v[j+2]+=normal.z*.65;this.life[i]=this.max[i]=.4+Math.random()*(burst?1:.7);this.color.setHex((COLORS[this.skin]||[0xff733c,0xffdb8e])[i%2]);this.color.toArray(this.colors,j);}
 update(dt,position,normal,grounded=true){
  const palette=COLORS[this.skin];this.points.visible=!!palette||this.life.some(v=>v>0);this.accumulator+=dt*(palette?65:0);while(this.accumulator>=1){this.accumulator--;this.spawn(position,normal);}
  for(let i=0;i<this.count;i++){this.life[i]=Math.max(0,this.life[i]-dt);this.sizes[i]=this.life[i]>0?(this.skin==='inferno'?.24:.12)*(this.life[i]/this.max[i]):0;for(let a=0;a<3;a++)this.p[i*3+a]+=this.v[i*3+a]*dt;}
  for(const name of ['position','color','aSize'])this.geometry.attributes[name].needsUpdate=true;
  const surfaceSkin=this.skin==='inferno'||this.skin==='frost';if(surfaceSkin&&grounded&&position.distanceToSquared(this.last)>.018){const i=this.trailCursor++%96;this.trailAge[i]=3.5;this.trailPositions[i].copy(position).addScaledVector(normal,-.308);this.trailRotations[i].setFromUnitVectors(new THREE.Vector3(0,0,1),normal);this.last.copy(position);this.trails.setColorAt(i,this.color.setHex(palette[0]));this.trails.instanceColor.needsUpdate=true;}
  this.trails.visible=surfaceSkin;for(let i=0;i<96;i++){this.trailAge[i]=Math.max(0,this.trailAge[i]-dt);this.dummy.position.copy(this.trailPositions[i]);this.dummy.quaternion.copy(this.trailRotations[i]);this.dummy.scale.setScalar(Math.min(1,this.trailAge[i]/1.5));this.dummy.updateMatrix();this.trails.setMatrixAt(i,this.dummy.matrix);}this.trails.instanceMatrix.needsUpdate=true;
 }
 dispose(){for(const r of [this.geometry,this.material,this.trailGeo,this.trailMat,this.trails])r.dispose();this.points.removeFromParent();this.trails.removeFromParent();}
}

export function portalMaterial(){return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{uTime:{value:0},uUnlocked:{value:0}},vertexShader:`varying vec2 vUv;varying vec3 vView;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec2 vUv;varying vec3 vView;uniform float uTime;uniform float uUnlocked;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){vec2 p=(vUv-.5)*2.;float r=length(p);if(r>1.)discard;vec2 q=p+vView.xy*.15;float a=atan(q.y,q.x);float vortex=sin(a*5.-r*13.+uTime*1.4);vec3 sky=mix(vec3(.025,.025,.18),vec3(.16,.3,.72),q.y*.5+.5);float horizon=-.32+sin(q.x*5.+uTime*.1)*.12;sky=mix(sky,vec3(.055,.1,.24),1.-smoothstep(horizon,horizon+.03,q.y));float moon=1.-smoothstep(.17,.18,length(q-vec2(.25,.28)));sky+=vec3(.5,.9,1.)*moon;vec2 stars=floor((q+uTime*.003)*70.);sky+=vec3(pow(hash(stars),90.))*.7;float ring=pow(r,7.)*(.6+.4*vortex);sky+=vec3(.08,1.1,.7)*ring;vec3 locked=vec3(.12,.08,.22)+vec3(.35,.13,.5)*pow(abs(sin(q.x*15.)*sin(q.y*15.)),12.);gl_FragColor=vec4(mix(locked,sky,uUnlocked),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});}
