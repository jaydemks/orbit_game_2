import { LEVELS } from './levels.js';
import { validateAlias } from './name-policy.js';

const SKINS = [
  { id: 'glacier', name: 'Glacier', type: 'Glass / arctic blue', cost: 0 },
  { id: 'sunset', name: 'Sunset', type: 'Glass / sunlit amber', cost: 80 },
  { id: 'obsidian', name: 'Obsidian', type: 'Metal / midnight black', cost: 150 },
  { id: 'pearl', name: 'Pearl', type: 'Ceramic / mother of pearl', cost: 220 },
  { id: 'aurora', name: 'Aurora', type: 'Crystal / iridescent', cost: 350 },
  { id: 'classic', name: 'Classic', type: 'The original / timeless', cost: 100 },
  { id: 'inferno', name: 'Inferno', type: 'Living fire / ember particles', cost: 480 },
  { id: 'frost', name: 'Frost', type: 'Frozen crystal / snowflake trail', cost: 480 },
  { id: 'plasma', name: 'Plasma', type: 'Electric energy / neon sparks', cost: 650 },
  { id: 'stardust', name: 'Stardust', type: 'A tiny galaxy / cosmic trail', cost: 800 },
];
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const githubUser = username => /^[a-zA-Z0-9-]{1,39}$/.test(String(username||''));
const githubLink = (username,label,description='') => githubUser(username) ? `<a href="https://github.com/${encodeURIComponent(username)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(username)} on GitHub" ${description?`title="${esc(description)}"`:''}>${esc(label)} ↗</a>` : esc(label);
function levelPreview(level, index) {
  const palette = [['#ffd582','#f39f56','#c97443'],['#8ce8ee','#4bbec9','#277d9d'],['#bd99ee','#875ac8','#553f94'],['#b8dbff','#8b9bf5','#6365c1']][level.worldIndex ?? 0];
  const project = ([x,y,z]) => [(x-z)*10,(x+z)*5-y*12];
  const cubes = [...level.cubes].sort((a,b) => (a[0]+a[2]-a[1])-(b[0]+b[2]-b[1]));
  const vertices = cubes.flatMap(([x,y,z]) => [[x,y,z],[x+1,y+1,z+1],[x+1,y,z],[x,y+1,z+1]].map(project));
  const xs=vertices.map(p=>p[0]), ys=vertices.map(p=>p[1]), minX=Math.min(...xs)-12,minY=Math.min(...ys)-17,maxX=Math.max(...xs)+12,maxY=Math.max(...ys)+12;
  const face = (points, fill) => `<polygon points="${points.map(project).map(p=>p.join(',')).join(' ')}" fill="${fill}" stroke="${palette[0]}" stroke-width=".32" stroke-linejoin="round"/>`;
  const blocks = cubes.map(([x,y,z]) => face([[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]],palette[1])+face([[x+1,y,z],[x+1,y,z+1],[x+1,y+1,z+1],[x+1,y+1,z]],palette[2])+face([[x,y+1,z],[x+1,y+1,z],[x+1,y+1,z+1],[x,y+1,z+1]],palette[0])).join('');
  const start=level.start.cell, ball=project([start[0]+.5,start[1]+1.3,start[2]+.5]);
  return `<svg class="level-map" viewBox="${minX} ${minY} ${maxX-minX} ${maxY-minY}" aria-hidden="true"><defs><radialGradient id="map-ball-${index}" cx="30%" cy="25%"><stop stop-color="#fff"/><stop offset=".45" stop-color="#c0e6ec"/><stop offset="1" stop-color="#4c8da6"/></radialGradient></defs>${blocks}<circle cx="${ball[0]}" cy="${ball[1]}" r="3.9" fill="url(#map-ball-${index})" stroke="#ffffffa0" stroke-width=".4"/></svg>`;
}

export class UI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.progress = { bank: 0, unlocked: 1, owned: ['glacier'], skin: 'glacier', best: {}, sound: true, quality: 'high', difficulty: 'easy', musicVolume:.35, effectsVolume:.65 };
    this.controlPointers = new Map();
    this.screen = 'menu';
    this.snapshot = {};
    this.leaderboard = {status:'loading',rows:[]};
    this.leaderboardDifficulty = 'easy';
    this.submission = {available:false};
    this.submissionIdentity = 'github';
    this.featuredRanking = null;
    this.root = document.createElement('div');
    this.root.id = 'interface';
    document.body.append(this.root);
    this.root.innerHTML = `
      <header class="topbar"><button class="brand" data-action="menu" aria-label="ORBIT 2, main menu"><span class="brand-mark"></span>ORBIT <span class="brand-sequel">2</span></button>
      <nav class="main-nav" aria-label="Main navigation"><button data-action="menu" data-nav="menu">PLAY</button><button data-action="worlds" data-nav="worlds">WORLDS</button><button data-action="atelier" data-nav="atelier">ATELIER</button><button class="rankings-nav" data-action="leaderboard" data-nav="leaderboard" aria-label="Rankings">RANKINGS</button></nav>
      <div class="header-tools"><span class="bank" title="Available coins"><span class="coin-mark">✦</span><b id="bank">0</b></span><button class="icon-button sound-toggle" data-action="sound" aria-label="Toggle audio">♫</button><button class="icon-button" data-action="settings" aria-label="Settings">⚙</button></div></header>
      <main id="screen-content"></main>
      <div id="game-hud" hidden><div class="hud-level"><span class="eyebrow">YOUR JOURNEY</span><strong id="hud-name">Solstice</strong><small id="hud-count">LEVEL 01</small></div><div class="hud-meters"><div><span>TIME</span><strong id="hud-time">120</strong><progress id="time-progress" max="120" value="120" aria-label="Time remaining"></progress></div><div><span>KEYS</span><strong id="hud-keys">0 / 1</strong><progress id="keys-progress" max="1" value="0" aria-label="Keys collected"></progress></div><div><span>COINS</span><strong id="hud-coins">0</strong></div><div><span>LIVES</span><strong id="hud-lives">3</strong></div><div id="speed-meter" hidden><span>SPEED</span><strong id="hud-speed">0.0</strong></div></div><button class="icon-button pause-button" data-action="pause" aria-label="Pause game">Ⅱ</button><div class="game-guide"><kbd>W</kbd><kbd>S</kbd> roll <span>·</span><kbd>A</kbd><kbd>D</kbd> turn <span>·</span><kbd>SPACE</kbd> jump <span>·</span><kbd>ESC</kbd> pause</div><div class="touch-controls"><button data-control="left" aria-label="Turn left">↶</button><button data-control="forward" aria-label="Forward">↑</button><button data-control="back" aria-label="Backward">↓</button><button data-control="right" aria-label="Turn right">↷</button><button class="touch-jump" data-control="jump">JUMP</button></div></div>
      <div id="dialog-layer" hidden></div><div id="toast" role="status" aria-live="polite"></div>`;
    this.root.addEventListener('click', e => {
      const control = e.target.closest('[data-control]');
      if (control && e.detail === 0 && this.screen === 'playing') window.dispatchEvent(new CustomEvent('orbit-control', { detail: control.dataset.control }));
      const el = e.target.closest('[data-action]');
      if (el && !el.disabled) this.action(el.dataset.action, el.dataset);
    });
    this.root.addEventListener('input', e => {
      if(e.target.id==='score-alias'||e.target.id==='ranking-consent')this.syncSubmission();
      const volume=e.target.dataset.volume;
      if(volume==='musicVolume'||volume==='effectsVolume') {
        const value=Math.max(0,Math.min(1,Number(e.target.value)/100));this.progress[volume]=value;
        this.root.querySelector(`[data-volume-output="${volume}"]`).textContent=`${Math.round(value*100)}%`;
        this.callbacks.onSettings?.({[volume]:value});
      }
    });
    this.root.addEventListener('pointerdown', e => {
      const control = e.target.closest('[data-control]');
      if (!control || this.screen !== 'playing') return;
      e.preventDefault();
      const action = control.dataset.control;
      if (this.controlPointers.has(e.pointerId)) return;
      control.setPointerCapture?.(e.pointerId);
      const entry = { action, element: control, interval: null };
      const alreadyHeld = [...this.controlPointers.values()].some(p => p.action === action);
      this.controlPointers.set(e.pointerId, entry);
      control.classList.add('held');
      if (action === 'jump') window.dispatchEvent(new CustomEvent('orbit-control', { detail: action }));
      else {
        if (!alreadyHeld) window.dispatchEvent(new CustomEvent('orbit-input', { detail: { action, pressed: true } }));
        if ((this.snapshot.difficulty ?? this.progress.difficulty) !== 'extreme') {
          const dispatch = () => { if (this.screen === 'playing') window.dispatchEvent(new CustomEvent('orbit-control', { detail: action })); };
          dispatch(); entry.interval = setInterval(dispatch, 130);
        }
      }
    });
    for (const event of ['pointerup','pointercancel','lostpointercapture']) window.addEventListener(event, e => this.releasePointer(e.pointerId));
    window.addEventListener('blur', () => this.clearControls());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearControls(); });
    this.root.addEventListener('keydown', e => {
      if (!this.dialog) return;
      if (e.key === 'Escape' && ['how', 'settings', 'submit'].includes(this.dialog)) { e.preventDefault(); e.stopPropagation(); this.action('close'); return; }
      if (e.key !== 'Tab') return;
      const buttons = [...this.root.querySelectorAll('#dialog-layer button:not(:disabled), #dialog-layer input:not(:disabled)')].filter(el=>!el.closest('[hidden]'));
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    });
    this.showScreen('menu');
  }

  releasePointer(id) {
    const entry = this.controlPointers.get(id); if (!entry) return;
    clearInterval(entry.interval); this.controlPointers.delete(id);
    if (![...this.controlPointers.values()].some(p => p.action === entry.action)) {
      entry.element.classList.remove('held');
      if (entry.action !== 'jump') window.dispatchEvent(new CustomEvent('orbit-input', { detail: { action: entry.action, pressed: false } }));
    }
  }
  clearControls() { for (const id of [...this.controlPointers.keys()]) this.releasePointer(id); }
  records() { return this.progress.difficulty === 'extreme' ? this.progress.extremeBest || {} : this.progress.best || {}; }
  difficultyPicker() {
    return `<div class="difficulty-picker"><span class="eyebrow">CHOOSE YOUR GRAVITY</span><div class="difficulty-options" role="group" aria-label="Difficulty"><button data-action="difficulty" data-difficulty="easy"><strong>Easy</strong><span>Find your flow</span></button><button data-action="difficulty" data-difficulty="extreme"><strong>Extreme <i>↗</i></strong><span>Feel the momentum</span></button></div><p class="difficulty-description"></p></div>`;
  }

  action(action, data = {}) {
    const cb = this.callbacks;
    if (action === 'play') cb.onPlay?.();
    else if (action === 'menu') { cb.onMenu?.(); this.showScreen('menu'); }
    else if (action === 'worlds' || action === 'atelier') this.showScreen(action);
    else if (action === 'level') cb.onLevel?.(Number(data.level));
    else if (action === 'skin') cb.onSkin?.(data.skin);
    else if (action === 'pause') { cb.onPause?.(); this.showScreen('paused'); }
    else if (action === 'resume') { this.showScreen('playing'); cb.onResume?.(); }
    else if (action === 'retry') cb.onRetry?.();
    else if (action === 'how') this.showDialog('how');
    else if (action === 'close') {if(this.dialog==='submit')this.showDialog('won');else this.closeDialog();}
    else if (action === 'settings') this.showDialog('settings');
    else if (action === 'sound') { this.progress.sound = !this.progress.sound; cb.onSettings?.({ sound: this.progress.sound, quality: this.progress.quality }); this.syncProgress(); if (this.dialog === 'settings') this.showDialog('settings'); }
    else if (action === 'quality') { this.progress.quality = data.quality; cb.onSettings?.({ sound: this.progress.sound, quality: this.progress.quality }); this.showDialog('settings'); }
    else if (action === 'difficulty') { this.clearControls(); this.progress.difficulty = data.difficulty === 'extreme' ? 'extreme' : 'easy'; cb.onSettings?.({difficulty:this.progress.difficulty}); this.syncProgress(); }
    else if (action === 'leaderboard' || action === 'leaderboard-retry' || action === 'leaderboard-mode') {
      this.leaderboardDifficulty = data.mode === 'extreme' ? 'extreme' : data.mode === 'easy' ? 'easy' : action === 'leaderboard' ? this.progress.difficulty : this.leaderboardDifficulty;
      this.leaderboard = {status:'loading',rows:[]};this.showScreen('leaderboard');cb.onLeaderboard?.(this.leaderboardDifficulty);
    }
    else if (action === 'submit-open' && this.submission.available) this.showDialog('submit');
    else if (action === 'submit-identity') {this.submissionIdentity=data.identity==='alias'?'alias':'github';this.syncSubmission();}
    else if (action === 'submit-confirm' && this.submission.available) {
      const alias = this.root.querySelector('#score-alias')?.value.trim() || '';
      const check=validateAlias(this.submissionIdentity==='alias'?alias:'');
      if(!check.ok){this.root.querySelector('#score-alias')?.focus();return;}
      if(!this.root.querySelector('#ranking-consent')?.checked){this.root.querySelector('#ranking-consent')?.focus();return;}
      cb.onSubmitScore?.({identity:this.submissionIdentity,alias:this.submissionIdentity==='alias'?alias:''});
    }
  }

  setLeaderboard(data) {this.leaderboard={status:'ready',rows:[],...data};if(this.screen==='leaderboard')this.renderLeaderboard();}
  setFeaturedLeaderboard(row) {this.featuredRanking=row||null;if(this.screen==='menu')this.showScreen('menu');}
  renderLeaderboard() {
    const data=this.leaderboard, mode=this.leaderboardDifficulty;
    const rows=Array.isArray(data.rows)?data.rows.filter(r=>!r.difficulty||r.difficulty===mode):[];
    const numeric=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');
    const profile = username => githubLink(username,`@${username||'Explorer'}`,'Verified GitHub identity');
    let body = '<div class="rankings-empty" role="status"><span class="rankings-emblem">◎</span><h3>Finding our stars…</h3><p>Loading verified scores.</p></div>';
    if(data.status==='error')body=`<div class="rankings-empty" role="status"><span class="rankings-emblem">↻</span><h3>A little interruption.</h3><p>${esc(data.message||'Rankings are temporarily unavailable. Your local progress is safe.')}</p><button class="secondary-button" data-action="leaderboard-retry">Try again</button></div>`;
    else if(data.status==='ready')body=rows.length?`<div class="rankings-table-wrap"><table class="rankings-table"><caption class="sr-only">${mode==='extreme'?'Extreme':'Easy'} verified rankings</caption><thead><tr><th scope="col">RANK</th><th scope="col">EXPLORER</th><th scope="col">SCORE</th><th scope="col">LEVELS</th></tr></thead><tbody>${rows.map(row=>`<tr><td class="rank-number">${numeric(row.rank)}</td><th scope="row"><strong>${githubLink(row.username,row.alias||row.username||'Explorer','Nickname linked to the verified GitHub profile')}</strong><small>${profile(row.username)}</small></th><td class="rank-score">${numeric(row.score)}</td><td>${numeric(row.levels)} <span class="rank-level-total">/ ${LEVELS.length}</span></td></tr>`).join('')}</tbody></table></div>`:`<div class="rankings-empty" role="status"><span class="rankings-emblem">✦</span><h3>The first star could be you.</h3><p>No verified ${mode==='extreme'?'Extreme':'Easy'} runs yet. Finish a level, then submit your run from the results screen.</p></div>`;
    this.root.querySelector('#screen-content').innerHTML=`<section class="collection-page rankings-page"><div class="collection-heading"><div><span class="eyebrow">REAL RUNS. SHARED ADVENTURES.</span><h2>Make yourself <em>famous.</em></h2><p>Your best verified score per level, added up. Every adventure counts.</p></div><button class="text-button" data-action="menu">← Back to menu</button></div><div class="rankings-toolbar"><div class="segmented" role="group" aria-label="Ranking difficulty"><button class="${mode==='easy'?'active':''}" aria-pressed="${mode==='easy'}" data-action="leaderboard-mode" data-mode="easy">Easy</button><button class="${mode==='extreme'?'active':''}" aria-pressed="${mode==='extreme'}" data-action="leaderboard-mode" data-mode="extreme">Extreme</button></div><span>Separate rankings. Same spirit of adventure.</span></div>${body}<aside class="rankings-explainer"><span>✦</span><p><strong>Your adventure, verified.</strong> Playing is anonymous and needs no account. A GitHub account is only required to submit a ranked run. Use your GitHub username or choose an alias. After completing a level, open the prepared GitHub submission and confirm it there. The owner reviews the queue, then replays valid runs before publication.</p></aside><p class="rankings-credit">ORBIT 2 by <a href="https://github.com/jaydemks" target="_blank" rel="noopener noreferrer">@jaydemks</a> · <a href="https://github.com/jaydemks/orbit_game_2" target="_blank" rel="noopener noreferrer">Explore the project ↗</a></p></section>`;
  }
  setSubmission(data) {this.submission={available:false,...data};this.syncSubmission();}
  syncSubmission() {
    this.root.querySelectorAll('[data-action="submit-open"]').forEach(button=>button.disabled=!this.submission.available);
    this.root.querySelectorAll('.submission-status').forEach(el=>el.textContent=this.submission.message||(this.submission.available?'Continue on GitHub to confirm your submission.':'Complete a recorded run to submit a verified score.'));
    const aliasMode=this.submissionIdentity==='alias';
    this.root.querySelectorAll('[data-action="submit-identity"]').forEach(button=>{const selected=button.dataset.identity===this.submissionIdentity;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
    const field=this.root.querySelector('#alias-field');if(field)field.hidden=!aliasMode;
    const input=this.root.querySelector('#score-alias'),check=validateAlias(aliasMode?(input?.value||''):''),valid=check.ok;
    if(input)input.setAttribute('aria-invalid',String(aliasMode&&!!input.value&&!valid));
    const hint=this.root.querySelector('#alias-hint');if(hint)hint.textContent=!valid?check.reason:'3–24 letters, numbers, spaces, underscores or hyphens. Offensive, deceptive and blacklisted names are rejected.';
    const consent=this.root.querySelector('#ranking-consent');
    const submit=this.root.querySelector('[data-action="submit-confirm"]');if(submit)submit.disabled=!this.submission.available||!valid||!consent?.checked;
  }

  showScreen(name) {
    this.clearControls();
    const aliases = { game: 'playing', play: 'playing', pause: 'paused', win: 'won', complete: 'won', lost: 'lost', gameover: 'lost', levels: 'worlds', shop: 'atelier' };
    name = aliases[name] || name;
    this.screen = name;
    this.root.dataset.screen = name;
    this.closeDialog();
    const content = this.root.querySelector('#screen-content');
    const isGame = ['playing','paused','won','lost'].includes(name);
    this.root.querySelector('.topbar').hidden = isGame;
    this.root.querySelector('#game-hud').hidden = !isGame;
    this.root.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === name));
    if (name === 'menu') {const top=this.featuredRanking,numeric=n=>Math.max(0,Math.floor(Number(n)||0)).toLocaleString('en-US');const feature=top?`<aside class="home-ranking-card"><span class="home-rank-crown">♜</span><div><span class="eyebrow">TOP EXPLORER · ${esc(String(top.difficulty||'easy').toUpperCase())}</span><strong>${githubLink(top.username,top.alias||top.username||'Explorer','Top explorer · verified GitHub profile')}</strong><small>${numeric(top.score)} points · ${numeric(top.levels)} levels</small><button data-action="leaderboard">View verified rankings ↗</button></div></aside>`:`<aside class="hero-caption"><span class="caption-symbol">✳</span><div><span class="eyebrow">WORLD 01 — AURELIA</span><p>Gravity is a matter<br>of perspective.</p></div></aside>`;content.innerHTML = `<section class="hero-copy"><div class="eyebrow hero-eyebrow"><span class="tiny-line"></span>A WHOLE NEW SPIN</div><h1>Small ball.<br><em>Big adventure.</em></h1><p>Wild worlds. Wonderful little detours.<br>Roll, leap and flip gravity on its head.</p>${this.difficultyPicker()}<div class="hero-actions"><button class="primary-button" data-action="play">Start rolling <span>↗</span></button><button class="text-button" data-action="how"><span class="play-circle">▷</span> How to play</button></div><button class="world-preview" data-action="worlds"><span class="preview-number">01 <span>/ 04</span></span><span class="preview-description"><small>YOUR NEXT ADVENTURE</small><strong>Four worlds. Endless wonder.</strong><progress class="campaign-progress" max="${LEVELS.length}" value="0" aria-label="Campaign completion"></progress><small class="campaign-count"></small></span><span class="preview-arrow">↗</span></button></section>${feature}<footer class="menu-footer"><div><kbd>W A S D</kbd><span>to move</span><span class="footer-divider"></span><kbd>SPACE</kbd><span>to jump</span></div><span class="footer-motto">MADE TO GET LOST IN. <span>↗</span></span></footer>`;}
    else if (name === 'worlds') content.innerHTML = `<section class="collection-page"><div class="collection-heading"><div><span class="eyebrow">04 WORLDS · ${LEVELS.length} PERSPECTIVES</span><h2>Beyond the <em>ordinary.</em></h2><p>Every surface is a new possibility.</p><progress class="campaign-progress" max="${LEVELS.length}" value="0" aria-label="Campaign completion"></progress><small class="campaign-count"></small></div><button class="text-button" data-action="menu">← Back to the beginning</button></div><div class="level-grid">${LEVELS.map((level,i) => {const locked = i >= this.progress.unlocked; return `<button class="level-card ${locked ? 'locked' : ''}" data-action="level" data-level="${i}" ${locked?'disabled':''}><span class="level-top"><span>${pad(i+1)}</span><small>${locked ? 'LOCKED' : this.records()[i] ? 'COMPLETED ✓' : 'EXPLORE ↗'}</small></span><div class="level-art">${levelPreview(level,i)}</div><span class="eyebrow">${esc(level.world || ['SOLSTICE','TIDELINE','AFTERGLOW','AETHER'][level.worldIndex ?? 0])}</span><strong>${esc(level.name || `Perspective ${i+1}`)}</strong><span class="level-subtitle">${esc(level.subtitle || 'A new perspective awaits.')}</span></button>`;}).join('')}</div></section>`;
    else if (name === 'atelier') content.innerHTML = `<section class="collection-page"><div class="collection-heading"><div><span class="eyebrow">THE ART OF BEING A SPHERE</span><h2>Your way to <em>shine.</em></h2><p>Collect coins. Find your material.</p></div><button class="text-button" data-action="menu">← Back to the beginning</button></div><div class="skin-grid">${SKINS.map(s => {const owned = this.progress.owned.includes(s.id), selected = this.progress.skin===s.id;return `<article class="skin-card ${selected?'selected':''}"><div class="skin-top"><span class="eyebrow">${s.id==='glacier'?'THE ORIGINAL':'MATERIAL COLLECTION'}</span>${selected?'<span class="selected-tag">EQUIPPED</span>':''}</div><div class="skin-orb ${s.id}"><span></span></div><div class="skin-info"><h3>${s.name}</h3><p>${s.type}</p><button class="skin-button" data-action="skin" data-skin="${s.id}" ${selected?'disabled':''}>${selected?'Selected':owned?'Equip ↗':`✦ ${s.cost} <span>Unlock ↗</span>`}</button></div></article>`;}).join('')}</div><p class="collection-note">Every skin is earned through play. No real-money purchases.</p></section>`;
    else content.innerHTML = '';
    if(name==='leaderboard')this.renderLeaderboard();
    if (name === 'paused' || name === 'won' || name === 'lost') this.showDialog(name);
    this.syncProgress();
  }

  showDialog(type) {
    if (!this.dialog) this.dialogReturnFocus = document.activeElement;
    this.dialog = type;
    const layer = this.root.querySelector('#dialog-layer');
    layer.hidden = false;
    const headings = { how:['A SHIFT IN PERSPECTIVE','There is more<br>than one <em>side.</em>'], settings:['YOUR SPACE','The little <em>details.</em>'], paused:['TAKE A BREATH','The world<br>can <em>wait.</em>'], won:['PERSPECTIVE UNLOCKED','One step<br><em>beyond.</em>'], lost:['TRY A DIFFERENT ANGLE','Another<br><em>possibility.</em>'] };
    const campaignComplete = type === 'won' && this.snapshot.levelIndex >= LEVELS.length - 1;
    const title = type==='submit'?['A VERIFIED PLACE AMONG THE STARS','Make yourself<br><em>famous.</em>']:campaignComplete ? [LEVELS.length + ' LEVELS · A NEW POINT OF VIEW','The world<br>is <em>yours.</em>'] : headings[type] || headings.paused;
    let body = '';
    if (type === 'how') body = `<div class="instructions"><p><b>01</b><span><strong>Roll beyond the edge.</strong>Gravity follows the surface: roll along the sides and underneath each block. The third-person camera follows your turns.</span></p><p><b>02</b><span><strong>Collect every key.</strong>Keys unlock the exit portal. Complete the level to bank your coins and bonuses, then unlock new skins in the Atelier.</span></p><p><b>03</b><span><strong>Jump. Look. Try again.</strong>Easy: press Space to jump two blocks. Extreme: hold forward to accelerate, use back to brake; inertia carries you, and faster jumps travel farther. Missing a landing, touching a hazard or running out of time costs a life. Lose all three and retry. Hourglasses add 30 seconds.</span></p></div><div class="instruction-keys"><span><kbd>W / ↑</kbd> Forward</span><span><kbd>S / ↓</kbd> Backward</span><span><kbd>A D / ← →</kbd> Turn</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>ESC</kbd> Pause</span></div><button class="primary-button full" data-action="close">Got it <span>↗</span></button>`;
    if (type === 'settings') body = `${this.difficultyPicker()}<p class="settings-mode-note">Difficulty changes apply when you start or restart a level.</p><div class="setting-row"><div><strong>Sound</strong><small>Little sounds for every discovery.</small></div><button class="toggle ${this.progress.sound?'on':''}" data-action="sound" aria-label="Audio" aria-pressed="${this.progress.sound}"><span></span></button></div><div class="setting-row"><div><strong>Visual quality</strong><small>Resolution adapts automatically for smoother play.</small></div><div class="segmented"><button class="${this.progress.quality==='balanced'?'active':''}" data-action="quality" data-quality="balanced">Balanced</button><button class="${this.progress.quality==='high'?'active':''}" data-action="quality" data-quality="high">High</button></div></div><button class="primary-button full" data-action="close">Done <span>✓</span></button>`;
    if (type === 'paused') body = `<p class="dialog-description">Your next perspective will be right here.</p><button class="primary-button full" data-action="resume">Resume <span>↗</span></button><button class="secondary-button full" data-action="retry">Restart level</button><button class="text-button full" data-action="menu">Back to menu</button>`;
    if (type === 'won') body = `<p class="dialog-description">${campaignComplete ? 'You have explored all four worlds. Revisit them, beat your best scores and complete your collection.' : 'You found your way. A new perspective awaits on the other side.'}</p><div class="result-stats"><div><small>SCORE</small><strong>${this.snapshot.score || 0}</strong></div><div><small>COINS EARNED</small><strong>✦ ${this.snapshot.earned ?? this.snapshot.coins ?? 0}</strong></div></div><button class="primary-button full" data-action="${campaignComplete ? 'worlds' : 'play'}">${campaignComplete ? 'Explore all worlds' : 'Next level'} <span>↗</span></button><button class="text-button full" data-action="menu">Back to menu</button>`;
    if (type === 'lost') body = `<p class="dialog-description">Every attempt is a new way to see the path.</p><button class="primary-button full" data-action="retry">Try again <span>↗</span></button><button class="text-button full" data-action="menu">Back to menu</button>`;
    if(type==='how')body=body.replace('</div><div class="instruction-keys">','<p><b>04</b><span><strong>Watch the warning ring.</strong>Enemies can mark a surface with a red danger ring. Move out before the attack lands, or time a jump to escape. On a touchscreen, hold the arrows and tap Jump; you can steer and jump together.</span></p></div><div class="instruction-keys">');
    if(type==='settings')body=body.replace('<div class="setting-row"><div><strong>Visual quality', `${['musicVolume','effectsVolume'].map(key=>{const value=Math.round(Math.max(0,Math.min(1,Number(this.progress[key])||0))*100);return `<div class="volume-setting"><label for="${key}">${key==='musicVolume'?'Music':'Sound effects'}<output for="${key}" data-volume-output="${key}">${value}%</output></label><input id="${key}" data-volume="${key}" type="range" min="0" max="100" step="1" value="${value}" aria-label="${key==='musicVolume'?'Music volume':'Sound effects volume'}"></div>`;}).join('')}<div class="setting-row"><div><strong>Visual quality`);
    if(type==='won')body+=`<div class="submit-run-block"><button class="secondary-button full" data-action="submit-open" ${this.submission.available?'':'disabled'}>Submit verified run <span>↗</span></button><p class="submission-status" role="status"></p></div>`;
    if(type==='submit')body=`<p class="dialog-description">Ranking is completely optional. Playing and local progress never require an account. To join, sign in to GitHub and choose how your name appears.</p><div class="identity-options" role="group" aria-label="Ranking identity"><button data-action="submit-identity" data-identity="github">Use GitHub username</button><button data-action="submit-identity" data-identity="alias">Add a nickname</button></div><div id="alias-field" hidden><label for="score-alias">Your explorer nickname</label><input id="score-alias" type="text" inputmode="text" autocomplete="nickname" minlength="3" maxlength="24" pattern="[A-Za-z0-9 _\\-]{3,24}" aria-describedby="alias-hint" placeholder="Cosmic explorer"><small id="alias-hint">3–24 letters, numbers, spaces, underscores or hyphens.</small></div><p class="submission-explanation">GitHub identifies the author of the public submission. Your displayed username or nickname always links to that verified GitHub profile. Rankings are reviewed before publication; abusive names may be removed, replaced or blacklisted, and accounts may be banned.</p><label class="ranking-consent"><input id="ranking-consent" type="checkbox"> <span>I understand that my GitHub username, profile link, optional nickname and run submission will be public.</span></label><button class="primary-button full" data-action="submit-confirm">Open GitHub submission <span>↗</span></button><p class="submission-status" role="status"></p><button class="text-button full" data-action="close">Back to results</button>`;
    layer.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${['how','settings','submit'].includes(type)?'<button class="dialog-close icon-button" data-action="close" aria-label="Close">×</button>':''}<span class="eyebrow">${title[0]}</span><h2 id="dialog-title">${title[1]}</h2>${body}</section>`;
    this.syncProgress();
    this.syncSubmission();
    layer.querySelector('button')?.focus({ preventScroll: true });
  }
  closeDialog() { this.dialog = null; this.root.querySelector('#dialog-layer').hidden = true; if (this.dialogReturnFocus?.isConnected) this.dialogReturnFocus.focus({ preventScroll: true }); this.dialogReturnFocus = null; }
  setProgress(progress) { this.progress = { ...this.progress, ...progress }; this.syncProgress(); if (['worlds','atelier'].includes(this.screen)) this.showScreen(this.screen); }
  syncProgress() {
    const completed=Math.min(LEVELS.length,Object.keys(this.records()).length);
    this.root.querySelectorAll('.campaign-progress').forEach(bar=>{bar.max=LEVELS.length;bar.value=completed;});
    this.root.querySelectorAll('.campaign-count').forEach(label=>label.textContent=completed+' / '+LEVELS.length+' completed');
    this.root.querySelector('#bank').textContent = this.progress.bank;
    this.root.querySelector('.sound-toggle').textContent = this.progress.sound ? '♫' : '♪';
    this.root.querySelector('.sound-toggle').setAttribute('aria-pressed', String(this.progress.sound));
    this.root.dataset.difficulty = this.progress.difficulty;
    this.root.querySelectorAll('[data-difficulty]').forEach(button=>{const selected=button.dataset.difficulty===this.progress.difficulty;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
    this.root.querySelectorAll('.difficulty-description').forEach(el=>el.textContent=this.progress.difficulty==='extreme'?'Real inertia. Brake before edges. More speed means longer jumps.':'Precise steps, forgiving jumps. Take your time and explore.');
    this.root.querySelector('#speed-meter').hidden = (this.snapshot.difficulty ?? this.progress.difficulty) !== 'extreme';
  }
  update(snapshot, progress) {
    this.snapshot = snapshot || {};
    if (progress) this.progress = { ...this.progress, ...progress };
    this.syncProgress();
    const s = this.snapshot, level = LEVELS[s.levelIndex || 0];
    this.root.querySelector('#hud-name').textContent = level?.name || 'Solstice';
    this.root.querySelector('#hud-count').textContent = `LEVEL ${pad((s.levelIndex || 0)+1)} / ${pad(LEVELS.length)}`;
    const time = Math.max(0, Math.ceil(s.time ?? 120));
    const timer = this.root.querySelector('#hud-time'); timer.textContent = `${Math.floor(time/60)}:${pad(time%60)}`; timer.classList.toggle('urgent', time <= 20);
    const timeBar=this.root.querySelector('#time-progress');timeBar.max=Math.max(level?.time || 120,time);timeBar.value=time;
    const keyBar=this.root.querySelector('#keys-progress');keyBar.max=s.totalKeys || 1;keyBar.value=s.keys || 0;
    this.root.querySelector('#hud-keys').textContent = `${s.keys ?? 0} / ${s.totalKeys ?? 1}`;
    this.root.querySelector('#hud-coins').textContent = s.coins ?? 0;
    this.root.querySelector('#hud-lives').textContent = s.lives ?? 3;
    this.root.querySelector('#hud-speed').textContent = Math.abs(Number(s.speed)||0).toFixed(1);
    if (s.state && s.state !== this.lastGameState) {
      this.lastGameState = s.state;
      if (['playing','paused','won','lost','gameover'].includes(s.state)) this.showScreen(s.state);
    }
  }
  toast(text) { const el=this.root.querySelector('#toast'); el.textContent=text; el.classList.add('visible'); clearTimeout(this.toastTimeout); this.toastTimeout=setTimeout(()=>el.classList.remove('visible'),3500); }
}
