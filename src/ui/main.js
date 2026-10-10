// ===== ui/main.js : client game loop, local movement, events, menus and boot =====
'use strict';
const ADV_SEED = 7319;
const G = {
  state: 'title', profile: { name: 'HERO', color: 'GREEN', cls: 'sword' }, world: null, sim: null, myId: 'p1', snap: null,
  local: null, msgs: [], seen: {}, seenRooms: new Set(), smooth: {}, lastSend: 0, lastBcast: 0, events: [], disconnected: false, fps: 0,
};
function $(id) { return document.getElementById(id); }
function loadProfile() { try { const p = JSON.parse(localStorage.getItem('emberwake_profile') || 'null'); if (p) Object.assign(G.profile, p); } catch (e) { } if (!monkUnlocked()) G.profile.cls = 'sword'; }
function saveProfile() { try { localStorage.setItem('emberwake_profile', JSON.stringify(G.profile)); } catch (e) { } }
function monkUnlocked() { try { return localStorage.getItem('emberwake_monk') === '1'; } catch (e) { return false; } }
function unlockMonk() { try { localStorage.setItem('emberwake_monk', '1'); } catch (e) { } }
function saveKey(mode) { return 'emberwake_save_' + mode; }
function readSave(mode) { try { return JSON.parse(localStorage.getItem(saveKey(mode)) || 'null'); } catch (e) { return null; } }
function writeSave() {
  if (!G.sim || NET.role === 'client') return;
  try { localStorage.setItem(saveKey(G.world.mode), JSON.stringify(G.sim.makeSave())); localStorage.setItem('emberwake_seen_' + G.world.mode, JSON.stringify(packSeen())); } catch (e) { console.warn(e); }
}
function packSeen() { const o = {}; const L = G.world.levels.ow; const s = G.seen.ow; if (!s) return o; let str = ''; for (let i = 0; i < s.length; i += 4) str += ((s[i] ? 1 : 0) | (s[i + 1] ? 2 : 0) | (s[i + 2] ? 4 : 0) | (s[i + 3] ? 8 : 0)).toString(16); o.ow = str; o.rooms = [...G.seenRooms]; return o; }
function unpackSeen(o) { if (!o || !o.ow) return; const L = G.world.levels.ow; const s = G.seen.ow = new Uint8Array(L.w * L.h); for (let i = 0; i < o.ow.length; i++) { const v = parseInt(o.ow[i], 16); for (let b = 0; b < 4; b++) if (v & (1 << b)) s[i * 4 + b] = 1; } (o.rooms || []).forEach(r => G.seenRooms.add(r)); }

// ---------- start / join ----------
function startGame(mode, cont) {
  audioInit();
  const save = cont ? readSave(mode) : null;
  const seed = save ? save.seed : mode === 'adv' ? ADV_SEED : (Math.random() * 1e9) | 0;
  G.world = genWorld(seed, mode);
  G.sim = new Sim(G.world, save);
  NET.role = 'host'; G.myId = 'p1'; G.seen = {}; G.seenRooms = new Set();
  if (save) unpackSeen(JSON.parse(localStorage.getItem('emberwake_seen_' + mode) || 'null'));
  const p = G.sim.addPlayer('p1', G.profile.name, G.profile.color, G.profile.cls);
  if (!save && mode === 'rogue') { p.sword = 1; p.gems = 30; p.bombs = 4; p.items.bombs = true; G.sim.team.taken['c0:shop0'] = true; }
  if (!save && G.profile.cls === 'monk') p.cls = 'monk';
  const dbg = debugLoadout(); if (dbg.on) applyDebugLoadout(p, dbg, !save);
  G.sim.events = [];
  enterPlay(p.lvl, p.x, p.y, p.a);
  if (!save) { G.sim.initLevel('ow'); showDialog(mode === 'adv' ? 'THE EIGHT EMBER SHARDS HAVE BEEN SCATTERED, AND THE HOLLOW KING STIRS BENEATH THE NORTHERN PEAKS. FIND THE OLD MAN\'S CAVE TO THE NORTH. [PRESS ATTACK]' : 'ROGUELIKE RUN. A NEW LAND EVERY TIME. ONE LIFE. GOOD LUCK.'); }
  G.sim.time = 0;
}
function enterPlay(lvl, x, y, a) {
  G.local = { lvl, x, y, a, pitch: 0, kx: 0, ky: 0, atkCd: 0, swing: null, punch: null, combo: 0, comboT: 0, charge: 0, held: 0, bob: 0, useFlash: 0, useSpr: null, bumpT: 0, dashT: 0, dashCd: 0, dialog: null, title: null, flash: 0, flashC: 0, shake: 0, get: null, pow: [], fade: 1, reviveT: 0, npcTalked: {}, downT: 0, sel: null, lowT: 0, atkVis: 0 };
  G.state = 'play'; G.msgs = []; showScreen(null); $('hudbtns').classList.add('on');
}
function clientOnMsg(m) {
  if (m.t === 'welcome') {
    G.world = genWorld(m.seed, m.mode); G.myId = m.pid; G.profile.color = m.color; G.seen = {}; G.seenRooms = new Set();
    applyMods(m.mods); G.lastMv = m.mv;
    enterPlay(m.lvl, m.x, m.y, m.a); showToast('JOINED! YOU ARE ' + m.color);
    return;
  }
  if (m.t === 's') {
    if (!G.world) return;
    if (m.mods) applyMods(m.mods);
    G.snap = m; if (m.ev) for (const e of m.ev) handleEvent(e);
  }
}
function applyMods(mods) {
  for (const lvl in mods) { const L = G.world.levels[lvl]; if (!L) continue; L.sealRoom = {}; for (const i in mods[lvl]) { const [t, pr, seal] = mods[lvl][i]; L.tiles[i] = t; L.props[i] = pr; if (seal != null) L.sealRoom[i] = seal; } }
}

// ---------- events ----------
function handleEvent(e) {
  const me = G.myId, Lc = G.local; if (!Lc) return;
  switch (e.t) {
    case 'msg': if (!e.pid || e.pid === me) pushMsg(e.text); break;
    case 'hint': if (e.pid === me) pushMsg(e.text, 2); break;
    case 'sfx': if (e.lvl && e.lvl !== Lc.lvl) break; { let v = 1; if (e.x != null) v = clamp(1.3 - Math.sqrt(dist2(e.x, e.y, Lc.x, Lc.y)) / 14, 0.1, 1); sfx(e.s, v); } break;
    case 'hurt': if (e.pid === me) { Lc.kx = e.kx; Lc.ky = e.ky; Lc.flash = 0.25; Lc.flashC = rgb(255, 40, 40); Lc.shake = 0.2; sfx('hurt'); if (navigator.vibrate) try { navigator.vibrate(60); } catch (er) { } } break;
    case 'tp': if (e.pid === me) { Lc.lvl = e.lvl; Lc.x = e.x; Lc.y = e.y; Lc.a = e.a; Lc.fade = 0; Lc.pitch = 0; G.smooth = {}; Lc.npcTalked = {}; } break;
    case 'title': if (e.pid === me) Lc.title = { text: e.text, sub: e.sub, t: 3 }; break;
    case 'dialog': if (e.pid === me) showDialog(e.text); break;
    case 'get': if (e.pid === me || e.all) { Lc.get = { item: e.item, text: (e.pid === me ? '' : '') + e.text, t: 2.2 }; sfx(e.item === 'shard' ? 'fanfare' : 'get'); if (e.item === 'fists' && e.pid === me) unlockMonk(); } break;
    case 'down': if (e.pid === me) { Lc.downT = 0; sfx('die'); } break;
    case 'monk': if (e.pid === me) { Lc.flash = 1; Lc.flashC = rgb(255, 255, 255); G.profile.cls = 'monk'; saveProfile(); setTimeout(() => showDialog('YOUR SWORD CLATTERS TO THE FLOOR. YOUR FISTS HUM WITH POWER. PUNCH WITH ATTACK. HOLD ATTACK TO CHARGE A STARFALL WAVE. [SHIFT] FLASH STEP. EVERY ITEM YOU OWN... IS NOW SOMETHING ELSE.'), 1600); } break;
    case 'pow': if (e.lvl === Lc.lvl) Lc.pow.push({ x: e.x, y: e.y, t: 0, big: e.big, word: e.big ? ['KA-POW!', 'WHAM!', 'BOOM!'][Math.random() * 3 | 0] : ['POW!', 'BAM!', 'THWACK!', 'SMACK!'][Math.random() * 4 | 0] }); break;
    case 'shake': if (e.lvl === Lc.lvl && dist2(e.x, e.y, Lc.x, Lc.y) < 64) Lc.shake = 0.35; break;
    case 'flash': if (e.pid === me) { Lc.flash = 0.4; Lc.flashC = c32(hexToRgb(e.c)); } break;
    case 'win': G.state = 'win'; musicPlay('final'); showScreen('winScreen'); $('winStats').textContent = 'SHARDS 8/8  -  ' + Object.values(G.snap ? G.snap.pl : []).length + ' HERO(ES)'; if (NET.role === 'host') { try { localStorage.removeItem(saveKey(G.world.mode)); } catch (er) { } } break;
    case 'runover': G.state = 'over'; showScreen('overScreen'); try { localStorage.removeItem(saveKey('rogue')); } catch (er) { } break;
  }
}
function pushMsg(text, dur) { G.msgs.push({ text, t: dur || 4 }); if (G.msgs.length > 4) G.msgs.shift(); }
function showDialog(text) { if (!G.local) return; G.local.dialog = { text, shown: 0, lines: wrapText(text, Math.floor((R.W - 30) / 6)) }; }

// ---------- local player update ----------
function ownedBItems(me) { return me ? bItems().filter(d => d.owned(me)).map(d => d.id) : []; }
function sendAction(a) {
  if (NET.role === 'host') G.sim.onAction(G.myId, a); else if (NET.hostConn) NET.hostConn.send({ t: 'a', a });
}
function updateLocal(dt, inp) {
  const Lc = G.local; const snap = G.snap; if (!snap || !snap.me) return;
  const me = snap.me; const L = G.world.levels[Lc.lvl]; if (!L) return;
  Lc.fade = Math.min(1, Lc.fade + dt * 2.5);
  if (Lc.flash > 0) Lc.flash -= dt; if (Lc.shake > 0) Lc.shake -= dt; if (Lc.title) { Lc.title.t -= dt; if (Lc.title.t <= 0) Lc.title = null; } if (Lc.get) { Lc.get.t -= dt; if (Lc.get.t <= 0) Lc.get = null; }
  for (const m of G.msgs) m.t -= dt; G.msgs = G.msgs.filter(m => m.t > 0);
  Lc.pow.forEach(p => p.t += dt); Lc.pow = Lc.pow.filter(p => p.t < 0.6);
  // seen tracking
  markSeen(L, Lc.x, Lc.y);
  if (L.kind === 'dungeon') { const r = dungeonRoomAt(L, Lc.x, Lc.y); if (r) G.seenRooms.add(L.id + ':' + r.id); }
  // dialog
  if (Lc.dialog) {
    const d = Lc.dialog; const total = d.lines.join('').length; const prev = Math.floor(d.shown); d.shown = Math.min(total, d.shown + dt * 45); if (Math.floor(d.shown) > prev && Math.floor(d.shown) % 2 === 0) sfx('text', 0.6);
    if (inp.confirm || inp.atkP || inp.interactP) { if (d.shown < total) d.shown = total; else Lc.dialog = null; }
    return;
  }
  if (!me.alive) { Lc.downT += dt; Lc.swing = null; Lc.charge = 0; Lc.pitch = lerp(Lc.pitch, 25, dt * 3); Lc.a += inp.turn * 0.3; return; }
  // selected item validity
  const owned = ownedBItems(me); if (!owned.includes(Lc.sel)) Lc.sel = owned.includes(me.sel) ? me.sel : owned[0] || null;
  if (inp.cycle && owned.length) { let i = owned.indexOf(Lc.sel); i = (i + (inp.cycle > 0 ? 1 : -1) + owned.length) % owned.length; Lc.sel = owned[i]; sfx('menu'); sendAction({ t: 'sel', item: Lc.sel }); }
  if (inp.slot && owned[inp.slot - 1]) { Lc.sel = owned[inp.slot - 1]; sfx('menu'); }
  // turning
  Lc.a += inp.turn; Lc.pitch = clamp(Lc.pitch + inp.pitch, -50, 50); if (!IN.locked && !IN.mouseL && !IN.mouseR) Lc.pitch *= 0.95;
  // movement
  const monk = me.cls === 'monk'; let spd = monk ? 4.0 : 3.6;
  if (Lc.charge > 0.3) spd *= 0.5;
  if (Lc.dashCd > 0) Lc.dashCd -= dt;
  if (inp.dash && monk && Lc.dashCd <= 0) { Lc.dashT = 0.16; Lc.dashCd = 0.7; sfx('dash'); Lc.dashDir = Math.atan2(inp.str, inp.fwd || (inp.str ? 0 : 1)); }
  let mvx = (Math.cos(Lc.a) * inp.fwd + Math.cos(Lc.a + Math.PI / 2) * inp.str) * spd, mvy = (Math.sin(Lc.a) * inp.fwd + Math.sin(Lc.a + Math.PI / 2) * inp.str) * spd;
  if (Lc.dashT > 0) { Lc.dashT -= dt; const da = Lc.a + (Lc.dashDir || 0); mvx = Math.cos(da) * 15; mvy = Math.sin(da) * 15; }
  mvx += Lc.kx; mvy += Lc.ky; Lc.kx *= Math.pow(0.0005, dt); Lc.ky *= Math.pow(0.0005, dt); if (Math.abs(Lc.kx) < 0.1) Lc.kx = 0; if (Math.abs(Lc.ky) < 0.1) Lc.ky = 0;
  const moving = Math.abs(inp.fwd) + Math.abs(inp.str) > 0.1; if (moving) Lc.bob += dt * spd * 2.6;
  const raft = !!me.items.raft; const rad = 0.22; const sop = { raft, mx: Lc.x, my: Lc.y };
  const solid = (x, y) => { for (const [ox, oy] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad]]) if (L.solidAt(x + ox, y + oy, sop)) return true; return false; };
  const nx = Lc.x + mvx * dt, ny = Lc.y + mvy * dt; let blockedX = false, blockedY = false;
  if (!solid(nx, Lc.y)) Lc.x = nx; else blockedX = true;
  if (!solid(Lc.x, ny)) Lc.y = ny; else blockedY = true;
  // bump interactions
  Lc.bumpT -= dt;
  if ((blockedX || blockedY) && moving && Lc.bumpT <= 0) {
    const fx = Math.floor(Lc.x + Math.sign(mvx) * (blockedX ? 0.5 : 0)), fy = Math.floor(Lc.y + Math.sign(mvy) * (blockedY ? 0.5 : 0));
    for (const [tx, ty] of [[fx, fy], [Math.floor(Lc.x + Math.cos(Lc.a) * 0.6), Math.floor(Lc.y + Math.sin(Lc.a) * 0.6)]]) {
      const idx = ty * L.w + tx; const t = L.get(tx, ty); const ti = TINFO[t];
      if (ti.portal || ti.shardGate) { sendAction({ t: 'enter', idx }); Lc.bumpT = 0.8; break; }
      if (ti.locked) { sendAction({ t: 'unlock', idx }); Lc.bumpT = 0.6; break; }
      if (ti.exitWall) { sendAction({ t: 'exit' }); Lc.bumpT = 0.8; break; }
    }
  }
  // step-on tiles
  const ct = L.get(Math.floor(Lc.x), Math.floor(Lc.y)); const cti = TINFO[ct];
  if ((cti.exit) && Lc.bumpT <= 0) { sendAction({ t: 'exit' }); Lc.bumpT = 0.8; }
  if (cti.stairs && L.portals[L.idx(Math.floor(Lc.x), Math.floor(Lc.y))] && Lc.bumpT <= 0) { sendAction({ t: 'enter', idx: L.idx(Math.floor(Lc.x), Math.floor(Lc.y)) }); Lc.bumpT = 0.8; }
  // conveyor floors push you
  if (cti.conveyor) { const cx = Lc.x + cti.conveyor[0] * dt, cy = Lc.y + cti.conveyor[1] * dt; if (!solid(cx, Lc.y)) Lc.x = cx; if (!solid(Lc.x, cy)) Lc.y = cy; }
  // pits: fall in once your center is over one, and come back where you last stood safely
  if (cti.pit) { const fx = Lc.x - Math.floor(Lc.x), fy = Lc.y - Math.floor(Lc.y); if (fx > 0.25 && fx < 0.75 && fy > 0.25 && fy < 0.75 && performance.now() - (Lc.fellAt || 0) > 900) { Lc.fellAt = performance.now(); sendAction({ t: 'fall', x: Lc.safeX, y: Lc.safeY }); Lc.flash = 0.4; Lc.flashC = rgb(0, 0, 0); } }
  else if (!cti.hurt && !cti.glass && !cti.conveyor) { Lc.safeX = Lc.x; Lc.safeY = Lc.y; }
  // walls you can walk through whisper when you're close
  if (L.kind === 'dungeon' && R.time - (Lc.whisperAt || 0) > 2.5) {
    let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (TINFO[L.get(Math.floor(Lc.x) + dx, Math.floor(Lc.y) + dy)].fake) { near = true; break; }
    if (near) { Lc.whisperAt = R.time; sfx('whisper'); if (!Lc.whisperHint) { Lc.whisperHint = true; pushMsg('...SOMETHING WHISPERS NEARBY...', 3); } }
  }
  // NPC auto-talk & sign
  for (const e of (snap.en || [])) { if (e[9] && dist2(e[2], e[3], Lc.x, Lc.y) < 6 && !Lc.npcTalked[e[0]]) { Lc.npcTalked[e[0]] = true; showDialog(e[9]); } }
  if (inp.interactP || (inp.atkP && me.sword === 0 && !monk)) {
    const sx = Math.floor(Lc.x + Math.cos(Lc.a) * 0.9), sy = Math.floor(Lc.y + Math.sin(Lc.a) * 0.9); const si = sy * L.w + sx;
    if (L.props[si] === PR.SIGN && L.signText && L.signText[si]) showDialog(L.signText[si]);
  }
  // revive teammates
  Lc.reviveTarget = (snap.pl || []).find(p => p[0] !== G.myId && !p[8] && p[1] === Lc.lvl && dist2(p[2], p[3], Lc.x, Lc.y) < REVIVE_R2) || null;
  if (inp.interact && Lc.reviveTarget) { const nw = performance.now(); if (nw - (Lc.reviveSent || 0) > 100) { Lc.reviveSent = nw; sendAction({ t: 'revive' }); } }
  // attack
  Lc.atkCd -= dt; Lc.comboT -= dt; if (Lc.swing != null) { Lc.swing += dt; if (Lc.swing > 0.3) Lc.swing = null; } if (Lc.punch) { Lc.punch.t += dt; if (Lc.punch.t > 0.25) Lc.punch = null; }
  if (Lc.atkVis > 0) Lc.atkVis -= dt;
  if (monk) {
    if (inp.atkP && Lc.atkCd <= 0) {
      if (Lc.comboT <= 0) Lc.combo = 0; Lc.combo++; const third = Lc.combo % 3 === 0;
      Lc.punch = { side: Lc.combo % 2 ? 1 : -1, t: 0 }; Lc.atkCd = third ? 0.3 : 0.16; Lc.comboT = 0.55; sfx('punch'); Lc.atkVis = 0.2;
      sendAction({ t: 'atk', kind: third ? 'punch3' : 'punch' });
    }
    if (inp.atk) { Lc.held += dt; if (Lc.held > 0.3) { const before = Lc.charge; Lc.charge = Math.min(1.2, Lc.charge + dt); if (Math.floor(Lc.charge * 8) !== Math.floor(before * 8)) sfx('charge'); } }
    else { if (Lc.charge >= 0.8) { sendAction({ t: 'atk', kind: 'wave' }); Lc.shake = 0.25; Lc.flash = 0.15; Lc.flashC = rgb(160, 230, 255); Lc.punch = { side: 1, t: 0 }; } Lc.charge = 0; Lc.held = 0; }
  } else if (inp.atkP && Lc.atkCd <= 0 && me.sword > 0) {
    Lc.swing = 0; Lc.atkCd = 0.3; sfx('swing'); Lc.atkVis = 0.25; sendAction({ t: 'atk', kind: 'sword' });
  }
  if (inp.item && Lc.sel) { sendAction({ t: 'use', item: Lc.sel }); Lc.useFlash = 0.3; Lc.useSpr = itemSprite(Lc.sel, me.cls); }
  if (Lc.useFlash > 0) Lc.useFlash -= dt;
  // low hp beep
  if (me.hp <= 4 && me.hp > 0) { Lc.lowT -= dt; if (Lc.lowT <= 0) { Lc.lowT = 0.5; sfx('lowhp'); } }
  // music
  let track = L.kind === 'ow' ? 'ow' : L.kind === 'cave' ? 'cave' : 'dungeon';
  if (L.kind === 'dungeon') { const r = dungeonRoomAt(L, Lc.x, Lc.y); if (r && r.boss && snap.en.some(e => e[8] >= 0)) track = L.dnum === 9 ? 'final' : 'boss'; }
  musicPlay(track);
}
function markSeen(L, x, y) {
  let s = G.seen[L.id]; if (!s) s = G.seen[L.id] = new Uint8Array(L.w * L.h);
  const r = 7; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { if (i * i + j * j > r * r) continue; const tx = Math.floor(x) + i, ty = Math.floor(y) + j; if (tx >= 0 && ty >= 0 && tx < L.w && ty < L.h) s[ty * L.w + tx] = 1; }
}

// ---------- frame ----------
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const rdt = Math.min(0.25, (now - lastT) / 1000); let dt = Math.min(0.05, rdt); lastT = now; R.time += dt;
  G.fps = G.fps * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
  musicTick();
  const inp = readInput(dt);
  if (G.state === 'title') { titleKonami(inp); return; }
  if (!G.local || !G.world) return;
  if (G.state === 'play') {
    if (inp.pause) { openPause(); }
    else if (inp.map) { G.state = 'map'; }
  } else if (G.state === 'map') { if (inp.map || inp.pause || inp.confirm) G.state = 'play'; }
  else if (G.state === 'pause' && inp.pause && performance.now() - (G.pauseAt || 0) > 400 && $('pauseScreen').classList.contains('on')) resume();
  // host simulation
  const soloPaused = Object.keys(NET.conns).length === 0 && !NET.peer && (G.state === 'pause' || G.state === 'map' || (G.local && G.local.dialog));
  if (NET.role === 'host' && G.sim && G.state !== 'title' && !soloPaused) {
    const Lc = G.local; const mp = G.sim.players[G.myId];
    if (mp && G.state === 'play') G.sim.onPlayerState(G.myId, { lvl: Lc.lvl, x: Lc.x, y: Lc.y, a: Lc.a, atk: Lc.atkVis > 0 ? 1 : 0, sel: Lc.sel });
    // fixed steps that catch up after slow frames, so game time keeps pace with real time
    G.simAcc = Math.min(0.25, (G.simAcc || 0) + rdt);
    while (G.simAcc >= 1 / 60) { G.sim.tick(1 / 60); G.simAcc -= 1 / 60; }
    const evs = G.sim.events; G.sim.events = [];
    G.events.push(...evs);
    for (const e of evs) handleEvent(e);
    G.snap = G.sim.snapshotFor(G.myId);
    if (now - G.lastBcast > 50) { G.lastBcast = now; hostBroadcast(G.events); G.events = []; }
    if (G.sim.autosave) { G.sim.autosave = false; writeSave(); }
  } else if (NET.role === 'host' && G.sim) { G.snap = G.sim.snapshotFor(G.myId);
  } else if (NET.role === 'client' && NET.hostConn && now - G.lastSend > 50) {
    G.lastSend = now; const Lc = G.local; NET.hostConn.send({ t: 'ps', lvl: Lc.lvl, x: Math.round(Lc.x * 100) / 100, y: Math.round(Lc.y * 100) / 100, a: Math.round(Lc.a * 100) / 100, atk: Lc.atkVis > 0 ? 1 : 0, sel: Lc.sel });
  }
  if (G.state === 'play') updateLocal(dt, inp);
  draw(dt);
}
function draw(dt) {
  const Lc = G.local; const snap = G.snap; const L = G.world.levels[Lc.lvl];
  if (!L) return;
  const me = snap && snap.me;
  // smooth entity positions (clients)
  let ents = snap ? snap.en : [];
  if (NET.role === 'client') {
    const sm = G.smooth; const seen = {};
    ents = ents.map(e => { const s = sm[e[0]] || (sm[e[0]] = { x: e[2], y: e[3] }); const k = Math.min(1, dt * 14); if (dist2(s.x, s.y, e[2], e[3]) > 4) { s.x = e[2]; s.y = e[3]; } s.x += (e[2] - s.x) * k; s.y += (e[3] - s.y) * k; seen[e[0]] = 1; const c = e.slice(); c[2] = s.x; c[3] = s.y; return c; });
    for (const id in sm) if (!seen[id]) delete sm[id];
  }
  const down = me && !me.alive;
  const shake = Lc.shake > 0 ? (Math.random() - 0.5) * 6 * Lc.shake : 0;
  const cam = { x: Lc.x, y: Lc.y, a: Lc.a + shake * 0.01, pitch: Lc.pitch + shake * 4, eye: down ? 0.12 : 0.5 + Math.sin(Lc.bob * 2) * 0.012 };
  renderWorld(cam, L, ents, snap ? snap.pl : [], G.myId);
  // pow words
  for (const p of Lc.pow) { const sc = projectPt(cam, p.x, p.y); if (sc) { const c = p.big ? rgb(255, 230, 60) : rgb(255, 255, 255); text(p.word, sc.x - p.word.length * 3, sc.y - 30 - p.t * 30, Math.floor(p.t * 20) & 1 ? c : rgb(255, 80, 40)); } }
  const bossE = ents.find(e => e[8] >= 0);
  const st = { me, bob: Lc.bob, swing: Lc.swing, punch: Lc.punch, charge: Lc.charge, useFlash: Lc.useFlash, useSpr: Lc.useSpr, level: L, cam, players: snap ? snap.pl : [], myId: G.myId, team: snap ? snap.team : { keys: {}, maps: {}, comps: {}, shards: [], done: [] }, seen: G.seen[L.id] || new Uint8Array(L.w * L.h), seenOW: G.seen.ow || new Uint8Array(1), seenRooms: G.seenRooms, selItem: Lc.sel, pitch: Lc.pitch, lvlKind: L.kind, bossHp: bossE ? bossE[8] : -1, world: G.world };
  if (me && !down) drawViewmodel(st);
  if (me && me.cls === 'monk' && me.armor > 0 && !down) { const ac = me.armor === 2 ? rgb(255, 248, 200) : rgb(100, 190, 255); for (let i = 0; i < 18; i++) { const side = Math.random() < 0.5; const x = side ? (Math.random() < 0.5 ? Math.random() * 10 : R.W - Math.random() * 10) : Math.random() * R.W; const y = side ? Math.random() * R.H : R.H - Math.random() * 8; px(x, y, ac); } }
  if (Lc.dashT > 0) rectA(0, 0, R.W, R.H, rgb(200, 240, 255), 0.15);
  if (down) { rectA(0, 0, R.W, R.H, rgb(40, 40, 60), 0.5); const multi = snap.pl.length > 1; textC(multi ? 'YOU ARE DOWN!' : 'YOU HAVE FALLEN...', R.W / 2, R.H / 2 - 20, rgb(255, 80, 80)); textC(multi ? 'A TEAMMATE CAN HOLD F NEXT TO YOU TO HELP YOU UP' : 'RISING AGAIN...', R.W / 2, R.H / 2 - 8, rgb(230, 230, 230)); const myP = snap.pl.find(p => p[0] === G.myId); if (myP && myP[11] > 0) { rect(R.W / 2 - 40, R.H / 2 + 6, 80, 5, rgb(30, 30, 30)); rect(R.W / 2 - 40, R.H / 2 + 6, 80 * clamp(myP[11], 0, 1), 5, rgb(80, 255, 120)); } }
  drawHUD(st);
  if (Lc.reviveTarget && me && me.alive) { const t = Lc.reviveTarget; const c = c32(hexToRgb((PCOLORS.find(c => c.name === t[5]) || PCOLORS[0]).c)); const y = R.H / 2 + 22; const label = 'HOLD F: HELP UP ' + t[10]; rectA(R.W / 2 - label.length * 3 - 6, y - 4, label.length * 6 + 12, 22, rgb(0, 0, 0), 0.6); textC(label, R.W / 2, y, c); rect(R.W / 2 - 40, y + 10, 80, 4, rgb(40, 40, 40)); rect(R.W / 2 - 40, y + 10, 80 * clamp(t[11], 0, 1), 4, rgb(90, 255, 130)); }
  // messages
  let my = 52; for (const m of G.msgs) { const lines = wrapText(m.text, Math.floor((R.W - 100) / 6)); for (const ln of lines) { textC(ln, R.W / 2, my, rgb(255, 255, 255)); my += 9; } }
  if (Lc.title) { const a = Math.min(1, Lc.title.t); rectA(0, R.H / 2 - 22, R.W, 34, rgb(0, 0, 0), 0.6 * a); textC(Lc.title.text, R.W / 2, R.H / 2 - 18, rgb(255, 220, 120)); textC(Lc.title.sub || '', R.W / 2, R.H / 2 - 4, rgb(255, 255, 255)); }
  if (Lc.get) { const s = SPR[itemSprite(Lc.get.item, me && me.cls)] || SPR.heart; rectA(R.W / 2 - 70, 54, 140, 52, rgb(0, 0, 0), 0.7); frame(R.W / 2 - 70, 54, 140, 52, rgb(255, 210, 90)); blit(s, R.W / 2 - 16, 58, 2); textC(Lc.get.text, R.W / 2, 94, rgb(255, 230, 140)); }
  if (Lc.dialog) drawDialog(Lc.dialog);
  if (G.state === 'map') drawBigMap(st);
  if (Lc.flash > 0) rectA(0, 0, R.W, R.H, Lc.flashC, Math.min(0.6, Lc.flash));
  if (Lc.fade < 1) rectA(0, 0, R.W, R.H, rgb(0, 0, 0), 1 - Lc.fade);
  if (snap && snap.over) { textC('THE PARTY HAS FALLEN', R.W / 2, R.H / 2 + 20, rgb(255, 60, 60)); }
  if (G.disconnected) textC('DISCONNECTED - PRESS ESC', R.W / 2, R.H - 40, rgb(255, 100, 100));
  if (G.showFps) text(Math.round(G.fps) + ' FPS', R.W - 50, R.H - 20, rgb(255, 255, 0));
  present();
}
function projectPt(cam, x, y) {
  const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a); const fov = 0.66 * (R.W / R.H) / 1.78; const plX = -dirY * fov, plY = dirX * fov;
  const sx = x - cam.x, sy = y - cam.y; const inv = 1 / (plX * dirY - dirX * plY); const tX = inv * (dirY * sx - dirX * sy), tY = inv * (-plY * sx + plX * sy);
  if (tY <= 0.2) return null; return { x: (R.W / 2) * (1 + tX / tY), y: R.H / 2 + cam.pitch };
}
function drawDialog(d) {
  const W = R.W, H = R.H; const bh = Math.min(70, 14 + d.lines.length * 9); const y0 = H - bh - 36;
  rectA(10, y0, W - 20, bh, rgb(0, 0, 0), 0.85); frame(10, y0, W - 20, bh, rgb(255, 255, 255)); frame(12, y0 + 2, W - 24, bh - 4, rgb(120, 120, 140));
  let n = Math.floor(d.shown); let y = y0 + 7;
  for (const ln of d.lines) { if (n <= 0) break; text(ln.slice(0, n), 18, y, rgb(255, 255, 255)); n -= ln.length; y += 9; if (y > y0 + bh - 9) break; }
  if (d.shown >= d.lines.join('').length && Math.floor(R.time * 3) & 1) text('>', W - 22, y0 + bh - 10, rgb(255, 220, 120));
}

// ---------- UI ----------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  const playing = !id; $('hudbtns').classList.toggle('on', playing && G.state !== 'title');
  if (!playing && document.exitPointerLock && IN.locked) document.exitPointerLock();
}
function showToast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(showToast.tm); showToast.tm = setTimeout(() => el.classList.remove('on'), 3500); }
function openPause() { if (G.state !== 'pause') G.pauseAt = performance.now(); G.state = 'pause'; showScreen('pauseScreen'); $('pSave').style.display = NET.role === 'host' ? '' : 'none'; $('pInvite').style.display = NET.role === 'host' ? '' : 'none'; updatePauseInfo(); }
function resume() { G.state = 'play'; showScreen(null); try { const r = $('game').requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
function updatePauseInfo() {
  const n = G.snap ? G.snap.pl.length : 1; const me = G.snap && G.snap.me;
  const dOn = !!(G.snap && G.snap.me && G.snap.me.dbg); $('pDebug').style.display = dOn ? '' : 'none';
  const dev = isDevName(G.snap && G.snap.me ? G.snap.me.name : G.profile.name); $('pDbgToggle').style.display = dev ? '' : 'none'; $('pDbgToggle').textContent = 'DEBUG: ' + (dOn ? 'ON' : 'OFF');
  if (dOn && !$('pWarps').childElementCount) { const mk = (label, to) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { sendAction({ t: 'warp', to }); resume(); }; $('pWarps').appendChild(b); }; mk('WILDS', 'ow'); for (let d = 1; d <= 9; d++) mk('L' + d, 'd' + d); }
  $('pInfo').textContent = (NET.role === 'host' ? 'HOSTING' : NET.role === 'client' ? 'CONNECTED' : 'SOLO') + ' - ' + n + ' PLAYER' + (n > 1 ? 'S' : '') + (me ? ' - ' + (me.cls === 'monk' ? 'MARTIAL ARTIST' : 'SWORD') : '');
}
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let konamiIdx = 0;
addEventListener('keydown', e => {
  if (G.state !== 'title') return;
  if (e.code === KONAMI[konamiIdx]) { konamiIdx++; if (konamiIdx === KONAMI.length) { konamiIdx = 0; if (!monkUnlocked()) { unlockMonk(); audioInit(); sfx('secret'); showToast('A HIDDEN PATH OPENS... A NEW CLASS AWAKENS'); buildClassPicker(); } } } else konamiIdx = e.code === KONAMI[0] ? 1 : 0;
});
function titleKonami() { }
function buildColorPicker() {
  const box = $('colors'); box.innerHTML = '';
  PCOLORS.forEach(c => { const b = document.createElement('button'); b.className = 'sw' + (G.profile.color === c.name ? ' sel' : ''); b.style.background = c.c; b.title = c.name; b.onclick = () => { G.profile.color = c.name; saveProfile(); buildColorPicker(); drawPreview(); sfx('menu'); }; box.appendChild(b); });
  drawPreview();
}
function buildClassPicker() {
  const box = $('classes'); box.innerHTML = '';
  const opts = [{ id: 'sword', label: 'SWORD & SHIELD' }, { id: 'monk', label: monkUnlocked() ? 'MARTIAL ARTIST' : '? ? ?' }];
  opts.forEach(o => { const b = document.createElement('button'); b.className = 'cls' + (G.profile.cls === o.id ? ' sel' : '') + (o.id === 'monk' && !monkUnlocked() ? ' locked' : ''); b.textContent = o.label; b.onclick = () => { if (o.id === 'monk' && !monkUnlocked()) { showToast('LOCKED. SOME SAY A MASTER HIDES IN THE MOUNTAINS...'); return; } G.profile.cls = o.id; saveProfile(); buildClassPicker(); drawPreview(); sfx('menu'); }; box.appendChild(b); });
}
function drawPreview() {
  const cv = $('preview'); const c = cv.getContext('2d'); cv.width = 64; cv.height = 32; const img = c.createImageData(64, 32); const b = new Uint32Array(img.data.buffer);
  const col = (PCOLORS.find(x => x.name === G.profile.color) || PCOLORS[0]).c;
  [0, 1, 2].forEach((tier, i) => { const s = heroSprite(G.profile.cls, col, G.profile.cls === 'monk' ? 0 : tier, 'front'); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = s.px[y * 16 + x]; if (v) { for (let k = 0; k < 2; k++) for (let m = 0; m < 2; m++) { const xx = 2 + i * 21 + x, yy = y * 2 + k; if (xx < 64 && yy < 32) b[yy * 64 + xx] = v; } } } });
  c.putImageData(img, 0, 0);
}
function drawLogo() {
  const cv = $('logo'); const c = cv.getContext('2d'); const str = 'EMBERWAKE'; cv.width = str.length * 6 + 2; cv.height = 9;
  const img = c.createImageData(cv.width, cv.height); const buf = new Uint32Array(img.data.buffer);
  let x = 0; for (const ch of str) { const g = FONT[ch]; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j] & (1 << i)) { buf[(j + 1) * cv.width + x + i + 1] = rgb(120, 40, 10); buf[j * cv.width + x + i] = j < 3 ? rgb(255, 230, 120) : j < 5 ? rgb(250, 160, 40) : rgb(230, 80, 30); } x += 6; }
  c.putImageData(img, 0, 0);
}
// ---- lobby / invite UI ----
async function hostInviteQR() {
  const el = $('invStatus'); el.textContent = 'CREATING INVITE...';
  try {
    // ask for the camera first: besides scanning replies, a granted camera lets browsers share
    // plain local network addresses, which makes hotspot connections far more reliable
    if (!G.camAsked && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) { G.camAsked = true; try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach(t => t.stop()); } catch (e) { } }
    const code = await hostCreateInvite();
    drawQR($('invQR'), code); $('invCode').value = code; $('invStep').textContent = '1. ON THE OTHER DEVICE: JOIN GAME > SCAN. 2. THEN TAP "SCAN THEIR REPLY" BELOW.';
    el.textContent = 'INVITE READY';
  } catch (e) { el.textContent = 'ERROR: ' + e.message; }
}
async function hostScanReply() {
  const el = $('invStatus'); $('invScanWrap').style.display = 'block';
  try { await startScan($('invVideo'), async (code) => { $('invScanWrap').style.display = 'none'; await hostTakeReply(code); }); el.textContent = 'POINT THE CAMERA AT THEIR REPLY QR'; }
  catch (e) { el.textContent = 'CAMERA: ' + e.message; $('invScanWrap').style.display = 'none'; }
}
async function hostTakeReply(code) {
  const el = $('invStatus');
  try { await hostAcceptReply(code); el.textContent = 'CONNECTING...'; setTimeout(() => { el.textContent = 'CONNECTED PLAYERS: ' + Object.keys(NET.conns).length + '. TAP NEW INVITE TO ADD ANOTHER.'; }, 1500); sfx('menu'); }
  catch (e) { el.textContent = 'ERROR: ' + e.message; }
}
const ROOM_WORDS = ['EMBER', 'FOX', 'WYRM', 'OWL', 'STONE', 'TIDE', 'ASH', 'MOSS', 'IRON', 'STAR', 'BRAMBLE', 'CROW', 'FLINT', 'GALE', 'HOLLOW', 'RAVEN'];
function randomRoom() { const r = () => ROOM_WORDS[Math.random() * ROOM_WORDS.length | 0]; let a = r(), b = r(); while (b === a) b = r(); return a + b; }
function cleanRoom(w) { w = String(w || '').trim(); const m = w.match(/#join[-=]?([A-Za-z0-9]+)/i); if (m) w = m[1]; return w.replace(/^GLD-?/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16); }
function inviteLink(word) { if (!/^https?:/.test(location.protocol)) return null; return location.origin + location.pathname + '#join-' + word; }
async function hostOnline() {
  const word = cleanRoom($('onlineWord').value) || randomRoom(); $('onlineWord').value = word; const el = $('invStatus');
  if (NET.peer && NET.roomWord === word) { showRoom(word); return; }
  if (NET.peer) { try { NET.peer.destroy(); } catch (e) { } NET.peer = null; }
  el.textContent = 'OPENING ROOM...';
  try { await onlineHost(word); NET.roomWord = word; el.textContent = 'ROOM OPEN. PLAYERS: ' + Object.keys(NET.conns).length; showRoom(word); sfx('secret'); }
  catch (e) { el.textContent = e.message; }
}
function showRoom(word) {
  $('roomBox').style.display = 'block'; $('roomCode').textContent = 'GLD-' + word;
  const link = inviteLink(word);
  $('roomLinkRow').style.display = link ? '' : 'none'; if (link) $('roomLink').value = link;
  $('roomNote').textContent = link ? 'OR THEY CAN OPEN THE GAME, PICK JOIN, AND TYPE GLD-' + word + '.' : 'FRIENDS OPEN THEIR COPY OF THE GAME, PICK JOIN A FRIEND, AND TYPE GLD-' + word + '. (CLICKABLE LINKS WORK WHEN THE GAME IS ON A WEBSITE.)';
}
async function joinScan() {
  const el = $('joinStatus'); $('joinScanWrap').style.display = 'block';
  try { await startScan($('joinVideo'), (code) => { $('joinScanWrap').style.display = 'none'; joinWithCode(code); }); el.textContent = 'POINT THE CAMERA AT THE HOST\'S QR'; }
  catch (e) { el.textContent = 'CAMERA: ' + e.message; $('joinScanWrap').style.display = 'none'; }
}
async function joinWithCode(code) {
  const el = $('joinStatus'); el.textContent = 'MAKING REPLY...'; audioInit();
  try {
    const { reply, ready } = await joinFromInvite(code);
    $('joinReply').style.display = 'block'; drawQR($('joinQR'), reply); $('joinReplyCode').value = reply;
    el.textContent = 'NOW LET THE HOST SCAN THIS REPLY QR';
    const conn = await ready; el.textContent = 'CONNECTED! LOADING...'; joinerStart(conn);
  } catch (e) { el.textContent = 'ERROR: ' + e.message; }
}
async function joinOnline() {
  const el = $('joinStatus'); const word = cleanRoom($('joinWord').value); if (!word) { el.textContent = 'ENTER THE ROOM CODE YOUR FRIEND SENT'; return; }
  el.textContent = 'CONNECTING TO GLD-' + word + '...'; audioInit();
  try { const conn = await onlineJoin(word); el.textContent = 'CONNECTED! LOADING...'; joinerStart(conn); } catch (e) { el.textContent = e.message; }
}
function quitToTitle() {
  writeSave(); stopScan();
  for (const pid in NET.conns) NET.conns[pid].close(); NET.conns = {}; if (NET.hostConn) NET.hostConn.close(); NET.hostConn = null; if (NET.peer) { try { NET.peer.destroy(); } catch (e) { } NET.peer = null; }
  NET.role = 'solo'; NET.roomWord = null; G.sim = null; G.world = null; G.local = null; G.snap = null; G.state = 'title'; G.disconnected = false; musicPlay(null); showScreen('titleScreen'); refreshTitle();
}
function refreshTitle() {
  $('btnDebug').textContent = 'DEBUG: ' + (debugLoadout().on ? 'ON' : 'OFF'); $('btnDebug').style.display = isDevName(G.profile.name) ? '' : 'none';
  $('btnContinue').style.display = readSave('adv') ? '' : 'none'; $('btnRogueCont').style.display = readSave('rogue') ? '' : 'none';
  $('pname').value = G.profile.name; buildColorPicker(); buildClassPicker();
}
function bindUI() {
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = (e) => { audioInit(); sfx('menu'); fn(e); }; };
  $('pname').oninput = (e) => { G.profile.name = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 8) || 'HERO'; saveProfile(); $('btnDebug').style.display = isDevName(G.profile.name) ? '' : 'none'; $('btnDebug').textContent = 'DEBUG: ' + (debugLoadout().on ? 'ON' : 'OFF'); };
  on('btnNew', () => { if (readSave('adv') && !confirm('Start a new adventure? Your old save will be replaced.')) return; startGame('adv', false); });
  on('btnContinue', () => startGame('adv', true));
  on('btnRogue', () => startGame('rogue', false));
  on('btnRogueCont', () => startGame('rogue', true));
  on('btnJoin', () => { showScreen('joinScreen'); $('joinReply').style.display = 'none'; $('joinStatus').textContent = ''; setTimeout(() => $('joinWord').focus(), 50); });
  on('btnHelp', () => showScreen('helpScreen'));
  on('btnDebug', () => { fillDebugUI(); showScreen('debugScreen'); });
  // in-game debug switch (dev names only): remembers the choice for next time too
  on('pDbgToggle', () => {
    const now = !(G.snap && G.snap.me && G.snap.me.dbg);
    G.profile.dbg = Object.assign(defaultDebug(), G.profile.dbg || {}, { on: now }); saveProfile();
    sendAction({ t: 'debug', on: now, god: !!G.profile.dbg.god });
    setTimeout(updatePauseInfo, 150); showToast(now ? 'DEBUG ON' : 'DEBUG OFF');
  });
  on('dbgBack', () => { readDebugUI(); showScreen('titleScreen'); refreshTitle(); });
  on('dbgAll', () => { G.profile.dbg = Object.assign(defaultDebug(), { on: true, sword: 3, armor: 2, hearts: 16, gems: 999, bombs: 16, arrows: 30, potions: 2, shards: 8, items: debugItems().map(i => i[0]) }); fillDebugUI(); });
  on('dbgNone', () => { G.profile.dbg = Object.assign(defaultDebug(), { on: true }); fillDebugUI(); });
  on('dbgMonk', () => { unlockMonk(); buildClassPicker(); showToast('SECRET CLASS UNLOCKED'); });
  $('dbgOn').onchange = () => { $('dbgBody').classList.toggle('off', !$('dbgOn').checked); };
  on('helpBack', () => showScreen(G.state === 'title' ? 'titleScreen' : 'pauseScreen'));
  on('joinBack', () => { stopScan(); showScreen('titleScreen'); });
  on('joinScanBtn', joinScan);
  on('joinPasteBtn', () => { const c = $('joinPaste').value.trim(); if (c) joinWithCode(c); });
  on('joinOnlineBtn', joinOnline);
  on('joinCopy', () => { $('joinReplyCode').select(); try { navigator.clipboard.writeText($('joinReplyCode').value); showToast('COPIED'); } catch (e) { document.execCommand('copy'); } });
  on('pResume', resume);
  on('pInvite', () => { showScreen('inviteScreen'); if (!$('onlineWord').value) $('onlineWord').value = NET.roomWord || randomRoom(); if (NET.roomWord) showRoom(NET.roomWord); $('invStatus').textContent = 'PLAYERS CONNECTED: ' + Object.keys(NET.conns).length; });
  on('roomCopy', () => { const v = $('roomLink').value; try { navigator.clipboard.writeText(v).then(() => showToast('INVITE LINK COPIED'), () => { $('roomLink').select(); }); } catch (e) { $('roomLink').select(); } });
  $('joinWord').onkeydown = (e) => { if (e.key === 'Enter') { audioInit(); joinOnline(); } };
  on('pSave', () => { writeSave(); showToast('GAME SAVED'); });
  on('pHelp', () => showScreen('helpScreen'));
  on('pQuit', quitToTitle);
  on('invBack', () => { stopScan(); openPause(); });
  on('invNew', hostInviteQR);
  on('invScan', hostScanReply);
  on('invPasteBtn', () => { const c = $('invPaste').value.trim(); if (c) hostTakeReply(c); });
  on('invOnlineBtn', hostOnline);
  on('invCopy', () => { $('invCode').select(); try { navigator.clipboard.writeText($('invCode').value); showToast('COPIED'); } catch (e) { document.execCommand('copy'); } });
  on('winBack', quitToTitle); on('overBack', quitToTitle);
  on('hudPause', () => { if (G.state === 'play') openPause(); });
  $('sens').oninput = (e) => { IN.sens = +e.target.value; try { localStorage.setItem('emberwake_sens', e.target.value); } catch (er) { } };
  $('vol').oninput = (e) => { AU.vol = +e.target.value; if (AU.master) AU.master.gain.value = AU.vol; try { localStorage.setItem('emberwake_vol', e.target.value); } catch (er) { } };
  $('invy').onchange = (e) => { IN.invertY = e.target.checked; };
  try { const s = localStorage.getItem('emberwake_sens'); if (s) { IN.sens = +s; $('sens').value = s; } const v = localStorage.getItem('emberwake_vol'); if (v) { AU.vol = +v; $('vol').value = v; } } catch (e) { }
}
function boot() {
  initSprites(); initAnims(); initTextures(); loadProfile();
  const problems = validateContent(); if (problems.length) console.warn('Content problems:\n' + problems.join('\n'));
  initRenderer($('game')); initInput($('game')); bindUI(); drawLogo(); refreshTitle();
  addEventListener('resize', () => { resizeRenderer(); });
  showScreen('titleScreen');
  // title backdrop: render a slow flyover of the overworld
  const demo = genWorld(ADV_SEED, 'adv'); let t = 0; const L = demo.levels.ow;
  const titleLoop = () => {
    if (G.state !== 'title') { requestAnimationFrame(titleLoop); return; }
    t += 1 / 60; R.time += 1 / 60;
    const cx = L.spawn.x + Math.sin(t * 0.05) * 6, cy = L.spawn.y - 4 + Math.cos(t * 0.04) * 3;
    let x = cx, y = cy; if (L.solidAt(x, y)) { x = L.spawn.x; y = L.spawn.y; }
    renderWorld({ x, y, a: t * 0.12, pitch: -6, eye: 0.5 }, L, [], [], null); present();
    requestAnimationFrame(titleLoop);
  };
  titleLoop();
  requestAnimationFrame(loop);
  window.G = G;
  // invite links: game.html#join-EMBERFOX
  const hm = location.hash.match(/^#join[-=]?([A-Za-z0-9]+)/i);
  if (hm) { showScreen('joinScreen'); $('joinWord').value = 'GLD-' + cleanRoom(hm[1]); $('joinStatus').textContent = 'PICK YOUR NAME AND COLOR ON THE TITLE SCREEN FIRST IF YOU LIKE, OR PRESS JOIN.'; }
}
window.addEventListener('load', boot);
