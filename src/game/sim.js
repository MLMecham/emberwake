// ===== game/sim.js : the host-authoritative game simulation =====
// Only the host runs this. Clients send their position and actions; the host sends back snapshots.
'use strict';
// Enemy, item, projectile and elite definitions live in src/content and are looked up through core/registry.js.
const SAVE_VERSION = 5;
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
  if (s.tileNames) for (const lvl in s.mods) for (const i in s.mods[lvl]) { const m = s.mods[lvl][i]; const tn = s.tileNames[m[0]]; if (tn && TL[tn] != null) m[0] = TL[tn]; const pn = s.propNames && s.propNames[m[1]]; if (pn) { const pi = PROPS.indexOf(pn); if (pi >= 0) m[1] = pi; } }
  return s;
}
const REVIVE_TIME = 1.5, REVIVE_R2 = 2.6 * 2.6; // seconds to help a teammate up, and how close you must stand
const SWORD_DMG = [1, 1, 2, 3, 4];             // damage per sword level (0 = no sword, punches still do 1)
// Enemy health multiplier by how many heroes are in the room (1, 2, 3, 4+). Adjusts live as people come and go.
const PARTY_HP = [1, 1, 1.5, 2, 2.5];
const partyMul = (n) => PARTY_HP[Math.min(4, Math.max(1, n))];

function newPlayer(id, name, color, cls) {
  return {
    id, name, color, cls: cls || 'sword', lvl: 'ow', x: 0, y: 0, a: 0, hp: 12, maxHp: 12, gems: 0, bombs: 0, maxBombs: 8, arrows: 0, sword: 0, armor: 0,
    items: {}, potions: 0, alive: true, inv: 0, revive: 0, sel: 'boomerang', atk: 0, lastSeen: 0, warpIdx: 0, kills: 0,
  };
}

class Sim {
  constructor(world, save) {
    this.W = world; this.players = {}; this.ents = []; this.mods = {}; this.modVer = 1; this.events = [];
    this.team = { keys: {}, maps: {}, comps: {}, shards: [], done: [], relics: [], taken: {}, cleared: {}, clearedAt: {} };
    this.groups = {}; this.time = 0; this.levelInit = {}; this.over = 0; this.won = false; this.mode = world.mode;
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
        if (any) { p.items = Object.assign({}, any.items); p.sword = any.sword; p.maxHp = any.maxHp; p.hp = p.maxHp; if (any.armor === 2) p.armor = 2; if (p.items.bombbag) p.bombs = 4; }
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
  playerSaveData(p) { const o = {}; for (const k of ['cls', 'lvl', 'x', 'y', 'a', 'hp', 'maxHp', 'gems', 'bombs', 'maxBombs', 'arrows', 'sword', 'armor', 'items', 'potions', 'sel']) o[k] = p[k]; o.alive = true; if (o.hp <= 0) o.hp = 12; return o; }
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
  // ---- input from clients ----
  onPlayerState(id, s) {
    const p = this.players[id]; if (!p) return;
    if (s.lvl !== p.lvl) return; // ignore stale states after teleport
    p.x = s.x; p.y = s.y; p.a = s.a; p.atk = s.atk || 0; p.lastSeen = this.time; p.sel = s.sel || p.sel;
  }
  onAction(id, a) {
    const p = this.players[id]; if (!p) return;
    const L = this.W.levels[p.lvl];
    if (!p.alive) { if (a.t === 'respawnreq') { } return; }
    switch (a.t) {
      case 'atk': this.playerAttack(p, a); break;
      case 'use': this.useItem(p, a.item, a); break;
      case 'enter': this.tryEnter(p, a.idx); break;
      case 'exit': this.tryExit(p); break;
      case 'unlock': this.tryUnlock(p, a.idx); break;
      case 'revive': this.tryRevive(p); break;
      case 'sel': if (bItems().some(d => d.id === a.item)) p.sel = a.item; break;
      case 'hazard': this.hurtPlayer(p, 1, null); break;
      case 'fall': { // fell into a pit: lose a heart, go back to the last safe spot (sent by the client, sanity-checked)
        if (this.time - (p.fellAt || -9) < 0.8) break; p.fellAt = this.time;
        const L = this.W.levels[p.lvl]; let x = +a.x, y = +a.y; if (!(dist2(x, y, p.x, p.y) < 64) || L.solidAt(x, y)) { x = L.spawn.x; y = L.spawn.y; }
        p.inv = 0; this.hurtPlayer(p, 2, null); this.teleport(p, p.lvl, x, y, p.a); this.sfx('hurt', p.lvl); break;
      }
      case 'debug': // dev names only; turning it off also drops god mode (and with it the Warp Stone)
        if (!isDevName(p.name)) break; p.dbg = !!a.on; p.god = !!(a.on && a.god); if (!p.dbg && p.sel === 'devwarp') p.sel = null; this.hint(p, 'DEBUG ' + (p.dbg ? 'ON' : 'OFF')); break;
      case 'warp': if (p.dbg) { const T = this.W.levels[a.to]; if (T) this.teleport(p, T.id, T.spawn.x, T.spawn.y, T.spawn.a); } break;
    }
  }
  // ---- teleport ----
  teleport(p, lvl, x, y, a) {
    p.lvl = lvl; p.x = x; p.y = y; p.a = a; this.ev({ t: 'tp', pid: p.id, lvl, x, y, a });
    this.initLevel(lvl);
    if (lvl[0] === 'd') { const d = +lvl.slice(1); this.ev({ t: 'title', pid: p.id, text: d <= 9 ? 'LEVEL-' + d : dungeonName(d), sub: d <= 9 ? dungeonName(d) : (d === 12 ? 'THE LAST FLAME' : 'OPTIONAL DUNGEON') }); }
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
      if (has('fang') && has('emberheart')) { this.setTile(L.id, idx, TL.GATE); this.sfx('hearthgate', L.id); this.msg('FROST AND FIRE MEET IN THE LOCK... THE HEARTH OPENS.'); }
      else this.ev({ t: 'dialog', pid: p.id, text: 'A GATE OF THREE FLAMES. TWO OF THE HOLLOWS ARE EMPTY: ONE COLD AS THE FROZEN REACH, ONE HOT AS THE CINDER WASTES.' + (has('fang') ? ' (THE FROST FANG FITS.)' : '') + (has('emberheart') ? ' (THE EMBER HEART FITS.)' : '') });
      return;
    }
    const portal = L.portals[idx]; if (!portal) return;
    if (!TINFO[t].portal && !TINFO[t].stairs) return;
    const T = this.W.levels[portal.to]; if (!T) return;
    const px = idx % L.w, py = Math.floor(idx / L.w);
    if (Math.abs(p.x - (px + 0.5)) > 1.8 || Math.abs(p.y - (py + 0.5)) > 1.8) return;
    this.sfx('stairs', p.lvl);
    this.teleport(p, T.id, T.spawn.x, T.spawn.y, T.spawn.a);
  }
  tryExit(p) {
    const L = this.W.levels[p.lvl]; if (!L.exit) return;
    this.teleport(p, L.exit.lvl, L.exit.x, L.exit.y, L.exit.a);
  }
  tryUnlock(p, idx) {
    const L = this.W.levels[p.lvl]; if (L.tiles[idx] !== TL.LOCKED) return;
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
  // ---- level init (static entities) ----
  initLevel(id) {
    if (this.levelInit[id]) return; this.levelInit[id] = true;
    const L = this.W.levels[id];
    for (const n of L.npcs) this.spawn({ k: 'npc', lvl: id, x: n.x, y: n.y, spr: n.spr, text: n.text, sc: 0.95 });
    L.shop.forEach((s, i) => {
      const tk = id + ':shop' + i; if (this.team.taken[tk] || (s.choose && this.team.taken[s.choose])) return;
      this.spawn({ k: 'shop', lvl: id, x: s.x, y: s.y, item: s.item, price: s.price, gift: s.gift, need: s.needHearts, choose: s.choose, unique: s.unique, tk, spr: itemSprite(s.item), sc: 0.55, z: 0.12 });
    });
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
    delete e.group; delete e.bounds; e.maxHp = e.hp;
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
    }
    // groups activation
    for (const p of plist) if (p.alive) this.activateGroupFor(p);
    this.updateGroups(dt, plist);
    // entities
    for (const e of this.ents) { if (!active.has(e.lvl)) continue; this.updateEnt(e, dt); }
    this.ents = this.ents.filter(e => !e.dead);
    // players
    for (const p of plist) {
      if (p.inv > 0) p.inv -= dt;
      if (!p.alive) continue;
      const L = this.W.levels[p.lvl];
      // hazard tiles
      if (p.chill > 0) p.chill -= dt;
      const t = L.get(Math.floor(p.x), Math.floor(p.y)); const ti = TINFO[t]; const boots = !!p.items.magmaboots;
      if (p.inv <= 0 && ((ti.hurt && !(boots && ti.lava)) || (ti.vent && this.ventPhase() === 2 && !boots))) this.hurtPlayer(p, 1, null);
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
    if (L.kind === 'dungeon') { const r = dungeonRoomAt(L, p.x, p.y); return r ? { key: L.id + ':' + r.id, room: r, L } : null; }
    if (L.kind === 'ow') { const r = owRegionAt(L, p.x, p.y); return { key: 'ow:' + (r.ry * RW + r.rx), room: r, L }; }
    return null;
  }
  activateGroupFor(p) {
    const gk = this.groupKeyFor(p); if (!gk) return;
    const { key, room, L } = gk; p.room = key;
    if (this.groups[key]) { this.groups[key].seen = this.time; return; }
    if (this.team.cleared[key] && L.kind === 'dungeon') { this.groups[key] = { key, ents: [], cleared: true, seen: this.time, room, lvl: L.id }; this.roomStatics(L, room, key, true); return; }
    if (L.kind === 'ow' && this.team.clearedAt[key] && this.time - this.team.clearedAt[key] < 90) { this.groups[key] = { key, ents: [], cleared: true, seen: this.time, room, lvl: L.id }; return; }
    const g = { key, ents: [], cleared: false, seen: this.time, room, lvl: L.id, mul: 1 }; this.groups[key] = g;
    const b = roomBounds(L, room);
    const rnd = mulberry32(hashStr(key) + Math.floor(this.time * 1000));
    const tierMul = L.kind === 'dungeon' ? 1 + (Math.min(10, L.dnum) - 1) * 0.25 : 1 + room.tier * 0.4;
    for (const type of room.enemies) {
      const def = enemyDef(type); if (!def) continue;
      let x, y, tries = 0;
      do {
        x = rnd.range(b.x0, b.x1 - 1) + 0.5; y = rnd.range(b.y0, b.y1 - 1) + 0.5; tries++;
        if (def.boss && L.kind === 'dungeon') { x = room.rx * DSX + 6.5; y = room.ry * DSY + 2.5; break; }
      } while (tries < 40 && (L.solidAt(x, y) || TINFO[L.get(Math.floor(x), Math.floor(y))].hurt || dist2(x, y, p.x, p.y) < 9));
      let hp = Math.ceil(def.hp * (def.boss ? 1 + (L.dnum || 1) * 0.35 : tierMul));
      if (def.fixedHp) hp = def.hp;
      const e = this.spawn({ k: 'en', type, lvl: L.id, x, y, hp, maxHp: hp, f: rnd() * TAU, b, g: key, st: 0, tm: rnd() * 2, stun: 0, hurt: 0, spawnFx: 0.5, dmgMul: L.kind === 'dungeon' ? Math.ceil(Math.min(9, L.dnum) / 3) : 1 + Math.floor(room.tier / 2) });
      if (!def.boss) { const ch = L.kind === 'dungeon' ? 0.05 + Math.min(9, L.dnum) * 0.015 : 0.06 + room.tier * 0.03; if (rnd() < ch) this.makeElite(e, rnd); }
      g.ents.push(e);
    }
    for (const s of room.dormant || []) { // statues that wake up when a hero walks close (gimmicks/statues.js)
      const e = this.spawn({ k: 'en', type: s.type, lvl: L.id, x: s.x, y: s.y, hp: Math.ceil(enemyDef(s.type).hp * tierMul), f: Math.PI / 2, b, g: key, st: 0, tm: 0.5, stun: 0, hurt: 0, spawnFx: 0, dmgMul: L.kind === 'dungeon' ? Math.ceil(Math.min(9, L.dnum) / 3) : 1, dormant: true });
      e.maxHp = e.hp; g.ents.push(e);
    }
    if (L.kind === 'dungeon') this.roomStatics(L, room, key, false);
    if (!g.ents.length) this.groupCleared(g, true);
  }
  roomStatics(L, room, key, cleared) {
    // item on pedestal (visible immediately)
    if (room.item && !this.team.taken[key + ':item']) {
      if (!this.ents.find(e => e.tk === key + ':item')) this.spawn({ k: 'pick', lvl: L.id, x: room.rx * DSX + 6.5, y: room.ry * DSY + 3.5, item: room.item, tk: key + ':item', perm: true, spr: itemSprite(room.item), sc: 0.6, z: 0.35, team: true });
    }
    if (cleared) this.roomRewards(L, room, key);
  }
  roomRewards(L, room, key) {
    const cx = room.rx * DSX + 6.5, cy = room.ry * DSY + 4.5;
    const drop = (item, dx) => { const tk = key + ':' + item; if (this.team.taken[tk] || this.ents.find(e => e.tk === tk)) return; this.spawn({ k: 'pick', lvl: L.id, x: cx + (dx || 0), y: cy, item, tk, perm: true, spr: itemSprite(item), sc: 0.55, z: 0.1, team: true }); };
    if (room.key) drop('key', 0);
    if (room.map) drop('map', -1);
    if (room.compass) drop('compass', 1);
    if (room.boss) { drop('hcont', -1.5); if (L.dnum <= 8) drop('shard', 0); const bd = (Content.dungeons[L.dnum] || {}).bossDrop; if (bd) drop(bd, 0); }
    if (room.reward) drop(room.reward, 0); // hidden room treasure
  }
  updateGroups(dt, plist) {
    for (const k in this.groups) {
      const g = this.groups[k];
      const here = plist.filter(p => p.room === k && p.lvl === g.lvl).length;
      if (here) g.seen = this.time;
      // co-op scaling: rescale every enemy's health by the same share when the headcount changes
      if (here && !g.cleared) { const m = partyMul(here); if (m !== g.mul) { for (const e of g.ents) { e.hp = e.hp * m / g.mul; e.maxHp = e.maxHp * m / g.mul; } g.mul = m; } }
      if (!g.cleared) {
        g.ents = g.ents.filter(e => !e.dead);
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
    if (L.kind === 'dungeon') {
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
  moveEnt(e, dx, dy, def) {
    const L = this.W.levels[e.lvl]; const r = def ? def.r * 0.8 : 0.25;
    const blocked = (x, y) => {
      if (def && def.phase) return x < 1 || y < 1 || x > L.w - 1 || y > L.h - 1;
      if (e.b && (x < e.b.x0 + 0.2 || y < e.b.y0 + 0.2 || x > e.b.x1 - 0.2 || y > e.b.y1 - 0.2)) return true;
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        const tx = Math.floor(x + ox), ty = Math.floor(y + oy); const t = L.get(tx, ty); const ti = TINFO[t];
        if (def && def.fly) { if (ti.solid && !ti.low) return true; } else { if (ti.solid || ti.hurt || ti.pit) return true; }
        const pr = L.props[ty * L.w + tx]; if (pr && PROP_INFO[pr].solid) return true;
      }
      return false;
    };
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
    if (e.hurt > 0) e.hurt -= dt;
    if (e.stun > 0) { e.stun -= dt; return; }
    if (e.kb) { this.moveEnt(e, e.kb[0] * dt, e.kb[1] * dt, def); e.kbT -= dt; if (e.kbT <= 0) e.kb = null; }
    const p = this.nearestPlayer(e, 30);
    e.tm -= dt;
    const ctx = { p, spd: def.spd * (e.rage ? 1.5 : 1) * (e.spdMul || 1), def };
    const elite = e.elite && eliteByIdx(e.elite);
    const skipAi = elite && elite.update && elite.update(this, e, dt, ctx);
    if (e.dead) return;
    if (!skipAi) def.ai(this, e, dt, ctx);
    // contact damage
    if (elite && elite.noContact) return;
    for (const pl of Object.values(this.players)) {
      if (!pl.alive || pl.lvl !== e.lvl || pl.inv > 0) continue;
      const rr = this.enemyRadius(e) + 0.28; if (dist2(pl.x, pl.y, e.x, e.y) < rr * rr) this.hurtPlayer(pl, def.dmg * (def.boss ? 1 : e.dmgMul), e);
    }
  }
  wake(e) { e.dormant = false; e.spawnFx = 0.35; this.sfx('roar', e.lvl, e.x, e.y); this.puff(e, 1); }
  // ---- elites (content/elites.js) ----
  makeElite(e, rnd) {
    const list = Content.elites; let total = 0; for (const d of list) total += d.weight;
    let r = rnd() * total; let pick = list[list.length - 1];
    for (const d of list) { if (r < d.weight) { pick = d; break; } r -= d.weight; }
    e.elite = pick.idx; if (pick.apply) pick.apply(e, this);
  }
  spawnMinion(boss, type) { return this.spawnEnemy(type, boss.lvl, boss.x + (Math.random() - 0.5), boss.y + (Math.random() - 0.5), { group: boss.g, bounds: boss.b }); }
  hurtPlayer(p, dmg, src) {
    if (p.inv > 0 || !p.alive || p.god) return;
    const red = p.armor === 2 ? 0.25 : p.armor === 1 ? 0.5 : 1;
    const amt = Math.max(1, Math.round(dmg * 2 * red)); // quarter-hearts (1 dmg = half heart)
    p.hp -= amt; p.inv = 1.0; this.clearBeam(p);
    for (const o of Object.values(this.players)) if (!o.alive && o.reviver === p.id && o.revive > 0) { o.revive = 0; o.reviver = null; this.ev({ t: 'hint', pid: p.id, text: 'HIT! HELP-UP RESET.' }); }
    let kx = 0, ky = 0; if (src) { const a = Math.atan2(p.y - src.y, p.x - src.x); kx = Math.cos(a) * 7; ky = Math.sin(a) * 7; }
    this.ev({ t: 'hurt', pid: p.id, kx, ky });
    if (p.hp <= 0) {
      if (p.potions > 0) { p.potions--; p.hp = p.maxHp; this.msg(p.name + "'S POTION SAVED THEM!"); this.sfx('heal', p.lvl); return; }
      p.hp = 0; p.alive = false; p.revive = 0; p.reviver = null; this.clearBeam(p); this.ev({ t: 'down', pid: p.id }); this.msg(p.name + ' IS DOWN!' + (Object.keys(this.players).length > 1 ? ' GET CLOSE AND HOLD F TO HELP THEM UP.' : ''));
    }
  }
  clearBeam(p) { for (const e of this.ents) if (e.k === 'proj' && e.pid === p.id && Content.projectiles[e.type].beam) e.dead = true; }
  heal(p, amt) { const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + amt); if (p.hp !== before) this.clearBeam(p); }
  // opt: pid (who hit it), silver, pierceShield, ignoreIframes, stunOnly. Returns true if the hit landed.
  damageEnemy(e, dmg, src, opt) {
    const def = enemyDef(e.type); opt = opt || {}; if (e.dead || e.spawnFx > 0) return false;
    if (e.dormant) { this.sfx('clink', e.lvl, e.x, e.y); this.wake(e); return false; }
    if (e.hurt > 0 && !opt.ignoreIframes) return false;
    if (def.shield && src && !opt.pierceShield) { // blocks hits from the front
      const toSrc = Math.atan2(src.y - e.y, src.x - e.x); if (Math.abs(angDiff(e.f, toSrc)) < 0.9) { this.sfx('clink', e.lvl, e.x, e.y); e.stun = 0.15; return false; }
    }
    if (opt.stunOnly && !def.boss) { e.stun = 3; this.sfx('clink', e.lvl, e.x, e.y); if (!def.boomerangKills) return true; }
    if (def.onDamage && def.onDamage(this, e, dmg, opt) === false) return true;
    e.hp -= dmg; e.hurt = 0.35; this.sfx('hit', e.lvl, e.x, e.y);
    if (src && !def.boss) { const a = Math.atan2(e.y - src.y, e.x - src.x); e.kb = [Math.cos(a) * 9, Math.sin(a) * 9]; e.kbT = 0.12; }
    if (e.hp <= 0) this.killEnemy(e, opt.pid);
    return true;
  }
  killEnemy(e, pid) {
    e.dead = true; const def = enemyDef(e.type);
    this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: def.boss ? 'boom' : 'puff', life: def.boss ? 0.8 : 0.35, sc: def.boss ? 2 : 0.8 });
    this.sfx(def.boss ? 'bossdie' : 'die', e.lvl, e.x, e.y);
    if (pid && this.players[pid]) this.players[pid].kills++;
    if (def.onDeath && def.onDeath(this, e) === 'win') { this.win(); return; }
    if (def.boss) return;
    const elite = e.elite && eliteByIdx(e.elite);
    if (elite && elite.onDeath) {
      const drop = (item, ox, oy) => this.dropItem(item, e.lvl, e.x + (ox || 0), e.y + (oy || 0), { g: e.g });
      drop.gems = (n) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; drop('gem5', Math.cos(a) * 0.5, Math.sin(a) * 0.5); } };
      elite.onDeath(this, e, drop); return;
    }
    const item = rollDrop(def.drops, this);
    if (item) this.dropItem(item, e.lvl, e.x, e.y, { g: e.g });
  }
  win() {
    this.won = true; this.ev({ t: 'win' }); this.msg('THE HOLLOW KING IS UNMADE. THE EMBERS RETURN TO THE LAND.');
  }
  // ---- player actions ----
  playerAttack(p, a) {
    const L = this.W.levels[p.lvl];
    const swordDmg = SWORD_DMG[p.sword] || 1;
    if (a.kind === 'sword' && p.sword === 0) return;
    let range = 1.45, cone = 0.85, dmg = swordDmg;
    if (p.cls === 'monk') { range = 1.15; cone = 0.7; dmg = Math.max(1, swordDmg) * (a.kind === 'punch3' ? 2 : 1); }
    if (a.kind === 'wave') { this.fireProj('wave', p.lvl, p.x + Math.cos(p.a) * 0.4, p.y + Math.sin(p.a) * 0.4, p.a, 'p', p.id, { dmg: 3 + swordDmg * 2, life: 2.5 }); this.sfx('wave', p.lvl, p.x, p.y); return; }
    let hitAny = false;
    for (const e of this.ents) {
      if (e.lvl !== p.lvl || e.dead) continue;
      if (e.k === 'en') {
        const def = enemyDef(e.type); const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
        if (d > range + this.enemyRadius(e)) continue;
        const ang = Math.atan2(e.y - p.y, e.x - p.x); if (d > 0.5 && Math.abs(angDiff(p.a, ang)) > cone) continue;
        if (this.damageEnemy(e, dmg, p, { pid: p.id })) hitAny = true;
        if (p.cls === 'monk' && a.kind === 'punch3' && !def.boss) { e.kb = [Math.cos(p.a) * 14, Math.sin(p.a) * 14]; e.kbT = 0.2; e.stun = 0.5; }
      }
    }
    this.cutAt(L, p.x + Math.cos(p.a) * 0.75, p.y + Math.sin(p.a) * 0.75); this.cutAt(L, p.x + Math.cos(p.a) * 1.25, p.y + Math.sin(p.a) * 1.25);
    if (hitAny && p.cls === 'monk') this.ev({ t: 'pow', lvl: p.lvl, x: p.x + Math.cos(p.a) * 0.9, y: p.y + Math.sin(p.a) * 0.9, big: a.kind === 'punch3' });
    // bush cutting / burn? sword cuts nothing; check bombable hint clink
    // beam at full health
    if (p.hp >= p.maxHp && !this.ents.some(e => e.k === 'proj' && e.pid === p.id && Content.projectiles[e.type].beam)) {
      if (p.cls === 'monk') this.fireProj('ki', p.lvl, p.x + Math.cos(p.a) * 0.3, p.y + Math.sin(p.a) * 0.3, p.a, 'p', p.id, { dmg: swordDmg });
      else this.fireProj(p.sword >= 4 ? 'dawnbeam' : 'beam', p.lvl, p.x + Math.cos(p.a) * 0.3, p.y + Math.sin(p.a) * 0.3, p.a, 'p', p.id, { dmg: swordDmg });
      this.sfx('beam', p.lvl, p.x, p.y);
    }
  }
  useItem(p, item) {
    const d = itemDef(item); if (!d || d.slot !== 'b' || !d.owned(p)) return;
    d.use(this, p);
  }
  updateProj(e, dt) {
    const L = this.W.levels[e.lvl];
    const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt; e.life -= dt;
    const t = L.get(Math.floor(nx), Math.floor(ny)); const ti = TINFO[t]; const pr = L.props[L.idx(Math.floor(nx), Math.floor(ny))];
    const def = Content.projectiles[e.type];
    if (def.fire) { // candle flame: burn bushes
      this.burnAt(L, nx, ny);
    }
    if (e.life <= 0 || (ti.solid && !ti.low) || (pr && PROP_INFO[pr] && PROP_INFO[pr].solid && pr !== PR.PEDESTAL)) {
      if (def.fire || e.fireTrail) { this.spawn({ k: 'fire', lvl: e.lvl, x: e.x, y: e.y, life: 1.2, spr: 'flame', sc: 0.8, z: -0.05, pid: e.pid }); }
      if (def.endFx) this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: def.endFx, life: 0.25, sc: 0.8 });
      e.dead = true; return;
    }
    e.x = nx; e.y = ny;
    if (e.owner === 'e') {
      for (const p of Object.values(this.players)) {
        if (!p.alive || p.lvl !== e.lvl) continue;
        if (dist2(p.x, p.y, e.x, e.y) < 0.16) {
          // sword-class shield blocks weak front projectiles when not attacking
          const toP = Math.atan2(e.y - p.y, e.x - p.x);
          if (p.cls !== 'monk' && def.blockable && Math.abs(angDiff(p.a, toP)) < 0.7) { e.dead = true; this.sfx('clink', e.lvl); this.ev({ t: 'block', pid: p.id }); return; }
          if (def.chill && p.inv <= 0 && !p.god) p.chill = Math.max(p.chill || 0, def.chill);
          this.hurtPlayer(p, e.dmg, e); e.dead = true; return;
        }
      }
    } else {
      for (const en of this.ents) {
        if (en.k !== 'en' || en.lvl !== e.lvl || en.dead || e.hitSet[en.id]) continue;
        const r = this.enemyRadius(en) + 0.2;
        if (dist2(en.x, en.y, e.x, e.y) < r * r) {
          e.hitSet[en.id] = 1;
          const landed = this.damageEnemy(en, e.dmg * (e.frost && enemyDef(en.type).hot ? 2 : 1), { x: e.x - e.vx * 0.1, y: e.y - e.vy * 0.1 }, { pid: e.pid, silver: e.silver, pierceShield: def.pierceShield, ignoreIframes: def.pierce });
          if (e.frost && landed && !en.dead) { en.stun = Math.max(en.stun, enemyDef(en.type).boss ? 0.6 : 2.5); this.spawn({ k: 'fx', lvl: e.lvl, x: en.x, y: en.y, spr: 'icefx', life: 0.4, sc: 1 }); this.sfx('freeze', e.lvl, en.x, en.y); }
          if (def.fire) this.spawn({ k: 'fire', lvl: e.lvl, x: e.x, y: e.y, life: 0.8, spr: 'flame', sc: 0.8, z: -0.05, pid: e.pid });
          if (!def.pierce) { e.dead = true; return; }
        }
      }
    }
  }
  // tiles with cuttable: true (brambles) open when a sword or fist hits them
  cutAt(L, x, y) {
    const i = L.idx(Math.floor(x), Math.floor(y)); const ti = TINFO[L.tiles[i]];
    if (ti && ti.cuttable) { this.setTile(L.id, i, TL[ti.opensTo] != null ? TL[ti.opensTo] : TL.DFLOOR); this.spawn({ k: 'fx', lvl: L.id, x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, spr: 'puff', life: 0.3, sc: 0.9 }); this.sfx('hit', L.id); }
  }
  burnAt(L, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const bx = tx + dx, by = ty + dy; const i = L.idx(bx, by);
      if (bx < 0 || by < 0 || bx >= L.w || by >= L.h) continue;
      const ti = TINFO[L.tiles[i]];
      if (ti && ti.burnable && dist2(bx + 0.5, by + 0.5, x, y) < 1.2) { this.setTile(L.id, i, TL[ti.opensTo] != null ? TL[ti.opensTo] : TL.DFLOOR); this.spawn({ k: 'fx', lvl: L.id, x: bx + 0.5, y: by + 0.5, spr: 'flame', life: 0.6, sc: 0.9 }); }
      if (PR.TORCH != null && L.props[i] === PR.TORCH && dist2(bx + 0.5, by + 0.5, x, y) < 1.2) { this.setTile(L.id, i, null, PR.FLAME); this.sfx('fire', L.id); }
      if (L.props[i] === PR.BUSH && dist2(bx + 0.5, by + 0.5, x, y) < 0.7) {
        const rev = L.secretReveal[i];
        this.setTile(L.id, i, rev ? rev.tile : null, 0);
        this.spawn({ k: 'fx', lvl: L.id, x: bx + 0.5, y: by + 0.5, spr: 'flame', life: 0.6, sc: 0.9 });
        if (rev) this.sfx('secret', L.id);
      }
    }
  }
  fireHits(e) {
    for (const en of this.ents) if (en.k === 'en' && en.lvl === e.lvl && !en.dead && dist2(en.x, en.y, e.x, e.y) < 0.5) this.damageEnemy(en, 1, e, { pid: e.pid });
    this.burnAt(this.W.levels[e.lvl], e.x, e.y);
  }
  pickup(p, e) {
    const d = itemDef(e.item); if (!d) { e.dead = true; return; }
    if (d.canTake && !d.canTake(p)) return;
    if (e.k === 'shop') {
      const nag = (t, text) => { if (!e.warned || this.time - e.warned > 3) { e.warned = this.time; this.ev({ t, pid: p.id, text }); } };
      if (e.need && p.maxHp / 4 < e.need) return nag('dialog', 'MASTER USING IT AND YOU CAN HAVE THIS... COME BACK WITH ' + e.need + ' HEARTS.');
      if (!e.gift && p.gems < e.price) return nag('hint', 'YOU NEED ' + e.price + ' GEMS.');
      if (e.unique && p.cls === 'monk') return nag('dialog', 'YOUR HANDS ALREADY KNOW THE WAY.');
      if (!e.gift) p.gems -= e.price;
      this.giveItem(p, e.item, true);
      if (e.gift) { this.team.taken[e.tk] = true; if (e.choose) { this.team.taken[e.choose] = true; for (const o of this.ents) if (o.choose === e.choose) o.dead = true; } e.dead = true; }
      return;
    }
    if (e.tk) this.team.taken[e.tk] = true;
    e.dead = true;
    this.giveItem(p, e.item, false);
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
    this.update(dt);
    if (this.pendingExit && this.time > this.pendingExit.at) {
      const L = this.W.levels[this.pendingExit.lvl];
      for (const p of Object.values(this.players)) if (p.lvl === L.id) { p.alive = true; p.hp = p.maxHp; this.teleport(p, 'ow', L.exit.x, L.exit.y, L.exit.a); }
      this.pendingExit = null;
    }
  }
  // ---- snapshot for a player ----
  entView(e) {
    let spr = e.spr, sc = e.sc || 0.8, z = e.z || 0, fl = 0;
    if (e.k === 'en') {
      const def = enemyDef(e.type); spr = e.dormant ? 'statue' : e.type; sc = e.dormant ? 1.1 : def.sc * (e.scMul || 1); z = e.dormant ? 0 : def.z || 0;
      if (def.fly) z += Math.sin(e.t * 6) * 0.06;
      if (e.hurt > 0) fl |= 1; if (e.stun > 0) fl |= 2; if (def.phase) fl |= 4; if (e.spawnFx > 0) { spr = 'puff'; }
      if (def.view) z += def.view(e);
    }
    if (e.k === 'pick' && !e.perm) z += Math.abs(Math.sin(e.t * 3)) * 0.04;
    if (e.k === 'shop') z += Math.sin(this.time * 2) * 0.03;
    const v = [e.id, spr, Math.round(e.x * 100) / 100, Math.round(e.y * 100) / 100, Math.round(sc * 100) / 100, Math.round(z * 100) / 100, fl];
    if (e.k === 'shop' && !e.gift) v.push(e.price); else if (e.k === 'shop' && e.need) v.push(-e.need); else v.push(0);
    if (e.k === 'en' && enemyDef(e.type).boss) v.push(Math.max(0, e.hp / e.maxHp)); else v.push(-1);
    if (e.k === 'npc') v.push(e.text); else v.push(0);
    v.push(e.k === 'en' && e.elite ? e.elite : 0);
    return v;
  }
  snapshotFor(pid) {
    const p = this.players[pid]; if (!p) return null;
    const en = []; for (const e of this.ents) if (e.lvl === p.lvl) en.push(this.entView(e));
    const pl = []; for (const o of Object.values(this.players)) pl.push([o.id, o.lvl, Math.round(o.x * 100) / 100, Math.round(o.y * 100) / 100, Math.round(o.a * 100) / 100, o.color, o.armor, o.cls, o.alive ? 1 : 0, o.atk, o.name, Math.round(o.revive / REVIVE_TIME * 100) / 100, o.hp, o.maxHp, o.reviver || 0]);
    const me = {}; for (const k of ['lvl', 'hp', 'maxHp', 'gems', 'bombs', 'maxBombs', 'arrows', 'sword', 'armor', 'items', 'potions', 'alive', 'cls', 'sel', 'color', 'name', 'dbg', 'god']) me[k] = p[k]; me.chill = p.chill > 0 ? 1 : 0;
    return { t: 's', paused: !!this.paused, pausedBy: this.pausedBy, me, pl, en, team: { keys: this.team.keys, maps: this.team.maps, comps: this.team.comps, shards: this.team.shards, done: this.team.done, relics: this.team.relics }, vp: this.ventPhase(), mv: this.modVer, over: this.over > 0 };
  }
  // ---- save ----
  makeSave() {
    const players = Object.assign({}, this.savedPlayers || {});
    for (const p of Object.values(this.players)) players[p.color] = this.playerSaveData(p);
    const cl = {}; for (const k in this.team.cleared) if (!k.startsWith('ow:')) cl[k] = true;
    const tileNames = []; for (const k in TL) tileNames[TL[k]] = k;
    const propNames = PROPS.slice();
    return { v: SAVE_VERSION, tileNames, propNames, seed: this.W.seed, mode: this.W.mode, team: { keys: this.team.keys, maps: this.team.maps, comps: this.team.comps, shards: this.team.shards, done: this.team.done, relics: this.team.relics, taken: this.team.taken, cleared: cl }, mods: this.mods, players, time: Date.now() };
  }
  loadSave(s) {
    s = migrateSave(s);
    Object.assign(this.team, s.team); this.team.relics = this.team.relics || []; this.team.clearedAt = {}; this.mods = s.mods || {}; this.savedPlayers = s.players || {};
    for (const lvl in this.mods) { const L = this.W.levels[lvl]; if (!L) continue; for (const i in this.mods[lvl]) { const [t, pr] = this.mods[lvl][i]; L.tiles[i] = t; L.props[i] = pr; } }
    // never restore closed shutters
    for (const lvl in this.mods) for (const i in this.mods[lvl]) if (this.mods[lvl][i][0] === TL.SHUTTER) { this.W.levels[lvl].tiles[i] = TL.OPENDOOR; this.mods[lvl][i][0] = TL.OPENDOOR; }
  }
}
