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
    case 'cast_force': tone(80, 1.2, 'sawtooth', 0.12 * v, 220); tone(160, 1.2, 'sine', 0.1 * v, 440); break; // mages gathering to cast together: a rising hum
    case 'cast_fire': noise(1.2, 0.22 * v, 900); for (let i = 0; i < 10; i++) noise(0.04, 0.15 * v, 3000, AU.ctx.currentTime + i * 0.11); tone(110, 1.0, 'sawtooth', 0.08 * v, 70); break; // a building roar
    case 'cast_storm': tone(60, 1.2, 'square', 0.07 * v, 240); for (let i = 0; i < 8; i++) tone(2000 + Math.random() * 1500, 0.05, 'square', 0.05 * v, null, AU.ctx.currentTime + i * 0.14); break; // crackling, climbing buzz
    case 'cast_bone': for (let i = 0; i < 12; i++) noise(0.03, 0.16 * v, 2800, AU.ctx.currentTime + i * 0.08); tone(55, 1.6, 'triangle', 0.14 * v, 48); break; // rattling over a low drone
    case 'click': tone(2600, 0.03, 'square', 0.07 * v, 1800); tone(1300, 0.05, 'sine', 0.05 * v, null, AU.ctx.currentTime + 0.05); break; // the Bat's Ear
    case 'shriek': tone(1900, 0.5, 'sawtooth', 0.12 * v, 2600); tone(2300, 0.4, 'square', 0.06 * v, 1500, AU.ctx.currentTime + 0.1); noise(0.4, 0.1 * v, 6000); break; // the Nightwing
    case 'zap': noise(0.08, 0.22 * v, 6000); tone(1800, 0.08, 'square', 0.08 * v, 400); tone(2400, 0.06, 'square', 0.06 * v, 900, AU.ctx.currentTime + 0.05); break; // a storm mage's bolt
    case 'bonecast': tone(520, 0.12, 'triangle', 0.1 * v, 260); noise(0.06, 0.14 * v, 3500, AU.ctx.currentTime + 0.04); break; // bone shards
    case 'rattle': for (let i = 0; i < 6; i++) noise(0.03, 0.16 * v, 2800, AU.ctx.currentTime + i * 0.05); break; // a skeleton climbs out of the floor
    case 'beam': tone(1400, 0.2, 'square', 0.1 * v, 2000); tone(700, 0.2, 'square', 0.06 * v, 1000); break;
    case 'wave': tone(200, 0.6, 'sawtooth', 0.2 * v, 1600); noise(0.5, 0.25 * v, 3000); break;
    case 'clink': tone(2400, 0.08, 'square', 0.1 * v, 1800); break;
    case 'heal': seq([523, 659, 784, 1047, 1319], 0.06, 'triangle', 0.15 * v); break;
    case 'stairs': seq([392, 349, 330, 294, 262], 0.06, 'square', 0.1 * v); break;
    case 'roar': tone(120, 0.5, 'sawtooth', 0.2 * v, 60); noise(0.4, 0.15 * v, 600); break;
    case 'reflect': seq([1568, 2093, 2637], 0.04, 'square', 0.13 * v); noise(0.05, 0.08 * v, 3000); break; // a perfect block sends it back
    case 'ward': tone(330, 0.25, 'triangle', 0.14 * v, 660); tone(495, 0.3, 'sine', 0.1 * v, 990); noise(0.08, 0.06 * v, 2500); break; // the Wardhold shield's ward stops a shot
    case 'rustle': noise(0.35, 0.12 * v, 1800); noise(0.2, 0.08 * v, 900, AU.ctx.currentTime + 0.15); break; // something in the bushes
    case 'webstick': noise(0.25, 0.1 * v, 600); tone(180, 0.35, 'sine', 0.08 * v, 120); break; // caught in web
    case 'webtear': noise(0.18, 0.16 * v, 2400); tone(400, 0.1, 'triangle', 0.06 * v, 250); break; // web torn free
    case 'skitter': for (let i = 0; i < 6; i++) noise(0.03, 0.09 * v, 3500 + i * 300, AU.ctx.currentTime + i * 0.06); break; // many small legs, overhead
    case 'hatch': noise(0.2, 0.12 * v, 900); tone(240, 0.12, 'square', 0.05 * v, 420); break; // an egg sac splits
    case 'whoosh': noise(0.5, 0.22 * v, 700); tone(90, 0.5, 'sawtooth', 0.08 * v, 160); break; // silk catching fire
    case 'armcut': tone(1200, 0.05, 'square', 0.05 * v, 700); noise(0.05, 0.06 * v, 5000); break; // the Silk Arm's echo cut
    case 'pipsqueak': seq([1568, 1175, 880], 0.05, 'square', 0.07 * v); break; // the little spider playing dead
    case 'growl': tone(70, 0.7, 'sawtooth', 0.12 * v, 55); noise(0.6, 0.06 * v, 300); break; // a low warning rumble (the wyrm arena's bait)
    case 'rage': tone(140, 0.8, 'sawtooth', 0.22 * v, 50); tone(95, 0.9, 'square', 0.12 * v, 40); noise(0.8, 0.2 * v, 500); break; // both wyrms enraged
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
    case 'gale': noise(0.9, 0.22 * v, 2400); seq([392, 523, 659, 784], 0.06, 'triangle', 0.1 * v); break; // the Gale Cloak lifts you
    case 'croak': tone(150, 0.18, 'square', 0.16 * v, 110); tone(120, 0.22, 'square', 0.14 * v, 90, AU.ctx.currentTime + 0.2); break; // a frog
    case 'bubble': tone(500, 0.12, 'sine', 0.1 * v, 900); tone(800, 0.06, 'sine', 0.06 * v, 1200, AU.ctx.currentTime + 0.1); break;
    case 'poison': tone(260, 0.15, 'sawtooth', 0.06 * v, 200); noise(0.12, 0.05 * v, 900); break; // a poison tick
    case 'disarm': tone(1300, 0.05, 'square', 0.12 * v, 900); tone(420, 0.25, 'triangle', 0.12 * v, 160, AU.ctx.currentTime + 0.04); noise(0.12, 0.1 * v, 3000); break; // a shield or staff knocked flying
    case 'force': noise(0.18, 0.22 * v, 700); tone(160, 0.18, 'sine', 0.16 * v, 60); break; // the wand's force bolt / wave
    case 'galeburst': noise(0.6, 0.3 * v, 900); tone(110, 0.5, 'sine', 0.2 * v, 40); seq([392, 523, 784], 0.07, 'triangle', 0.1 * v); break; // a combined Force Wave
    case 'chant': seq([440, 554, 659], 0.09, 'triangle', 0.08 * v); break; // a spell starts its chant
    case 'chantjoin': seq([659, 880, 1109], 0.07, 'square', 0.08 * v); break; // a friend joins the chant
    case 'windup': tone(300, 0.4, 'sawtooth', 0.07 * v, 900); noise(0.3, 0.05 * v, 5000); break; // a sword knight draws back for a counter
    case 'land': tone(200, 0.08, 'triangle', 0.1 * v, 120); noise(0.1, 0.08 * v, 800); break; // dropping out of a Gale Cloak flight
    case 'grip': tone(300, 0.06, 'triangle', 0.08 * v, 220); noise(0.05, 0.06 * v, 2500); break; // the sword flips into reverse grip
    case 'pommel': noise(0.07, 0.28 * v, 900); tone(140, 0.1, 'square', 0.16 * v, 50); break; // the hilt driven home
    case 'lungeready': seq([523, 784, 1047], 0.05, 'square', 0.08 * v); break; // held long enough to lunge
    case 'lunge': noise(0.25, 0.22 * v, 4000); tone(900, 0.2, 'sawtooth', 0.07 * v, 300); break;
    case 'gourd': tone(220, 0.06, 'square', 0.12 * v, 120); noise(0.12, 0.14 * v, 700); break; // a gourd splits
    case 'thok': tone(160, 0.05, 'triangle', 0.1 * v, 120); break; // a gourd shrugs off a swing
    case 'armor': tone(1600, 0.06, 'square', 0.1 * v, 900); noise(0.15, 0.16 * v, 5000); tone(500, 0.12, 'square', 0.08 * v, 250, AU.ctx.currentTime + 0.05); break; // armor flies off
    case 'clank': tone(900, 0.07, 'square', 0.1 * v, 700); tone(600, 0.07, 'square', 0.06 * v, 500, AU.ctx.currentTime + 0.05); break; // armor that won't come off that way
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
  // the frontier tunnels: a marching road song for each, the cold one in D minor with an icy arp, the ember one dark and driving
  tunnel_cold: { bpm: 112, lead: 'D5 . . F5 A5 . G5 F5 E5 . . . C5 . D5 E5 F5 . . A5 C6 . A#5 A5 G5 . . . . . . . A5 . . G5 F5 . E5 D5 C#5 . . . E5 . A4 . D5 . . E5 F5 . G5 A5 D5 . . . . . . .', bass: 'D2 D2 A2 D2 A#1 A#1 F2 A#1 C2 C2 G2 C2 A1 A1 E2 A1', arp: 'D4 A4 F5 A4 D4 A4 F5 A4 A#3 F4 D5 F4 A#3 F4 D5 F4 C4 G4 E5 G4 C4 G4 E5 G4 A3 E4 C#5 E4 A3 E4 C#5 E4', drums: 'k . h . s . h . k k h . s . h h' },
  tunnel_ember: { bpm: 120, lead: 'E5 . F5 . E5 . B4 . C5 . B4 . A4 . . . E5 . F5 . G5 . F5 E5 F5 . . . . . . . G5 . A5 . G5 . F5 . E5 . F5 . D5 . . . E5 . . . F5 E5 D5 C5 B4 . . . . . . .', bass: 'E2 E2 E3 E2 F2 F2 F3 F2 G2 G2 G3 G2 F2 F2 E2 E2', arp: 'E4 B4 E5 B4 E4 B4 E5 B4 F4 C5 F5 C5 F4 C5 F5 C5 G4 D5 G5 D5 G4 D5 G5 D5 F4 C5 F5 C5 E4 B4 E5 B4', drums: 'k . h k s . h . k . h k s s h .' },
  // DREAD: for the first old man's dark cave, the Lament, and other sad moments. Slow B phrygian with a tritone bell: sine
  // lead, held low drone, a heartbeat thud (d) through the stone, no hats.
  dread: { bpm: 54, quiet: true, wave: 'sine', leadSus: 5, leadVol: 0.11, bassSus: 3.8, bassVol: 0.14, arpWave: 'sine', arpSus: 6, arpVol: 0.05,
    lead: 'F#5 . . . G5 . . . . . . . F#5 . E5 . D5 . . . . . . . C#5 . . . . . . . . . . . . . . . B4 . . . C5 . . . B4 . . . . . . . . . . . . . . . . . . . D5 . . . C#5 . . . . . . . C5 . . . B4 . . . . . . . A#4 . . . . . . . . . . . . . . . B4 . . . . . . . . . . . . . . . . . . . . . . . . . . .',
    bass: 'B1 . . . B1 . . . G1 . . . G1 . . . B1 . . . B1 . . . C2 . . . A#1 . . .',
    arp: 'B5 . . . . . . . . . . . . . . . . . . . . . . . F6 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .',
    drone: 'B2 B2 G2 F#2',
    drums: 'd . d . . . . . . . . . . . . . . . . . . . . . . . . . . . . .' },
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
  else if (kind === 'd') { tone(62, 0.45, 'sine', 0.32, 40, t, g); noise(0.2, 0.03, 300, t, g); } // a far-off thud, like a heartbeat through stone
}
function musicTick() {
  if (!AU.ctx || !AU.track || !AU.on) return; const tr = AU.track; const stepDur = 60 / tr.bpm / 2;
  const lead = tr._l || (tr._l = tr.lead.split(' ')), bass = tr._b || (tr._b = tr.bass.split(' '));
  const arp = tr.arp ? (tr._a || (tr._a = tr.arp.split(' '))) : null, drums = tr.drums ? (tr._d || (tr._d = tr.drums.split(' '))) : null;
  while (AU.nextT < AU.ctx.currentTime + 0.25) {
    const l = lead[AU.step % lead.length]; if (l && l !== '.') tone(N(l), stepDur * (tr.leadSus || 1.8), tr.wave || 'square', tr.leadVol || 0.09, null, AU.nextT, AU.musicGain);
    if (AU.step % 2 === 0) { const b = bass[(AU.step / 2) % bass.length]; if (b && b !== '.') tone(N(b), stepDur * (tr.bassSus || 1.6), 'triangle', tr.bassVol || 0.22, null, AU.nextT, AU.musicGain); }
    if (arp) { const a = arp[AU.step % arp.length]; if (a && a !== '.') tone(N(a), stepDur * (tr.arpSus || 0.9), tr.arpWave || 'square', tr.arpVol || 0.035, null, AU.nextT, AU.musicGain); }
    if (tr.drone && AU.step % 16 === 0) { const dr = tr._dr || (tr._dr = tr.drone.split(' ')); const n = dr[(AU.step / 16) % dr.length]; if (n && n !== '.') { tone(N(n), stepDur * 17, 'sine', 0.12, null, AU.nextT, AU.musicGain); tone(N(n) * 1.004, stepDur * 17, 'sine', 0.06, null, AU.nextT, AU.musicGain); } } // a slow, slightly beating pedal tone
    if (drums) { const d = drums[AU.step % drums.length]; if (d && d !== '.') drum(d, AU.nextT); }
    else if (!tr.quiet && AU.step % 4 === 2) noise(0.05, 0.04, 6000, AU.nextT, AU.musicGain);
    AU.step++; AU.nextT += stepDur;
  }
}
