import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-800.css';
import './style.css';
import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { WorldView, HERO_LEVEL } from './scene.js';
import { UI } from './ui.js';
import { Soundscape } from './audio.js';
import { readProgress, saveProgress, awardCompletion, SKINS } from './progress.js';

const progress = readProgress();
const sound = new Soundscape();
sound.setEnabled(progress.sound);
let view, ui, earned = 0;
const held = new Set();
let inputDelay = 0, jumpBuffer = 0, respawnTimer;
const game = new Game({ onChange: snapshot => ui?.update({...snapshot,earned},progress), onEvent: event => {
  if (event.type === 'start') {
    clearTimeout(respawnTimer); jumpBuffer=0;
    earned = 0;
    view?.setLevel(LEVELS[game.levelIndex]);
    view?.setPlayer(game.cell,game.normal,game.forward,{instant:true});
    view?.setMode('playing');
  }
  if (event.type === 'move' || event.type === 'turn') {
    view?.setPlayer(event.to.cell,event.to.normal,event.to.forward,{jump:event.jump,fall:event.fall,duration:event.duration});
    sound.play(event.jump?'jump':event.type);
  }
  if (event.type === 'respawn') {
    held.clear();jumpBuffer=0;
    respawnTimer=setTimeout(()=>view?.setPlayer(event.to.cell,event.to.normal,event.to.forward,{instant:true}),450);
  }
  if (event.type === 'collect') {
    view?.setCollected(game.collected);
    sound.play(event.item.type);
    if(event.item.type==='key') ui?.toast(game.keys===game.totalKeys?'Portal unlocked. Find the exit!':'Key collected');
    if(event.item.type==='time') ui?.toast('+30 seconds');
    if(event.item.type==='fruit') ui?.toast('Rare fruit · +5 coins');
  }
  if (event.type === 'damage') {
    sound.play('lost'); ui?.toast({fall:'Into the void. Try again!',spike:'Watch out for spikes!',burn:'Too hot! Jump over molten tiles.',timeout:'Time is up!'}[event.reason]);
    document.body.classList.remove('damage-flash');void document.body.offsetWidth;document.body.classList.add('damage-flash');
  }
  if (event.type === 'blocked') {sound.play('exitLocked'); ui?.toast(event.reason==='keys'?`Keys needed to unlock the portal: ${event.remaining}`:'The path is blocked');}
  if (event.type === 'won') {
    earned = awardCompletion(progress,game.levelIndex,game.getSnapshot());
    persist(); sound.play('won'); held.clear();
  }
  if (event.type === 'lost') {sound.play('lost'); held.clear();}
}});

function persist() { if(!saveProgress(progress)) ui?.toast('Local saving is unavailable in this browser'); ui?.setProgress(progress); }
function start(index) {
  sound.unlock(); held.clear();
  const chosen = Number.isInteger(index)?index:game.state==='won'?Math.min(LEVELS.length-1,game.levelIndex+1):progress.unlocked-1;
  if(chosen<0 || chosen>=progress.unlocked || chosen>=LEVELS.length)return;
  game.start(chosen); ui.showScreen('game');
  ui.toast(LEVELS[chosen].subtitle);
}
function menu() {
  clearTimeout(respawnTimer);jumpBuffer=0;
  held.clear(); game.state='menu';
  view?.setMode('menu'); view?.setLevel(HERO_LEVEL);
  view?.setPlayer(HERO_LEVEL.start.cell,HERO_LEVEL.start.normal,HERO_LEVEL.start.forward,{instant:true});
  ui.showScreen('menu'); ui.update({...game.getSnapshot(),earned},progress);
}
function skin(id) {
  sound.unlock();
  const entry = SKINS.find(s=>s.id===id); if(!entry)return;
  if(!progress.owned.includes(id)) {
    if(progress.bank<entry.price) {ui.toast(`You need ${entry.price-progress.bank} more coins`);return;}
    progress.bank-=entry.price; progress.owned.push(id); sound.play('buy');
  }
  progress.skin=id; view?.setSkin(id); persist(); ui.toast('New perspective. New style.');
}
ui = new UI({ onPlay:start,onLevel:start,onSkin:skin,onPause:()=>{held.clear();game.pause(true);},onResume:()=>{game.pause(false);ui.showScreen('game');},onRetry:()=>start(game.levelIndex),onMenu:menu,onSettings:settings=>{
  if(typeof settings.sound==='boolean') { progress.sound=settings.sound;sound.setEnabled(settings.sound);sound.unlock(); }
  if(settings.quality) {progress.quality=settings.quality;view?.setQuality(settings.quality);}
  persist();
}});
try {
  view = new WorldView(document.getElementById('world'));
  view.setQuality(progress.quality);view.setSkin(progress.skin);
  menu();
} catch(error) {
  console.error(error);
  const boot = document.getElementById('boot');
  boot.innerHTML='<strong>Your universe needs WebGL.</strong><small>Enable hardware acceleration in your browser and reload the page.</small>';
  boot.classList.add('boot-error');
}
if(view)document.getElementById('boot')?.remove();

const keymap = {ArrowUp:'forward',KeyW:'forward',ArrowDown:'back',KeyS:'back',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump'};
function control(action) {sound.unlock();if(action==='jump'){if(!game.jump()&&game.state==='playing')jumpBuffer=.32;}else game.move(action);}
window.addEventListener('keydown',event=>{
  if(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)return;
  if(event.code==='Escape') {if(game.state==='playing'){held.clear();game.pause(true);}else if(game.state==='paused'){game.pause(false);ui.showScreen('game');}return;}
  if(event.code==='KeyR'&&game.state==='playing'){start(game.levelIndex);return;}
  const action = keymap[event.code];if(!action||game.state!=='playing')return;
  event.preventDefault();
  if(!event.repeat) {control(action);inputDelay=.25;held.add(action);}
});
window.addEventListener('keyup',event=>held.delete(keymap[event.code]));
window.addEventListener('orbit-control',event=>control(event.detail));
window.addEventListener('blur',()=>{held.clear();game.pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){held.clear();game.pause(true);}});
window.addEventListener('resize',()=>view?.resize());
let last=performance.now(),elapsed=0;
function frame(now) {
  const realDt=Math.min((now-last)/1000,.25),dt=Math.min(realDt,.05);last=now;elapsed+=dt;
  game.update(realDt); inputDelay-=realDt;
  if(jumpBuffer>0) {jumpBuffer-=realDt;if(game.state==='playing'&&game.cooldown<=0){game.jump();jumpBuffer=0;}}
  if(inputDelay<=0&&held.size&&game.state==='playing') { const action=held.has('jump')?'jump':[...held].at(-1); control(action); inputDelay=.12; }
  view?.update(dt,elapsed); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Explicit opt-in harness: no gameplay/debug globals in ordinary sessions.
if(new URLSearchParams(location.search).has('test'))window.__ORBIT__={game,view,progress,start,skin,menu};
