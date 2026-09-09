import { createHash } from 'node:crypto';
import { normalizeName,validateAlias } from '../src/name-policy.js';

export const emptyModeration=()=>({version:1,bannedUserIds:[],forcedAliases:{},blockedAliasFingerprints:[]});
export const fingerprint=value=>createHash('sha256').update(normalizeName(value)).digest('hex');
export function isFingerprintBlocked(alias,entries=[]) {
  const normalized=normalizeName(alias);
  return entries.some(entry=>{
    const length=Math.max(1,Math.floor(Number(entry?.length)||0));
    if(!/^[a-f0-9]{64}$/.test(entry?.hash||'')||length>normalized.length)return false;
    for(let index=0;index<=normalized.length-length;index++)if(fingerprint(normalized.slice(index,index+length))===entry.hash)return true;
    return false;
  });
}
export function moderateIdentity(identity,policy=emptyModeration()) {
  const id=String(identity.id);
  if((policy.bannedUserIds||[]).map(String).includes(id))return {ok:false,reason:'This GitHub account is not eligible for ORBIT 2 rankings.'};
  const forced=Object.prototype.hasOwnProperty.call(policy.forcedAliases||{},id);
  const alias=forced?String(policy.forcedAliases[id]||''):String(identity.alias||'');
  const check=validateAlias(alias);
  if(!check.ok||isFingerprintBlocked(alias,policy.blockedAliasFingerprints))return {ok:false,reason:check.reason||'Please choose a different display name.'};
  return {ok:true,alias:check.alias,forced};
}
