import { Game } from './game.js';
import { LEVELS } from './levels.js';

export const RULESET = 'orbit2-2026-09-expeditions';
export const STEP = 1 / 60;
export const MAX_TICKS = 72000;
export const MAX_EVENTS = 3500;
const ACTIONS = ['forward','back','left','right','jump'];
const INPUTS = ['forward','back','left','right'];
const unpack = mask => Object.fromEntries(INPUTS.map((key,i)=>[key,!!(mask & (1<<i))]));

export class RunRecorder {
  constructor(game) { this.game=game; this.reset(); }
  reset() { this.tick=0;this.events=[];this.mask=0;this.overflow=false;this.completed=null; }
  start() { this.reset();this.level=this.game.levelIndex;this.difficulty=this.game.difficulty; }
  record(code) { if(this.events.length>=MAX_EVENTS){this.overflow=true;return;}this.events.push([this.tick,code]); }
  action(action) {
    if(this.game.state!=='playing')return false;
    const code=ACTIONS.indexOf(action);if(code<0)return false;
    const before=this.events.length;this.record(code);
    const accepted=action==='jump'?this.game.jump():this.game.move(action);
    if(!accepted&&this.events.length>before)this.events.pop();
    return accepted;
  }
  input(input) {
    const mask=INPUTS.reduce((value,key,i)=>value | (input[key]?1<<i:0),0);
    if(this.game.state==='playing'&&this.difficulty==='extreme'&&mask!==this.mask){this.record(16+mask);this.mask=mask;}
    this.game.setInput(input);
  }
  update() {
    if(this.game.state!=='playing')return;
    this.tick++;if(this.tick>MAX_TICKS)this.overflow=true;
    this.game.update(STEP);
  }
  export() {
    if(this.overflow||this.game.state!=='won')return null;
    return {version:RULESET,level:this.level,difficulty:this.difficulty,ticks:this.tick,events:this.events.map(e=>[...e])};
  }
}

export function validateReplay(replay) {
  if(!replay||replay.version!==RULESET)throw Error('This run uses an older ruleset. Reload the game and try again.');
  if(!Number.isInteger(replay.level)||replay.level<0||replay.level>=LEVELS.length)throw Error('Invalid level.');
  if(!['easy','extreme'].includes(replay.difficulty))throw Error('Invalid difficulty.');
  if(!Number.isInteger(replay.ticks)||replay.ticks<0||replay.ticks>MAX_TICKS)throw Error('Invalid duration.');
  if(!Array.isArray(replay.events)||replay.events.length>MAX_EVENTS)throw Error('Replay is too large.');
  let previous=-1;
  for(const event of replay.events){
    if(!Array.isArray(event)||event.length!==2)throw Error('Invalid command.');
    const [tick,code]=event;
    if(!Number.isInteger(tick)||tick<previous||tick<0||tick>replay.ticks||!Number.isInteger(code)||!(code>=0&&code<=4||code>=16&&code<=31))throw Error('Invalid command order.');
    previous=tick;
  }
  const game=new Game();game.setDifficulty(replay.difficulty);game.start(replay.level);
  let cursor=0;
  for(let tick=0;tick<=replay.ticks;tick++){
    while(cursor<replay.events.length&&replay.events[cursor][0]===tick){
      if(game.state!=='playing')throw Error('Commands after the run finished.');
      const code=replay.events[cursor++][1];
      if(code>=16)game.setInput(unpack(code-16));
      else if(code===4)game.jump();else game.move(ACTIONS[code]);
    }
    if(tick===replay.ticks)break;
    if(game.state!=='playing')throw Error('Invalid finish time.');
    game.update(STEP);
  }
  if(game.state!=='won'||game.lives<1||game.keys!==game.totalKeys)throw Error('Replay does not complete this level.');
  const snapshot=game.getSnapshot();
  return {level:replay.level,difficulty:replay.difficulty,score:snapshot.score,lives:snapshot.lives,time:Math.round(snapshot.time*100)/100,ticks:replay.ticks,version:RULESET};
}

export function parseSubmission(body) {
  if(typeof body!=='string'||body.length>60000)throw Error('Submission is too large.');
  const match=body.match(/```orbit-run\s*\n([\s\S]*?)\n```/);
  if(!match)throw Error('No replay found. Use Submit verified run after completing a level.');
  const data=JSON.parse(match[1]);
  if(data.alias!==undefined&&data.alias!==''&&(typeof data.alias!=='string'||!/^[a-zA-Z0-9 _-]{3,24}$/.test(data.alias)))throw Error('Nickname must contain 3–24 letters, numbers, spaces, hyphens or underscores.');
  return {replay:data.replay,alias:data.alias||''};
}
