import { pathToFileURL } from 'node:url';
import { emptyModeration,fingerprint,isFingerprintBlocked } from './moderation-policy.mjs';
import { normalizeName,validateAlias } from '../src/name-policy.js';

export function applyModeration(board,policy,action,userId,value,options={}) {
  const nextBoard={...board,runs:Array.isArray(board.runs)?board.runs.map(run=>({...run})):[]};
  const nextPolicy={...emptyModeration(),...policy,bannedUserIds:[...(policy.bannedUserIds||[])].map(String),forcedAliases:{...(policy.forcedAliases||{})},blockedAliasFingerprints:[...(policy.blockedAliasFingerprints||[])]};
  const id=String(userId||'').trim();
  if(['remove_run','ban','unban','force_alias','remove_alias','allow_alias'].includes(action)&&!/^[0-9]{1,20}$/.test(id))throw Error('A numeric GitHub user ID is required.');
  if(action==='remove_run'){
    const difficulty=options.difficulty==='extreme'?'extreme':'easy',level=Number(options.level),issue=Number(options.issue);
    if(!Number.isSafeInteger(issue)||issue<1){if(!Number.isSafeInteger(level)||level<1||level>40)throw Error('An issue number, or a level number from 1 to 40, is required.');}
    const before=nextBoard.runs.length;
    nextBoard.runs=nextBoard.runs.filter(run=>!(String(run.userId)===id&&(Number.isSafeInteger(issue)&&issue>0?run.issue===issue:run.difficulty===difficulty&&run.level===level-1)));
    if(nextBoard.runs.length===before)throw Error('No matching ranked run exists for this user.');
  } else if(action==='ban'){
    if(!nextPolicy.bannedUserIds.includes(id))nextPolicy.bannedUserIds.push(id);
    delete nextPolicy.forcedAliases[id];nextBoard.runs=nextBoard.runs.filter(run=>String(run.userId)!==id);
  } else if(action==='unban')nextPolicy.bannedUserIds=nextPolicy.bannedUserIds.filter(entry=>entry!==id);
  else if(action==='force_alias'){
    const check=validateAlias(value);if(!check.ok||!check.alias)throw Error(check.reason||'A safe nickname is required.');
    nextPolicy.forcedAliases[id]=check.alias;
    nextBoard.runs.forEach(run=>{if(String(run.userId)===id)run.alias=check.alias;});
  } else if(action==='remove_alias'){
    nextPolicy.forcedAliases[id]='';
    nextBoard.runs.forEach(run=>{if(String(run.userId)===id)run.alias='';});
  } else if(action==='allow_alias')delete nextPolicy.forcedAliases[id];
  else if(action==='blacklist_term'||action==='unblacklist_term'){
    const term=normalizeName(value);if(term.length<3||term.length>24)throw Error('The normalized blocked term must contain 3–24 letters.');
    const entry={length:term.length,hash:fingerprint(term)};
    if(action==='blacklist_term'){
      if(!nextPolicy.blockedAliasFingerprints.some(item=>item.length===entry.length&&item.hash===entry.hash))nextPolicy.blockedAliasFingerprints.push(entry);
      nextBoard.runs.forEach(run=>{if(run.alias&&isFingerprintBlocked(run.alias,[entry]))run.alias='';});
    } else nextPolicy.blockedAliasFingerprints=nextPolicy.blockedAliasFingerprints.filter(item=>item.length!==entry.length||item.hash!==entry.hash);
  } else throw Error('Unknown moderation action.');
  nextBoard.updatedAt=new Date().toISOString();
  nextPolicy.updatedAt=nextBoard.updatedAt;
  return {board:nextBoard,policy:nextPolicy};
}

const githubAPI=async(method,path,data)=>{
  const response=await fetch(`https://api.github.com/repos/jaydemks/orbit_game_2/${path}`,{method,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:data?JSON.stringify(data):undefined});
  if(!response.ok){const error=Error(`GitHub request failed (${response.status})`);error.status=response.status;throw error;}
  return response.status===204?null:response.json();
};
async function readJSON(path,fallback) {
  try {const file=await githubAPI('GET',`contents/${path}?ref=rankings`);return {sha:file.sha,data:JSON.parse(Buffer.from(file.content,'base64').toString('utf8'))};}
  catch(error){if(error.status===404)return {sha:null,data:fallback};throw error;}
}
async function writeJSON(path,data,sha,message) {
  await githubAPI('PUT',`contents/${path}`,{branch:'rankings',...(sha?{sha}:{}),message,content:Buffer.from(JSON.stringify(data)).toString('base64')});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.env.GITHUB_REPOSITORY!=='jaydemks/orbit_game_2')throw Error('Unexpected repository.');
  const boardFile=await readJSON('leaderboard.json',{updatedAt:null,runs:[]}),policyFile=await readJSON('moderation.json',emptyModeration());
  const result=applyModeration(boardFile.data,policyFile.data,process.env.MODERATION_ACTION,process.env.MODERATION_USER_ID,process.env.MODERATION_VALUE||'',{difficulty:process.env.MODERATION_DIFFICULTY,level:process.env.MODERATION_LEVEL,issue:process.env.MODERATION_ISSUE});
  await writeJSON('moderation.json',result.policy,policyFile.sha,`Moderation: ${process.env.MODERATION_ACTION}`);
  await writeJSON('leaderboard.json',result.board,boardFile.sha,`Apply ranking moderation: ${process.env.MODERATION_ACTION}`);
  console.log(`Applied ${process.env.MODERATION_ACTION}; ${result.board.runs.length} ranked records remain.`);
}
