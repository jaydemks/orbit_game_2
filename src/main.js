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
import musicTracks from 'virtual:orbit-music';
import { readProgress, saveProgress, awardCompletion, SKINS } from './progress.js';
import { loading } from './loading.js';
import { RunRecorder,STEP } from './replay.js';
import { fetchRankings,fetchAllRankings,submissionURL,submissionBody,REPOSITORY } from './leaderboard.js';

const progress = readProgress();
const sound = new Soundscape(musicTracks);
sound.setEnabled(progress.sound);
sound.setVolumes(progress);
let view, ui, earned = 0;
let recorder,finishedRun=null,simulationAccumulator=0,rankingsRequest=0;
const held = new Set();
const touchHeld = new Set();
let transitionRemaining = 0, respawnPose = null;
let inputDelay = 0, jumpBuffer = 0, respawnTimer;
let loadingBusy = true, last=performance.now(),elapsed=0;
const game = new Game({ onChange: snapshot => { if (!transitionRemaining) ui?.update({...snapshot,earned},progress); }, onEvent: event => {
  if (event.type === 'start') {
    recorder?.start();finishedRun=null;simulationAccumulator=0;ui?.setSubmission({available:false});
    document.querySelector('.pause-button')?.removeAttribute('disabled');
    clearTimeout(respawnTimer); jumpBuffer=0; transitionRemaining=0; respawnPose=null;touchHeld.clear();
    earned = 0;
    view?.setLevel(LEVELS[game.levelIndex]);
    view?.setEnemies(game.getEnemies?.()||[]);
    view?.setPlayer(game.cell,game.normal,game.forward,{instant:true});
    view?.setMode('playing');
  }
  if (event.type === 'move' || event.type === 'turn') {
    view?.setPlayer(event.to.cell,event.to.normal,event.to.forward,{jump:event.jump,fall:event.fall,duration:event.duration});
    sound.play(event.jump?'jump':event.type);
  }
  if (event.type === 'respawn') {
    held.clear();touchHeld.clear();jumpBuffer=0;
    respawnPose=event.to;
  }
  if (event.type === 'collect') {
    view?.setCollected(game.collected);
    sound.play(event.item.type);
    if(event.item.type==='key') ui?.toast(game.keys===game.totalKeys?'Portal unlocked. Find the exit!':'Key collected');
    if(event.item.type==='time') ui?.toast('+30 seconds');
    if(event.item.type==='fruit') ui?.toast('Rare fruit · +5 coins');
  }
  if (event.type === 'damage') {
    document.querySelector('.pause-button')?.setAttribute('disabled','');
    transitionRemaining=view?.transition(event.reason,{skin:progress.skin}) || 1.5; held.clear();touchHeld.clear();jumpBuffer=0;
    sound.play('lost'); ui?.toast({fall:'Into the void. Try again!',spike:'Watch out for spikes!',burn:'Too hot! Jump over molten tiles.',timeout:'Time is up!',enemy:progress.skin==='classic'?'Punctured! Watch the sentinel warning.':'Shattered! Move out of the warning zone.'}[event.reason]);
  }
  if (event.type === 'blocked') {sound.play('exitLocked'); ui?.toast(event.reason==='keys'?`Keys needed to unlock the portal: ${event.remaining}`:'The path is blocked');}
  if (event.type === 'won') {
    finishedRun=recorder?.export();ui?.setSubmission({available:!!finishedRun,message:finishedRun?'Optional: publish your verified personal best.':'This run is too long to submit. You can still keep playing.'});
    document.querySelector('.pause-button')?.setAttribute('disabled','');
    transitionRemaining=view?.transition('won') || 1.8;touchHeld.clear();jumpBuffer=0;
    earned = awardCompletion(progress,game.levelIndex,game.getSnapshot());
    persist(); sound.play('won'); held.clear();
  }
  if (event.type === 'lost') {sound.play('lost'); held.clear();}
  if (event.type === 'jump') sound.play('jump');
  if (event.type === 'enemy-warning') {sound.play('exitLocked');ui?.toast('Sentinel charging! Leave the marked surface or jump.');}
}});
recorder=new RunRecorder(game);

async function leaderboard(difficulty='easy') {
  const request=++rankingsRequest;ui.setLeaderboard({status:'loading',rows:[]});
  try {const rows=await fetchRankings(difficulty);if(request===rankingsRequest)ui.setLeaderboard({status:'ready',rows});}
  catch(error){if(request===rankingsRequest)ui.setLeaderboard({status:'error',rows:[],message:error.message});}
}
async function featureTopExplorer() {
  try {
    const groups=await fetchAllRankings();
    const candidates=[groups.easy[0],groups.extreme[0]].filter(Boolean);
    candidates.sort((a,b)=>b.score-a.score||b.levels-a.levels||a.username.localeCompare(b.username));
    ui.setFeaturedLeaderboard(candidates[0]||null);
  } catch { ui.setFeaturedLeaderboard(null); }
}
function submitScore({identity,alias}) {
  if(!finishedRun)return;
  try {
    const name=identity==='alias'?alias.trim():'';
    const url=submissionURL(finishedRun,name);
    if(url.length<7000){window.open(url,'_blank','noopener,noreferrer');ui.toast('Confirm your optional submission on GitHub.');return;}
    const body=submissionBody(finishedRun,name);
    const copy=navigator.clipboard?.writeText(body)||Promise.reject(Error('Clipboard unavailable'));
    const target=new URL(`https://github.com/${REPOSITORY}/issues/new`);target.searchParams.set('title','[ORBIT RUN] Replay submission');target.searchParams.set('body','Paste the complete replay text copied by ORBIT 2 here, then submit this issue.');
    window.open(target.toString(),'_blank','noopener,noreferrer');
    copy.then(()=>{
      ui.toast('Replay copied. Paste it into the GitHub issue body and submit.');
    }).catch(()=>{
      const link=document.createElement('a');const blob=URL.createObjectURL(new Blob([body],{type:'text/plain'}));link.href=blob;link.download='orbit-ranked-run.txt';link.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);
      ui.toast('Replay downloaded. Paste its text into a new GitHub issue titled [ORBIT RUN].');
    });
  } catch(error){ui.toast(error.message);}
}

function persist() { if(!saveProgress(progress)) ui?.toast('Local saving is unavailable in this browser'); ui?.setProgress(progress); }
async function prepareScene(label,build) {
  loadingBusy=true;held.clear();touchHeld.clear();loading.show(label);
  try {
    await loading.paint();build();loading.set(.2,'Preparing materials');await loading.paint();
    await view.prepare((fraction,stage)=>loading.set(.2+fraction*.78,stage));
    loading.set(1,'Ready to explore');await loading.paint();
    last=performance.now();simulationAccumulator=0;loadingBusy=false;loading.hide();return true;
  } catch(error) {console.error(error);loading.fail('This world could not be prepared. Reload to try again.');return false;}
}
async function start(index) {
  if(loadingBusy)return;
  sound.unlock(); held.clear();
  const chosen = Number.isInteger(index)?index:game.state==='won'?Math.min(LEVELS.length-1,game.levelIndex+1):progress.unlocked-1;
  if(chosen<0 || chosen>=progress.unlocked || chosen>=LEVELS.length)return;
  if(await prepareScene(`Building ${LEVELS[chosen].name}`,()=>{game.setDifficulty(progress.difficulty);game.start(chosen);ui.showScreen('game');}))ui.toast(LEVELS[chosen].subtitle);
}
function buildMenu() {
  clearTimeout(respawnTimer);jumpBuffer=0;transitionRemaining=0;respawnPose=null;touchHeld.clear();
  held.clear(); game.state='menu';
  view?.setMode('menu'); view?.setLevel(HERO_LEVEL);
  view?.setEnemies([]);
  view?.setPlayer(HERO_LEVEL.start.cell,HERO_LEVEL.start.normal,HERO_LEVEL.start.forward,{instant:true});
  ui.showScreen('menu'); ui.update({...game.getSnapshot(),earned},progress);
}
async function menu() {if(!loadingBusy)await prepareScene('Returning to your universe',buildMenu);}
async function skin(id) {
  if(loadingBusy)return;
  sound.unlock();
  const entry = SKINS.find(s=>s.id===id); if(!entry)return;
  if(!progress.owned.includes(id)) {
    if(progress.bank<entry.price) {ui.toast(`You need ${entry.price-progress.bank} more coins`);return;}
    progress.bank-=entry.price; progress.owned.push(id); sound.play('buy');
  }
  progress.skin=id;persist();
  if(await prepareScene('Polishing your new material',()=>view.setSkin(id)))ui.toast('New perspective. New style.');
}
ui = new UI({ onLeaderboard:leaderboard,onSubmitScore:submitScore,onPlay:start,onLevel:start,onSkin:skin,onPause:()=>{held.clear();touchHeld.clear();if(!transitionRemaining)game.pause(true);},onResume:()=>{game.pause(false);ui.showScreen('game');},onRetry:()=>start(game.levelIndex),onMenu:menu,onSettings:settings=>{
  if(typeof settings.sound==='boolean') { progress.sound=settings.sound;sound.setEnabled(settings.sound);sound.unlock(); }
  if(settings.quality) {progress.quality=settings.quality;view?.setQuality(settings.quality);}
  if(settings.difficulty) progress.difficulty=settings.difficulty==='extreme'?'extreme':'easy';
  for(const key of ['musicVolume','effectsVolume'])if(typeof settings[key]==='number')progress[key]=Math.max(0,Math.min(1,settings[key]));
  sound.setVolumes(progress);
  persist();
}});
try {
  loading.show('Creating your universe');await loading.paint();
  view = new WorldView(document.getElementById('world'));
  view.setQuality(progress.quality);view.setSkin(progress.skin);
  await prepareScene('Building the sanctuary',buildMenu);
  if(!new URLSearchParams(location.search).has('test')||new URLSearchParams(location.search).has('rankings'))featureTopExplorer();
} catch(error) {
  console.error(error);
  loading.fail('Unable to start WebGL. Enable hardware acceleration and reload.');
}

const keymap = {ArrowUp:'forward',KeyW:'forward',ArrowDown:'back',KeyS:'back',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump'};
function control(action) {if(loadingBusy||transitionRemaining)return;sound.unlock();if(action==='jump'){if(!recorder.action('jump')&&game.state==='playing')jumpBuffer=.32;}else recorder.action(action);}
window.addEventListener('keydown',event=>{
  if(loadingBusy||transitionRemaining)return;
  if(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)return;
  if(event.code==='Escape') {if(game.state==='playing'){held.clear();game.pause(true);}else if(game.state==='paused'){game.pause(false);ui.showScreen('game');}return;}
  if(event.code==='KeyR'&&game.state==='playing'){start(game.levelIndex);return;}
  const action = keymap[event.code];if(!action||game.state!=='playing')return;
  event.preventDefault();
  if(!event.repeat) {control(action);inputDelay=.25;held.add(action);}
});
window.addEventListener('keyup',event=>held.delete(keymap[event.code]));
window.addEventListener('orbit-control',event=>control(event.detail));
window.addEventListener('orbit-input',event=>{const {action,pressed}=event.detail;if(pressed&&!loadingBusy&&!transitionRemaining)touchHeld.add(action);else touchHeld.delete(action);});
window.addEventListener('blur',()=>{held.clear();touchHeld.clear();if(!loadingBusy&&!transitionRemaining)game.pause(true);});
document.addEventListener('visibilitychange',()=>{sound.setHidden(document.hidden);if(document.hidden){held.clear();touchHeld.clear();if(!loadingBusy&&!transitionRemaining)game.pause(true);}});
window.addEventListener('resize',()=>view?.resize());
function frame(now) {
  const realDt=Math.min((now-last)/1000,.25),dt=Math.min(realDt,.05);last=now;elapsed+=dt;
  if(loadingBusy||document.hidden){requestAnimationFrame(frame);return;}
  if (transitionRemaining>0) {
    transitionRemaining=Math.max(0,transitionRemaining-realDt);
    if (!transitionRemaining) {
      document.querySelector('.pause-button')?.removeAttribute('disabled');
      if(respawnPose&&game.state==='playing') {view.setPlayer(respawnPose.cell,respawnPose.normal,respawnPose.forward,{instant:true});respawnPose=null;}
      ui.update({...game.getSnapshot(),earned},progress);
    }
    view?.update(dt,elapsed);requestAnimationFrame(frame);return;
  }
  recorder.input(Object.fromEntries(['forward','back','left','right'].map(action=>[action,held.has(action)||touchHeld.has(action)])));
  if(game.state==='playing'){
    simulationAccumulator+=realDt;
    while(simulationAccumulator>=STEP){simulationAccumulator-=STEP;recorder.update();if(transitionRemaining||game.state!=='playing'){simulationAccumulator=0;break;}}
  } else simulationAccumulator=0;
  inputDelay-=realDt;
  view?.setEnemies(['playing','paused'].includes(game.state)?game.getEnemies?.()||[]:[]);
  const physicalPose=game.getPhysicalPose();if(physicalPose&&!transitionRemaining&&['playing','paused'].includes(game.state))view?.setPhysicalPose({...physicalPose,grounded:!physicalPose.airborne});
  if(jumpBuffer>0) {jumpBuffer-=realDt;if(game.state==='playing'&&game.cooldown<=0){recorder.action('jump');jumpBuffer=0;}}
  if(game.difficulty!=='extreme'&&inputDelay<=0&&held.size&&game.state==='playing') { const action=held.has('jump')?'jump':[...held].at(-1); control(action); inputDelay=.12; }
  view?.update(dt,elapsed);view?.sampleFrame(realDt*1000);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Explicit opt-in harness: no gameplay/debug globals in ordinary sessions.
if(new URLSearchParams(location.search).has('test'))window.__ORBIT__={game,view,progress,start,skin,menu,sound,recorder};
