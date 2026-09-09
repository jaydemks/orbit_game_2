// A shuffle bag plays each available track once before reshuffling.
export class ShuffleBag {
  constructor(items, random = Math.random) { this.items = [...new Set(items)]; this.random = random; this.bag = []; this.last = null; }
  next() {
    if (!this.items.length) return null;
    if (this.items.length === 1 && this.last === this.items[0]) return null;
    if (!this.bag.length) {
      this.bag = [...this.items];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      if (this.bag.at(-1) === this.last) [this.bag[0], this.bag[this.bag.length - 1]] = [this.bag.at(-1), this.bag[0]];
    }
    return (this.last = this.bag.pop());
  }
}

export class MusicDeck {
  constructor(context, destination, tracks) {
    this.context = context; this.destination = destination;
    this.playlist = new ShuffleBag(tracks); this.slots = []; this.current = null;
    this.failed = new Set(); this.fade = 5; this.pending = false; this.started = false;
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.ambient(); this.advance();
    this.timer = setInterval(() => this.tick(), 250);
  }
  ambient() {
    const ctx = this.context;
    this.pad = ctx.createGain(); this.pad.gain.value = .07; this.pad.connect(this.destination);
    this.drones = [130.81, 196, 261.63].map((frequency, index) => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 3 - 3; gain.gain.value = .18;
      oscillator.connect(gain); gain.connect(this.pad); oscillator.start(); return oscillator;
    });
  }
  ramp(node, value, seconds) {
    const at = this.context.currentTime;
    node.gain.cancelAndHoldAtTime?.(at);
    if (!node.gain.cancelAndHoldAtTime) { node.gain.cancelScheduledValues(at); node.gain.setValueAtTime(node.gain.value, at); }
    node.gain.linearRampToValueAtTime(value, at + seconds);
  }
  async advance() {
    if (this.pending) return;
    this.pending = true;
    let url = this.playlist.next(), attempts = this.playlist.items.length;
    while (url && this.failed.has(url) && attempts-- > 0) url = this.playlist.next();
    if (!url || this.failed.has(url)) { this.ramp(this.pad, .07, this.fade); this.pending = false; return; }
    const audio = new Audio(url); audio.preload = 'auto';
    const gain = this.context.createGain(); gain.gain.value = 0; gain.connect(this.destination);
    const source = this.context.createMediaElementSource(audio); source.connect(gain);
    const slot = { audio, gain, source, retiring: false, fading: false };
    try {
      await audio.play();
      if (this.current) {
        const previous = this.current; previous.retiring = true;
        this.ramp(previous.gain, 0, this.fade);
        previous.cleanup = setTimeout(() => this.remove(previous), this.fade * 1000 + 100);
      }
      this.slots.push(slot); this.current = slot;
      this.ramp(gain, .32, this.fade); this.ramp(this.pad, 0, this.fade);
    } catch {
      audio.pause(); source.disconnect(); gain.disconnect();
      this.failed.add(url); this.ramp(this.pad, .07, this.fade);
    } finally { this.pending = false; }
  }
  tick() {
    const slot = this.current;
    if (!slot) { if (this.failed.size < this.playlist.items.length) this.advance(); return; }
    const { audio } = slot;
    if (audio.error) { this.failed.add(this.playlist.last); this.remove(slot); this.current = null; this.advance(); return; }
    const remaining = audio.duration - audio.currentTime;
    if (!slot.fading && Number.isFinite(remaining) && remaining <= this.fade) {
      slot.fading = true; this.ramp(slot.gain, 0, Math.max(.1, remaining)); this.advance();
    }
    if (audio.ended && this.current === slot) { this.remove(slot); this.current = null; this.ramp(this.pad, .07, this.fade); }
  }
  remove(slot) {
    clearTimeout(slot.cleanup); slot.audio.pause(); slot.audio.removeAttribute('src'); slot.audio.load();
    slot.source.disconnect(); slot.gain.disconnect(); this.slots = this.slots.filter(s => s !== slot);
  }
  dispose() { clearInterval(this.timer); for (const slot of [...this.slots]) this.remove(slot); this.drones?.forEach(o => o.stop()); this.pad?.disconnect(); }
}
