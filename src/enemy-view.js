import * as THREE from 'three';
// All sentinels share four batches, irrespective of actor count.
export class EnemyView {
 constructor(scene){
  this.group=new THREE.Group();this.group.name='Sentinels and attack telegraphs';scene.add(this.group);this.state=[];this.dummy=new THREE.Object3D();this.color=new THREE.Color();this.up=new THREE.Vector3(0,1,0);this.v=new THREE.Vector3();
  const mesh=(geo,mat,count)=>{const m=new THREE.InstancedMesh(geo,mat,count);m.frustumCulled=false;m.count=0;this.group.add(m);return m;};
  this.bodies=mesh(new THREE.IcosahedronGeometry(.29,1),new THREE.MeshStandardMaterial({color:0x352b49,metalness:.8,roughness:.24,emissive:0x5c1633,emissiveIntensity:.4}),8);
  this.spines=mesh(new THREE.ConeGeometry(.08,.37,4),new THREE.MeshStandardMaterial({color:0xbd7a91,metalness:.8,roughness:.2}),48);
  this.rings=mesh(new THREE.RingGeometry(.55,.67,48),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}),8);
  this.beams=mesh(new THREE.CylinderGeometry(.055,.13,1,8),new THREE.MeshBasicMaterial({color:0xff3c56,transparent:true,opacity:.85,depthWrite:false}),8);
 }
 set(enemies){this.state=enemies||[];}
 update(time){let body=0,spine=0,ring=0,beam=0;for(const e of this.state.slice(0,8)){
  const normal=this.v.fromArray(e.normal);const p=new THREE.Vector3().fromArray(e.position);const target=new THREE.Vector3().fromArray(e.target);const attack=e.phase==='attack',warning=e.phase==='warning';
  this.dummy.position.copy(p).addScaledVector(normal,Math.sin(time*3+body)*.06);this.dummy.quaternion.setFromUnitVectors(this.up,normal);this.dummy.rotateY(time*.7);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.bodies.setMatrixAt(body++,this.dummy.matrix);
  for(let j=0;j<6;j++){const a=j/6*Math.PI*2;this.dummy.position.copy(p);this.dummy.quaternion.setFromUnitVectors(this.up,normal);this.dummy.rotateY(a+time*.7);this.dummy.translateX(.32);this.dummy.rotateZ(-Math.PI/2);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.spines.setMatrixAt(spine++,this.dummy.matrix);}
  this.dummy.position.copy(target).addScaledVector(normal,.015);this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);this.dummy.scale.setScalar(warning?1+Math.sin(time*14)*.12:attack?1.13:1);this.dummy.updateMatrix();this.rings.setMatrixAt(ring,this.dummy.matrix);this.rings.setColorAt(ring++,this.color.setHex(attack?0xff2048:warning?0xffae22:0x765986));
  if(attack){const direction=new THREE.Vector3().subVectors(p,target);this.dummy.position.copy(p).add(target).multiplyScalar(.5);this.dummy.quaternion.setFromUnitVectors(this.up,direction.clone().normalize());this.dummy.scale.set(1,direction.length(),1);this.dummy.updateMatrix();this.beams.setMatrixAt(beam++,this.dummy.matrix);}
 }
 for(const [mesh,count] of [[this.bodies,body],[this.spines,spine],[this.rings,ring],[this.beams,beam]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}if(this.rings.instanceColor)this.rings.instanceColor.needsUpdate=true;
 }
 dispose(){this.group.children.forEach(m=>{m.geometry.dispose();m.material.dispose();m.dispose();});this.group.removeFromParent();}
}
