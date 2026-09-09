const BLOCKED = [
  'fuck','shit','cunt','bitch','asshole','nigger','nazi','hitler','whore','slut',
  'cazzo','merda','stronzo','puttana','vaffanculo','coglione','bastardo','troia',
];
const RESERVED = ['admin','administrator','moderator','githubstaff','orbitadmin','orbitofficial','orbitdeveloper'];
const LEET = Object.freeze({'0':'o','1':'i','2':'z','3':'e','4':'a','5':'s','6':'g','7':'t','8':'b','9':'g'});

export function normalizeName(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[0-9]/g,character=>LEET[character]).replace(/[^a-z]/g,'');
}

export function moderationVariants(value) {
  const normalized=normalizeName(value);
  return [normalized,normalized.replace(/(.)\1+/g,'$1')];
}

export function validateAlias(value,extraTerms=[]) {
  const alias=String(value ?? '').trim();
  if(!alias)return {ok:true,alias:''};
  if(!/^[a-zA-Z0-9 _-]{3,24}$/.test(alias))return {ok:false,reason:'Use 3–24 letters, numbers, spaces, hyphens or underscores.'};
  const variants=moderationVariants(alias),terms=[...BLOCKED,...extraTerms].map(normalizeName).filter(Boolean);
  if(variants.some(name=>RESERVED.some(term=>name===term||name.startsWith(term))))return {ok:false,reason:'This display name could be mistaken for an official account.'};
  if(variants.some(name=>terms.some(term=>name.includes(term)||name.replace(/(.)\1+/g,'$1').includes(term.replace(/(.)\1+/g,'$1')))))return {ok:false,reason:'Please choose a different display name.'};
  return {ok:true,alias};
}

