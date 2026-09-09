export function weekKey(value=new Date()) {
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))throw Error('Invalid ranking date.');
  date.setUTCHours(0,0,0,0);
  date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));
  const year=date.getUTCFullYear(),yearStart=new Date(Date.UTC(year,0,1));
  const week=Math.ceil((((date-yearStart)/86400000)+1)/7);
  return `${year}-W${String(week).padStart(2,'0')}`;
}

export function weekLabel(key) {
  const match=String(key||'').match(/^(\d{4})-W(\d{2})$/);
  return match?`WEEK ${Number(match[2])} · ${match[1]}`:String(key||'');
}
