class PlaybackQueue {
  constructor() { this.tracks = []; this.index = -1; this.shuffle = false; this.repeat = 'off'; this.history = []; this.remaining = []; }
  set(tracks, id) {
    this.tracks = [...tracks];
    this.index = this.tracks.findIndex(track => track.id === id);
    this.history = [];
    this.remaining = this.tracks.map((_, i) => i).filter(i => i !== this.index);
  }
  next(manual = true) {
    if (!this.tracks.length) return null;
    if (!manual && this.repeat === 'one') return this.tracks[this.index];
    let next = this.index + 1;
    if (this.shuffle) {
      if (!this.remaining.length) {
        if (!manual && this.repeat === 'off') return null;
        this.remaining = this.tracks.map((_, i) => i).filter(i => i !== this.index);
      }
      next = this.remaining.length ? this.remaining.splice(Math.floor(Math.random() * this.remaining.length), 1)[0] : this.index;
    } else if (next >= this.tracks.length) {
      if (!manual && this.repeat === 'off') return null;
      next = 0;
    }
    this.history.push(this.index);
    this.index = next;
    return this.tracks[this.index];
  }
  previous() {
    if (!this.tracks.length) return null;
    this.index = this.history.length ? this.history.pop() : Math.max(0, this.index - 1);
    return this.tracks[this.index];
  }
  remove(ids) {
    const current = this.tracks[this.index]?.id;
    this.set(this.tracks.filter(track => !ids.has(track.id)), current);
  }
}
if (typeof module !== 'undefined') module.exports = PlaybackQueue;
else window.PlaybackQueue = PlaybackQueue;
