import { MusicDeck } from './music.js';
export class Soundscape {
  constructor(tracks = []) { this.enabled = true; this.context = null; this.tracks = tracks; }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new (window.AudioContext || window.webkitAudioContext)();
      if (!this.master) { this.master = this.context.createGain(); this.master.connect(this.context.destination); this.music = new MusicDeck(this.context, this.master, this.tracks); }
      this.context.resume(); this.music.start();
    } catch {}
  }
  setEnabled(value) { this.enabled = value; if (this.master) this.master.gain.setTargetAtTime(value ? 1 : 0, this.context.currentTime, .15); }
  setHidden(hidden) { if (hidden) this.context?.suspend(); else if (this.enabled) this.context?.resume(); }
  play(type) {
    if (!this.enabled || !this.context) return;
    const notes = { coin:[880,1320], key:[523,659,1046], fruit:[660,880,1320], time:[440,880], won:[523,659,784,1046], lost:[220,165,110], jump:[240,480], turn:[180], move:[120], buy:[659,880,1318], exitLocked:[220,196] }[type];
    if (!notes) return;
    const ctx = this.context;
    notes.forEach((freq,i) => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + i * .065;
      oscillator.type = type === 'move' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(freq,at);
      gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(type === 'move' ? .025 : .055,at+.012); gain.gain.exponentialRampToValueAtTime(.001,at+.23);
      oscillator.connect(gain); gain.connect(this.master); oscillator.start(at); oscillator.stop(at+.25);
    });
  }
}
