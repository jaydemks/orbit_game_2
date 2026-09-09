import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseSubmission,validateReplay } from '../src/replay.js';
import { storeVerified } from './rankings-store.mjs';

const githubAPI=async(method,path,data)=>{
  const response=await fetch(`https://api.github.com/repos/jaydemks/orbit_game_2/${path}`,{
    method,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:data?JSON.stringify(data):undefined,
  });
  if(!response.ok){const error=Error(`GitHub request failed (${response.status})`);error.status=response.status;throw error;}
  return response.status===204?null:response.json();
};
export async function processSubmission(event,api) {
const issue=event.issue;
if(!issue||!issue.title?.startsWith('[ORBIT RUN]'))return {status:'ignored'};
let parsed,result;
try {
  if(issue.user?.type!=='User'||!Number.isSafeInteger(issue.user.id)||!issue.user.login)throw Error('A GitHub account is required.');
  parsed=parseSubmission(issue.body);result=validateReplay(parsed.replay);
} catch {
  await api('POST',`issues/${issue.number}/comments`,{body:'This run could not be validated. Reload ORBIT 2, complete a level and use **Submit verified run**. The replay must be complete and use the current ruleset. No score was added.'});
  await api('PATCH',`issues/${issue.number}`,{state:'closed',state_reason:'not_planned'});
  return {status:'rejected'};
}
const digest=createHash('sha256').update(JSON.stringify(parsed.replay)).digest('hex');
const improved=await storeVerified(api,result,{id:issue.user.id,login:issue.user.login,alias:parsed.alias},issue.number,digest);
await api('POST',`issues/${issue.number}/comments`,{body:`Replay verified: **${result.score} points**, level ${result.level+1}, ${result.difficulty}. ${improved?'Your personal best was saved.':'Your existing personal best is already equal or better.'}\n\n[View ORBIT 2 rankings](https://jaydemks.github.io/orbit_game_2/) · GitHub identity comes from this issue's author. Validation confirms a legal replay, not that it was played without automation.`});
await api('PATCH',`issues/${issue.number}`,{state:'closed',state_reason:'completed'});
return {status:'verified',improved,result};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.GITHUB_REPOSITORY!=='jaydemks/orbit_game_2')throw Error('Unexpected repository.');
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  await processSubmission(event,githubAPI);
}
