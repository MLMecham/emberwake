// ===== audio.js : tiny chiptune synth =====
'use strict';
const AU = { ctx: null, master: null, music: null, musicGain: null, track: null, step: 0, nextT: 0, on: true, vol: 0.5 };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try { AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.vol; AU.master.connect(AU.ctx.destination);
  AU.musicGain = AU.ctx.createGain(); AU.musicGain.gain.value = 0.22; AU.musicGain.connect(AU.master);
  // noise buffer
  const len = AU.ctx.sampleRate * 0.5; AU.noise = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate); const d = AU.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}
function tone(freq, dur, type, vol, slide, when, dest) {
  if (!AU.ctx) return; const t = when || AU.ctx.currentTime;
  const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || AU.master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, when) {
  if (!AU.ctx) return; const t = when || AU.ctx.currentTime; const s = AU.ctx.createBufferSource(); s.buffer = AU.noise;
  const f = AU.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 2000; const g = AU.ctx.createGain();
  g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(AU.master); s.start(t); s.stop(t + dur);
}
function seq(notes, step, type, vol) { if (!AU.ctx) return; const t = AU.ctx.currentTime; notes.forEach((n, i) => { if (n) tone(n, step * 1.1, type || 'square', vol || 0.15, null, t + i * step); }); }
function sfx(name, vol) {
  if (!AU.ctx || !AU.on) return; const v = vol == null ? 1 : vol;
  switch (name) {
    case 'swing': noise(0.12, 0.18 * v, 3000); tone(600, 0.08, 'triangle', 0.08 * v, 200); break;
    case 'punch': noise(0.08, 0.25 * v, 1200); tone(180, 0.08, 'square', 0.12 * v, 60); break;
    case 'hit': tone(200, 0.1, 'square', 0.2 * v, 80); noise(0.06, 0.15 * v, 1500); break;
    case 'die': tone(400, 0.25, 'square', 0.15 * v, 60); noise(0.2, 0.15 * v, 800); break;
    case 'bossdie': for (let i = 0; i < 6; i++) { noise(0.3, 0.3 * v, 600, AU.ctx.currentTime + i * 0.12); } tone(300, 1.2, 'sawtooth', 0.2 * v, 30); break;
    case 'hurt': tone(300, 0.2, 'sawtooth', 0.22 * v, 90); break;
    case 'gem': seq([1568, 2093], 0.05, 'square', 0.1 * v); break;
    case 'heart': seq([880, 1175, 1568], 0.05, 'triangle', 0.15 * v); break;
    case 'key': seq([1047, 1319, 1568, 2093], 0.05, 'square', 0.12 * v); break;
    case 'get': seq([523, 659, 784, 1047, 0, 784, 1047], 0.09, 'square', 0.14 * v); break;
    case 'fanfare': seq([392, 523, 659, 784, 0, 659, 784, 1047, 1047], 0.11, 'square', 0.14 * v); break;
    case 'secret': seq([587, 740, 880, 1175, 1480, 1760], 0.08, 'triangle', 0.18 * v); break;
    case 'appear': seq([784, 988, 1175], 0.07, 'triangle', 0.15 * v); break;
    case 'door': noise(0.25, 0.2 * v, 400); tone(120, 0.2, 'square', 0.1 * v, 60); break;
    case 'shutter': noise(0.3, 0.3 * v, 300); tone(90, 0.3, 'square', 0.15 * v, 50); break;
    case 'boom': noise(0.6, 0.5 * v, 500); tone(80, 0.5, 'sawtooth', 0.25 * v, 30); break;
    case 'place': tone(300, 0.06, 'square', 0.1 * v); break;
    case 'shoot': tone(500, 0.1, 'square', 0.1 * v, 250); break;
    case 'magic': tone(900, 0.25, 'sine', 0.15 * v, 300); tone(1200, 0.2, 'triangle', 0.08 * v, 600); break;
    case 'arrow': noise(0.1, 0.2 * v, 5000); break;
    case 'boomer': tone(700, 0.3, 'triangle', 0.1 * v, 1000); break;
    case 'fire': noise(0.4, 0.25 * v, 1200); break;
    case 'beam': tone(1400, 0.2, 'square', 0.1 * v, 2000); tone(700, 0.2, 'square', 0.06 * v, 1000); break;
    case 'wave': tone(200, 0.6, 'sawtooth', 0.2 * v, 1600); noise(0.5, 0.25 * v, 3000); break;
    case 'clink': tone(2400, 0.08, 'square', 0.1 * v, 1800); break;
    case 'heal': seq([523, 659, 784, 1047, 1319], 0.06, 'triangle', 0.15 * v); break;
    case 'stairs': seq([392, 349, 330, 294, 262], 0.06, 'square', 0.1 * v); break;
    case 'roar': tone(120, 0.5, 'sawtooth', 0.2 * v, 60); noise(0.4, 0.15 * v, 600); break;
    case 'whistle': seq([1047, 1175, 1319, 1568, 1319, 1568, 2093], 0.1, 'sine', 0.16 * v); break;
    case 'lowhp': tone(1760, 0.06, 'square', 0.05 * v); break;
    case 'text': tone(1200, 0.02, 'square', 0.04 * v); break;
    case 'menu': tone(880, 0.05, 'square', 0.08 * v); break;
    case 'charge': tone(400, 0.12, 'sine', 0.06 * v, 800); break;
    case 'dash': noise(0.15, 0.2 * v, 6000); break;
    case 'whisper': noise(0.9, 0.06 * v, 900); tone(220, 0.8, 'sine', 0.03 * v, 180); tone(330, 0.7, 'sine', 0.02 * v, 300); break;
  }
}
// ---- music: original procedural loops ----
const N = (s) => { const m = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }; return 440 * Math.pow(2, (m[s[0]] + (s[1] === '#' ? 1 : 0) + (parseInt(s[s.length - 1]) - 4) * 12 - 9) / 12); };
const TRACKS = {
  ow: { bpm: 132, lead: 'E5 . G5 A5 B5 . A5 G5 E5 . D5 E5 G5 . . . A5 . B5 C6 D6 . C6 B5 A5 . G5 A5 B5 . . . E5 . G5 A5 B5 . D6 . E6 . D6 B5 A5 . G5 A5 B5 . A5 G5 E5 . D5 E5 E5 . . . . . . .', bass: 'E3 E3 B3 E3 C3 C3 G3 C3 D3 D3 A3 D3 B2 B2 F#3 B2' },
  dungeon: { bpm: 100, lead: 'A4 . C5 . E5 . D#5 . D5 . . . C5 . B4 . A4 . C5 . F5 . E5 . D5 . . . . . . . G#4 . B4 . D5 . C5 . B4 . A4 . G#4 . E4 . . . . . . . . . . . . . . . . .', bass: 'A2 A2 A2 A2 F2 F2 F2 F2 E2 E2 E2 E2 E2 E2 G#2 G#2' },
  cave: { bpm: 90, lead: 'C5 . E5 . G5 . E5 . F5 . A5 . G5 . . . E5 . G5 . C6 . B5 . A5 . G5 . . . . .', bass: 'C3 C3 F3 F3 G3 G3 C3 C3' },
  boss: { bpm: 160, lead: 'E5 E5 . E5 F5 E5 D#5 E5 . . B4 . C5 . D#5 . E5 E5 . E5 G5 F#5 F5 E5 . . B4 . A4 . B4 .', bass: 'E2 E2 E3 E2 E2 E3 E2 E3 C2 C2 C3 C2 B1 B1 B2 B1' },
  final: { bpm: 120, lead: 'D5 . F5 . A5 . G#5 . A5 . . . D6 . C6 . A5 . F5 . G5 . A5 . D5 . . . . . . .', bass: 'D2 D2 D3 D2 A#1 A#1 A#2 A#1 C2 C2 C3 C2 A1 A1 A2 A1' },
};
function musicPlay(name) {
  if (AU.trackName === name) return; AU.trackName = name; AU.track = TRACKS[name] || null; AU.step = 0; if (AU.ctx) AU.nextT = AU.ctx.currentTime + 0.1;
}
function musicTick() {
  if (!AU.ctx || !AU.track || !AU.on) return; const tr = AU.track; const stepDur = 60 / tr.bpm / 2;
  const lead = tr._l || (tr._l = tr.lead.split(' ')), bass = tr._b || (tr._b = tr.bass.split(' '));
  while (AU.nextT < AU.ctx.currentTime + 0.25) {
    const l = lead[AU.step % lead.length]; if (l && l !== '.') tone(N(l), stepDur * 1.8, 'square', 0.09, null, AU.nextT, AU.musicGain);
    if (AU.step % 2 === 0) { const b = bass[(AU.step / 2) % bass.length]; if (b && b !== '.') tone(N(b), stepDur * 1.6, 'triangle', 0.22, null, AU.nextT, AU.musicGain); }
    if (AU.step % 4 === 2) { const s = AU.ctx.createBufferSource(); s.buffer = AU.noise; const g = AU.ctx.createGain(); g.gain.setValueAtTime(0.04, AU.nextT); g.gain.exponentialRampToValueAtTime(0.001, AU.nextT + 0.05); s.connect(g); g.connect(AU.musicGain); s.start(AU.nextT); s.stop(AU.nextT + 0.06); }
    AU.step++; AU.nextT += stepDur;
  }
}
