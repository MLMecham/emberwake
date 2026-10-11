// ===== audio.js : tiny chiptune synth =====
'use strict';
// Two volume knobs: sound effects (sfxVol) and music (musicVol), both 0..1 from the pause menu sliders.
const AU = { ctx: null, master: null, music: null, musicGain: null, sfxGain: null, track: null, step: 0, nextT: 0, on: true, sfxVol: 0.6, musicVol: 0.6 };
const MUSIC_BASE = 0.6; // how loud music is at full slider (it used to be 0.22)
function audioSetVolumes() { if (!AU.ctx) return; AU.sfxGain.gain.value = AU.sfxVol; AU.musicGain.gain.value = AU.musicVol * MUSIC_BASE; }
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try { AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  AU.master = AU.ctx.createGain(); AU.master.gain.value = 1; AU.master.connect(AU.ctx.destination);
  AU.sfxGain = AU.ctx.createGain(); AU.sfxGain.connect(AU.master);
  AU.musicGain = AU.ctx.createGain(); AU.musicGain.connect(AU.master); audioSetVolumes();
  // noise buffer
  const len = AU.ctx.sampleRate * 0.5; AU.noise = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate); const d = AU.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}
function tone(freq, dur, type, vol, slide, when, dest) {
  if (!AU.ctx) return; const t = when || AU.ctx.currentTime;
  const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || AU.sfxGain); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, when, dest) {
  if (!AU.ctx) return; const t = when || AU.ctx.currentTime; const s = AU.ctx.createBufferSource(); s.buffer = AU.noise;
  const f = AU.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 2000; const g = AU.ctx.createGain();
  g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(dest || AU.sfxGain); s.start(t); s.stop(t + dur);
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
    // the frontier and the dragons
    case 'dragonroar': tone(85, 1.0, 'sawtooth', 0.26 * v, 38); tone(130, 0.8, 'square', 0.1 * v, 62); tone(170, 0.6, 'sawtooth', 0.06 * v, 90); noise(0.9, 0.22 * v, 520); break;
    case 'bite': noise(0.07, 0.32 * v, 2600); tone(320, 0.06, 'square', 0.16 * v, 110); noise(0.05, 0.25 * v, 1800, AU.ctx.currentTime + 0.06); break;
    case 'breath_ice': noise(1.0, 0.16 * v, 7500); for (let i = 0; i < 8; i++) tone(1800 + Math.random() * 1800, 0.14, 'sine', 0.045 * v, null, AU.ctx.currentTime + i * 0.11); break;
    case 'breath_fire': noise(1.0, 0.3 * v, 850); tone(68, 1.0, 'sawtooth', 0.13 * v, 48); for (let i = 0; i < 5; i++) noise(0.05, 0.12 * v, 3200, AU.ctx.currentTime + 0.1 + Math.random() * 0.8); break;
    case 'icespit': tone(1500, 0.1, 'triangle', 0.09 * v, 2600); noise(0.06, 0.05 * v, 8000); break;
    case 'freeze': seq([2637, 3136, 3951, 4699], 0.035, 'sine', 0.09 * v); noise(0.2, 0.07 * v, 9000); break;
    case 'eruption': noise(1.3, 0.42 * v, 320); tone(52, 1.2, 'sawtooth', 0.26 * v, 28); for (let i = 0; i < 9; i++) noise(0.04, 0.16 * v, 3000, AU.ctx.currentTime + 0.15 + Math.random() * 1.0); break;
    case 'vent_warn': tone(55, 0.5, 'sawtooth', 0.07 * v, 95); noise(0.5, 0.07 * v, 260); break;
    case 'vent_blow': noise(0.55, 0.3 * v, 1600); tone(190, 0.4, 'triangle', 0.09 * v, 60); break;
    case 'iceslide': noise(0.2, 0.05 * v, 5200); tone(2400 + Math.random() * 400, 0.12, 'sine', 0.015 * v, 1900); break;
    case 'hearthgate': seq([262, 330, 392, 523, 659, 784, 1047], 0.12, 'triangle', 0.16 * v); tone(65, 1.6, 'sawtooth', 0.14 * v, 130); break;
    case 'pitfall': tone(900, 0.7, 'sine', 0.13 * v, 70); noise(0.15, 0.1 * v, 500, AU.ctx.currentTime + 0.65); break; // an enemy drops into a pit
    case 'sizzle': noise(0.25, 0.14 * v, 7000); tone(1100, 0.12, 'sawtooth', 0.03 * v, 600); break; // an enemy burning on lava or a vent
    case 'icecrack': for (let i = 0; i < 4; i++) tone(2600 + Math.random() * 1600, 0.05, 'square', 0.05 * v, 1800, AU.ctx.currentTime + i * 0.07); noise(0.2, 0.06 * v, 6000); break; // frost-arrow ice about to melt
    case 'nock': tone(700, 0.06, 'square', 0.1 * v, 900); tone(1050, 0.08, 'triangle', 0.08 * v, 1300, AU.ctx.currentTime + 0.06); break; // a second arrow nocked
    case 'eyeshut': tone(320, 0.12, 'square', 0.14 * v, 140); noise(0.1, 0.12 * v, 900); break; // an arrow shuts an eye
    case 'eyecreak': tone(140, 0.7, 'sawtooth', 0.08 * v, 260); noise(0.6, 0.05 * v, 400); break; // the eye is opening again
    case 'drain': noise(1.2, 0.2 * v, 700); seq([523, 440, 349, 262], 0.12, 'triangle', 0.1 * v); break; // the water runs away
    case 'tidewarn': seq([330, 0, 330, 0, 330], 0.12, 'square', 0.07 * v); noise(0.8, 0.08 * v, 1200); break; // shallow water about to go deep
    case 'flood': noise(1.0, 0.24 * v, 1500); tone(110, 0.8, 'sine', 0.12 * v, 70); break; // water rising
    case 'splash': noise(0.35, 0.25 * v, 2600); tone(500, 0.2, 'sine', 0.08 * v, 150); break;
    case 'whisper': noise(0.9, 0.06 * v, 900); tone(220, 0.8, 'sine', 0.03 * v, 180); tone(330, 0.7, 'sine', 0.02 * v, 300); break;
  }
}
// ---- music: original procedural loops ----
const N = (s) => { const m = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }; return 440 * Math.pow(2, (m[s[0]] + (s[1] === '#' ? 1 : 0) + (parseInt(s[s.length - 1]) - 4) * 12 - 9) / 12); };
// lead / bass: notes per half-beat ('.' = rest). Optional: arp (a third voice), drums: 'k' kick, 's' snare, 'h' hat, '.' rest.
const TRACKS = {
  ow: { bpm: 132, lead: 'E5 . G5 A5 B5 . A5 G5 E5 . D5 E5 G5 . . . A5 . B5 C6 D6 . C6 B5 A5 . G5 A5 B5 . . . E5 . G5 A5 B5 . D6 . E6 . D6 B5 A5 . G5 A5 B5 . A5 G5 E5 . D5 E5 E5 . . . . . . .', bass: 'E3 E3 B3 E3 C3 C3 G3 C3 D3 D3 A3 D3 B2 B2 F#3 B2', drums: 'k . h . s . h . k . k . s . h .' },
  // dungeons 1-4: a creeping minor walk; 5-8 (the deep ones) get their own darker theme
  dungeon: { bpm: 100, lead: 'A4 . C5 . E5 . D#5 . D5 . . . C5 . B4 . A4 . C5 . F5 . E5 . D5 . . . . . . . G#4 . B4 . D5 . C5 . B4 . A4 . G#4 . E4 . . . . . . . . . . . . . . . . .', bass: 'A2 A2 A2 A2 F2 F2 F2 F2 E2 E2 E2 E2 E2 E2 G#2 G#2', arp: 'A3 C4 E4 C4 A3 C4 E4 C4 F3 A3 C4 A3 F3 A3 C4 A3 E3 G#3 B3 G#3 E3 G#3 B3 G#3 E3 G#3 B3 G#3 E3 G#3 B3 D4', drums: 'k . . . . . h . k . . . s . . .' },
  deep: { bpm: 92, lead: 'D5 . . . F5 . E5 . C#5 . . . . . . . D5 . . . A5 . G5 . F5 . E5 . . . . . A#4 . . . D5 . C5 . A4 . . . F4 . . . G4 . . . A4 . . . C#5 . . . . . . .', bass: 'D2 D2 D2 D2 A#1 A#1 A#1 A#1 G1 G1 G1 G1 A1 A1 A1 A1', arp: 'D4 F4 A4 F4 D4 F4 A4 F4 A#3 D4 F4 D4 A#3 D4 F4 D4 G3 A#3 D4 A#3 G3 A#3 D4 A#3 A3 C#4 E4 C#4 A3 C#4 E4 G4', drums: 'k . . . h . . . k . k . s . . h' },
  // the frontier and the optional dungeons
  frost: { bpm: 84, lead: 'B5 . . . F#5 . . . G5 . A5 . B5 . . . D6 . . . C#6 . B5 . A5 . . . . . . . G5 . . . E5 . . . F#5 . G5 . A5 . . . B5 . . . A5 . F#5 . E5 . . . . . . .', bass: 'E2 E2 E2 E2 C2 C2 C2 C2 D2 D2 D2 D2 B1 B1 B1 B1', arp: 'E5 B5 G5 B5 E5 B5 G5 B5 C5 G5 E5 G5 C5 G5 E5 G5 D5 A5 F#5 A5 D5 A5 F#5 A5 B4 F#5 D#5 F#5 B4 F#5 D#5 F#5', drums: 'h . . . . . h . . . h . . . . .' },
  fire: { bpm: 150, lead: 'E5 . E5 G5 . E5 D5 . E5 . . . B4 . D5 . E5 . E5 G5 . A5 G5 . E5 . D5 . B4 . . .', bass: 'E2 E2 E3 E2 G2 G2 G3 G2 A2 A2 A3 A2 B2 B2 B3 D3', drums: 'k . s k k . s . k . s k k s s s' },
  hearth: { bpm: 108, lead: 'C5 . E5 . G5 . . . F#5 . . . A5 . G5 . E5 . . . C5 . D5 . E5 . . . . . . . A4 . C5 . E5 . . . D#5 . . . F#5 . E5 . C5 . . . A4 . B4 . C5 . . . . . . .', bass: 'C2 C2 C2 C2 D2 D2 D2 D2 A1 A1 A1 A1 B1 B1 B1 B1', arp: 'C4 E4 G4 E4 C4 E4 G4 E4 D4 F#4 A4 F#4 D4 F#4 A4 F#4 A3 C4 E4 C4 A3 C4 E4 C4 B3 D#4 F#4 D#4 B3 D#4 F#4 A4', drums: 'k . . h s . . h k . k h s . . h' },
  dragon: { bpm: 176, lead: 'A5 A5 . A5 C6 . B5 A5 . . E5 . G5 . A5 . A5 A5 . A5 D6 C6 B5 A5 . . E5 . F5 . G#5 .', bass: 'A1 A1 A2 A1 A1 A2 A1 A2 F1 F1 F2 F1 E1 E1 E2 E1', arp: 'A4 C5 E5 A5 A4 C5 E5 A5 A4 C5 E5 A5 A4 C5 E5 A5 F4 A4 C5 F5 F4 A4 C5 F5 E4 G#4 B4 E5 E4 G#4 B4 E5', drums: 'k h s h k k s h k h s k k k s s' },
  cave: { bpm: 90, lead: 'C5 . E5 . G5 . E5 . F5 . A5 . G5 . . . E5 . G5 . C6 . B5 . A5 . G5 . . . . .', bass: 'C3 C3 F3 F3 G3 G3 C3 C3' },
  boss: { bpm: 168, lead: 'E5 E5 . E5 F5 E5 D#5 E5 . . B4 . C5 . D#5 . E5 E5 . E5 G5 F#5 F5 E5 . . B4 . A4 . B4 .', bass: 'E2 E2 E3 E2 E2 E3 E2 E3 C2 C2 C3 C2 B1 B1 B2 B1', arp: 'E4 G4 B4 E5 E4 G4 B4 E5 E4 G4 B4 E5 E4 G4 B4 E5 C4 E4 G4 C5 C4 E4 G4 C5 B3 D#4 F#4 B4 B3 D#4 F#4 B4', drums: 'k h s h k k s h k h s h k k s s' },
  final: { bpm: 126, lead: 'D5 . F5 . A5 . G#5 . A5 . . . D6 . C6 . A5 . F5 . G5 . A5 . D5 . . . . . . .', bass: 'D2 D2 D3 D2 A#1 A#1 A#2 A#1 C2 C2 C3 C2 A1 A1 A2 A1', arp: 'D4 F4 A4 D5 D4 F4 A4 D5 A#3 D4 F4 A#4 A#3 D4 F4 A#4 C4 E4 G4 C5 C4 E4 G4 C5 A3 C#4 E4 A4 A3 C#4 E4 G4', drums: 'k . s . k k s . k . s . k k s h' },
};
function musicPlay(name) {
  if (AU.trackName === name) return; AU.trackName = name; AU.track = TRACKS[name] || null; AU.step = 0; if (AU.ctx) AU.nextT = AU.ctx.currentTime + 0.1;
}
function drum(kind, t) {
  const g = AU.musicGain;
  if (kind === 'k') { tone(150, 0.14, 'sine', 0.5, 40, t, g); }
  else if (kind === 's') { noise(0.12, 0.16, 2600, t, g); tone(220, 0.06, 'triangle', 0.08, 120, t, g); }
  else if (kind === 'h') { noise(0.03, 0.05, 9000, t, g); }
}
function musicTick() {
  if (!AU.ctx || !AU.track || !AU.on) return; const tr = AU.track; const stepDur = 60 / tr.bpm / 2;
  const lead = tr._l || (tr._l = tr.lead.split(' ')), bass = tr._b || (tr._b = tr.bass.split(' '));
  const arp = tr.arp ? (tr._a || (tr._a = tr.arp.split(' '))) : null, drums = tr.drums ? (tr._d || (tr._d = tr.drums.split(' '))) : null;
  while (AU.nextT < AU.ctx.currentTime + 0.25) {
    const l = lead[AU.step % lead.length]; if (l && l !== '.') tone(N(l), stepDur * 1.8, 'square', 0.09, null, AU.nextT, AU.musicGain);
    if (AU.step % 2 === 0) { const b = bass[(AU.step / 2) % bass.length]; if (b && b !== '.') tone(N(b), stepDur * 1.6, 'triangle', 0.22, null, AU.nextT, AU.musicGain); }
    if (arp) { const a = arp[AU.step % arp.length]; if (a && a !== '.') tone(N(a), stepDur * 0.9, 'square', 0.035, null, AU.nextT, AU.musicGain); }
    if (drums) { const d = drums[AU.step % drums.length]; if (d && d !== '.') drum(d, AU.nextT); }
    else if (AU.step % 4 === 2) noise(0.05, 0.04, 6000, AU.nextT, AU.musicGain);
    AU.step++; AU.nextT += stepDur;
  }
}
