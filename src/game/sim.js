// ===== game/sim.js : the host-authoritative game simulation =====
// Only the host runs this. Clients send their position and actions; the host sends back snapshots.
'use strict';
// Enemy, item, projectile and elite definitions live in src/content and are looked up through core/registry.js.
const SAVE_VERSION = 9;
// Bring an old save up to date. v1 -> v2: dungeons were redrawn as shapes, so dungeon tile changes, cleared rooms,
// keys and maps from v1 no longer fit; overworld progress, items and shards are kept. Tile/prop ids are remapped by name.
function migrateSave(s) {
  s = JSON.parse(JSON.stringify(s)); s.team = s.team || {}; s.mods = s.mods || {};
  if (!s.v || s.v < 2) {
    for (const lvl of Object.keys(s.mods)) if (lvl[0] === 'd') delete s.mods[lvl];
    for (const t of ['cleared', 'taken']) for (const k of Object.keys(s.team[t] || {})) if (k[0] === 'd') delete s.team[t][k];
    s.team.keys = {}; s.team.maps = {}; s.team.comps = {};
  }
  // v2 -> v3: the Wilds were redrawn (start in the middle, sea/peaks/great wood at the edges, gate towers), so overworld
  // changes and cave contents no longer line up. Dungeon progress, items and shards are kept; everyone starts at the new spawn.
  // v3 -> v4: the Wilds grew two frontier columns, so the same applies again
  if ((s.v || 1) < 5) { // (v5: level 7 moved onto a lake island)
    for (const lvl of Object.keys(s.mods)) if (lvl === 'ow' || (lvl[0] === 'c' && lvl !== 'c0')) delete s.mods[lvl];
    for (const t of ['cleared', 'taken']) for (const k of Object.keys(s.team[t] || {})) if (k.startsWith('ow:') || (k[0] === 'c' && !k.startsWith('c0:'))) delete s.team[t][k];
    for (const c in (s.players || {})) { const pl = s.players[c]; if (pl.lvl === 'ow' || (pl.lvl && pl.lvl[0] === 'c')) pl.respawn = true; }
  }
  if ((s.v || 1) < 6) { // v6: Tideglass Halls got its glass opening and the Sunken Stair was redrawn, so their progress starts over
    for (const d of ['d3', 'd6']) { delete s.mods[d]; for (const t of ['cleared', 'taken']) for (const k of Object.keys(s.team[t] || {})) if (k.startsWith(d + ':')) delete s.team[t][k]; for (const t of ['keys', 'maps', 'comps']) if (s.team[t]) delete s.team[t][d]; }
    for (const c in (s.players || {})) { const pl = s.players[c]; if (pl.lvl === 'd3' || pl.lvl === 'd6') pl.respawn = true; }
  }
  if ((s.v || 1) < 7) { // v7: no bag now means 1 bomb; the old Bramble Keep bag (16) is now the 8 bag. Bramble Keep was rebuilt (no keys), so it starts over.
    delete s.mods.d2; for (const t of ['cleared', 'taken']) for (const k of Object.keys(s.team[t] || {})) if (k.startsWith('d2:')) delete s.team[t][k]; for (const t of ['keys', 'maps', 'comps']) if (s.team[t]) delete s.team[t].d2;
    for (const c in (s.players || {})) { const pl = s.players[c]; if (pl.lvl === 'd2') pl.respawn = true; }
    for (const c in (s.players || {})) { const pl = s.players[c]; if ((pl.maxBombs || 0) > 8) { pl.items = pl.items || {}; pl.items.bombbag = true; } }
  }
  if ((s.v || 1) < 9) { // v9: the Wilds grew a row to the north (the high wood and the mountain), so the land is redrawn again; the Ascent was rebuilt
    for (const lvl of Object.keys(s.mods)) if (lvl === 'ow' || lvl === 'climb' || (lvl[0] === 'c' && lvl !== 'c0')) delete s.mods[lvl];
    for (const t of ['cleared', 'taken']) for (const k of Object.keys(s.team[t] || {})) if (k.startsWith('ow:') || k === 'climb:ladder' || (k[0] === 'c' && !k.startsWith('c0:') && !k.startsWith('climb:'))) delete s.team[t][k];
    for (const c in (s.players || {})) { const pl = s.players[c]; if (pl.lvl === 'ow' || (pl.lvl && pl.lvl[0] === 'c')) pl.respawn = true; }
  }
  if ((s.v || 1) < 8) { // v8: the fire rod became the magic wand; whoever had it keeps its fire as the Flame Orb
    for (const c in (s.players || {})) { const pl = s.players[c]; if (pl.items && pl.items.rod) { pl.items.wandfire = true; pl.wandEl = 'fire'; } if (pl.items && pl.items.thunderrod) { pl.items.wandthunder = true; pl.items.rod = true; delete pl.items.thunderrod; } }
  }
  if (s.tileNames) for (const lvl in s.mods) for (const i in s.mods[lvl]) { const m = s.mods[lvl][i]; const tn = s.tileNames[m[0]]; if (tn && TL[tn] != null) m[0] = TL[tn]; const pn = s.propNames && s.propNames[m[1]]; if (pn) { const pi = PROPS.indexOf(pn); if (pi >= 0) m[1] = pi; } }
  return s;
}
const REVIVE_TIME = 1.5, REVIVE_R2 = 2.6 * 2.6; // seconds to help a teammate up, and how close you must stand
const RESPAWN_WAIT = 30; // seconds a downed hero waits before they may give up and respawn at the start on their own
const BUY_COOLDOWN = 0.8; // seconds between shop purchases for one player
const FLY_TIME = 4, FLY_COOLDOWN = 2; // Gale Cloak: seconds aloft, and the rest after landing before it works again
const POISON_FRAC = 0.05, POISON_FROG_CHANCE = 0.1; // poison frogs are 1 in 10 frogs // poison takes 5% of max health a tick
const BOOMERANG_STUN = 3, STUN_LOCK = 6, BOOMERANG_DMG = 0.25; // boomerang: stun seconds, the longest a foe can be kept dizzy, chip damage
const BACK_ANGLE = 2.1;
// ARMOR (def.armor 0-3, e.armor now): each level blocks ARMOR_STEP of the damage. Bombs and the Heavy Pommel knock one level off
// instead of hurting, but each of those ways only works once per foe (e.stripped), so a fight can't be just one trick.
const ARMOR_STEP = 0.25;
const DUMMY_RESET = 3; // a training dummy heals (and gets its armor back) after this many seconds without a hit
const fmtDmg = (n) => String(Math.round(n * 100) / 100);
const DISARM_STAGGER = 1.2;
const KNIGHT_WINDUP = 0.45; // seconds a sword knight raises its blade before the counter lands (your cue to back off) // seconds a disarmed foe reels
const WEB_HELPLESS = 1, ARM_DELAY = 0.12, ARM_MIRROR = 0.25, ARM_SWAP = 1.5; // stuck in a web: seconds before a slash frees you; the Silk Arm's mirror cut: delay, share of the hit; stance change time
const GRUDGE_COOL = 180, THORN_RING_GRUDGE = 12; // the thorn-folk's grudge: seconds per point it cools; the most the root merchant forgives
const OSSUARY_HITS = 7; // sword cuts that break a rib of a bone archmage's OSSUARY (a bomb or a heavy pommel strike: one; a plain pommel strike: two)
const MAX_HEARTS = 20; // heart containers and pieces stop here (the HUD shows two rows of 10)
const REFLECT_TIME = 1, WARD_TIME = 8; // the Wardhold shield (content/wardhold.js): reflect window after it comes up; seconds between wards
const TWIN_EYE_TIME = 0.55; // seconds a twin-eye gate's eye stays shut (content/gimmicks/twingate.js)
const GOURD_REGROW = 40; // seconds before a split gourd can grow back (and only with nobody within 6 tiles)
// how many bombs you can carry: 1 without a bag, 8 with the Bramble Keep bag, 16 with the second one (sold in a grotto)
const bombCap = (p) => (p.items.bombbag ? 8 : 0) + (p.items.bombbag2 ? 8 : 0) || 1; // each bag holds 8, in either order (1 bomb without one)
// sword techniques: the pommel strike (reverse grip), the lunge's slashes, and the backswing on every third hit
const POMMEL_DMG = 0.25, POMMEL_STUN = 2.5, CHAIN_GAP = 2, BACKSWING_DELAY = 0.2; // the backswing lands while the blade comes back (ui/main.js plays it right after the forward cut) // radians off a foe's facing that count as behind it (about 120 degrees)
const SHIELD_STUN = 0.9; // seconds a knight reels after a loaded shot hits its shield
const FREEZE_TIME = 6, FREEZE_PATH = 6; // seconds frost-arrow ice lasts; how many tiles of water one arrow freezes along its flight
const HAZARD_TICK = 0.5, ICE_KB = 1.5, SHALLOW_SLOW = 0.75; // how often lava/spikes/vents burn a grounded enemy; how much harder hits shove enemies standing on ice
const SWORD_DMG = [1, 1, 2, 3, 4];             // damage per sword level (0 = no sword, punches still do 1)
// Enemy health multiplier by how many heroes are in the room (1, 2, 3, 4+). Adjusts live as people come and go.
const PARTY_HP = [1, 1, 1.5, 2, 2.5];
const partyMul = (n) => PARTY_HP[Math.min(4, Math.max(1, n))];

function newPlayer(id, name, color, cls) {
  return {
    id, name, color, cls: cls || 'sword', lvl: 'ow', x: 0, y: 0, a: 0, hp: 12, maxHp: 12, gems: 0, bombs: 0, maxBombs: 1, arrows: 0, maxArrows: ARROWS_START, sword: 0, armor: 0,
    items: {}, favs: [], potions: 0, alive: true, inv: 0, revive: 0, sel: 'boomerang', atk: 0, lastSeen: 0, warpIdx: 0, kills: 0,
  };
}

class Sim {
  constructor(world, save) {
    this.W = world; this.players = {}; this.ents = []; this.mods = {}; this.modVer = 1; this.events = []; this.rigShots = {}; this.thaws = {}; // thaws: 'lvl' -> { tile idx: when it melts }.
    // rigShots: 'lvl:room' -> when its timed eye was last shot
    this.team = { keys: {}, maps: {}, comps: {}, shards: [], done: [], relics: [], taken: {}, cleared: {}, clearedAt: {} };
    this.groups = {}; this.gourdRegrow = []; this.tempTiles = []; this.time = 0; this.levelInit = {}; this.over = 0; this.won = false; this.mode = world.mode;
    if (save) this.loadSave(save);
  }
  // ---- players ----
  addPlayer(id, name, color, cls) {
    let p = this.players[id];
    if (!p) {
      const saved = this.savedPlayers && this.savedPlayers[color];
      p = saved ? Object.assign(newPlayer(id, name, color, cls), saved, { id, name }) : newPlayer(id, name, color, cls);
      if (!saved) { // late joiners get team progression
        const any = Object.values(this.players)[0];
        if (any) { p.items = Object.assign({}, any.items); p.sword = Math.max(any.sword, any.swordMax || 0); p.maxHp = any.maxHp; p.maxArrows = any.maxArrows || ARROWS_START; p.hp = p.maxHp; if (any.armor === 2) p.armor = 2; p.maxBombs = bombCap(p); if (p.items.bombbag) p.bombs = 4; }
      }
      const host = Object.values(this.players)[0];
      const sp = host && host.alive ? host : null;
      if (saved && saved.respawn) { const L = this.W.levels.ow; p.lvl = 'ow'; p.x = L.spawn.x; p.y = L.spawn.y; p.a = L.spawn.a; delete p.respawn; }
      if (!saved) { const L = this.W.levels[sp ? sp.lvl : 'ow']; p.lvl = L.id; p.x = sp ? sp.x : L.spawn.x; p.y = sp ? sp.y : L.spawn.y; p.a = sp ? sp.a : L.spawn.a; }
      this.players[id] = p;
      this.ev({ t: 'msg', text: name + ' JOINED THE QUEST!' });
    }
    p.lastSeen = this.time;
    return p;
  }
  removePlayer(id) { const p = this.players[id]; if (!p) return; this.savedPlayers = this.savedPlayers || {}; this.savedPlayers[p.color] = this.playerSaveData(p); delete this.players[id]; this.ev({ t: 'msg', text: p.name + ' LEFT.' }); }
  playerSaveData(p) { const o = {}; for (const k of ['cls', 'lvl', 'x', 'y', 'a', 'hp', 'maxHp', 'gems', 'bombs', 'maxBombs', 'arrows', 'maxArrows', 'swordMax', 'armorMax', 'arrowType', 'wandEl', 'sword', 'armor', 'items', 'favs', 'ring', 'armMode', 'potions', 'sel']) o[k] = p[k]; o.alive = true; if (o.hp <= 0) o.hp = 12; return o; }
  ev(e) { this.events.push(e); }
  sfx(s, lvl, x, y) { this.ev({ t: 'sfx', s, lvl, x, y }); }
  msg(text, pid) { this.ev({ t: 'msg', text, pid }); }
  // ---- tiles ----
  // vents (content/gimmicks/vents.js) breathe on a shared 3 second cycle: 0 cool, 1 about to blow, 2 blowing
  ventPhase() { const t = this.time % 3; return t > 1.9 ? 2 : t > 1.4 ? 1 : 0; }
  setTile(lvl, idx, tile, prop, sealRoom) {
    const L = this.W.levels[lvl]; if (tile != null) L.tiles[idx] = tile; if (prop != null) L.props[idx] = prop;
    L.sealRoom = L.sealRoom || {}; if (sealRoom != null) L.sealRoom[idx] = sealRoom; else delete L.sealRoom[idx];
    (this.mods[lvl] = this.mods[lvl] || {})[idx] = sealRoom != null ? [L.tiles[idx], L.props[idx], sealRoom] : [L.tiles[idx], L.props[idx]]; this.modVer++;
  }
  // the glowing way out of a boss room (gimmicks/eyes.js WARP). It stays, so a later visit has a quick exit.
  openWarp(p) {
    const L = this.W.levels[p.lvl]; if (!L || L.kind !== 'dungeon') return; const room = dungeonRoomAt(L, p.x, p.y); if (!room) return;
    const ix = room.rx * DSX, iy = room.ry * DSY; let best = null, bd = 1e9;
    for (let y = 1; y < DSY; y++) for (let x = 1; x < DSX; x++) { const t = L.get(ix + x, iy + y); if (t !== TL.DFLOOR) continue; const d = (x - 6) ** 2 + (y - 6.5) ** 2; if (d < bd) { bd = d; best = [ix + x, iy + y]; } }
    if (!best) return; this.setTile(L.id, L.idx(best[0], best[1]), TL.WARP); this.sfx('secret', L.id); this.msg('A WAY OUT GLOWS. STEP ON IT TO LEAVE.');
  }
  // ---- eye targets and tide water (content/gimmicks/eyes.js, game/world.js) ----
  updateRigs(L) {
    if (!L.rigs) return;
    for (const rid in L.rigs) {
      const k = L.id + ':' + rid; const shot = this.rigShots[k];
      const code = shot === Infinity ? 1 : tideCode(shot != null ? this.time - shot : null); const prev = (L.rigCode && L.rigCode[rid]) || 0; // (shot Infinity: a bomb arrow sealed its eye)
      if (code === prev) continue;
      applyRig(L, rid, code); if (code === 0) delete this.rigShots[k];
      const r = L.rooms && L.rooms[rid]; const c0 = L.rigs[rid].cells[0]; this.sfx(['flood', 'drain', 'eyecreak', 'flood', 'tidewarn'][code], L.id, r ? r.rx * DSX + 6.5 : c0 % L.w + 0.5, r ? r.ry * DSY + 4.5 : Math.floor(c0 / L.w) + 0.5);
    }
  }
  // frost arrows freeze the deep fresh water they fly over: a path of ice three tiles wide, up to FREEZE_PATH long, that melts after a while
  freezeAlong(e, L, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y); const k = tx + ',' + ty; if (e.lastIce === k) return; e.lastIce = k;
    if (!(e.iceLeft > 0)) return; const ti = TINFO[L.get(tx, ty)]; if ((!ti.water && !ti.frozen) || ti.salty) return;
    e.iceLeft--; let any = false; const th = this.thaws[L.id] = this.thaws[L.id] || {};
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = L.idx(tx + dx, ty + dy); if (freezeTile(L, i) || (L.frozen && i in L.frozen)) { th[i] = this.time + FREEZE_TIME + Math.random() * 0.6; any = true; } }
    if (any && !e.froze) { e.froze = true; this.sfx('freeze', L.id, x, y); }
  }
  updateThaws(L) {
    const th = this.thaws[L.id]; if (!th) return; let crack = null;
    for (const i in th) { const left = th[i] - this.time; if (left <= 0) { thawTile(L, +i); delete th[i]; } else if (left < 1.5 && crack == null) crack = +i; }
    if (crack != null && this.time - (L.crackAt || -9) > 1.5) { L.crackAt = this.time; this.sfx('icecrack', L.id, crack % L.w + 0.5, Math.floor(crack / L.w) + 0.5); } // a warning crack before the ice gives way
  }
  frozenList(lvl) { const L = this.W.levels[lvl]; if (!L || !L.frozen) return undefined; const k = Object.keys(L.frozen); return k.length ? k.map(Number) : undefined; } // for snapshots
  rigCodes(lvl) { const L = this.W.levels[lvl]; if (!L || !L.rigCode) return undefined; const o = {}; let any = false; for (const rid in L.rigCode) if (L.rigCode[rid]) { o[rid] = L.rigCode[rid]; any = true; } return any ? o : undefined; } // for snapshots
  projBurst(e) { if (e.bomb && !e.burst) { e.burst = true; this.spawn({ k: 'bomb', lvl: e.lvl, x: e.x - e.vx * 0.03, y: e.y - e.vy * 0.03, fuse: 0, pid: e.pid, spr: 'bomb', sc: 0.5 }); } } // a bomb arrow bursts where it stops
  hitEye(L, idx, forGood) {
    const link = L.eyeLinks && L.eyeLinks[idx]; if (!link) return; const t = L.tiles[idx]; const x = idx % L.w + 0.5, y = Math.floor(idx / L.w) + 0.5;
    if (link.kind === 'timed') { this.rigShots[L.id + ':' + link.rid] = forGood ? Infinity : this.time; if (forGood) this.msg('THE EYE IS SEALED SHUT.'); this.sfx('eyeshut', L.id, x, y); return; } // shooting it again keeps it shut longer
    if (link.kind === 'twin') { // a twin-eye gate's eye: shut for a moment (or for good, with a bomb arrow); updateTwinGates does the rest
      if (forGood) this.setTile(L.id, idx, TL.EYE_SHUT); else this.setTempTile(L.id, idx, TL.EYE_SHUT, TWIN_EYE_TIME);
      this.sfx('eyeshut', L.id, x, y); this.updateTwinGates(L); return;
    }
    if (link.kind === 'seal' && !TINFO[t].shut) {
      this.setTile(L.id, idx, TINFO[t].small ? TL.EYE_SMALL_SHUT : TL.EYE_SHUT); this.sfx('eyeshut', L.id, x, y);
      for (const o of link.opens || []) this.setTile(L.id, o, link.openTo != null ? link.openTo : TL.OPENDOOR);
      this.sfx('secret', L.id); if (link.text) this.msg(link.text);
    }
  }
  // ---- input from clients ----
  onPlayerState(id, s) {
    const p = this.players[id]; if (!p) return;
    if (s.lvl !== p.lvl) return; // ignore stale states after teleport
    if (s.sh && !p.shUp) p.shieldAt = this.time; p.shUp = !!s.sh; // the shield just came up: the perfect-block window starts
    if (Math.abs(s.x - p.x) + Math.abs(s.y - p.y) > 0.01) p.movedAt = this.time; // (the Mender's Ring heals only the still)
    p.x = s.x; p.y = s.y; p.z = +s.z || 0; p.a = s.a; p.atk = s.atk || 0; p.lastSeen = this.time; p.sel = s.sel || p.sel;
  }
  onAction(id, a) {
    const p = this.players[id]; if (!p) return;
    const L = this.W.levels[p.lvl];
    if (!p.alive) { if (a.t === 'respawn') this.tryRespawn(p); return; }
    switch (a.t) {
      case 'atk': this.playerAttack(p, a); break;
      case 'use': if (p.webbed) break; this.useItem(p, a.item, a); break;
      case 'webline': { const i = a.idx | 0; const x = i % L.w, y = Math.floor(i / L.w); if (L.props[i] === PR.WEBLINE && !p.webbed && !this.flying(p) && dist2(x + 0.5, y + 0.5, p.x, p.y) < 1.5) { p.webbed = { at: this.time, idx: i, by: 'line' }; this.sfx('webstick', p.lvl, p.x, p.y); } break; } // walked into a strand (gimmicks/webs.js)
      case 'equip': this.equip(p, a); break;
      case 'enter': this.tryEnter(p, a.idx); break;
      case 'exit': this.tryExit(p); break;
      case 'unlock': this.tryUnlock(p, a.idx); break;
      case 'revive': this.tryRevive(p); break;
      case 'sel': if (bItems().some(d => d.id === a.item)) p.sel = a.item; break;
      case 'fav': { if (!bItems().some(d => d.id === a.item)) break; const f = p.favs = (p.favs || []).filter(x => x !== a.item); if (a.on) f.push(a.item); break; } // favorites live on the hero, so each save has its own
      case 'hazard': this.hurtPlayer(p, 1, null); break;
      case 'fall': { // fell into a pit: lose a heart, go back to the last safe spot (sent by the client, sanity-checked)
        if (this.time - (p.fellAt || -9) < 0.8) break; p.fellAt = this.time;
        const L = this.W.levels[p.lvl]; let x = +a.x, y = +a.y; if (!(dist2(x, y, p.x, p.y) < 64) || L.solidAt(x, y)) { x = L.spawn.x; y = L.spawn.y; }
        p.inv = 0; this.hurtPlayer(p, 2, null); this.teleport(p, p.lvl, x, y, p.a); this.sfx('hurt', p.lvl); break;
      }
      case 'debug': // dev names only; turning it off also drops god mode (and with it the Warp Stone)
        if (!isDevName(p.name)) break; p.dbg = !!a.on; p.god = !!(a.on && a.god); if (!p.dbg && p.sel === 'devwarp') p.sel = null;
        if (p.dbg && a.loadout) this.grantLoadout(p, a.loadout); // switching debug on mid-game hands over the debug loadout
        this.hint(p, 'DEBUG ' + (p.dbg ? 'ON' : 'OFF') + (p.god ? ' + GOD MODE' : '')); break;
      case 'dbgspawn': if (p.dbg && enemyDef(a.type)) { // debug: a foe (optionally an elite) a few steps in front of you
        const L = this.W.levels[p.lvl]; let x = p.x + Math.cos(p.a) * 2.5, y = p.y + Math.sin(p.a) * 2.5; if (L.solidAt(x, y) && !(enemyDef(a.type).swim && TINFO[L.get(Math.floor(x), Math.floor(y))].water)) { x = p.x; y = p.y; }
        const e = this.spawnEnemy(a.type, p.lvl, x, y, { dmgMul: 1 }); if (a.elite) { const el = Content.elites.find(d => d.id === a.elite); if (el) { e.elite = el.idx; if (el.apply) el.apply(e, this); } } } break;
      case 'dbgboss': if (p.dbg) { const D = this.W.levels['d' + (a.d | 0)]; const r = D && D.rooms[D.bossRoom]; if (r) { const at = r.rewardAt || [6.5, 6.5]; this.teleport(p, D.id, r.rx * DSX + at[0], r.ry * DSY + at[1], -Math.PI / 2); } } break; // debug: straight to a boss
      case 'dbgup': if (p.dbg) { // debug: switch upgrades and technique scrolls on and off (inventory, UPGRADES page)
        const list = a.all != null ? Content.upgrades : Content.upgrades.filter(u => u.id === a.id); const on = a.all != null ? !!a.all : !!a.on;
        if (on && a.all != null) for (const id of Content.upgradeBase) p.items[id] = true;
        for (const u of list) { if (on) u.on(p); else u.off(p); }
        p.maxBombs = bombCap(p); if (p.bombs > p.maxBombs) p.bombs = p.maxBombs;
      } break;
      case 'dbgmap': if (p.dbg && this.W.levels[p.lvl].kind === 'dungeon') { const t = a.what === 'comp' ? 'comps' : 'maps'; this.team[t] = this.team[t] || {}; this.team[t][p.lvl] = true; this.hint(p, (a.what === 'comp' ? 'COMPASS' : 'MAP') + ' GIVEN (DEBUG)'); } break; // sanity checks for dungeon maps
      case 'god': if (p.dbg) { p.god = !!a.on; p.hp = p.maxHp; p.chill = 0; this.hint(p, 'GOD MODE ' + (p.god ? 'ON' : 'OFF')); } break;
      case 'warp': if (p.dbg) { const T = this.W.levels[a.to]; if (T) this.teleport(p, T.id, T.spawn.x, T.spawn.y, T.spawn.a); } break;
    }
  }
  // debug loadout added on top of what the hero already has (never takes anything away). Dev names only (see 'debug').
  grantLoadout(p, d) {
    const n = (v, hi) => clamp(v | 0, 0, hi);
    p.sword = Math.max(p.sword, n(d.sword, 4)); p.armor = Math.max(p.armor, n(d.armor, 2));
    const mh = clamp(d.hearts | 0, 3, MAX_HEARTS) * 4; if (mh > p.maxHp) p.maxHp = mh; p.hp = p.maxHp;
    p.gems = Math.max(p.gems, n(d.gems, 999)); p.potions = Math.max(p.potions, n(d.potions, 2)); if (p.potions) p.items.potion = true;
    for (const id of d.items || []) { const it = itemDef(id); if (!it || !it.debug) continue; if (it.debugGrant) it.debugGrant(p, this); else p.items[id] = true; }
    p.arrows = Math.max(p.arrows, Math.min(p.maxArrows || ARROWS_START, n(d.arrows, 50)));
    if (d.bombs) { p.items.bombs = true; p.bombs = Math.max(p.bombs, Math.min(p.maxBombs, n(d.bombs, 16))); }
    for (let i = 1; i <= n(d.shards, 8); i++) { if (!this.team.shards.includes(i)) this.team.shards.push(i); if (!this.team.done.includes(i)) this.team.done.push(i); }
  }
  // ---- teleport ----
  teleport(p, lvl, x, y, a) {
    p.lvl = lvl; p.x = x; p.y = y; p.a = a; p.webbed = null; this.ev({ t: 'tp', pid: p.id, lvl, x, y, a });
    this.initLevel(lvl);
    if (this.W.levels[lvl] && this.W.levels[lvl].kind === 'tunnel') { const T = this.W.levels[lvl]; this.ev({ t: 'title', pid: p.id, text: T.label, sub: T.sub || (T.tunnelBiome === 'snow' ? 'TO THE FROZEN REACH' : 'TO THE CINDER WASTES') }); }
    if (lvl === 'dbg') { this.ev({ t: 'title', pid: p.id, text: 'TEST ZONE', sub: 'DEBUG' }); // and its training dummies (world.js genTestZone L.dummies)
      for (const [type, x, y] of (this.W.levels.dbg.dummies || [])) if (!this.ents.some(e => e.k === 'en' && e.lvl === 'dbg' && e.type === type && !e.dead)) { const d = this.spawnEnemy(type, 'dbg', x, y, {}); d.spawnFx = 0; d.f = Math.PI / 2; } }
    else if (lvl[0] === 'd') { const d = +lvl.slice(1); this.ev({ t: 'title', pid: p.id, text: d <= 9 ? 'LEVEL-' + d : dungeonName(d), sub: d <= 9 ? dungeonName(d) : (d === 12 ? 'THE LAST FLAME' : 'OPTIONAL DUNGEON') }); }
    if (lvl === 'ow') this.autosave = true;
  }
  tryEnter(p, idx) {
    const L = this.W.levels[p.lvl]; const t = L.tiles[idx];
    if (TINFO[t].shardGate) {
      if (this.team.shards.length >= 8) { this.setTile(L.id, idx, TL.GATE); this.sfx('secret', L.id); this.msg('THE EIGHT SHARDS BLAZE... THE HOLLOW CROWN OPENS.'); }
      else this.ev({ t: 'dialog', pid: p.id, text: 'A SEALED GATE. EIGHT EMBER-SHAPED HOLLOWS LINE THE ARCH. (' + this.team.shards.length + '/8 SHARDS)' });
      return;
    }
    if (TINFO[t].hearthGate) {
      const rel = this.team.relics || []; const has = (id) => rel.includes(id);
      if (has('fang') && has('emberheart')) { this.setTile(L.id, idx, TINFO[t].openTile ? TL[TINFO[t].openTile] : TL.GATE); this.sfx('hearthgate', L.id); this.msg('FROST AND FIRE MEET IN THE LOCK... THE HEARTH OPENS.'); }
      else this.ev({ t: 'dialog', pid: p.id, text: 'A GATE OF THREE FLAMES. TWO OF THE HOLLOWS ARE EMPTY: ONE COLD AS THE FROZEN REACH, ONE HOT AS THE CINDER WASTES.' + (has('fang') ? ' (THE FROST FANG FITS.)' : '') + (has('emberheart') ? ' (THE EMBER HEART FITS.)' : '') });
      return;
    }
    if (TINFO[t].sealedMsg) { this.ev({ t: 'dialog', pid: p.id, text: TINFO[t].sealedMsg }); return; }
    const portal = L.portals[idx]; if (!portal) return;
    if (!TINFO[t].portal && !TINFO[t].stairs) return;
    const T = this.W.levels[portal.to]; if (!T) return;
    const px = idx % L.w, py = Math.floor(idx / L.w);
    if (Math.abs(p.x - (px + 0.5)) > 1.8 || Math.abs(p.y - (py + 0.5)) > 1.8) return;
    this.sfx('stairs', p.lvl);
    const at = portal.at || T.spawn; this.teleport(p, T.id, at.x, at.y, at.a);
    if (portal.ladder && !this.team.taken['climb:ladder']) this.dropLadder(); // the summit's rope ladder: the first one down kicks it loose (content/south.js) // portal.at: a way in somewhere other than the level's start (the tunnels' far ends)
  }
  dropLadder() {
    const c = this.W.climb; if (!c) return; this.team.taken['climb:ladder'] = true; this.setTile('ow', c.ladderFoot, TL.LADDERFOOT);
    this.msg('THE ROPE LADDER UNROLLS DOWN THE CLIFF. A QUICKER WAY UP, FROM NOW ON.'); this.sfx('secret', 'ow');
  }
  tryExit(p) {
    const L = this.W.levels[p.lvl]; if (!L.exit) return;
    let ex = L.exit; if (L.exits) { let best = 1e9; for (const e of L.exits) { const d = dist2(p.x, p.y, e.x + 0.5, e.y + 0.5); if (d < best) { best = d; ex = e.to; } } } // a level with several ways out: the nearest one
    this.teleport(p, ex.lvl, ex.x, ex.y, ex.a);
  }
  tryUnlock(p, idx) {
    const L = this.W.levels[p.lvl]; if (L.tiles[idx] !== TL.LOCKED) return;
    if (Object.values(this.players).some(o => o.items.skeletonkey)) { this.setTile(L.id, idx, TL.OPENDOOR); this.sfx('door', L.id); return; } // the Skeleton Key opens anything, for free
    const k = this.team.keys[L.id] || 0;
    if (k <= 0) { this.ev({ t: 'hint', pid: p.id, text: 'LOCKED. FIND A SMALL KEY.' }); return; }
    this.team.keys[L.id] = k - 1; this.setTile(L.id, idx, TL.OPENDOOR); this.sfx('door', L.id);
  }
  tryRevive(p) {
    for (const o of Object.values(this.players)) {
      if (o.alive || o.lvl !== p.lvl) continue;
      if (dist2(o.x, o.y, p.x, p.y) < REVIVE_R2) {
        const gap = this.time - (o.reviveAt || 0);
        if (o.reviver !== p.id || gap > 0.7) { o.revive = 0; o.reviver = p.id; o.reviveAt = this.time; return; }
        o.reviveAt = this.time; o.revive += Math.min(0.4, gap); // real time held, independent of frame rate
        if (o.revive >= REVIVE_TIME) { o.alive = true; o.hp = Math.min(o.maxHp, 8); o.revive = 0; o.reviver = null; o.inv = 2; this.msg(p.name + ' HELPED ' + o.name + ' UP!'); this.sfx('fanfare', p.lvl); this.ev({ t: 'revived', pid: o.id }); }
        return;
      }
    }
  }
  // ---- the Silkwood (gimmicks/webs.js, enemies/silk.js) ----
  igniteSilk(L, i) {
    const t = L.tiles[i]; if (!(TINFO[t].silk || t === TL.WEB)) return; this.setTile(L.id, i, TL.SILK_BURNING, L.props[i] === PR.HELM || L.props[i] === PR.SIGN ? L.props[i] : 0);
    (L.silkFire = L.silkFire || {})[i] = this.time; L.silkSpread = L.silkSpread || {}; if (!L.fireSfxAt || this.time - L.fireSfxAt > 0.4) { L.fireSfxAt = this.time; this.sfx('whoosh', L.id, i % L.w + 0.5, Math.floor(i / L.w) + 0.5); }
  }
  // spiders for a room: as tough as the dungeon makes its own (tier), joined to that room's fight
  spawnBrood(L, x, y, type, opts) {
    const room = L.kind === 'dungeon' ? dungeonRoomAt(L, x, y) : null; const key = room ? L.id + ':' + room.id : null; const def = enemyDef(type);
    const tierMul = L.kind === 'dungeon' ? 1 + (Math.min(10, L.dnum) - 1) * 0.25 : 1;
    return this.spawnEnemy(type, L.id, x, y, Object.assign({ group: key, bounds: room ? roomBounds(L, room) : null, hp: Math.ceil(def.hp * tierMul), dmgMul: L.kind === 'dungeon' ? Math.ceil(Math.min(9, L.dnum) / 3) : 1 }, opts || {}));
  }
  hatchEggs(L, i) { this.setTile(L.id, i, null, 0); const x = i % L.w + 0.5, y = Math.floor(i / L.w) + 0.5; for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; this.spawnBrood(L, x + Math.cos(a) * 0.4, y + Math.sin(a) * 0.4, 'spiderling', { spawnFx: 0.2 }); } this.sfx('hatch', L.id, x, y); }
  // spiders come down from the ceiling around a hero (a cut strand, the Broodmother's wrap): shadows first, then them
  dropSpiders(p, n) {
    const L = this.W.levels[p.lvl]; this.sfx('skitter', p.lvl, p.x, p.y); this.ev({ t: 'shake', lvl: p.lvl, x: p.x, y: p.y });
    for (let k = 0, tries = 0; k < n && tries < 40; tries++) { const a = Math.random() * TAU, r = 1.6 + Math.random() * 1.6; const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (L.solidAt(x, y) || TINFO[L.get(Math.floor(x), Math.floor(y))].pit) continue; k++;
      this.spawnBrood(L, x, y, 'spider_ceiling', { st: 1, tm: 0.6 + k * 0.25, tx: x, ty: y, spawnFx: 0 }); }
  }
  cutFree(p) { const w = p.webbed; p.webbed = null; const L = this.W.levels[p.lvl]; if (w.by === 'line' && L.props[w.idx] === PR.WEBLINE) this.setTile(L.id, w.idx, null, 0); this.sfx('webtear', p.lvl, p.x, p.y); this.dropSpiders(p, w.by === 'wrap' ? 2 : 3); }
  armOn(p, mode) { return !!p.items.silkarm && p.armMode === mode && this.time >= (p.armSwapAt || 0); }
  // the Silkwood's far way out (world.js genSilkPlaces): opens once the Broodmother is dead
  openSilkPass() { const D = this.W.levels.d13, m = this.W.silkMouth; if (D && D.passSeal != null && D.tiles[D.passSeal] === TL.WEBSEAL) this.setTile(D.id, D.passSeal, TL.DEXIT); if (m && this.W.levels.ow.tiles[m.idx] === TL.SILKSEAL) this.setTile('ow', m.idx, TL.SILKCAVE); }
  // ---- the first old man (content/wardhold.js) ----
  updateFirstDoor(plist) {
    const W = this.W, C = Content.fallen; if (!C || !W.startCave) return;
    if (!this.team.fallen && plist.some(p => p.maxHp >= C.hearts * 4) && !plist.some(p => p.lvl === W.startCave)) this.fallOldMan();
    // the first old man anyone meets after taking his shield says one line, once
    // ...and the old men have heard what the thorn-folk are saying (the grudge), once each step
    const said = this.team.said = this.team.said || {}; const gr = this.team.grudge || 0;
    const lines = [[!this.team.wardLine, (p) => p.items.wardshield, () => { this.team.wardLine = true; }, Content.wardLine]];
    for (const [k, at] of [['g25', 25], ['g70', 70]]) lines.push([!said[k] && gr >= at, () => true, () => { said[k] = true; }, Content.grudgeLines[k]]);
    for (const [want, who, mark, text] of lines) { if (!want || !text) continue; let done = false;
      for (const p of plist) { if (!p.alive || !who(p) || this.W.levels[p.lvl].kind !== 'cave') continue;
        const e = this.ents.find(o => o.k === 'npc' && o.lvl === p.lvl && Content.oldMen.includes(o.spr) && !o.restoreAt && dist2(o.x, o.y, p.x, p.y) < 9);
        if (e) { mark(); e.textOrig = e.text; e.text = text; e.restoreAt = this.time + 30; done = true; break; } }
      if (done) break; }
    for (const e of this.ents) if (e.k === 'npc' && e.restoreAt && this.time > e.restoreAt) { e.text = e.textOrig; delete e.restoreAt; }
  }
  // ---- THE THORN-FOLK'S GRUDGE (enemies/thornling.js): every bush or hollow tree burned on the overworld (+2) and every
  // thorn-folk killed out there (+1; not in dungeons) feeds it. It cools 1 point every GRUDGE_COOL seconds of play, but
  // never below half its peak. It picks which kin come (thornKin) and, high enough, brings more and sets ambushes.
  addGrudge(n) { this.team.grudge = (this.team.grudge || 0) + n; this.team.grudgePeak = Math.max(this.team.grudgePeak || 0, this.team.grudge); }
  coolGrudge(dt) { this.team.grudgeT = (this.team.grudgeT || 0) + dt; if (this.team.grudgeT < GRUDGE_COOL) return; this.team.grudgeT = 0; if ((this.team.grudge || 0) > Math.floor((this.team.grudgePeak || 0) / 2)) this.team.grudge--; }
  thornKin(rnd) {
    const g = this.team.grudge || 0; const w = g >= 70 ? [20, 25, 30, 25] : g >= 45 ? [30, 25, 25, 20] : g >= 25 ? [45, 30, 25, 0] : g >= 10 ? [70, 30, 0, 0] : [1, 0, 0, 0];
    const ids = ['thornling', 'thornling_nettle', 'thornling_briar', 'thornling_seer']; let r = rnd() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 4; i++) { if (r < w[i]) return ids[i]; r -= w[i]; } return 'thornling';
  }
  shopCond(c) { if (c === 'kindToThorns') return (this.team.grudge || 0) <= THORN_RING_GRUDGE; if (c === 'roost') return !!this.team.taken['climb:roost']; return true; }
  onKill(e, pid) {
    const L = this.W.levels[e.lvl]; const p = pid && this.players[pid];
    if (L && L.kind === 'ow' && /^thornling/.test(e.type)) this.addGrudge(1);
    if (p && p.alive && this.ringOn(p, 'ring_hollow')) this.heal(p, 1); // the Hollow Ring feeds on the fallen
  }
  fallOldMan() {
    const W = this.W, L = W.levels[W.startCave]; this.team.fallen = true;
    this.setTile(L.id, L.idx(6, 1), TL.HATCH_CAVED, PR.RUBBLE); // he brought the passage down
    for (const [x, y] of [[3, 2], [9, 2]]) this.setTile(L.id, L.idx(x, y), null, 0); // the torches are out
    const at = W.startCaveAt, O = W.levels.ow; if (at) for (const [dx, dy] of [[1, 1], [-1, 1], [0, 2], [1, 2]]) { const i = O.idx(at.x + dx, at.y + dy); if (!TINFO[O.tiles[i]].solid && !TINFO[O.tiles[i]].portal && !O.props[i]) { this.setTile('ow', i, null, PR.HELM); break; } } // a dented helmet outside
    applyFallen(W);
    for (const e of this.ents) if (e.k === 'npc' && e.lvl === L.id) e.dead = true; // (nobody is inside when this happens)
    if (this.levelInit[L.id]) { for (const n of L.npcs) this.spawn({ k: 'npc', lvl: L.id, x: n.x, y: n.y, spr: n.spr, text: n.text, sc: 0.95 }); this.layWardShield(L); }
  }
  layWardShield(L) { const tk = L.id + ':wardshield'; if (this.team.taken[tk] || this.ents.some(e => e.tk === tk && !e.dead)) return; this.spawn({ k: 'pick', lvl: L.id, x: 8.3, y: 2.8, item: 'wardshield', tk, perm: true, spr: 'wardshield', sc: 0.6, z: 0.02, team: true }); }
  // ---- level init (static entities) ----
  initLevel(id) {
    if (this.levelInit[id]) return; this.levelInit[id] = true;
    const L = this.W.levels[id];
    for (const n of L.npcs) this.spawn({ k: 'npc', lvl: id, x: n.x, y: n.y, spr: n.spr, text: this.team.taken['refill:' + id] ? Content.refillText : n.after && this.team.taken[n.after] ? n.textAfter : n.text, after: n.after, textAfter: n.textAfter, sc: 0.95 });
    if (id === this.W.startCave && this.team.fallen) this.layWardShield(L);
    if (this.team.taken['refill:' + id]) this.openRefill(id);
    L.shop.forEach((s, i) => {
      const tk = id + ':shop' + i; if (this.team.taken[tk] || (s.choose && this.team.taken[s.choose])) return; if (s.cond && !this.shopCond(s.cond) && !s.condShow) return; // e.g. the Thorn Ring: only while the thorn-folk aren't angry
      this.spawn({ k: 'shop', lvl: id, x: s.x, y: s.y, item: s.item, price: s.price, gift: s.gift, need: s.needHearts, choose: s.choose, unique: s.unique, cond: s.cond, condText: s.condText, tk, spr: itemSprite(s.item), sc: 0.55, z: 0.12 });
    });
  }
  // you took the potion in a heart cave: from now on its old man refills one for POTION_REFILL (the map marks the cave)
  openRefill(id) {
    const L = this.W.levels[id]; const s = L.shop.find(x => x.item === 'potion'); if (!s || this.ents.some(o => o.k === 'shop' && o.lvl === id && o.refill)) return;
    this.spawn({ k: 'shop', lvl: id, x: s.x, y: s.y, item: 'potion', price: POTION_REFILL, refill: true, tk: id + ':refill', spr: itemSprite('potion'), sc: 0.55, z: 0.12 });
    for (const o of this.ents) if (o.k === 'npc' && o.lvl === id) o.text = Content.refillText;
  }
  spawn(e) { e.id = uid(); e.t = e.t || 0; this.ents.push(e); return e; }
  // ---- small helpers content files use ----
  hint(p, text) { this.ev({ t: 'hint', pid: p.id, text }); }
  puff(e, sc) { this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'puff', life: 0.35, sc: sc || 0.8 }); }
  enemyRadius(e) { return enemyDef(e.type).r * (e.rm || 1); }
  // Spawn an enemy. opts: group, bounds, hp, dmgMul, spawnFx, plus any field to copy (scMul, rm, spdMul...)
  spawnEnemy(type, lvl, x, y, opts) {
    const def = enemyDef(type); opts = opts || {}; const hp = opts.hp || def.hp;
    const e = this.spawn(Object.assign({ k: 'en', type, lvl, x, y, hp, maxHp: hp, f: Math.random() * TAU, b: opts.bounds || null, g: opts.group || null, st: 0, tm: 0.5, stun: 0, hurt: 0, spawnFx: 0.3, dmgMul: 1 }, opts));
    delete e.group; delete e.bounds; e.maxHp = e.hp; if (def.armor && e.armor == null) e.armor = def.armor;
    const g = e.g && this.groups[e.g]; if (g && !g.cleared) { g.ents.push(e); e.hp *= g.mul || 1; e.maxHp *= g.mul || 1; }
    return e;
  }
  // drop an item on the ground
  dropItem(item, lvl, x, y, extra) { const d = itemDef(item); if (!d) return null; const pu = d.pickup || {}; return this.spawn(Object.assign({ k: 'pick', lvl, x, y, item, spr: d.sprite, sc: pu.sc || 0.5, z: pu.z || 0, float: !!pu.float }, extra || {})); }
  // ---- main update ----
  update(dt) {
    this.time += dt;
    const plist = Object.values(this.players);
    const active = new Set(plist.map(p => p.lvl));
    for (const lvl of active) {
      this.initLevel(lvl);
      const L = this.W.levels[lvl]; for (const g of L.gimmicks || []) { const gm = Content.gimmicks[g]; if (gm && gm.update) gm.update(this, L, dt); }
      this.updateRigs(L); this.updateThaws(L);
    }
    // groups activation
    for (const p of plist) if (p.alive) this.activateGroupFor(p);
    this.updateGroups(dt, plist);
    this.updateFirstDoor(plist); this.coolGrudge(dt);
    // entities
    for (const e of this.ents) { if (!active.has(e.lvl)) continue; this.updateEnt(e, dt); }
    this.ents = this.ents.filter(e => !e.dead);
    // players
    for (const p of plist) {
      if (p.inv > 0) p.inv -= dt;
      if (!p.alive) continue;
      const L = this.W.levels[p.lvl];
      // hazard tiles
      if (p.chill > 0) p.chill -= dt; if (this.ringOn(p, 'ring_rime')) p.chill = 0; this.tickPoison(p); if (p.silk > 0) p.silk -= dt;
      if (p.armCuts && p.armCuts.length) p.armCuts = p.armCuts.filter(c => { if (this.time < c.at) return true; const e = this.ents.find(o => o.id === c.id && !o.dead); if (e) { this.damageEnemy(e, c.dmg, p, { pid: p.id, ignoreIframes: true, kbMul: 0.3 }); this.sfx('armcut', p.lvl, e.x, e.y); } return false; });
      if (this.ringOn(p, 'ring_mender') && p.hp < p.maxHp && this.time - (p.movedAt || 0) > 3 && this.time - (p.lastHurtAt || -99) > 3 && this.time >= (p.mendNext || 0)) { p.mendNext = this.time + 1.2; this.heal(p, 1); } // Mender's Ring
      this.updateBackswing(p); p.maxBombs = bombCap(p); if (p.bombs > p.maxBombs) p.bombs = p.maxBombs;
      if (p.dbg) { p.arrows = Math.max(p.arrows, p.maxArrows || ARROWS_START); p.bombs = Math.max(p.bombs, p.maxBombs); p.items.bombs = true; p.potions = 2; p.items.potion = true; p.gems = Math.max(p.gems, 999); } // debug: never run out
      const t = L.get(Math.floor(p.x), Math.floor(p.y)); const ti = TINFO[t]; const boots = !!p.items.magmaboots;
      if (ti.heal && p.hp < p.maxHp && this.time >= (p.healNext || 0)) { p.healNext = this.time + 0.35; this.heal(p, 1); if (p.hp >= p.maxHp) this.sfx('heart', p.lvl, p.x, p.y); } // a warm spring (content/grottos.js)
      if (p.inv <= 0 && !this.flying(p) && ((ti.hurt && !(boots && ti.lava)) || (ti.vent && this.ventPhase() === 2 && !boots))) this.hurtPlayer(p, ti.hurtDmg || 1, null, ti.lava || ti.vent || ti.fire ? 'fire' : null); // fliers are above it all
      p.swordMax = Math.max(p.swordMax || 0, p.sword); p.armorMax = Math.max(p.armorMax || 0, p.armor); // best gear ever owned (the inventory lets you wear less)
      // pickups & shop
      for (const e of this.ents) {
        if (e.lvl !== p.lvl || e.dead) continue;
        if ((e.k === 'pick' || e.k === 'shop') && dist2(e.x, e.y, p.x, p.y) < 0.5) this.pickup(p, e);
      }
    }
    // game over
    if (plist.length && plist.every(p => !p.alive)) {
      this.over += dt;
      if (this.over > 3.5) { this.over = 0; this.respawnAll(); }
    } else this.over = 0;
  }
  // a downed hero who has waited RESPAWN_WAIT seconds can get up at the start: the dungeon's entrance if they fell in
  // a dungeon, otherwise where the adventure began (same places a party wipe sends everyone)
  tryRespawn(p) {
    if (p.alive || this.time - (p.downAt || 0) < RESPAWN_WAIT) return;
    const L = this.W.levels[p.lvl]; const target = L.kind === 'dungeon' ? L : this.W.levels.ow;
    // the price of getting up alone: half your gems stay behind in a bag where you fell. Only you can pick it up,
    // and if you go down and respawn alone again before getting it back, that bag is lost.
    const lost = Math.floor(p.gems / 2);
    for (const e of this.ents) if (e.item === 'gembag' && e.owner === p.id) e.dead = true;
    if (lost > 0) { p.gems -= lost; this.spawn({ k: 'pick', lvl: p.lvl, x: p.x, y: p.y, item: 'gembag', amount: lost, owner: p.id, perm: true, spr: 'gembag', sc: 0.6, z: 0.05 }); }
    p.alive = true; p.hp = Math.min(p.maxHp, 12); p.inv = 2; p.revive = 0; p.reviver = null;
    this.teleport(p, target.id, target.spawn.x, target.spawn.y, target.spawn.a);
    this.msg(p.name + ' GOT BACK UP AT THE ' + (target.kind === 'dungeon' ? 'DUNGEON ENTRANCE.' : 'START.'));
    if (lost > 0) this.ev({ t: 'dialog', pid: p.id, text: 'YOU LEFT ' + lost + ' GEMS IN A BAG WHERE YOU FELL. GO BACK FOR THEM BEFORE YOU FALL AGAIN.' });
  }
  respawnAll() {
    if (this.mode === 'rogue') { this.ev({ t: 'runover' }); return; }
    for (const p of Object.values(this.players)) {
      const L = this.W.levels[p.lvl]; let target = L.kind === 'dungeon' ? L : this.W.levels.ow;
      p.alive = true; p.hp = Math.min(p.maxHp, 12); p.inv = 2;
      this.teleport(p, target.id, target.spawn.x, target.spawn.y, target.spawn.a);
    }
    // reset non-cleared groups
    for (const k in this.groups) { const g = this.groups[k]; if (!g.cleared) { for (const e of g.ents) e.dead = true; delete this.groups[k]; } }
    this.msg('YOU RISE AGAIN.');
  }
  // ---- groups (rooms / regions) ----
  groupKeyFor(p) {
    const L = this.W.levels[p.lvl];
    if (L.kind === 'dungeon' || L.kind === 'tunnel') { const r = dungeonRoomAt(L, p.x, p.y); return r ? { key: L.id + ':' + r.id, room: r, L } : null; }
    if (L.kind === 'ow') { const r = owRegionAt(L, p.x, p.y); return { key: 'ow:' + (r.ry * RW + r.rx), room: r, L }; }
    return null;
  }
  activateGroupFor(p) {
    const gk = this.groupKeyFor(p); if (!gk) return;
    const { key, room, L } = gk; p.room = key;
    if (this.groups[key]) { this.groups[key].seen = this.time; return; }
    if (this.team.cleared[key] && (L.kind === 'dungeon' || L.kind === 'tunnel')) { this.groups[key] = { key, ents: [], cleared: true, seen: this.time, room, lvl: L.id }; this.roomStatics(L, room, key, true); return; }
    if (L.kind === 'ow' && this.team.clearedAt[key] && this.time - this.team.clearedAt[key] < 90) { this.groups[key] = { key, ents: [], cleared: true, seen: this.time, room, lvl: L.id }; return; }
    const g = { key, ents: [], cleared: false, seen: this.time, room, lvl: L.id, mul: 1 }; this.groups[key] = g;
    const b = roomBounds(L, room);
    const rnd = mulberry32(hashStr(key) + Math.floor(this.time * 1000));
    const tierMul = L.kind === 'dungeon' ? 1 + (Math.min(10, L.dnum) - 1) * 0.25 : 1 + room.tier * 0.4;
    let dryRoom = null; // frogs only appear where there's water to hide in
    // outdoors the thorn-folk's GRUDGE decides which kin come and how many (thornKin); at its worst they spring out of the bushes
    let list = room.enemies, ambush = new Set();
    if (L.kind === 'ow' && list.some(t => /^thornling/.test(t))) { const gr = this.team.grudge || 0; list = list.map(t => /^thornling/.test(t) ? this.thornKin(rnd) : t); for (let k = 0; k < (gr >= 70 ? 2 : gr >= 45 ? 1 : 0); k++) { list.push(this.thornKin(rnd)); if (gr >= 70) ambush.add(list.length - 1); } }
    list.forEach((type, ei) => {
      if (enemyDef(type) && enemyDef(type).swim && !enemyDef(type).boss) {
        if (dryRoom == null) { dryRoom = true; for (let y = b.y0; y < b.y1 && dryRoom; y++) for (let x = b.x0; x < b.x1; x++) { const ti = TINFO[L.get(x, y)]; if (ti.water && !ti.ocean) { dryRoom = false; break; } } }
        if (dryRoom) { const alt = room.enemies.filter(t => enemyDef(t) && !enemyDef(t).swim); type = alt.length ? alt[ei % alt.length] : 'slime'; }
        else if (type === 'frog' && rnd() < POISON_FROG_CHANCE) type = 'frog_poison';
      }
      { const d0 = enemyDef(type); if (d0 && d0.rare && rnd() < d0.rare.chance) type = d0.rare.type; } // e.g. 1 mage in 50 is a bone mage (enemies/wizard.js)
      const def = enemyDef(type); if (!def) return;
      let x, y, tries = 0;
      const at = room.at && room.at[ei]; // a hand-built room can pin where each enemy appears
      if (at) { x = room.rx * DSX + at[0]; y = room.ry * DSY + at[1]; } else do {
        x = rnd.range(b.x0, b.x1 - 1) + 0.5; y = rnd.range(b.y0, b.y1 - 1) + 0.5; tries++;
        if (def.boss && L.kind === 'dungeon') { x = room.rx * DSX + (def.spawnAt ? def.spawnAt[0] : 6.5); y = room.ry * DSY + (def.spawnAt ? def.spawnAt[1] : 2.5); break; }
        if (def.swim && tries < 25 && TINFO[L.get(Math.floor(x), Math.floor(y))].water && !TINFO[L.get(Math.floor(x), Math.floor(y))].ocean && dist2(x, y, p.x, p.y) >= 9) break; // frogs like to start in the water
      } while (tries < 40 && (L.solidAt(x, y) || TINFO[L.get(Math.floor(x), Math.floor(y))].hurt || TINFO[L.get(Math.floor(x), Math.floor(y))].pit || dist2(x, y, p.x, p.y) < 9));
      let hp = Math.ceil(def.hp * (def.boss ? 1 + (L.dnum || 1) * 0.35 : tierMul));
      if (def.fixedHp) hp = def.hp;
      if (ambush.has(ei)) { const bushes = []; for (let yy = b.y0; yy < b.y1; yy++) for (let xx = b.x0; xx < b.x1; xx++) if (L.props[L.idx(xx, yy)] === PR.BUSH) { const d = dist2(xx + 0.5, yy + 0.5, p.x, p.y); if (d > 9 && d < 64) bushes.push([xx + 0.5, yy + 0.5]); }
        if (bushes.length) { const [bx2, by2] = bushes[Math.floor(rnd() * bushes.length)]; const a = Math.atan2(p.y - by2, p.x - bx2); const ax = bx2 + Math.cos(a) * 0.7, ay = by2 + Math.sin(a) * 0.7; if (!L.solidAt(ax, ay)) { x = ax; y = ay; this.sfx('rustle', L.id, ax, ay); } } } // out of the bushes
      const e = this.spawn({ k: 'en', type, lvl: L.id, x, y, hp, maxHp: hp, f: rnd() * TAU, b, g: key, st: 0, tm: rnd() * 2, stun: 0, hurt: 0, spawnFx: 0.5, dmgMul: L.kind === 'dungeon' ? Math.ceil(Math.min(9, L.dnum) / 3) : 1 + Math.floor(room.tier / 2) });
      if (def.armor && e.armor == null) e.armor = def.armor; // (armored knights spawned in rooms used to arrive without their plate)
      if (!def.boss) { const ch = L.kind === 'dungeon' ? 0.05 + Math.min(9, L.dnum) * 0.015 : 0.06 + room.tier * 0.03; if (rnd() < ch) this.makeElite(e, rnd); }
      g.ents.push(e);
    });
    for (const s of room.dormant || []) { // statues that wake up when a hero walks close (gimmicks/statues.js)
      const e = this.spawn({ k: 'en', type: s.type, lvl: L.id, x: s.x, y: s.y, hp: Math.ceil(enemyDef(s.type).hp * tierMul), f: Math.PI / 2, b, g: key, st: 0, tm: 0.5, stun: 0, hurt: 0, spawnFx: 0, dmgMul: L.kind === 'dungeon' ? Math.ceil(Math.min(9, L.dnum) / 3) : 1, dormant: true });
      e.maxHp = e.hp; g.ents.push(e);
    }
    if (L.kind === 'dungeon' || L.kind === 'tunnel') this.roomStatics(L, room, key, false);
    if (room.miniboss && g.ents.length && this.baitBoth(L, room, key)) this.enrageGroup(g); // they remember who robbed them
    if (!g.ents.length) this.groupCleared(g, true);
  }
  roomStatics(L, room, key, cleared) {
    // item on pedestal (visible immediately)
    if (room.item && !this.team.taken[key + ':item']) {
      if (!this.ents.find(e => e.tk === key + ':item')) this.spawn({ k: 'pick', lvl: L.id, x: room.rx * DSX + 6.5, y: room.ry * DSY + 3.5, item: room.item, tk: key + ':item', perm: true, spr: itemSprite(room.item), sc: 0.6, z: 0.35, team: true });
    }
    (room.stash || []).forEach((s, i) => { const tk = key + ':stash' + i; if (!this.team.taken[tk] && !this.ents.find(e => e.tk === tk)) this.spawn({ k: 'pick', lvl: L.id, x: room.rx * DSX + s.x, y: room.ry * DSY + s.y, item: s.item, tk, perm: true, spr: itemSprite(s.item), sc: 0.55, z: 0.15, team: true, bait: s.bait, g: key }); }); // hidden treasures (world.js bossEyeAlcove); bait: the wyrm arena's corner gems
    if (room.looseKey && !this.team.taken[key + ':lkey'] && !this.ents.find(e => e.tk === key + ':lkey')) { // a key waiting somewhere awkward (gimmick intro rooms)
      this.spawn({ k: 'pick', lvl: L.id, x: room.rx * DSX + room.looseKey[0], y: room.ry * DSY + room.looseKey[1], item: 'key', tk: key + ':lkey', perm: true, spr: itemSprite('key'), sc: 0.55, z: 0.1, team: true });
    }
    if (cleared) this.roomRewards(L, room, key);
  }
  roomRewards(L, room, key) {
    const cx = room.rx * DSX + (room.rewardAt ? room.rewardAt[0] : 6.5), cy = room.ry * DSY + (room.rewardAt ? room.rewardAt[1] : 4.5); // rewardAt: hand-built rooms whose middle isn't floor
    const drop = (item, dx) => { const tk = key + ':' + item; if (this.team.taken[tk] || this.ents.find(e => e.tk === tk)) return; this.spawn({ k: 'pick', lvl: L.id, x: cx + (dx || 0), y: cy, item, tk, perm: true, spr: itemSprite(item), sc: 0.55, z: 0.1, team: true }); };
    if (room.key) drop('key', 0);
    if (room.map) drop('map', -1);
    if (room.compass) drop('compass', 1);
    if (room.boss) { drop('hcont', -1.5); if (L.dnum <= 8) drop('shard', 0); const bd = (Content.dungeons[L.dnum] || {}).bossDrop; if (bd) drop(bd, 0); }
    if (room.reward) drop(room.reward, 0); // hidden room treasure
    for (const [item, dx] of room.rewards || []) drop(item, dx); // several prizes at once (the wyrm arena)
  }
  updateGroups(dt, plist) {
    for (const k in this.groups) {
      const g = this.groups[k];
      const here = plist.filter(p => p.room === k && p.lvl === g.lvl).length;
      if (here) g.seen = this.time;
      // co-op scaling: rescale every enemy's health by the same share when the headcount changes
      if (here && !g.cleared) { const m = partyMul(here); if (m !== g.mul) { for (const e of g.ents) { e.hp = e.hp * m / g.mul; e.maxHp = e.maxHp * m / g.mul; } g.mul = m; } }
      if (!g.cleared) {
        g.ents = g.ents.filter(e => !e.dead && !enemyDef(e.type).neutral); // a neutral one (the Silkwood's little spider) never holds a room shut
        if (!g.ents.length) this.groupCleared(g, false);
      }
      // shutters for dungeon rooms
      const L = this.W.levels[g.lvl];
      if (L.kind === 'dungeon') this.updateShutters(L, g, plist);
      // despawn overworld groups when nobody around
      if (L.kind === 'ow' && this.time - g.seen > 2.5) {
        for (const e of g.ents) e.dead = true;
        for (const e of this.ents) if (e.lvl === 'ow' && e.k === 'pick' && !e.perm && e.g === k) e.dead = true;
        delete this.groups[k];
      }
    }
  }
  groupCleared(g, silent) {
    g.cleared = true; this.team.cleared[g.key] = true; this.team.clearedAt[g.key] = this.time;
    const L = this.W.levels[g.lvl];
    if (L.kind === 'dungeon' || L.kind === 'tunnel') {
      const room = g.room;
      if (!silent && (room.key || room.map || room.compass || room.boss)) this.sfx('appear', L.id);
      this.roomRewards(L, room, g.key);
      if (room.boss && !silent) { this.msg('THE GUARDIAN FALLS!'); }
    }
  }
  updateShutters(L, g, plist) {
    const room = g.room; if (!room.shutter) return;
    const x0 = room.rx * DSX, y0 = room.ry * DSY;
    const doors = [[x0 + 6, y0], [x0 + 6, y0 + DSY], [x0, y0 + 4], [x0 + DSX, y0 + 4]];
    const insidePlayers = plist.filter(p => p.alive && p.lvl === L.id && p.x > x0 + 1.3 && p.x < x0 + DSX - 0.3 && p.y > y0 + 1.3 && p.y < y0 + DSY - 0.3);
    const shouldClose = !g.cleared && insidePlayers.length > 0;
    if (shouldClose && !g.shut) {
      g.shut = []; for (const [x, y] of doors) { const i = L.idx(x, y); if (L.tiles[i] === TL.OPENDOOR) { g.shut.push(i); this.setTile(L.id, i, TL.SHUTTER, null, room.id); } }
      if (g.shut.length) this.sfx('shutter', L.id);
    } else if (!shouldClose && g.shut) {
      for (const i of g.shut) this.setTile(L.id, i, TL.OPENDOOR); if (g.shut.length) this.sfx('door', L.id); g.shut = null;
    }
  }
  // ---- entity update ----
  nearestPlayer(e, maxD) {
    let best = null, bd = (maxD || 99) ** 2;
    for (const p of Object.values(this.players)) { if (!p.alive || p.lvl !== e.lvl) continue; const d = dist2(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  // push: knockback, which can shove grounded enemies onto lava, spikes and pits (walking never does)
  moveEnt(e, dx, dy, def, push) {
    const L = this.W.levels[e.lvl]; const r = def ? def.r * 0.8 : 0.25;
    const onHazard = (() => { const ti = TINFO[L.get(Math.floor(e.x), Math.floor(e.y))]; return !!(ti.hurt || ti.pit); })();
    const avoid = !push && !onHazard; // an enemy already standing in lava may walk out of it
    const blocked = (x, y) => {
      if (def && def.phase) return x < 1 || y < 1 || x > L.w - 1 || y > L.h - 1;
      if (e.b && (x < e.b.x0 + 0.2 || y < e.b.y0 + 0.2 || x > e.b.x1 - 0.2 || y > e.b.y1 - 0.2)) return true;
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        const tx = Math.floor(x + ox), ty = Math.floor(y + oy); const t = L.get(tx, ty); const ti = TINFO[t];
        if (def && def.fly) { if (ti.solid && !ti.low) return true; } else { if ((ti.solid && !(def && def.swim && ti.water && !ti.ocean)) || (avoid && (ti.hurt || ti.pit))) return true; } // swimmers (frogs) go through fresh water
        const pr = L.props[ty * L.w + tx]; if (pr && PROP_INFO[pr].solid) return true;
      }
      return false;
    };
    if (!push && !(def && def.fly) && TINFO[L.get(Math.floor(e.x), Math.floor(e.y))].shallow) { dx *= SHALLOW_SLOW; dy *= SHALLOW_SLOW; } // wading
    let hit = false;
    if (!blocked(e.x + dx, e.y)) e.x += dx; else hit = true;
    if (!blocked(e.x, e.y + dy)) e.y += dy; else hit = true;
    return hit;
  }
  fireProj(type, lvl, x, y, ang, owner, pid, extra) {
    const d = Content.projectiles[type];
    return this.spawn(Object.assign({ k: 'proj', type, lvl, x, y, vx: Math.cos(ang) * d.spd, vy: Math.sin(ang) * d.spd, owner, pid, life: d.range ? d.range / d.spd : 3, dmg: d.dmg, spr: d.spr, sc: d.sc, z: d.z, hitSet: {} }, extra || {}));
  }
  updateEnt(e, dt) {
    e.t += dt;
    if (e.k === 'en') this.updateEnemy(e, dt);
    else if (e.k === 'proj') this.updateProj(e, dt);
    else { const kind = Content.entities[e.k]; if (kind) kind.update(this, e, dt); } // npc/shop have no behavior
  }
  updateEnemy(e, dt) {
    const def = enemyDef(e.type);
    if (e.dormant) { // a statue until someone comes close
      if (Object.values(this.players).some(p => p.alive && p.lvl === e.lvl && dist2(p.x, p.y, e.x, e.y) < 2.2 * 2.2)) this.wake(e);
      return;
    }
    if (e.spawnFx > 0) { e.spawnFx -= dt; return; }
    if (e.carried) return; // riding a boomerang back to the hero (items/boomerang.js)
    this.groundHazards(e, def, dt); if (e.dead) return;
    if (e.hurt > 0) e.hurt -= dt;
    if (e.kb) { this.moveEnt(e, e.kb[0] * dt, e.kb[1] * dt, def, true); e.kbT -= dt; if (e.kbT <= 0) e.kb = null; } // a stunned enemy still gets shoved
    if (e.stun > 0) { e.stun -= dt; return; }
    const p = this.nearestPlayer(e, 30);
    e.tm -= dt;
    const ctx = { p, spd: def.spd * (e.rage ? 1.5 : 1) * (e.spdMul || 1), def };
    const elite = e.elite && eliteByIdx(e.elite);
    if (def.hollow && !e.signetSeen) for (const pl of Object.values(this.players)) if (pl.alive && pl.lvl === e.lvl && this.ringOn(pl, 'ring_signet') && dist2(pl.x, pl.y, e.x, e.y) < 7) { e.signetSeen = true; e.hesitate = this.time + 1.1; e.f = Math.atan2(pl.y - e.y, pl.x - e.x); break; } // a knight sees the Wardhold Signet... and remembers
    if (e.hesitate && this.time < e.hesitate) return;
    const skipAi = elite && elite.update && elite.update(this, e, dt, ctx);
    if (e.dead) return;
    if (!skipAi) (e.disarmed && def.disarmedAi ? def.disarmedAi : def.ai)(this, e, dt, ctx);
    // contact damage
    if ((elite && elite.noContact) || e.sub || e.air || !def.dmg) return; // can't bite you from under the water or in mid-air
    for (const pl of Object.values(this.players)) {
      if (!pl.alive || pl.lvl !== e.lvl || pl.inv > 0) continue;
      const rr = this.enemyRadius(e) + 0.28; if (dist2(pl.x, pl.y, e.x, e.y) < rr * rr) { this.hurtPlayer(pl, def.dmg * (def.boss ? 1 : e.dmgMul), e); if (elite && elite.onHitPlayer) elite.onHitPlayer(this, e, pl); }
    }
  }
  // Tiles hurt grounded enemies too: pits swallow them, lava, spikes and blowing vents burn them.
  // Flyers, ghosts and bosses don't care; fire creatures shrug off lava and vents.
  groundHazards(e, def, dt) {
    if (def.fly || def.phase || def.boss || e.dormant) return;
    const L = this.W.levels[e.lvl]; const ti = TINFO[L.get(Math.floor(e.x), Math.floor(e.y))];
    if (ti.pit) { this.enemyFalls(e); return; }
    if (ti.water && !ti.ocean && !def.swim) { this.enemyFalls(e, true); return; } // tide water came back over it (frogs just swim)
    const burn = (ti.hurt && !(def.hot && ti.lava)) || (ti.vent && this.ventPhase() === 2 && !def.hot);
    if (!burn) { e.hazT = 0; return; }
    e.hazT = (e.hazT || 0) - dt; if (e.hazT > 0) return; e.hazT = HAZARD_TICK;
    if (ti.lava || ti.vent || ti.fire) this.sfx('sizzle', e.lvl, e.x, e.y);
    this.damageEnemy(e, ti.hurtDmg || 1, null, { ignoreIframes: true, pid: e.lastPid });
  }
  enemyFalls(e, water) { // gone, with no loot (it fell or sank with it)
    e.dead = true; const p = e.lastPid && this.players[e.lastPid]; if (p) p.kills++; this.onKill(e, e.lastPid);
    this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'puff', life: 0.35, sc: 0.6, z: -0.3 }); this.sfx(water ? 'splash' : 'pitfall', e.lvl, e.x, e.y);
  }
  // Knockback speed for a hit. Grounded enemies on ice slide much further.
  knockFor(e, def, speed) { const L = this.W.levels[e.lvl]; return !def.fly && TINFO[L.get(Math.floor(e.x), Math.floor(e.y))].slippery ? [speed * ICE_KB, 0.3] : [speed, null]; }
  wake(e) { e.dormant = false; e.spawnFx = 0.35; this.sfx('roar', e.lvl, e.x, e.y); this.puff(e, 1); }
  // ---- elites (content/elites.js) ----
  // Spider-kin (def.spiderkin) only roll the spider elites (elite.only === 'spider'); everything else only the general ones.
  makeElite(e, rnd) {
    const def = enemyDef(e.type); const no = def.noElites || [];
    const list = Content.elites.filter(d => (def.spiderkin ? d.only === 'spider' : !d.only) && !no.includes(d.id)); if (!list.length) return;
    let total = 0; for (const d of list) total += d.weight; let r = rnd() * total; let pick = list[list.length - 1];
    for (const d of list) { if (r < d.weight) { pick = d; break; } r -= d.weight; }
    e.elite = pick.idx; if (pick.apply) pick.apply(e, this);
  }
  spawnMinion(boss, type) { return this.spawnEnemy(type, boss.lvl, boss.x + (Math.random() - 0.5), boss.y + (Math.random() - 0.5), { group: boss.g, bounds: boss.b }); }
  // DEFENSE: the tunic counts fully against physical hits and only half as much against elemental ones (elem: 'fire',
  // 'ice', 'magic'; from the projectile def, burning entities, hazard tiles or the enemy def). Rings: items/rings.js.
  elemOf(src) { if (!src) return null; if (src.k === 'proj') return (Content.projectiles[src.type] || {}).elem || null; if (src.k === 'efire' || src.k === 'emberblob') return 'fire'; if (src.k === 'en') return (enemyDef(src.type) || {}).elem || null; return src.elem || null; }
  defenseMul(p, elem) {
    const phys = p.armor === 2 ? 0.25 : p.armor === 1 ? 0.5 : 1; let m = elem ? 1 - (1 - phys) / 2 : phys;
    if ((elem === 'fire' && this.ringOn(p, 'ring_cinder')) || (elem === 'ice' && this.ringOn(p, 'ring_rime')) || (elem === 'magic' && this.ringOn(p, 'ring_hollowsilver'))) m *= 0.5;
    if (this.ringOn(p, 'ring_glass')) m *= 2; return m;
  }
  ringOn(p, id) { return !!p && p.ring === id && !!p.items[id]; }
  heartHeal(p, amt) { return this.ringOn(p, 'ring_hollow') ? 0 : this.ringOn(p, 'ring_miser') ? Math.ceil(amt / 2) : amt; }
  shepherd(p, amt) { if (!this.ringOn(p, 'ring_shepherd')) return; for (const o of Object.values(this.players)) if (o !== p && o.alive && o.lvl === p.lvl && this.ringOn(o, 'ring_shepherd') && dist2(o.x, o.y, p.x, p.y) < 36) { this.heal(o, this.heartHeal(o, amt)); this.sfx('heart', o.lvl, o.x, o.y); } }
  hurtPlayer(p, dmg, src, elem) {
    if (p.inv > 0 || !p.alive || p.god) return;
    elem = elem || this.elemOf(src);
    if (elem === 'fire' && (!src || src.k === 'efire') && this.ringOn(p, 'ring_cinder')) return; // burning ground can't touch a Cinder Ring
    if (src && src.k === 'en' && this.armOn(p, 'guard')) dmg *= 0.75; // the Silk Arm's guard takes the edge off a bite or a charge
    const amt = Math.max(1, Math.round(dmg * 2 * this.defenseMul(p, elem))); // quarter-hearts (1 dmg = half heart)
    if (src && src.k === 'en' && !src.dead && this.ringOn(p, 'ring_thorn')) this.damageEnemy(src, dmg * 3, p, { pid: p.id, ignoreIframes: true, pierceShield: true }); // the Thorn Ring bites back
    p.hp -= amt; p.inv = 1.0; p.lastHurtAt = this.time; this.clearBeam(p);
    for (const o of Object.values(this.players)) if (!o.alive && o.reviver === p.id && o.revive > 0) { o.revive = 0; o.reviver = null; this.ev({ t: 'hint', pid: p.id, text: 'HIT! HELP-UP RESET.' }); }
    let kx = 0, ky = 0; if (src) { const a = Math.atan2(p.y - src.y, p.x - src.x); kx = Math.cos(a) * 7; ky = Math.sin(a) * 7; }
    this.ev({ t: 'hurt', pid: p.id, kx, ky });
    if (p.hp <= 0) {
      if (this.ringOn(p, 'ring_secondwind') && !p.windUsed) { p.windUsed = true; p.hp = 1; this.sfx('heal', p.lvl); this.ev({ t: 'hint', pid: p.id, text: 'SECOND WIND!' }); return; } // once per life
      if (p.potions > 0) { p.potions--; this.drinkPotion(p); this.msg(p.name + "'S POTION SAVED THEM!"); return; }
      p.hp = 0; p.alive = false; p.downAt = this.time; p.revive = 0; p.reviver = null; this.clearBeam(p); p.windUsed = false; p.webbed = null; this.ev({ t: 'down', pid: p.id }); this.msg(p.name + ' IS DOWN!' + (Object.keys(this.players).length > 1 ? ' GET CLOSE AND HOLD F TO HELP THEM UP.' : ''));
    }
  }
  drinkPotion(p) { p.hp = p.maxHp; p.poisonTicks = 0; p.chill = 0; p.inv = Math.max(p.inv || 0, POTION_GUARD); this.clearBeam(p); this.sfx('heal', p.lvl); this.ev({ t: 'flash', pid: p.id, c: '#f060b0' }); } // full health, poison and chill gone, and a few seconds nothing can touch you
  clearBeam(p) { for (const e of this.ents) if (e.k === 'proj' && e.pid === p.id && Content.projectiles[e.type].beam) e.dead = true; }
  heal(p, amt) { const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + amt); if (p.hp !== before) this.clearBeam(p); }
  // opt: pid (who hit it), silver, pierceShield, ignoreIframes, stunOnly. Returns true if the hit landed.
  damageEnemy(e, dmg, src, opt) {
    const def = enemyDef(e.type); opt = opt || {}; if (e.dead || e.spawnFx > 0) return false;
    if (e.sub || e.air) return false; // under the water, or mid-leap: out of reach
    const atk = opt.pid && this.players[opt.pid]; if (atk && atk.god) dmg *= 3; if (atk && this.ringOn(atk, 'ring_glass')) dmg *= 2; // god mode hits three times as hard
    if (e.dormant) { this.sfx('clink', e.lvl, e.x, e.y); this.wake(e); return false; }
    if (e.hurt > 0 && !opt.ignoreIframes) return false;
    if (def.shield && !e.disarmed && src && !opt.pierceShield && !(e.reelUntil > this.time)) { // blocks hits from the front (not while reeling from a loaded shot)
      const toSrc = Math.atan2(src.y - e.y, src.x - e.x); if (Math.abs(angDiff(e.f, toSrc)) < 0.9) {
        this.sfx('clink', e.lvl, e.x, e.y);
        if (def.counter) this.shieldBlocked(e, def, opt.pid); // sword knights strike back after enough blocks
        if (!opt.shieldBreak || (def.bigShield && (opt.breakNocks || 0) < 3)) { e.stun = 0.15; return false; } // a big shield shrugs off anything less than a triple shot
        dmg = opt.shieldBreak * (atk && atk.god ? 3 : 1); e.stun = Math.max(e.stun, SHIELD_STUN); e.reelUntil = this.time + SHIELD_STUN; // a loaded shot jars the shield: half damage, and the knight reels long enough for a sword strike
      }
    }
    if (opt.stunOnly && !def.boss) { // a boomerang hit: stun with a little damage. Hitting a dizzy foe only renews the stun (no damage),
      // and a foe that's been held dizzy for STUN_LOCK seconds gets a moment of immunity, so two boomerangs can't pin it forever.
      this.sfx('clink', e.lvl, e.x, e.y);
      if (this.time < (e.stunImmune || 0)) return false;
      if (e.stun > 0) { if (this.time - (e.stunFrom != null ? e.stunFrom : this.time) < STUN_LOCK) e.stun = Math.max(e.stun, BOOMERANG_STUN); else { e.stunImmune = this.time + e.stun + 1.2; } return true; }
      e.stun = BOOMERANG_STUN; e.stunFrom = this.time; if (def.boomerangKills) dmg = Math.max(dmg, e.hp); // bats and the like drop to one throw
    }
    if (e.wardBy) { const c = this.ents.find(o => o.id === e.wardBy); if (c && !c.dead && c.channel === e.id) { this.sfx('clink', e.lvl, e.x, e.y); this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'wardbubble', life: 0.25, sc: 1.5, z: 0.1 }); return false; } e.wardBy = null; } // a force mage's SHIELD (enemies/wizard.js)
    if (e.armor > 0) dmg *= 1 - ARMOR_STEP * Math.min(3, e.armor);
    if (opt.elem && def.resist && def.resist[opt.elem]) dmg *= 1 - def.resist[opt.elem]; // mages shrug off their own element (opt.elem: 'force' | 'fire' | 'storm' | 'frost')
    if (def.hitMul) dmg *= def.hitMul(opt, e); // e.g. a bone mage: arrows pass through, blunt hits shatter
    if (def.onDamage && def.onDamage(this, e, dmg, opt) === false) return true;
    e.hp -= dmg; e.hurt = 0.35; this.sfx('hit', e.lvl, e.x, e.y); if (opt.pid) e.lastPid = opt.pid;
    if (def.dummy) { e.total = (this.time - (e.hitAt != null ? e.hitAt : -99) < DUMMY_RESET ? e.total || 0 : 0) + dmg; this.ev({ t: 'pow', lvl: e.lvl, x: e.x, y: e.y, num: true, word: fmtDmg(dmg) + '  (' + fmtDmg(e.total) + ')' }); } // training dummy: show the numbers
    e.hitAt = this.time;
    if (src && !def.boss && !def.anchored && !opt.noKb) { const a = Math.atan2(e.y - src.y, e.x - src.x); const [v, t] = this.knockFor(e, def, 9 * (opt.kbMul || 1)); e.kb = [Math.cos(a) * v, Math.sin(a) * v]; e.kbT = t || 0.12; }
    if (e.hp <= 0) this.killEnemy(e, opt.pid);
    return true;
  }
  killEnemy(e, pid) {
    e.dead = true; const def = enemyDef(e.type);
    this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: def.boss ? 'boom' : 'puff', life: def.boss ? 0.8 : 0.35, sc: def.boss ? 2 : 0.8 });
    this.sfx(def.boss ? 'bossdie' : 'die', e.lvl, e.x, e.y);
    if (pid && this.players[pid]) this.players[pid].kills++;
    this.onKill(e, pid);
    if (def.onDeath && def.onDeath(this, e) === 'win') { this.win(); return; }
    if (def.boss) return;
    const elite = e.elite && eliteByIdx(e.elite);
    if (elite && elite.onDeath) {
      const drop = (item, ox, oy) => this.dropItem(item, e.lvl, e.x + (ox || 0), e.y + (oy || 0), { g: e.g });
      drop.gems = (n) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; drop('gem5', Math.cos(a) * 0.5, Math.sin(a) * 0.5); } };
      elite.onDeath(this, e, drop); return;
    }
    let item = rollDrop(def.drops, this);
    // in a dungeon with eye targets, foes drop arrows for whoever has the bow (hearts stay as likely as ever)
    const L = this.W.levels[e.lvl]; if (L.eyeLinks && item !== 'heart' && item !== 'fairy' && Math.random() < 0.35 && Object.values(this.players).some(o => o.lvl === e.lvl && o.items.bow)) item = 'arrow';
    if (item) this.dropItem(item, e.lvl, e.x, e.y, { g: e.g });
  }
  win() {
    this.won = true; this.ev({ t: 'win' }); this.msg('THE HOLLOW KING IS UNMADE. THE EMBERS RETURN TO THE LAND.');
  }
  // ---- player actions ----
  playerAttack(p, a) {
    const L = this.W.levels[p.lvl];
    if (p.webbed) { if (this.time - p.webbed.at >= WEB_HELPLESS) this.cutFree(p); return; } // stuck: a moment of nothing, then a slash cuts you loose (and brings them down)
    const swordDmg = SWORD_DMG[p.sword] || 1;
    if ((a.kind === 'sword' || a.kind === 'pommel' || a.kind === 'slash') && p.sword === 0) return;
    if (a.kind === 'pommel') return this.pommelStrike(p, L);
    let range = 1.45, cone = 0.85, dmg = swordDmg; const slash = a.kind === 'slash'; if (slash) { range = 1.65; cone = 1.0; } const hits = [];
    if (p.cls === 'monk') { range = 1.15; cone = 0.7; dmg = Math.max(1, swordDmg) * (a.kind === 'punch3' ? 2 : 1); }
    if (a.kind === 'wave') { this.fireProj('wave', p.lvl, p.x + Math.cos(p.a) * 0.4, p.y + Math.sin(p.a) * 0.4, p.a, 'p', p.id, { dmg: 3 + swordDmg * 2, life: 2.5 }); this.sfx('wave', p.lvl, p.x, p.y); return; }
    let hitAny = false;
    for (const e of this.ents) {
      if (e.lvl !== p.lvl || e.dead) continue;
      if (e.k === 'en') {
        const def = enemyDef(e.type); const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
        if (d > range + this.enemyRadius(e)) continue;
        const ang = Math.atan2(e.y - p.y, e.x - p.x); if (d > 0.5 && Math.abs(angDiff(p.a, ang)) > cone) continue;
        if (this.damageEnemy(e, dmg, p, { pid: p.id, ignoreIframes: true })) { hitAny = true; hits.push(e); } // every swing lands (swings come every 0.3 s, faster than the 0.35 s a hit protects a foe)
        if (p.cls === 'monk' && a.kind === 'punch3' && !def.boss) { const [v, t] = this.knockFor(e, def, 14); e.kb = [Math.cos(p.a) * v, Math.sin(p.a) * v]; e.kbT = t || 0.2; e.stun = 0.5; }
      }
    }
    if (!this.cutAt(L, p.x + Math.cos(p.a) * 0.75, p.y + Math.sin(p.a) * 0.75, p)) this.cutAt(L, p.x + Math.cos(p.a) * 1.25, p.y + Math.sin(p.a) * 1.25, p);
    // TODO(monk rework): remove. The martial artist has no pommel strike yet, so his punches split gourds instead (he'd be stuck in Bramble Keep otherwise).
    if (p.cls === 'monk') { for (const d of [0.6, 1.1]) this.breakGourd(L, p.x + Math.cos(p.a) * d, p.y + Math.sin(p.a) * d); }
    else for (const d of [0.6, 1.1]) { const i = L.idx(Math.floor(p.x + Math.cos(p.a) * d), Math.floor(p.y + Math.sin(p.a) * d)); if (Content.breakables[L.props[i]]) { this.sfx('thok', p.lvl, p.x, p.y); break; } } // a swing just bounces off
    if (a.kind === 'sword' && hitAny) this.chainHit(p, hits);
    if (hitAny && this.armOn(p, 'blade')) for (const e of hits) (p.armCuts = p.armCuts || []).push({ id: e.id, at: this.time + ARM_DELAY, dmg: dmg * ARM_MIRROR }); // the Silk Arm cuts again a beat later
    if (hitAny && p.cls === 'monk') this.ev({ t: 'pow', lvl: p.lvl, x: p.x + Math.cos(p.a) * 0.9, y: p.y + Math.sin(p.a) * 0.9, big: a.kind === 'punch3' });
    // bush cutting / burn? sword cuts nothing; check bombable hint clink
    // sword beams: at full health, one at a time. The Dawnblade's light always flies, at any health, up to 3 at once.
    const myBeams = this.ents.filter(e => e.k === 'proj' && !e.dead && e.pid === p.id && Content.projectiles[e.type].beam).length;
    if (a.kind !== 'pommel' && (p.cls !== 'monk' && p.sword >= 4 ? myBeams < 3 : p.hp >= p.maxHp && myBeams === 0)) {
      if (p.cls === 'monk') this.fireProj('ki', p.lvl, p.x + Math.cos(p.a) * 0.3, p.y + Math.sin(p.a) * 0.3, p.a, 'p', p.id, { dmg: swordDmg });
      else this.fireProj(p.sword >= 4 ? 'dawnbeam' : 'beam', p.lvl, p.x + Math.cos(p.a) * 0.3, p.y + Math.sin(p.a) * 0.3, p.a, 'p', p.id, { dmg: swordDmg });
      this.sfx('beam', p.lvl, p.x, p.y);
    }
  }
  // split a gourd (or a dungeon's own breakable) at x, y: it drops its thing and grows back later, once nobody's near
  breakGourd(L, x, y) {
    const i = L.idx(Math.floor(x), Math.floor(y)); const b = Content.breakables[L.props[i]]; if (!b) return false;
    this.setTile(L.id, i, null, PR.NONE); this.gourdRegrow.push({ lvl: L.id, i, prop: L.gourds && L.gourds[i] != null ? L.gourds[i] : PR[b.name], at: this.time + GOURD_REGROW });
    const cx = Math.floor(x) + 0.5, cy = Math.floor(y) + 0.5; this.sfx('gourd', L.id, cx, cy); this.spawn({ k: 'fx', lvl: L.id, x: cx, y: cy, spr: 'puff', life: 0.3, sc: 0.7 });
    const item = b.drop(Math.random); if (item) this.dropItem(item, L.id, cx, cy);
    return true;
  }
  // a tile that's something else for `dur` seconds (a wyrm's ice strip, a lava splash), then goes back. Saves never keep it.
  setTempTile(lvl, i, tile, dur) {
    const L = this.W.levels[lvl]; const old = this.tempTiles.find(t => t.lvl === lvl && t.i === i);
    if (old) { old.at = this.time + dur; if (L.tiles[i] !== tile) this.setTile(lvl, i, tile); return; }
    this.tempTiles.push({ lvl, i, orig: L.tiles[i], tile, at: this.time + dur }); this.setTile(lvl, i, tile);
  }
  updateTempTiles() { if (!this.tempTiles.length) return; this.tempTiles = this.tempTiles.filter(t => { if (this.time < t.at) return true; const L = this.W.levels[t.lvl]; if (L.tiles[t.i] === t.tile) this.setTile(t.lvl, t.i, t.orig); return false; }); }
  // twin-eye gates: closed with no eye shut, half raised with one, and open for good once both are shut at the same time
  updateTwinGates(only) {
    for (const L of only ? [only] : Object.values(this.W.levels)) for (const g of L.twinGates || []) {
      const cur = L.tiles[g.gate]; if (!TINFO[cur].twinGate) continue; // already open
      const shut = g.eyes.filter(i => TINFO[L.tiles[i]].shut).length;
      if (shut >= 2) { this.setTile(L.id, g.gate, g.openTo); for (const i of g.eyes) { this.tempTiles = this.tempTiles.filter(t => !(t.lvl === L.id && t.i === i)); this.setTile(L.id, i, TL.EYE_SHUT); } this.sfx('secret', L.id); this.msg('THE GATE GRINDS ALL THE WAY UP!'); continue; }
      const want = shut ? TL.TWINGATE_HALF : TL.TWINGATE; if (cur !== want) { this.setTile(L.id, g.gate, want); this.sfx(shut ? 'door' : 'clank', L.id, g.gate % L.w + 0.5, Math.floor(g.gate / L.w) + 0.5); }
    }
  }
  updateGourds() {
    if (!this.gourdRegrow.length) return;
    this.gourdRegrow = this.gourdRegrow.filter(g => {
      if (this.time < g.at) return true; const L = this.W.levels[g.lvl]; const x = g.i % L.w + 0.5, y = Math.floor(g.i / L.w) + 0.5;
      if (Object.values(this.players).some(p => p.lvl === g.lvl && dist2(p.x, p.y, x, y) < 36)) return true; // not while someone's watching
      if (L.props[g.i] === PR.NONE) this.setTile(g.lvl, g.i, null, g.prop); return false;
    });
  }
  // A sword knight counts the hits its shield stops; after def.counter of them (within 4 s) it winds up a counter-attack
  // (enemies/knight.js knightAi swings it).
  shieldBlocked(e, def, pid) {
    if (this.time - (e.blockAt != null ? e.blockAt : -99) > 4) e.blocks = 0; e.blockAt = this.time; if (pid && this.players[pid]) e.counterOn = pid; // the counter goes after whoever hit the shield last
    e.blocks = (e.blocks || 0) + 1; if (e.blocks >= def.counter && !(e.counterT > 0)) { e.blocks = 0; e.counterT = KNIGHT_WINDUP; e.counterHits = def.counterHits || 1; this.sfx('windup', e.lvl, e.x, e.y); }
  }
  // DISARM (Heavy Pommel on a foe with def.disarm): what it holds goes flying (a 'tossed' entity), it staggers for a moment,
  // and from then on fights without it: def.disarmedSprite for the look, def.disarmedAi for how it behaves.
  disarmEnemy(e, src) {
    const def = enemyDef(e.type); e.disarmed = true; e.stun = Math.max(e.stun || 0, DISARM_STAGGER); e.stunFrom = this.time; e.hurt = 0.3;
    const a = src ? Math.atan2(e.y - src.y, e.x - src.x) + (Math.random() - 0.5) * 1.2 : Math.random() * TAU;
    this.spawn({ k: 'tossed', lvl: e.lvl, x: e.x, y: e.y, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, spr: def.disarm, sc: 0.6, z: 0.3, life: 6 });
    this.sfx('disarm', e.lvl, e.x, e.y); if (src && this.players[src.id] === src) this.hint(src, def.disarmText || 'DISARMED!');
  }
  // knock one piece of armor off. `method` ('bomb', 'pommel', ...) only works once per foe: a second time just clanks.
  stripArmor(e, method, src) {
    if (!(e.armor > 0) || e.dead) return false; e.stripped = e.stripped || {};
    if (e.stripped[method]) { this.sfx('clank', e.lvl, e.x, e.y); return false; }
    e.stripped[method] = true; e.armor--; e.hurt = 0.25; e.hitAt = this.time; if (enemyDef(e.type).dummy) this.ev({ t: 'pow', lvl: e.lvl, x: e.x, y: e.y, num: true, word: 'ARMOR -1' });
    this.sfx('armor', e.lvl, e.x, e.y); this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'armorbits', life: 0.45, sc: 0.9, z: 0.3 });
    if (src && !enemyDef(e.type).boss && !enemyDef(e.type).anchored) { const a = Math.atan2(e.y - src.y, e.x - src.x); const [v, t] = this.knockFor(e, enemyDef(e.type), 6); e.kb = [Math.cos(a) * v, Math.sin(a) * v]; e.kbT = t || 0.12; }
    return true;
  }
  // POMMEL STRIKE: little damage and a long stun on whatever's right in front of you. A shield still blocks it from the front.
  // With the Heavy Pommel scroll it also knocks a piece of armor off (once per foe). It's also the only thing that splits gourds.
  pommelStrike(p, L) {
    let hit = false;
    for (const e of this.ents) {
      if (e.k !== 'en' || e.lvl !== p.lvl || e.dead) continue; const def = enemyDef(e.type); const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
      if (d > 1.25 + this.enemyRadius(e)) continue; if (d > 0.5 && Math.abs(angDiff(p.a, Math.atan2(e.y - p.y, e.x - p.x))) > 0.6) continue;
      hit = true;
      if (p.items.heavypommel && def.disarm && !e.disarmed && !def.boss && !(e.armor > 0)) { this.disarmEnemy(e, p); continue; } // knocks the shield (or staff) clean away; armor has to come off first
      if (e.armor > 0) { if (!(p.items.heavypommel && this.stripArmor(e, 'pommel', p))) this.damageEnemy(e, POMMEL_DMG, p, { pid: p.id, kbMul: 0.6, blunt: true }); continue; } // armor takes the blow: no stun
      if (this.damageEnemy(e, POMMEL_DMG, p, { pid: p.id, kbMul: 0.6, blunt: true }) && !def.boss && !e.dead) { e.stun = Math.max(e.stun || 0, POMMEL_STUN); e.stunFrom = this.time; }
    }
    let ribbed = false; for (const d of [0.6, 1.1]) { this.breakGourd(L, p.x + Math.cos(p.a) * d, p.y + Math.sin(p.a) * d); if (!ribbed) ribbed = this.hitRib(L, p.x + Math.cos(p.a) * d, p.y + Math.sin(p.a) * d, p.items.heavypommel ? OSSUARY_HITS : Math.ceil(OSSUARY_HITS / 2), p); } // a rib: one heavy pommel strike, or two plain ones
    this.sfx(hit ? 'pommel' : 'swing', p.lvl, p.x, p.y);
  }
  // Every third sword hit in a chain (hits less than CHAIN_GAP apart) readies a backswing. It fires on the first hit that
  // leaves a foe standing (so a third hit that kills saves it for the next one), cutting that foe again a moment later.
  chainHit(p, hits) {
    if (this.time - (p.chainAt != null ? p.chainAt : -99) > CHAIN_GAP) p.chain = 0;
    p.chain = (p.chain || 0) + 1; p.chainAt = this.time; if (p.chain >= 3) p.backArmed = true;
    const alive = hits.find(e => !e.dead);
    if (p.backArmed && alive) { p.backArmed = false; p.chain = 0; p.backswing = { at: this.time + BACKSWING_DELAY, eid: alive.id }; this.ev({ t: 'backswing', pid: p.id }); }
  }
  updateBackswing(p) {
    const b = p.backswing; if (!b || this.time < b.at) return; p.backswing = null;
    const e = this.ents.find(x => x.id === b.eid); if (!e || e.dead || e.lvl !== p.lvl) return;
    if (Math.sqrt(dist2(e.x, e.y, p.x, p.y)) > 1.9 + this.enemyRadius(e)) return;
    this.damageEnemy(e, SWORD_DMG[p.sword] || 1, p, { pid: p.id, ignoreIframes: true });
  }
  useItem(p, item, a) {
    const d = itemDef(item); if (!d || d.slot !== 'b' || !d.owned(p)) return;
    if (a && a.alt && d.useAlt) return d.useAlt(this, p, a); // Shift + item: the item's technique, when it has one (otherwise the plain use)
    d.use(this, p, a || {});
  }
  // Poison: POISON_FRAC of max health every second for 2-5 ticks. A new dose restarts the count. It can't kill.
  poisonPlayer(p) { if (p.god || !p.alive) return; p.poisonTicks = 2 + Math.floor(Math.random() * 4); p.poisonNext = this.time + 1; this.ev({ t: 'poison', pid: p.id }); }
  tickPoison(p) {
    if (!(p.poisonTicks > 0) || this.time < p.poisonNext) return;
    p.poisonTicks--; p.poisonNext = this.time + 1; if (p.hp > 1) { p.hp = Math.max(1, p.hp - Math.max(1, Math.round(p.maxHp * POISON_FRAC))); this.clearBeam(p); }
    this.ev({ t: 'poisontick', pid: p.id }); this.sfx('poison', p.lvl, p.x, p.y);
  }
  flying(p) { return (p.flyUntil || 0) > this.time; }
  // inventory choices: wear a lesser sword or tunic than your best, or fire plain arrows instead of frost ones
  equip(p, a) {
    if (a.slot === 'sword') { const lv = a.lv | 0; if (lv >= 1 && lv <= Math.max(p.swordMax || 0, p.sword)) p.sword = lv; }
    else if (a.slot === 'armor') { const lv = a.lv | 0; if (lv >= 0 && lv <= Math.max(p.armorMax || 0, p.armor)) p.armor = lv; }
    else if (a.slot === 'arm') { if (p.items.silkarm && (a.mode === 'blade' || a.mode === 'guard') && a.mode !== p.armMode) { p.armMode = a.mode; p.armSwapAt = this.time + ARM_SWAP; } } // the Silk Arm's stance (it takes a moment to change)
    else if (a.slot === 'ring') { if (a.id === 'none') p.ring = null; else if (p.items[a.id] && Content.items[a.id] && Content.items[a.id].ring) p.ring = a.id; } // one ring at a time (items/rings.js)
    else if (a.slot === 'wand') p.wandEl = ['plain', 'fire', 'thunder'].includes(a.kind) ? a.kind : 'plain'; // the magic wand's element (items/rod.js)
    else if (a.slot === 'arrows') p.arrowType = ['plain', 'frost', 'silver'].includes(a.kind) ? a.kind : (a.plain ? 'plain' : 'frost');
  }
  // HOMING shots (projectile def homing: turn rate in radians a second) bend toward the nearest target within 12 tiles:
  // a hero for an enemy's shot, a foe for a hero's
  steerProj(e, def, dt) {
    let best = null, bd = 144;
    if (e.owner === 'e') { for (const p of Object.values(this.players)) if (p.alive && p.lvl === e.lvl) { const d = dist2(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = p; } } }
    else for (const o of this.ents) if (o.k === 'en' && o.lvl === e.lvl && !o.dead && !o.dormant) { const d = dist2(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; best = o; } }
    if (!best) return; const sp = Math.hypot(e.vx, e.vy); const cur = Math.atan2(e.vy, e.vx);
    const na = cur + clamp(angDiff(cur, Math.atan2(best.y - e.y, best.x - e.x)), -def.homing * dt, def.homing * dt); e.vx = Math.cos(na) * sp; e.vy = Math.sin(na) * sp;
  }
  // THE WARDHOLD SHIELD's reflect (content/wardhold.js): for REFLECT_TIME after your shield comes up, a blockable shot that
  // hits it flies straight back the way it came, now yours (three times as hard with Mirror Guard); a homing seed chases foes.
  reflectOpen(p) { return p.cls !== 'monk' && !!p.items.wardshield && !!p.shUp && this.time - (p.shieldAt || -99) <= REFLECT_TIME; }
  wardReady(p) { return p.cls !== 'monk' && !!p.items.wardshield && this.time >= (p.wardAt || 0); }
  reflectProj(e, p) {
    e.owner = 'p'; e.pid = p.id; e.vx = -e.vx * 1.3; e.vy = -e.vy * 1.3; e.dmg = p.items.mirrorguard ? 6 : 2; e.hitSet = {}; e.life = Math.max(e.life, 2); e.reflected = true;
    this.sfx('reflect', e.lvl, p.x, p.y); this.ev({ t: 'block', pid: p.id, reflect: true });
  }
  updateProj(e, dt) {
    const L = this.W.levels[e.lvl]; const def = Content.projectiles[e.type];
    if (def.homing && e.t >= (def.homeDelay || 0)) this.steerProj(e, def, dt);
    if (e.owner === 'e' && def.elem === 'magic' && !e.slowed) for (const pl of Object.values(this.players)) if (pl.alive && pl.lvl === e.lvl && this.ringOn(pl, 'ring_hollowsilver') && dist2(pl.x, pl.y, e.x, e.y) < 6.25) { e.slowed = true; e.vx *= 0.5; e.vy *= 0.5; e.life *= 2; break; } // Hollow Silver
    let nx = e.x + e.vx * dt, ny = e.y + e.vy * dt; e.life -= dt;
    // sword beams and arrows glance off a door frame instead of breaking on it: if only one axis is blocked and the
    // shot is mostly travelling along the other, it straightens out and carries on through the doorway
    if (def.player && !def.fire) {
      const blocked = (x, y) => { const tt = TINFO[L.get(Math.floor(x), Math.floor(y))]; return tt.solid && !tt.low; };
      if (blocked(nx, ny)) {
        const sp = Math.hypot(e.vx, e.vy) || 1;
        if (!blocked(nx, e.y) && Math.abs(e.vx) > sp * 0.7) { e.vx = Math.sign(e.vx) * sp; e.vy = 0; }
        else if (!blocked(e.x, ny) && Math.abs(e.vy) > sp * 0.7) { e.vy = Math.sign(e.vy) * sp; e.vx = 0; }
        nx = e.x + e.vx * dt; ny = e.y + e.vy * dt;
      }
    }
    const t = L.get(Math.floor(nx), Math.floor(ny)); const ti = TINFO[t]; const pr = L.props[L.idx(Math.floor(nx), Math.floor(ny))];
    if (def.fire) { // candle flame: burn bushes
      this.burnAt(L, nx, ny);
    }
    if (def.beam && e.owner !== 'e' && !e.bounced && e.life > 0 && ti.solid && !ti.low && this.ringOn(this.players[e.pid], 'ring_echo')) { // the Echo Ring: a sword beam bounces off one wall
      const sol = (x, y) => { const t2 = TINFO[L.get(Math.floor(x), Math.floor(y))]; return t2.solid && !t2.low; }; const bx = sol(nx, e.y), by = sol(e.x, ny);
      if (bx || !by) e.vx = -e.vx; if (by || !bx) e.vy = -e.vy; e.bounced = true; e.hitSet = {}; e.life = Math.max(e.life, 0.6); this.sfx('clink', e.lvl, e.x, e.y); return;
    }
    if (e.life <= 0 || (ti.solid && !ti.low) || (pr && PROP_INFO[pr] && PROP_INFO[pr].solid && pr !== PR.PEDESTAL)) {
      if (ti.eye && def.eyeHit && e.life > 0) this.hitEye(L, L.idx(Math.floor(nx), Math.floor(ny)), e.bomb);
      else if (ti.eye && !ti.shut && def.player && e.pid && this.players[e.pid]) { const pl = this.players[e.pid]; if (this.time - (pl.eyeHintAt || -99) > 8) { pl.eyeHintAt = this.time; this.hint(pl, 'THE EYE DOESN\'T EVEN BLINK. MAYBE AN ARROW...'); } }
      if (def.fire || e.fireTrail) { this.spawn({ k: 'fire', lvl: e.lvl, x: e.x, y: e.y, life: 1.2, spr: 'flame', sc: 0.8, z: -0.05, pid: e.pid }); }
      if (def.endFx) this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: def.endFx, life: 0.25, sc: 0.8 });
      this.projBurst(e); e.dead = true; return;
    }
    e.x = nx; e.y = ny;
    if (e.frost && e.owner !== 'e') this.freezeAlong(e, L, nx, ny);
    if (e.owner === 'e') {
      for (const p of Object.values(this.players)) {
        if (!p.alive || p.lvl !== e.lvl) continue;
        if (dist2(p.x, p.y, e.x, e.y) < 0.16) {
          // sword-class shield blocks weak front projectiles when not attacking
          const toP = Math.atan2(e.y - p.y, e.x - p.x);
          if (def.poison) this.poisonPlayer(p); // poison gets through a shield
          if (def.silk) p.silk = Math.max(p.silk || 0, def.silk); // a web glob: you wade for a moment
          if (def.guardOnly) { if (p.cls !== 'monk' && p.shUp && Math.abs(angDiff(p.a, toP)) < 0.7) { e.dead = true; this.sfx('clink', e.lvl); this.ev({ t: 'block', pid: p.id }); return; } } // only a raised shield (stand still, face it) stops this: no ward, no reflect, no Silk Arm
          const guardArm = !def.guardOnly && def.blockable && this.armOn(p, 'guard'); // the Silk Arm's guard blocks from any side
          if (!def.guardOnly && p.cls !== 'monk' && def.blockable && Math.abs(angDiff(p.a, toP)) < 0.7 && this.reflectOpen(p)) { this.reflectProj(e, p); return; }
          if (!def.guardOnly && !def.blockable && Math.abs(angDiff(p.a, toP)) < 0.7 && this.wardReady(p)) { p.wardAt = this.time + WARD_TIME; e.dead = true; this.sfx('ward', e.lvl, p.x, p.y); this.ev({ t: 'block', pid: p.id, reflect: true }); return; } // the shield's ward stops what a shield can't
          if (guardArm || (!def.guardOnly && p.cls !== 'monk' && def.blockable && Math.abs(angDiff(p.a, toP)) < 0.7)) { e.dead = true; this.sfx('clink', e.lvl); this.ev({ t: 'block', pid: p.id }); return; }
          if (def.chill && p.inv <= 0 && !p.god) p.chill = Math.max(p.chill || 0, def.chill);
          this.hurtPlayer(p, e.dmg, e); if (def.knock && p.alive) { const sp = Math.hypot(e.vx, e.vy) || 1; this.ev({ t: 'shove', pid: p.id, kx: e.vx / sp * def.knock, ky: e.vy / sp * def.knock }); } e.dead = true; return;
        }
      }
    } else {
      for (const en of this.ents) {
        if (en.k !== 'en' || en.lvl !== e.lvl || en.dead || e.hitSet[en.id] || en.sub || en.air) continue; // shots pass over a submerged or leaping foe
        const r = this.enemyRadius(en) + 0.2;
        if (dist2(en.x, en.y, e.x, e.y) < r * r) {
          e.hitSet[en.id] = 1;
          const landed = this.damageEnemy(en, e.dmg * (e.frost && enemyDef(en.type).hot ? 2 : 1), { x: e.x - e.vx * 0.1, y: e.y - e.vy * 0.1 }, { pid: e.pid, silver: e.silver, elem: e.frost ? 'frost' : def.pelem || (e.fireTrail ? 'fire' : null), arrow: e.type === 'arrow' || /^arrow/.test(e.type), reflected: !!e.reflected, noKb: !!e.frost, pierceShield: def.pierceShield, ignoreIframes: def.pierce, kbMul: e.kbMul, shieldBreak: e.shieldBreak ? e.dmg / (e.shieldBreak === true ? 2 : e.shieldBreak) : 0, breakNocks: e.shieldBreak === true ? 2 : e.shieldBreak || 0 }); // a loaded shot jars a shield for one arrow's damage
          if (e.frost && landed && !en.dead) { en.stun = Math.max(en.stun, enemyDef(en.type).boss ? 0.6 : 2.5); this.spawn({ k: 'fx', lvl: e.lvl, x: en.x, y: en.y, spr: 'icefx', life: 0.4, sc: 1 }); this.sfx('freeze', e.lvl, en.x, en.y); }
          if (def.fire) this.spawn({ k: 'fire', lvl: e.lvl, x: e.x, y: e.y, life: 0.8, spr: 'flame', sc: 0.8, z: -0.05, pid: e.pid });
          if (def.stun && landed && !en.dead && !enemyDef(en.type).boss) en.stun = Math.max(en.stun, def.stun);
          if (def.chain && e.chainLeft > 0) { // leap to the nearest other foe
            let nx2 = null, nd = 3.5 * 3.5; for (const o of this.ents) { if (o.k !== 'en' || o.dead || o.lvl !== e.lvl || e.hitSet[o.id] || o.sub || o.air) continue; const d = dist2(o.x, o.y, e.x, e.y); if (d < nd) { nd = d; nx2 = o; } }
            if (nx2) { e.chainLeft--; const a = Math.atan2(nx2.y - e.y, nx2.x - e.x), sp = Math.hypot(e.vx, e.vy); e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp; e.life = Math.max(e.life, 0.8); this.sfx('beam', e.lvl, e.x, e.y); return; }
          }
          if (!def.pierce) { this.projBurst(e); e.dead = true; return; }
        }
      }
    }
  }
  // tiles with cuttable: true (brambles) open when a sword or fist hits them
  // THE OSSUARY's ribs (enemies/wizard.js): seven sword cuts break one, a pommel strike or a bomb at once. A burning rib bites back.
  hitRib(L, x, y, n, p) {
    const i = L.idx(Math.floor(x), Math.floor(y)); const ti = TINFO[L.tiles[i]]; if (!ti || !ti.rib) return false;
    if (p && ti.ribHot) this.hurtPlayer(p, 1, { k: 'efire', x, y }, 'fire');
    L.ribHits = L.ribHits || {}; L.ribHits[i] = (L.ribHits[i] || 0) + n; this.sfx('clank', L.id, x, y);
    if (L.ribHits[i] < OSSUARY_HITS) return true;
    for (const t of this.tempTiles) if (t.lvl === L.id && t.i === i) t.at = this.time - 1; this.updateTempTiles(); delete L.ribHits[i];
    this.spawn({ k: 'fx', lvl: L.id, x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, spr: 'armorbits', life: 0.45, sc: 1, z: 0.3 }); this.sfx('rattle', L.id, x, y); return true;
  }
  clearRibs(o) { for (const t of this.tempTiles) if (t.lvl === o.lvl && o.ribs.includes(t.i)) t.at = this.time - 1; this.updateTempTiles(); const L = this.W.levels[o.lvl]; if (L.ribHits) for (const i of o.ribs) delete L.ribHits[i]; }
  cutAt(L, x, y, p) {
    const i = L.idx(Math.floor(x), Math.floor(y)); const ti = TINFO[L.tiles[i]];
    if (ti && ti.rib) { this.hitRib(L, x, y, 1, p); return true; } // (true: the swing stops at the rib, so one swing is one cut)
    if (PR.COCOON != null && L.props[i] === PR.COCOON) { this.setTile(L.id, i, null, PR.HELM); this.spawn({ k: 'fx', lvl: L.id, x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, spr: 'puff', life: 0.4, sc: 1 }); this.sfx('hit', L.id); } // cut open: empty armor
    if (PR.WEBLINE != null && L.props[i] === PR.WEBLINE && p) { this.setTile(L.id, i, null, 0); this.dropSpiders(p, 3); } // a cut strand shakes the whole web
    if (ti && ti.cuttable) { this.setTile(L.id, i, TL[ti.opensTo] != null ? TL[ti.opensTo] : TL.DFLOOR); this.spawn({ k: 'fx', lvl: L.id, x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, spr: 'puff', life: 0.3, sc: 0.9 }); this.sfx('hit', L.id); }
  }
  // A HOLLOW TREE (content/grottos.js) burns open on the stair down to its grotto: fire does it (the candle, from the start).
  openHollowTree(L, x, y) {
    const i = L.idx(Math.floor(x), Math.floor(y)); if (PR.HOLLOWTREE == null || L.props[i] !== PR.HOLLOWTREE) return false;
    const rev = L.secretReveal[i]; this.setTile(L.id, i, rev ? rev.tile : null, 0); if (L.kind === 'ow') this.addGrudge(2);
    for (const [dx, dz] of [[0, 0.2], [-0.25, 0.6], [0.25, 0.6], [0, 1]]) this.spawn({ k: 'fx', lvl: L.id, x: Math.floor(x) + 0.5 + dx, y: Math.floor(y) + 0.5, spr: 'flame', life: 0.9, sc: 1.1, z: dz }); this.sfx('fire', L.id); this.sfx('secret', L.id);
    return true;
  }
  burnAt(L, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const bx = tx + dx, by = ty + dy; const i = L.idx(bx, by);
      if (bx < 0 || by < 0 || bx >= L.w || by >= L.h) continue;
      const ti = TINFO[L.tiles[i]];
      if (ti && ti.burnable && dist2(bx + 0.5, by + 0.5, x, y) < 1.2) { this.setTile(L.id, i, TL[ti.opensTo] != null ? TL[ti.opensTo] : TL.DFLOOR); this.spawn({ k: 'fx', lvl: L.id, x: bx + 0.5, y: by + 0.5, spr: 'flame', life: 0.6, sc: 0.9 }); }
      if (L.props[i] === PR.HOLLOWTREE && dist2(bx + 0.5, by + 0.5, x, y) < 1.2) this.openHollowTree(L, bx + 0.5, by + 0.5);
      if (ti && ti.silk && dist2(bx + 0.5, by + 0.5, x, y) < 1.2) this.igniteSilk(L, i); // old silk: the whole room goes up (gimmicks/webs.js)
      if (PR.EGGSAC != null && (L.props[i] === PR.EGGSAC || L.props[i] === PR.WEBLINE || L.props[i] === PR.COCOON) && dist2(bx + 0.5, by + 0.5, x, y) < 1.2) { const was = L.props[i]; this.setTile(L.id, i, null, was === PR.COCOON ? PR.HELM : 0); this.spawn({ k: 'fx', lvl: L.id, x: bx + 0.5, y: by + 0.5, spr: 'flame', life: 0.6, sc: 0.9 }); this.sfx('fire', L.id); }
      if (PR.TORCH != null && L.props[i] === PR.TORCH && dist2(bx + 0.5, by + 0.5, x, y) < 1.2) { this.setTile(L.id, i, null, PR.FLAME); this.sfx('fire', L.id); }
      if (L.props[i] === PR.BUSH && dist2(bx + 0.5, by + 0.5, x, y) < 0.7) {
        const rev = L.secretReveal[i]; if (L.kind === 'ow') this.addGrudge(2); // a thorn-folk home
        this.setTile(L.id, i, rev ? rev.tile : null, 0);
        this.spawn({ k: 'fx', lvl: L.id, x: bx + 0.5, y: by + 0.5, spr: 'flame', life: 0.6, sc: 0.9 });
        if (rev) this.sfx('secret', L.id);
      }
    }
  }
  fireHits(e) {
    for (const en of this.ents) if (en.k === 'en' && en.lvl === e.lvl && !en.dead && dist2(en.x, en.y, e.x, e.y) < 0.5) this.damageEnemy(en, 1, e, { pid: e.pid, elem: 'fire' });
    this.burnAt(this.W.levels[e.lvl], e.x, e.y);
  }
  pickup(p, e) {
    const d = itemDef(e.item); if (!d) { e.dead = true; return; }
    if (d.canTake && !d.canTake(p)) return;
    if (d.takeFrom) { if (d.takeFrom(this, p, e) !== false) e.dead = true; return; } // items that need the ground entity (like a dropped gem bag)
    if (e.k === 'shop') {
      const nag = (t, text) => { if (!e.warned || this.time - e.warned > 3) { e.warned = this.time; this.ev({ t, pid: p.id, text }); } };
      if (e.cond && !this.shopCond(e.cond)) { nag('dialog', e.condText || 'THE ROOTS DON\'T TRUST YOU ANYMORE. NOT THAT ONE.'); return; }
      if (e.need && p.maxHp / 4 < e.need) return nag('dialog', 'MASTER USING IT AND YOU CAN HAVE THIS... COME BACK WITH ' + e.need + ' HEARTS.');
      if (!e.gift && p.gems < e.price) return nag('hint', 'YOU NEED ' + e.price + ' GEMS.');
      if (e.unique && p.cls === 'monk') return nag('dialog', 'YOUR HANDS ALREADY KNOW THE WAY.');
      if (!e.gift && d.full && d.full(p)) return nag('hint', 'YOU CAN\'T CARRY ANY MORE.');
      if (!e.gift && this.time < (p.buyReady || 0)) return; // one purchase per BUY_COOLDOWN, so standing on the counter can't drain your gems
      if (!e.gift) { p.gems -= e.price; p.buyReady = this.time + BUY_COOLDOWN; }
      this.giveItem(p, e.item, true);
      if (e.gift) { this.team.taken[e.tk] = true; if (e.choose) { this.team.taken[e.choose] = true; for (const o of this.ents) if (o.choose === e.choose) o.dead = true; } e.dead = true; if (e.choose && e.item === 'potion') { this.team.taken['refill:' + e.lvl] = true; this.openRefill(e.lvl); } }
      return;
    }
    if (e.tk) this.team.taken[e.tk] = true;
    e.dead = true;
    this.giveItem(p, e.item, false);
    if (!e.tk && (e.item === 'gem1' || e.item === 'gem5') && this.ringOn(p, 'ring_miser')) this.giveItem(p, e.item, false); // the Miser's Ring
    if (e.bait) this.baitTaken(e);
  }
  // THE WYRM ARENA'S BAIT (world.js genTunnel): gems and a heart at each end. Take from BOTH ends while the pair lives and they
  // both fly into a rage (enemies/wyrm.js). They remember: if you wipe and come back, they start out enraged.
  baitBoth(L, room, key) { const sides = new Set(); (room.stash || []).forEach((s, i) => { if (s.bait && this.team.taken[key + ':stash' + i]) sides.add(s.bait); }); return sides.size >= 2; }
  baitTaken(e) {
    const g = this.groups[e.g]; if (!g || g.cleared) return; const L = this.W.levels[g.lvl];
    if (!this.baitBoth(L, g.room, g.key)) { if (!g.baitWarned) { g.baitWarned = true; this.sfx('growl', L.id, e.x, e.y); this.msg('THE WYRMS WATCH YOU...'); } return; }
    this.enrageGroup(g);
  }
  enrageGroup(g) {
    let any = false; for (const en of g.ents) { if (en.dead || en.enraged) continue; any = true; en.enraged = true; en.maxHp = Math.round(en.maxHp * 1.5); en.hp = en.maxHp; en.tm = 1; en.chargeIn = 1.5 + Math.random(); }
    if (any) { const L = this.W.levels[g.lvl]; const e0 = g.ents.find(en => !en.dead); this.sfx('rage', L.id, e0.x, e0.y); this.ev({ t: 'shake', lvl: L.id, x: e0.x, y: e0.y }); this.msg('THIEF! THE WYRMS ARE ENRAGED!'); }
  }
  // Runs the item's give(). Team items run it for every player, and the "you got it" banner shows once.
  giveItem(p, id, fromShop) {
    const d = itemDef(id); if (!d) return;
    let shown = false;
    const banner = (text, all) => { if (shown) return; shown = true; this.ev({ t: 'get', pid: p.id, item: id, text: text || itemName(id, p.cls), all: all != null ? all : !!d.team }); };
    const ctx = { fromShop, banner, taker: p };
    if (d.team) for (const o of Object.values(this.players)) d.give(this, o, ctx); else d.give(this, p, ctx);
  }
  tick(dt) {
    this.update(dt); if (Content.updateOssuaries) Content.updateOssuaries(this); this.updateGourds(); this.updateTempTiles(); this.updateTwinGates();
    if (this.pendingExit && this.time > this.pendingExit.at) {
      const L = this.W.levels[this.pendingExit.lvl];
      for (const p of Object.values(this.players)) if (p.lvl === L.id) { p.alive = true; p.hp = p.maxHp; this.teleport(p, 'ow', L.exit.x, L.exit.y, L.exit.a); }
      this.pendingExit = null;
    }
  }
  // ---- snapshot for a player ----
  entView(e, viewer) { // viewer: the hero this snapshot is for (a knight shows them its back when they're behind it)
    let spr = e.spr, sc = e.sc || 0.8, z = e.z || 0, fl = 0;
    if (e.k === 'en') {
      const def = enemyDef(e.type); spr = e.dormant ? 'statue' : e.type; sc = e.dormant ? 1.1 : def.sc * (e.scMul || 1); z = e.dormant ? 0 : def.z || 0;
      if (def.fly) z += Math.sin(e.t * 6) * 0.06;
      if (def.sprFor) { const s2 = def.sprFor(e); if (s2) spr = s2; }
      if (e.disarmed && def.disarmedSprite) spr = def.disarmedSprite;
      else if (def.backSprite && !e.disarmed && viewer && !e.dormant && Math.abs(angDiff(e.f, Math.atan2(viewer.y - e.y, viewer.x - e.x))) > BACK_ANGLE) spr = def.backSprite; // e.g. a frog's head poking out of the water
      if (e.hurt > 0) fl |= 1; if (e.stun > 0) fl |= 2; if (def.phase) fl |= 4; if (e.spawnFx > 0) { spr = 'puff'; }
      if (def.view) z += def.view(e);
      const el = e.elite && eliteByIdx(e.elite); if (el && el.hidden && viewer && viewer.sel !== 'candle' && dist2(viewer.x, viewer.y, e.x, e.y) > 9) spr = 'hush_eyes'; // HUSH: only its eyes, until it's close or in candlelight
    }
    if (e.k === 'pick' && !e.perm) z += Math.abs(Math.sin(e.t * 3)) * 0.04;
    if (e.k === 'shop') z += Math.sin(this.time * 2) * 0.03;
    const v = [e.id, spr, Math.round(e.x * 100) / 100, Math.round(e.y * 100) / 100, Math.round(sc * 100) / 100, Math.round(z * 100) / 100, fl];
    if (e.k === 'shop' && !e.gift) v.push(e.price); else if (e.k === 'shop' && e.need) v.push(-e.need); else v.push(0);
    if (e.k === 'en' && enemyDef(e.type).boss) v.push(Math.max(0, e.hp / e.maxHp)); else v.push(-1);
    if (e.k === 'npc') v.push(e.text); else v.push(0);
    v.push(e.k === 'en' && e.elite ? e.elite : 0);
    v.push(e.k === 'en' && !e.dead && !enemyDef(e.type).neutral ? 1 : 0); // [11]: a foe (the lunge stops at one)
    return v;
  }
  snapshotFor(pid) {
    const p = this.players[pid]; if (!p) return null;
    const en = []; for (const e of this.ents) if (e.lvl === p.lvl) en.push(this.entView(e, p));
    const pl = []; for (const o of Object.values(this.players)) pl.push([o.id, o.lvl, Math.round(o.x * 100) / 100, Math.round(o.y * 100) / 100, Math.round(o.a * 100) / 100, o.color, o.armor, o.cls, o.alive ? 1 : 0, o.atk, o.name, Math.round(o.revive / REVIVE_TIME * 100) / 100, o.hp, o.maxHp, o.reviver || 0, o.z || 0]); // [15] z: feet height (ledges, the cloak's lift)
    const me = {}; for (const k of ['lvl', 'hp', 'maxHp', 'gems', 'bombs', 'maxBombs', 'arrows', 'maxArrows', 'swordMax', 'armorMax', 'arrowType', 'wandEl', 'sword', 'armor', 'items', 'favs', 'ring', 'armMode', 'potions', 'alive', 'cls', 'sel', 'color', 'name', 'dbg', 'god']) me[k] = p[k]; me.spellCd = Math.max(0, Math.round(((p.spellReady || 0) - this.time) * 10) / 10); me.chill = p.chill > 0 ? 1 : 0; me.mirror = this.reflectOpen(p) ? 1 : 0; me.webbed = p.webbed ? Math.round((this.time - p.webbed.at) * 10) / 10 : -1; me.silk = p.silk > 0 ? 1 : 0; me.armReady = this.time >= (p.armSwapAt || 0) ? 1 : 0; me.ward = this.wardReady(p) ? 1 : 0; me.poison = p.poisonTicks > 0 ? p.poisonTicks : 0; me.fly = this.flying(p) ? Math.round((p.flyUntil - this.time) * 10) / 10 : 0; me.respawnIn = p.alive ? 0 : Math.max(0, Math.ceil(RESPAWN_WAIT - (this.time - (p.downAt || 0))));
    return { t: 's', paused: !!this.paused, pausedBy: this.pausedBy, me, pl, en, team: { keys: this.team.keys, maps: this.team.maps, comps: this.team.comps, shards: this.team.shards, done: this.team.done, relics: this.team.relics, fallen: !!this.team.fallen, grudge: this.team.grudge || 0, refills: Object.keys(this.team.taken).filter(k => k.startsWith('refill:') && this.team.taken[k]).map(k => k.slice(7)) }, vp: this.ventPhase(), rg: this.rigCodes(p.lvl), fz: this.frozenList(p.lvl), mv: this.modVer, over: this.over > 0 };
  }
  // ---- save ----
  makeSave() {
    const players = Object.assign({}, this.savedPlayers || {});
    for (const p of Object.values(this.players)) players[p.color] = this.playerSaveData(p);
    const cl = {}; for (const k in this.team.cleared) if (!k.startsWith('ow:')) cl[k] = true;
    const tileNames = []; for (const k in TL) tileNames[TL[k]] = k;
    let mods = this.mods; if (this.tempTiles.length) { mods = JSON.parse(JSON.stringify(this.mods)); for (const t of this.tempTiles) if (mods[t.lvl] && mods[t.lvl][t.i]) mods[t.lvl][t.i][0] = t.orig; } // temporary tiles are saved as they'll end up
    const propNames = PROPS.slice();
    return { v: SAVE_VERSION, tileNames, propNames, seed: this.W.seed, mode: this.W.mode, team: { keys: this.team.keys, maps: this.team.maps, comps: this.team.comps, shards: this.team.shards, done: this.team.done, relics: this.team.relics, taken: this.team.taken, cleared: cl, fallen: !!this.team.fallen, wardLine: !!this.team.wardLine, grudge: this.team.grudge || 0, grudgePeak: this.team.grudgePeak || 0, said: this.team.said || {} }, mods, players, time: Date.now() };
  }
  loadSave(s) {
    s = migrateSave(s);
    Object.assign(this.team, s.team); this.team.relics = this.team.relics || []; this.team.clearedAt = {}; this.mods = s.mods || {}; this.savedPlayers = s.players || {};
    for (const lvl in this.mods) { const L = this.W.levels[lvl]; if (L && L.gourds) for (const i in this.mods[lvl]) if (L.gourds[i] != null && this.mods[lvl][i][1] !== L.gourds[i]) delete this.mods[lvl][i]; } // split gourds grow back
    for (const lvl in this.mods) { const L = this.W.levels[lvl]; if (!L) continue; for (const i in this.mods[lvl]) { const [t, pr] = this.mods[lvl][i]; L.tiles[i] = t; L.props[i] = pr; } }
    if (this.team.fallen) applyFallen(this.W);
    if (TL.SILK_BURNING != null) for (const lvl in this.mods) for (const i in this.mods[lvl]) if (this.mods[lvl][i][0] === TL.SILK_BURNING) { this.mods[lvl][i][0] = TL.CHARRED; this.W.levels[lvl].tiles[i] = TL.CHARRED; } // a fire that was burning when you saved has burned out
    for (const L of Object.values(this.W.levels)) for (const r of Object.values(L.rooms || {})) for (const [a, b] of (r && r.legacyTk) || []) if (this.team.taken[L.id + ':' + a]) this.team.taken[L.id + ':' + b] = true; // prizes that moved (the wyrm arena)
    // never restore closed shutters
    for (const lvl in this.mods) for (const i in this.mods[lvl]) if (this.mods[lvl][i][0] === TL.SHUTTER) { this.W.levels[lvl].tiles[i] = TL.OPENDOOR; this.mods[lvl][i][0] = TL.OPENDOOR; }
  }
}
