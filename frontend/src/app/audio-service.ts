import { Service, signal } from '@angular/core';

@Service()
export class AudioService {
  muted = signal(localStorage.getItem('muted') === '1');

  private ctx?: AudioContext;
  private musique = new Audio('/audio/musique.mp3');

  constructor() {
    this.musique.loop = true; // musique en boucle
    this.musique.volume = 0.25;
  }

  // à appeler depuis un clic (les navigateurs interdisent le son avant une action du joueur)
  demarrer() {
    this.ctx ??= new AudioContext();
    this.ctx.resume();
    if (!this.muted()) this.musique.play().catch(() => {});
  }

  toggleMute() {
    const muet = !this.muted();
    this.muted.set(muet);
    localStorage.setItem('muted', muet ? '1' : '0');
    if (muet) this.musique.pause();
    else this.musique.play().catch(() => {});
  }

  // une note de synthèse : fréquence, début, durée, forme d'onde, volume
  private note(freq: number, debut: number, duree: number, type: OscillatorType = 'sine', volume = 0.15) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + debut;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duree);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duree);
  }

  // un son différent selon le type de message
  jouer(type: string) {
    if (this.muted() || !this.ctx) return;
    switch (type) {
      case 'achat': // petit "pop" montant
        this.note(660, 0, 0.08, 'triangle');
        this.note(880, 0.07, 0.12, 'triangle');
        break;
      case 'bonus': // arpège joyeux
        [523, 659, 784, 1047].forEach((f, i) => this.note(f, i * 0.08, 0.25, 'triangle'));
        break;
      case 'manager': // fanfare
        [392, 523, 659, 784].forEach((f, i) => this.note(f, i * 0.12, 0.3, 'square', 0.08));
        this.note(1047, 0.5, 0.5, 'square', 0.08);
        break;
      case 'erreur': // son grave descendant
        this.note(220, 0, 0.2, 'sawtooth', 0.1);
        this.note(150, 0.15, 0.3, 'sawtooth', 0.1);
        break;
    }
  }
}