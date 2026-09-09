export function updateBoard(board, result, identity, issue, digest) {
  const runs=Array.isArray(board.runs)?[...board.runs]:[];
  const index=runs.findIndex(r=>r.userId===identity.id&&r.level===result.level&&r.difficulty===result.difficulty&&r.version===result.version);
  const old=runs[index];
  if(old&&(old.score>result.score||old.score===result.score&&old.ticks<=result.ticks))return {board,improved:false};
  const row={...result,userId:identity.id,username:identity.login,alias:identity.alias,issue,digest};
  if(index<0)runs.push(row);else runs[index]=row;
  return {board:{updatedAt:new Date().toISOString(),runs},improved:true};
}

export async function storeVerified(api,result,identity,issue,digest) {
  // Contents API SHA comparison prevents concurrent submissions overwriting one another.
  for(let attempt=0;attempt<5;attempt++){
    const file=await api('GET','contents/leaderboard.json?ref=rankings');
    const content=file.content || (await api('GET',`git/blobs/${file.sha}`)).content;
    const board=JSON.parse(Buffer.from(content,'base64').toString('utf8'));
    const updated=updateBoard(board,result,identity,issue,digest);
    if(!updated.improved)return false;
    try {
      await api('PUT','contents/leaderboard.json',{branch:'rankings',sha:file.sha,message:`Validate ranked run #${issue}`,content:Buffer.from(JSON.stringify(updated.board)).toString('base64')});
      return true;
    } catch(error) {
      if(![409,422].includes(error.status)||attempt===4)throw error;
      await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
    }
  }
}
