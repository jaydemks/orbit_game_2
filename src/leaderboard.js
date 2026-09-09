import { RULESET } from './replay.js';
import { validateAlias } from './name-policy.js';
export const REPOSITORY = 'jaydemks/orbit_game_2';
const DATA_URL = `https://raw.githubusercontent.com/${REPOSITORY}/rankings/leaderboard.json`;
let rankingsCache=null,rankingsPromise=null,cacheTime=0;
async function loadRuns() {
  if(rankingsCache&&Date.now()-cacheTime<30000)return rankingsCache;
  if(!rankingsPromise)rankingsPromise=(async()=>{
    const response=await fetch(DATA_URL,{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Rankings are temporarily unavailable. Please try again.');
    const data=await response.json();
    if(!Array.isArray(data.runs))throw Error('Rankings could not be read.');
    rankingsCache=data.runs;cacheTime=Date.now();return rankingsCache;
  })();
  try{return await rankingsPromise;}finally{rankingsPromise=null;}
}
export async function fetchRankings(difficulty='easy') {
  const runs=await loadRuns();
  const players=new Map();
  for(const run of runs){
    if(run.version!==RULESET||run.difficulty!==difficulty||!Number.isSafeInteger(run.userId)||!Number.isFinite(run.score)||typeof run.username!=='string'||!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(run.username))continue;
    const checked=validateAlias(run.alias||'');
    const alias=checked.ok?checked.alias:'';
    const player=players.get(run.userId)||{username:run.username,alias,score:0,levels:0,difficulty,latestIssue:-1};
    if((run.issue||0)>player.latestIssue){player.latestIssue=run.issue||0;player.username=run.username;player.alias=alias;}
    player.score+=run.score;player.levels++;players.set(run.userId,player);
  }
  return [...players.values()].sort((a,b)=>b.score-a.score||b.levels-a.levels||a.username.localeCompare(b.username)).map((row,i)=>({...row,rank:i+1}));
}
export async function fetchAllRankings() {
  const [easy,extreme]=await Promise.all([fetchRankings('easy'),fetchRankings('extreme')]);
  return {easy,extreme};
}
export function submissionBody(replay,alias='') {
  const checked=validateAlias(alias);
  if(!checked.ok)throw Error(checked.reason);
  return `Please queue this ORBIT 2 run for owner review. I understand that my public GitHub account identifies this result.\n\n\`\`\`orbit-run\n${JSON.stringify({alias:checked.alias,replay})}\n\`\`\``;
}
export function submissionURL(replay,alias='') {
  const url=new URL(`https://github.com/${REPOSITORY}/issues/new`);
  url.searchParams.set('title',`[ORBIT RUN] Level ${replay.level+1} · ${replay.difficulty}`);
  url.searchParams.set('body',submissionBody(replay,alias));
  return url.toString();
}
