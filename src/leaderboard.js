import { RULESET } from './replay.js';
export const REPOSITORY = 'jaydemks/orbit_game_2';
const DATA_URL = `https://raw.githubusercontent.com/${REPOSITORY}/rankings/leaderboard.json`;
export async function fetchRankings(difficulty='easy') {
  const response=await fetch(DATA_URL,{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Rankings are temporarily unavailable. Please try again.');
  const data=await response.json();
  if(!Array.isArray(data.runs))throw Error('Rankings could not be read.');
  const players=new Map();
  for(const run of data.runs){
    if(run.version!==RULESET||run.difficulty!==difficulty||!Number.isFinite(run.score)||typeof run.username!=='string')continue;
    const player=players.get(run.userId)||{username:run.username,alias:run.alias||'',score:0,levels:0,difficulty,latestIssue:-1};
    if((run.issue||0)>player.latestIssue){player.latestIssue=run.issue||0;player.username=run.username;player.alias=run.alias||'';}
    player.score+=run.score;player.levels++;players.set(run.userId,player);
  }
  return [...players.values()].sort((a,b)=>b.score-a.score||b.levels-a.levels||a.username.localeCompare(b.username)).map((row,i)=>({...row,rank:i+1}));
}
export function submissionBody(replay,alias='') {
  if(alias&&!/^[a-zA-Z0-9 _-]{3,24}$/.test(alias))throw Error('Use 3–24 letters, numbers, spaces, hyphens or underscores.');
  return `Please validate this ORBIT 2 run. My public GitHub account identifies this result.\n\n\`\`\`orbit-run\n${JSON.stringify({alias,replay})}\n\`\`\``;
}
export function submissionURL(replay,alias='') {
  const url=new URL(`https://github.com/${REPOSITORY}/issues/new`);
  url.searchParams.set('title',`[ORBIT RUN] Level ${replay.level+1} · ${replay.difficulty}`);
  url.searchParams.set('body',submissionBody(replay,alias));
  return url.toString();
}
