export const SCORE_RULES=Object.freeze({
  completionBase:1000,
  levelStep:50,
  paceMaximum:1500,
  survival:Object.freeze({1:0,2:300,3:750}),
  difficulty:Object.freeze({easy:1,extreme:1.35}),
  items:Object.freeze({coin:100,key:250,fruit:500,time:50}),
});

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
export function calculateScore({level=0,difficulty='easy',time=0,baseTime=1,lives=1,items={}}={}) {
  level=Math.max(0,Math.floor(finite(level)));
  lives=Math.max(1,Math.min(3,Math.floor(finite(lives,1))));
  const counts=Object.fromEntries(Object.keys(SCORE_RULES.items).map(type=>[type,Math.max(0,Math.floor(finite(items[type])))]));
  const completion=SCORE_RULES.completionBase+level*SCORE_RULES.levelStep;
  const collectibles=Object.entries(SCORE_RULES.items).reduce((sum,[type,value])=>sum+counts[type]*value,0);
  const available=Math.max(1,finite(baseTime,1)+counts.time*30);
  const pace=Math.floor(SCORE_RULES.paceMaximum*Math.max(0,Math.min(1,finite(time)/available)));
  const survival=SCORE_RULES.survival[lives];
  const multiplier=SCORE_RULES.difficulty[difficulty]||1;
  const subtotal=completion+collectibles+pace+survival;
  return {completion,collectibles,pace,survival,multiplier,subtotal,total:Math.round(subtotal*multiplier),counts};
}
