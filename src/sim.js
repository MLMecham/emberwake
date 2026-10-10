// ===== sim.js : host-authoritative simulation =====
'use strict';
const ENEMY = {
  slime: { hp: 1, spd: 1.4, dmg: 1, r: 0.32, spr: 'slime', sc: 0.75, ai: 'hop' },
  spitter: { hp: 1, spd: 1.3, dmg: 1, r: 0.32, spr: 'spitter', sc: 0.8, ai: 'shooter', proj: 'rock' },
  thornling: { hp: 2, spd: 1.6, dmg: 1, r: 0.32, spr: 'thornling', sc: 0.85, ai: 'shooter', proj: 'spear' },
  bat: { hp: 1, spd: 2.6, dmg: 1, r: 0.28, spr: 'bat', sc: 0.6, ai: 'bat', fly: true, z: 0.35 },
  skeleton: { hp: 2, spd: 1.9, dmg: 1, r: 0.32, spr: 'skeleton', sc: 0.85, ai: 'chase' },
  knight: { hp: 4, spd: 1.5, dmg: 2, r: 0.34, spr: 'knight', sc: 0.9, ai: 'chase', shield: true },
  ghost: { hp: 3, spd: 1.1, dmg: 2, r: 0.32, spr: 'ghost', sc: 0.85, ai: 'ghost', fly: true, phase: true },
  wizard: { hp: 4, spd: 0, dmg: 2, r: 0.32, spr: 'wizard', sc: 0.9, ai: 'wizard', proj: 'magic' },
  wyrm: { hp: 10, spd: 1.2, dmg: 2, r: 0.7, spr: 'wyrm', sc: 1.8, ai: 'wyrm', boss: true },
  orb: { hp: 8, spd: 2.2, dmg: 2, r: 0.6, spr: 'orb', sc: 1.5, ai: 'orb', boss: true, fly: true, z: 0.3 },
  spider: { hp: 8, spd: 3.2, dmg: 2, r: 0.6, spr: 'spider', sc: 1.5, ai: 'spider', boss: true },
  king: { hp: 30, spd: 0, dmg: 3, r: 0.6, spr: 'king', sc: 1.6, ai: 'king', boss: true },
};
const PROJ = {
  rock: { spr: 'rock', spd: 5, dmg: 1, sc: 0.6, z: 0.15 }, spear: { spr: 'arrow', spd: 6, dmg: 1, sc: 0.7, z: 0.1 }, magic: { spr: 'magic', spd: 4.5, dmg: 2, sc: 0.6, z: 0.15 },
  fire: { spr: 'fireball', spd: 4.5, dmg: 2, sc: 0.7, z: 0.15 },
  arrow: { spr: 'arrow', spd: 11, dmg: 2, sc: 0.7, z: 0.1, player: true }, beam: { spr: 'beam', spd: 9, dmg: 1, sc: 0.8, z: 0.15, player: true },
  rodbolt: { spr: 'magic', spd: 8, dmg: 3, sc: 0.7, z: 0.15, player: true }, candle: { spr: 'flame', spd: 4, dmg: 1, sc: 0.8, z: -0.05, player: true, range: 2.2, fire: true },
  ki: { spr: 'ki', spd: 10, dmg: 1, sc: 0.6, z: 0.15, player: true }, wave: { spr: 'ki', spd: 9, dmg: 4, sc: 1.4, z: 0.1, player: true, pierce: true },
  dart: { spr: 'beam', spd: 12, dmg: 2, sc: 0.5, z: 0.15, player: true }, palm: { spr: 'flame', spd: 6, dmg: 2, sc: 1.1, z: -0.05, player: true, range: 3.5, fire: true, pierce: true },
  thunder: { spr: 'beam', spd: 14, dmg: 3, sc: 0.9, z: 0.15, player: true, pierce: true },
};
const ITEM_NAMES = {
  sword1: 'WOODEN SWORD', sword2: 'SILVER SWORD', sword3: 'MYTHRIL SWORD', boomerang: 'BOOMERANG', bombbag: 'BOMB BAG', bombs: 'BOMBS', bow: 'BOW', arrows: 'ARROWS',
  candle: 'CANDLE', rod: 'FIRE ROD', whistle: 'WIND WHISTLE', raft: 'RAFT', plate: 'PLATE TUNIC', chain: 'CHAIN TUNIC', silver: 'SILVER ARROWS', potion: 'RED POTION', potion2: 'BLUE POTION',
  hcont: 'HEART CONTAINER', heart: 'HEART', map: 'DUNGEON MAP', compass: 'COMPASS', key: 'SMALL KEY', shard: 'EMBER SHARD', fists: 'THE OPEN HAND', fairy: 'FAIRY',
};
const MONK_NAMES = { boomerang: 'ORBIT DISC', bombs: 'NOVA ORB', bow: 'SPIRIT DARTS', candle: 'FLAME PALM', rod: 'THUNDER PALM', whistle: 'WIND STEP', raft: 'CLOUD WALK', potion: 'SPIRIT TEA' };
const ITEM_SPR = {
  sword1: 'sword', sword2: 'sword', sword3: 'sword', boomerang: 'boomerang', bombbag: 'bomb', bombs: 'bomb', bow: 'bow', arrows: 'arrow', candle: 'candle', rod: 'rod', whistle: 'key',
  raft: 'boulder', plate: 'armor', chain: 'armor', silver: 'arrow', potion: 'potion', potion2: 'potion', hcont: 'hcont', heart: 'heart', map: 'map', compass: 'compass', key: 'key', shard: 'shard',
  fists: 'ki', fairy: 'fairy', gem1: 'gem_g', gem5: 'gem_b', gems30: 'gem_r', gems50: 'gem_r', gems100: 'gem_r', bomb: 'bomb', arrow: 'arrow',
};
const B_ITEMS = ['boomerang', 'bombs', 'bow', 'candle', 'rod', 'whistle', 'potion'];

function newPlayer(id, name, color, cls) {
  return {
    id, name, color, cls: cls || 'sword', lvl: 'ow', x: 0, y: 0, a: 0, hp: 12, maxHp: 12, gems: 0, bombs: 0, maxBombs: 8, arrows: 0, sword: 0, armor: 0,
    items: {}, potions: 0, alive: true, inv: 0, revive: 0, sel: 'boomerang', atk: 0, lastSeen: 0, warpIdx: 0, kills: 0,
  };
}

class Sim {
  constructor(world, save) {
    this.W = world; this.players = {}; this.ents = []; this.mods = {}; this.modVer = 1; this.events = [];
    this.team = { keys: {}, maps: {}, comps: {}, shards: [], done: [], taken: {}, cleared: {}, clearedAt: {} };
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
  setTile(lvl, idx, tile, prop) {
    const L = this.W.levels[lvl]; if (tile != null) L.tiles[idx] = tile; if (prop != null) L.props[idx] = prop;
    (this.mods[lvl] = this.mods[lvl] || {})[idx] = [L.tiles[idx], L.props[idx]]; this.modVer++;
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
      case 'sel': if (B_ITEMS.includes(a.item)) p.sel = a.item; break;
      case 'hazard': this.hurtPlayer(p, 1, null); break;
    }
  }
  // ---- teleport ----
  teleport(p, lvl, x, y, a) {
    p.lvl = lvl; p.x = x; p.y = y; p.a = a; this.ev({ t: 'tp', pid: p.id, lvl, x, y, a });
    this.initLevel(lvl);
    if (lvl[0] === 'd') { const d = +lvl.slice(1); this.ev({ t: 'title', pid: p.id, text: 'LEVEL-' + d, sub: DUNGEON_NAMES[d] }); }
    if (lvl === 'ow') this.autosave = true;
  }
  tryEnter(p, idx) {
    const L = this.W.levels[p.lvl]; const t = L.tiles[idx];
    if (TINFO[t].shardGate) {
      if (this.team.shards.length >= 8) { this.setTile(L.id, idx, TL.GATE); this.sfx('secret', L.id); this.msg('THE EIGHT SHARDS BLAZE... THE HOLLOW CROWN OPENS.'); }
      else this.ev({ t: 'dialog', pid: p.id, text: 'A SEALED GATE. EIGHT EMBER-SHAPED HOLLOWS LINE THE ARCH. (' + this.team.shards.length + '/8 SHARDS)' });
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
      if (dist2(o.x, o.y, p.x, p.y) < 2.2) { o.revive += 0.12; if (o.revive >= 2) { o.alive = true; o.hp = Math.min(o.maxHp, 8); o.revive = 0; o.inv = 2; this.msg(p.name + ' REVIVED ' + o.name + '!'); this.sfx('fanfare', p.lvl); } }
    }
  }
  // ---- level init (static entities) ----
  initLevel(id) {
    if (this.levelInit[id]) return; this.levelInit[id] = true;
    const L = this.W.levels[id];
    for (const n of L.npcs) this.spawn({ k: 'npc', lvl: id, x: n.x, y: n.y, spr: n.spr, text: n.text, sc: 0.95 });
    L.shop.forEach((s, i) => {
      const tk = id + ':shop' + i; if (this.team.taken[tk] || (s.choose && this.team.taken[s.choose])) return;
      this.spawn({ k: 'shop', lvl: id, x: s.x, y: s.y, item: s.item, price: s.price, gift: s.gift, need: s.needHearts, choose: s.choose, unique: s.unique, tk, spr: ITEM_SPR[s.item] || 'heart', sc: 0.55, z: 0.12 });
    });
  }
  spawn(e) { e.id = uid(); e.t = e.t || 0; this.ents.push(e); return e; }
  // ---- main update ----
  update(dt) {
    this.time += dt;
    const plist = Object.values(this.players);
    const active = new Set(plist.map(p => p.lvl));
    for (const lvl of active) this.initLevel(lvl);
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
      const t = L.get(Math.floor(p.x), Math.floor(p.y)); if (TINFO[t].hurt && p.inv <= 0) this.hurtPlayer(p, 1, null);
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
    const g = { key, ents: [], cleared: false, seen: this.time, room, lvl: L.id }; this.groups[key] = g;
    const b = roomBounds(L, room);
    const rnd = mulberry32(hashStr(key) + Math.floor(this.time * 1000));
    const tierMul = L.kind === 'dungeon' ? 1 + (L.dnum - 1) * 0.25 : 1 + room.tier * 0.4;
    for (const type of room.enemies) {
      const def = ENEMY[type];
      let x, y, tries = 0;
      do {
        x = rnd.range(b.x0, b.x1 - 1) + 0.5; y = rnd.range(b.y0, b.y1 - 1) + 0.5; tries++;
        if (def.boss && L.kind === 'dungeon') { x = room.rx * DSX + 6.5; y = room.ry * DSY + 2.5; break; }
      } while (tries < 40 && (L.solidAt(x, y) || TINFO[L.get(Math.floor(x), Math.floor(y))].hurt || dist2(x, y, p.x, p.y) < 9));
      let hp = Math.ceil(def.hp * (def.boss ? 1 + (L.dnum || 1) * 0.35 : tierMul));
      if (type === 'king') hp = def.hp;
      const e = this.spawn({ k: 'en', type, lvl: L.id, x, y, hp, maxHp: hp, f: rnd() * TAU, b, g: key, st: 0, tm: rnd() * 2, stun: 0, hurt: 0, spawnFx: 0.5, dmgMul: L.kind === 'dungeon' ? Math.ceil(L.dnum / 3) : 1 + Math.floor(room.tier / 2) });
      g.ents.push(e);
    }
    if (L.kind === 'dungeon') this.roomStatics(L, room, key, false);
    if (!g.ents.length) this.groupCleared(g, true);
  }
  roomStatics(L, room, key, cleared) {
    // item on pedestal (visible immediately)
    if (room.item && !this.team.taken[key + ':item']) {
      if (!this.ents.find(e => e.tk === key + ':item')) this.spawn({ k: 'pick', lvl: L.id, x: room.rx * DSX + 6.5, y: room.ry * DSY + 3.5, item: room.item, tk: key + ':item', perm: true, spr: ITEM_SPR[room.item], sc: 0.6, z: 0.35, team: true });
    }
    if (cleared) this.roomRewards(L, room, key);
  }
  roomRewards(L, room, key) {
    const cx = room.rx * DSX + 6.5, cy = room.ry * DSY + 4.5;
    const drop = (item, dx) => { const tk = key + ':' + item; if (this.team.taken[tk] || this.ents.find(e => e.tk === tk)) return; this.spawn({ k: 'pick', lvl: L.id, x: cx + (dx || 0), y: cy, item, tk, perm: true, spr: ITEM_SPR[item], sc: 0.55, z: 0.1, team: true }); };
    if (room.key) drop('key', 0);
    if (room.map) drop('map', -1);
    if (room.compass) drop('compass', 1);
    if (room.boss) { drop('hcont', -1.5); if (L.dnum < 9) drop('shard', 0); }
  }
  updateGroups(dt, plist) {
    for (const k in this.groups) {
      const g = this.groups[k];
      const inside = plist.some(p => p.room === k && p.lvl === g.lvl);
      if (inside) g.seen = this.time;
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
      g.shut = []; for (const [x, y] of doors) { const i = L.idx(x, y); if (L.tiles[i] === TL.OPENDOOR) { g.shut.push(i); this.setTile(L.id, i, TL.SHUTTER); } }
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
        if (def && def.fly) { if (ti.solid && !ti.low) return true; } else { if (ti.solid || ti.hurt) return true; }
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
    const d = PROJ[type];
    return this.spawn(Object.assign({ k: 'proj', type, lvl, x, y, vx: Math.cos(ang) * d.spd, vy: Math.sin(ang) * d.spd, owner, pid, life: d.range ? d.range / d.spd : 3, dmg: d.dmg, spr: d.spr, sc: d.sc, z: d.z, hitSet: {} }, extra || {}));
  }
  updateEnt(e, dt) {
    e.t += dt;
    switch (e.k) {
      case 'en': this.updateEnemy(e, dt); break;
      case 'proj': this.updateProj(e, dt); break;
      case 'boomer': this.updateBoomer(e, dt); break;
      case 'bomb': e.fuse -= dt; if (e.fuse <= 0) this.explode(e); break;
      case 'fx': if (e.t > e.life) e.dead = true; break;
      case 'pick': if (!e.perm && e.t > 12) e.dead = true; if (e.fairy) { e.x += Math.cos(e.t * 2.3) * dt * 0.8; e.y += Math.sin(e.t * 1.7) * dt * 0.8; } break;
      case 'fire': if (e.t > e.life) e.dead = true; else this.fireHits(e); break;
    }
  }
  updateEnemy(e, dt) {
    const def = ENEMY[e.type];
    if (e.spawnFx > 0) { e.spawnFx -= dt; return; }
    if (e.hurt > 0) e.hurt -= dt;
    if (e.stun > 0) { e.stun -= dt; return; }
    if (e.kb) { this.moveEnt(e, e.kb[0] * dt, e.kb[1] * dt, def); e.kbT -= dt; if (e.kbT <= 0) e.kb = null; }
    const p = this.nearestPlayer(e, 30);
    e.tm -= dt;
    const spd = def.spd * (e.rage ? 1.5 : 1);
    switch (def.ai) {
      case 'hop': {
        if (e.tm <= 0) { e.tm = 0.8 + Math.random() * 0.6; e.f = p && Math.random() < 0.7 ? Math.atan2(p.y - e.y, p.x - e.x) + (Math.random() - 0.5) : Math.random() * TAU; e.hop = 0.4; }
        if (e.hop > 0) { e.hop -= dt; this.moveEnt(e, Math.cos(e.f) * spd * 2 * dt, Math.sin(e.f) * spd * 2 * dt, def); }
        break;
      }
      case 'shooter': {
        if (e.st === 0) { // walk
          if (this.moveEnt(e, Math.cos(e.f) * spd * dt, Math.sin(e.f) * spd * dt, def) || e.tm <= 0) {
            e.tm = 1 + Math.random() * 1.5; e.f = (Math.floor(Math.random() * 4)) * Math.PI / 2;
            if (p && dist2(p.x, p.y, e.x, e.y) < 64 && Math.random() < 0.55) { e.st = 1; e.tm = 0.5; e.f = Math.atan2(p.y - e.y, p.x - e.x); }
          }
        } else if (e.tm <= 0) { this.fireProj(def.proj, e.lvl, e.x, e.y, e.f, 'e', null, { dmg: PROJ[def.proj].dmg * e.dmgMul }); e.st = 0; e.tm = 0.6; this.sfx('shoot', e.lvl, e.x, e.y); }
        break;
      }
      case 'bat': {
        if (e.tm <= 0) { e.tm = 0.4 + Math.random() * 0.8; e.f = p && Math.random() < 0.5 ? Math.atan2(p.y - e.y, p.x - e.x) : e.f + (Math.random() - 0.5) * 2.5; }
        if (this.moveEnt(e, Math.cos(e.f) * spd * dt, Math.sin(e.f) * spd * dt, def)) e.f += Math.PI * (0.5 + Math.random());
        break;
      }
      case 'chase': case 'ghost': {
        if (p && dist2(p.x, p.y, e.x, e.y) < 100) { const ta = Math.atan2(p.y - e.y, p.x - e.x); e.f += clamp(angDiff(e.f, ta), -dt * 4, dt * 4); }
        else if (e.tm <= 0) { e.tm = 1.5; e.f = Math.random() * TAU; }
        if (this.moveEnt(e, Math.cos(e.f) * spd * dt, Math.sin(e.f) * spd * dt, def) && def.ai === 'chase') e.f += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        break;
      }
      case 'wizard': {
        if (e.tm <= 0) {
          if (e.st === 0 && p) { // teleport near player
            const L = this.W.levels[e.lvl]; for (let i = 0; i < 20; i++) { const a = Math.random() * TAU, r = 2.5 + Math.random() * 2; const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (!L.solidAt(x, y) && (!e.b || (x > e.b.x0 && x < e.b.x1 && y > e.b.y0 && y < e.b.y1))) { this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'puff', life: 0.3, sc: 0.8 }); e.x = x; e.y = y; break; } }
            e.st = 1; e.tm = 0.7; e.hidden = 0;
          } else if (e.st === 1 && p) { this.fireProj('magic', e.lvl, e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), 'e', null, { dmg: 2 * e.dmgMul }); this.sfx('magic', e.lvl, e.x, e.y); e.st = 0; e.tm = 1.6 + Math.random(); }
          else e.tm = 1;
        }
        break;
      }
      case 'wyrm': {
        if (e.tm <= 0) {
          e.tm = e.hp < e.maxHp / 2 ? 1.3 : 2;
          if (p) { const a = Math.atan2(p.y - e.y, p.x - e.x); for (const s of [-0.35, 0, 0.35]) this.fireProj('fire', e.lvl, e.x, e.y, a + s, 'e', null, { dmg: 2 }); this.sfx('roar', e.lvl, e.x, e.y); }
        }
        e.f = e.f || 0; if (this.moveEnt(e, Math.cos(e.st ? 0 : Math.PI) * spd * dt, Math.sin(e.t * 1.3) * spd * 0.6 * dt, def)) e.st = e.st ? 0 : 1;
        break;
      }
      case 'orb': {
        if (e.st === 0) { e.f += dt * 1.2; this.moveEnt(e, Math.cos(e.f) * spd * dt, Math.sin(e.f * 0.7) * spd * dt, def); if (e.tm <= 0 && p) { e.st = 1; e.tm = 0.9; e.cf = Math.atan2(p.y - e.y, p.x - e.x); this.sfx('roar', e.lvl, e.x, e.y); } }
        else { if (this.moveEnt(e, Math.cos(e.cf) * spd * 3 * dt, Math.sin(e.cf) * spd * 3 * dt, def) || e.tm <= 0) { e.st = 0; e.tm = 2.5; } }
        if (!e.split && e.hp < e.maxHp / 2) { e.split = true; for (let i = 0; i < 3; i++) this.spawnMinion(e, 'bat'); }
        break;
      }
      case 'spider': {
        if (e.st === 0 && e.tm <= 0 && p) { e.st = 1; e.tm = 0.55; e.cf = Math.atan2(p.y - e.y, p.x - e.x); }
        else if (e.st === 1) { this.moveEnt(e, Math.cos(e.cf) * spd * dt, Math.sin(e.cf) * spd * dt, def); if (e.tm <= 0) { e.st = 0; e.tm = 0.5 + Math.random() * 0.6; } }
        break;
      }
      case 'king': {
        if (e.tm <= 0 && p) {
          e.st = (e.st + 1) % 3;
          if (e.st === 0) { const L = this.W.levels[e.lvl]; for (let i = 0; i < 30; i++) { const x = e.b.x0 + 1 + Math.random() * (e.b.x1 - e.b.x0 - 2), y = e.b.y0 + 1 + Math.random() * (e.b.y1 - e.b.y0 - 2); if (!L.solidAt(x, y) && dist2(x, y, p.x, p.y) > 6) { this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'puff', life: 0.4, sc: 1.2 }); e.x = x; e.y = y; break; } } e.tm = 0.8; }
          else if (e.st === 1) { for (let i = 0; i < 10; i++) this.fireProj('fire', e.lvl, e.x, e.y, i * TAU / 10 + e.t, 'e', null, { dmg: 3 }); this.sfx('roar', e.lvl); e.tm = 1.2; }
          else { const a = Math.atan2(p.y - e.y, p.x - e.x); for (const s of [-0.2, 0, 0.2]) this.fireProj('magic', e.lvl, e.x, e.y, a + s, 'e', null, { dmg: 3 }); e.tm = 1.2; if (Math.random() < 0.4) this.spawnMinion(e, Math.random() < 0.5 ? 'bat' : 'ghost'); }
        }
        break;
      }
    }
    // contact damage
    for (const pl of Object.values(this.players)) {
      if (!pl.alive || pl.lvl !== e.lvl || pl.inv > 0) continue;
      const rr = def.r + 0.28; if (dist2(pl.x, pl.y, e.x, e.y) < rr * rr) this.hurtPlayer(pl, def.dmg * (def.boss ? 1 : e.dmgMul), e);
    }
  }
  spawnMinion(boss, type) {
    const g = this.groups[boss.g]; const def = ENEMY[type];
    const m = this.spawn({ k: 'en', type, lvl: boss.lvl, x: boss.x + (Math.random() - 0.5), y: boss.y + (Math.random() - 0.5), hp: def.hp, maxHp: def.hp, f: Math.random() * TAU, b: boss.b, g: boss.g, st: 0, tm: 0.5, stun: 0, hurt: 0, spawnFx: 0.3, dmgMul: 1 });
    if (g) g.ents.push(m);
  }
  hurtPlayer(p, dmg, src) {
    if (p.inv > 0 || !p.alive) return;
    const red = p.armor === 2 ? 0.25 : p.armor === 1 ? 0.5 : 1;
    const amt = Math.max(1, Math.round(dmg * 2 * red)); // quarter-hearts (1 dmg = half heart)
    p.hp -= amt; p.inv = 1.0;
    let kx = 0, ky = 0; if (src) { const a = Math.atan2(p.y - src.y, p.x - src.x); kx = Math.cos(a) * 7; ky = Math.sin(a) * 7; }
    this.ev({ t: 'hurt', pid: p.id, kx, ky });
    if (p.hp <= 0) {
      if (p.potions > 0) { p.potions--; p.hp = p.maxHp; this.msg(p.name + "'S POTION SAVED THEM!"); this.sfx('heal', p.lvl); return; }
      p.hp = 0; p.alive = false; p.revive = 0; this.ev({ t: 'down', pid: p.id }); this.msg(p.name + ' HAS FALLEN!' + (Object.keys(this.players).length > 1 ? ' STAND CLOSE AND HOLD [INTERACT] TO REVIVE.' : ''));
    }
  }
  damageEnemy(e, dmg, src, opt) {
    const def = ENEMY[e.type]; if (e.dead || e.spawnFx > 0) return false;
    if (e.hurt > 0 && !(opt && opt.ignoreIframes)) return false;
    if (def.shield && src && !(opt && opt.pierceShield)) {
      // blocked if attack comes from front
      const toSrc = Math.atan2(src.y - e.y, src.x - e.x); if (Math.abs(angDiff(e.f, toSrc)) < 0.9) { this.sfx('clink', e.lvl, e.x, e.y); e.stun = 0.15; return false; }
    }
    if (opt && opt.stunOnly && !def.boss) { e.stun = 3; this.sfx('clink', e.lvl, e.x, e.y); if (def.hp <= 1 && e.type === 'bat') { } else return true; }
    if (e.type === 'king' && e.hp - dmg <= 0 && !(opt && opt.silver)) { e.hp = 1; e.hurt = 0.4; this.sfx('clink', e.lvl); if (!e.taunt || this.time - e.taunt > 4) { e.taunt = this.time; this.msg('"FOOLS. ONLY SILVER CAN UNMAKE A KING."'); } return true; }
    e.hp -= dmg; e.hurt = 0.35; this.sfx('hit', e.lvl, e.x, e.y);
    if (src && !def.boss) { const a = Math.atan2(e.y - src.y, e.x - src.x); e.kb = [Math.cos(a) * 9, Math.sin(a) * 9]; e.kbT = 0.12; }
    if (e.hp <= 0) this.killEnemy(e, opt && opt.pid);
    return true;
  }
  killEnemy(e, pid) {
    e.dead = true; const def = ENEMY[e.type];
    this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: def.boss ? 'boom' : 'puff', life: def.boss ? 0.8 : 0.35, sc: def.boss ? 2 : 0.8 });
    this.sfx(def.boss ? 'bossdie' : 'die', e.lvl, e.x, e.y);
    if (pid && this.players[pid]) this.players[pid].kills++;
    if (e.type === 'king') { this.win(); return; }
    if (def.boss) return;
    const r = Math.random(); let item = null;
    if (r < 0.28) item = 'gem1'; else if (r < 0.36) item = 'gem5'; else if (r < 0.48) item = 'heart'; else if (r < 0.53) item = 'bomb'; else if (r < 0.555) item = 'fairy'; else if (r < 0.6 && Object.values(this.players).some(p => p.items.bow)) item = 'arrow';
    if (item) this.spawn({ k: 'pick', lvl: e.lvl, x: e.x, y: e.y, item, spr: ITEM_SPR[item], sc: item === 'fairy' ? 0.6 : 0.5, z: item === 'fairy' ? 0.3 : 0, g: e.g, fairy: item === 'fairy' });
  }
  win() {
    this.won = true; this.ev({ t: 'win' }); this.msg('THE HOLLOW KING IS UNMADE. THE EMBERS RETURN TO THE LAND.');
  }
  // ---- player actions ----
  playerAttack(p, a) {
    const L = this.W.levels[p.lvl];
    const swordDmg = [1, 1, 2, 3][p.sword] || 1;
    if (a.kind === 'sword' && p.sword === 0) return;
    let range = 1.45, cone = 0.85, dmg = swordDmg;
    if (p.cls === 'monk') { range = 1.15; cone = 0.7; dmg = Math.max(1, swordDmg) * (a.kind === 'punch3' ? 2 : 1); }
    if (a.kind === 'wave') { this.fireProj('wave', p.lvl, p.x + Math.cos(p.a) * 0.4, p.y + Math.sin(p.a) * 0.4, p.a, 'p', p.id, { dmg: 3 + swordDmg * 2, life: 2.5 }); this.sfx('wave', p.lvl, p.x, p.y); return; }
    let hitAny = false;
    for (const e of this.ents) {
      if (e.lvl !== p.lvl || e.dead) continue;
      if (e.k === 'en') {
        const def = ENEMY[e.type]; const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
        if (d > range + def.r) continue;
        const ang = Math.atan2(e.y - p.y, e.x - p.x); if (d > 0.5 && Math.abs(angDiff(p.a, ang)) > cone) continue;
        if (this.damageEnemy(e, dmg, p, { pid: p.id })) hitAny = true;
        if (p.cls === 'monk' && a.kind === 'punch3' && !def.boss) { e.kb = [Math.cos(p.a) * 14, Math.sin(p.a) * 14]; e.kbT = 0.2; e.stun = 0.5; }
      }
    }
    if (hitAny && p.cls === 'monk') this.ev({ t: 'pow', lvl: p.lvl, x: p.x + Math.cos(p.a) * 0.9, y: p.y + Math.sin(p.a) * 0.9, big: a.kind === 'punch3' });
    // bush cutting / burn? sword cuts nothing; check bombable hint clink
    // beam at full health
    if (p.hp >= p.maxHp && !this.ents.some(e => e.k === 'proj' && e.pid === p.id && (e.type === 'beam' || e.type === 'ki'))) {
      if (p.cls === 'monk') this.fireProj('ki', p.lvl, p.x + Math.cos(p.a) * 0.3, p.y + Math.sin(p.a) * 0.3, p.a, 'p', p.id, { dmg: swordDmg });
      else this.fireProj('beam', p.lvl, p.x + Math.cos(p.a) * 0.3, p.y + Math.sin(p.a) * 0.3, p.a, 'p', p.id, { dmg: swordDmg });
      this.sfx('beam', p.lvl, p.x, p.y);
    }
  }
  useItem(p, item, a) {
    const L = this.W.levels[p.lvl]; const monk = p.cls === 'monk';
    const fx = p.x + Math.cos(p.a) * 0.6, fy = p.y + Math.sin(p.a) * 0.6;
    switch (item) {
      case 'bombs': {
        if (p.bombs <= 0) { this.ev({ t: 'hint', pid: p.id, text: 'NO BOMBS.' }); return; }
        if (this.ents.filter(e => e.k === 'bomb' && e.pid === p.id).length >= 2) return;
        p.bombs--; const bx = L.solidAt(fx, fy) ? p.x : fx, by = L.solidAt(fx, fy) ? p.y : fy;
        this.spawn({ k: 'bomb', lvl: p.lvl, x: bx, y: by, fuse: 1.4, pid: p.id, spr: monk ? 'ki' : 'bomb', sc: 0.6, z: monk ? 0.2 : 0, nova: monk }); this.sfx('place', p.lvl); break;
      }
      case 'boomerang': {
        if (!p.items.boomerang) return;
        if (this.ents.some(e => e.k === 'boomer' && e.pid === p.id)) return;
        this.spawn({ k: 'boomer', lvl: p.lvl, x: p.x, y: p.y, a: p.a, pid: p.id, out: true, t: 0, spr: monk ? 'disc' : 'boomerang', sc: 0.6, z: 0.15, disc: monk, hitSet: {} }); this.sfx('boomer', p.lvl); break;
      }
      case 'bow': {
        if (!p.items.bow) return;
        if (p.arrows <= 0 && p.gems <= 0) { this.ev({ t: 'hint', pid: p.id, text: 'NO ARROWS.' }); return; }
        if (this.ents.filter(e => e.k === 'proj' && e.pid === p.id && (e.type === 'arrow' || e.type === 'dart')).length >= (monk ? 3 : 1)) return;
        if (p.arrows > 0) p.arrows--; else p.gems--;
        const silver = !!p.items.silver; const dmg = silver ? 4 : 2;
        if (monk) for (const s of [-0.12, 0, 0.12]) this.fireProj('dart', p.lvl, p.x, p.y, p.a + s, 'p', p.id, { dmg: dmg - 1, silver, life: 1.5 });
        else this.fireProj('arrow', p.lvl, p.x, p.y, p.a, 'p', p.id, { dmg, silver, spr: 'arrow' });
        this.sfx('arrow', p.lvl); break;
      }
      case 'candle': {
        if (!p.items.candle) return;
        if (this.ents.some(e => e.k === 'proj' && e.pid === p.id && (e.type === 'candle' || e.type === 'palm'))) return;
        this.fireProj(monk ? 'palm' : 'candle', p.lvl, p.x, p.y, p.a, 'p', p.id, {}); this.sfx('fire', p.lvl); break;
      }
      case 'rod': {
        if (!p.items.rod) return;
        if (this.ents.some(e => e.k === 'proj' && e.pid === p.id && (e.type === 'rodbolt' || e.type === 'thunder'))) return;
        this.fireProj(monk ? 'thunder' : 'rodbolt', p.lvl, p.x, p.y, p.a, 'p', p.id, { fireTrail: !monk }); this.sfx('magic', p.lvl); break;
      }
      case 'potion': {
        if (p.potions <= 0) { this.ev({ t: 'hint', pid: p.id, text: 'NO POTIONS.' }); return; }
        if (p.hp >= p.maxHp) { this.ev({ t: 'hint', pid: p.id, text: 'ALREADY AT FULL HEALTH.' }); return; }
        p.potions--; p.hp = p.maxHp; this.sfx('heal', p.lvl); this.ev({ t: 'flash', pid: p.id, c: '#f060b0' }); break;
      }
      case 'whistle': {
        if (!p.items.whistle) return;
        const done = this.team.done.filter(d => this.W.dungeons[d]);
        if (!done.length) { this.ev({ t: 'hint', pid: p.id, text: 'THE WIND HAS NOWHERE TO TAKE YOU YET.' }); return; }
        const d = done[p.warpIdx++ % done.length]; const g = this.W.dungeons[d];
        this.sfx('whistle', p.lvl); this.teleport(p, 'ow', g.x + 0.5, g.y + 1.8, Math.PI / 2); this.msg(p.name + ' RIDES THE WIND TO GATE ' + d + '.', p.id);
        break;
      }
    }
  }
  updateProj(e, dt) {
    const L = this.W.levels[e.lvl];
    const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt; e.life -= dt;
    const t = L.get(Math.floor(nx), Math.floor(ny)); const ti = TINFO[t]; const pr = L.props[L.idx(Math.floor(nx), Math.floor(ny))];
    const def = PROJ[e.type];
    if (def.fire) { // candle flame: burn bushes
      this.burnAt(L, nx, ny);
    }
    if (e.life <= 0 || (ti.solid && !ti.low) || (pr && PROP_INFO[pr] && PROP_INFO[pr].solid && pr !== PR.PEDESTAL)) {
      if (def.fire || e.fireTrail) { this.spawn({ k: 'fire', lvl: e.lvl, x: e.x, y: e.y, life: 1.2, spr: 'flame', sc: 0.8, z: -0.05, pid: e.pid }); }
      if (e.type === 'thunder' || e.type === 'wave') this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'boom', life: 0.25, sc: 0.8 });
      e.dead = true; return;
    }
    e.x = nx; e.y = ny;
    if (e.owner === 'e') {
      for (const p of Object.values(this.players)) {
        if (!p.alive || p.lvl !== e.lvl) continue;
        if (dist2(p.x, p.y, e.x, e.y) < 0.16) {
          // sword-class shield blocks weak front projectiles when not attacking
          const toP = Math.atan2(e.y - p.y, e.x - p.x);
          if (p.cls !== 'monk' && (e.type === 'rock' || e.type === 'spear') && Math.abs(angDiff(p.a, toP)) < 0.7) { e.dead = true; this.sfx('clink', e.lvl); return; }
          this.hurtPlayer(p, e.dmg, e); e.dead = true; return;
        }
      }
    } else {
      for (const en of this.ents) {
        if (en.k !== 'en' || en.lvl !== e.lvl || en.dead || e.hitSet[en.id]) continue;
        const r = ENEMY[en.type].r + 0.2;
        if (dist2(en.x, en.y, e.x, e.y) < r * r) {
          e.hitSet[en.id] = 1;
          this.damageEnemy(en, e.dmg, { x: e.x - e.vx * 0.1, y: e.y - e.vy * 0.1 }, { pid: e.pid, silver: e.silver, pierceShield: e.type === 'wave' || e.type === 'thunder', ignoreIframes: def.pierce });
          if (def.fire) this.spawn({ k: 'fire', lvl: e.lvl, x: e.x, y: e.y, life: 0.8, spr: 'flame', sc: 0.8, z: -0.05, pid: e.pid });
          if (!def.pierce) { e.dead = true; return; }
        }
      }
    }
  }
  updateBoomer(e, dt) {
    const p = this.players[e.pid]; if (!p || p.lvl !== e.lvl) { e.dead = true; return; }
    const L = this.W.levels[e.lvl]; const spd = e.disc ? 10 : 8;
    if (e.out) {
      const nx = e.x + Math.cos(e.a) * spd * dt, ny = e.y + Math.sin(e.a) * spd * dt;
      if (e.t > (e.disc ? 0.65 : 0.5) || L.solidAt(nx, ny) && !TINFO[L.get(Math.floor(nx), Math.floor(ny))].low) e.out = false; else { e.x = nx; e.y = ny; }
    } else {
      const a = Math.atan2(p.y - e.y, p.x - e.x); e.x += Math.cos(a) * spd * dt; e.y += Math.sin(a) * spd * dt;
      if (dist2(p.x, p.y, e.x, e.y) < 0.3) e.dead = true;
    }
    for (const en of this.ents) {
      if (en.lvl !== e.lvl || en.dead) continue;
      if (en.k === 'en' && !e.hitSet[en.id] && dist2(en.x, en.y, e.x, e.y) < (ENEMY[en.type].r + 0.25) ** 2) {
        e.hitSet[en.id] = 1;
        if (e.disc) this.damageEnemy(en, 2, e, { pid: e.pid, ignoreIframes: true }); else this.damageEnemy(en, 1, e, { pid: e.pid, stunOnly: true });
        if (!e.disc) e.out = false;
      }
      if (en.k === 'pick' && !en.perm && dist2(en.x, en.y, e.x, e.y) < 0.4) { en.x = e.x; en.y = e.y; }
    }
  }
  burnAt(L, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const bx = tx + dx, by = ty + dy; const i = L.idx(bx, by);
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
  explode(e) {
    e.dead = true; const L = this.W.levels[e.lvl]; const R = e.nova ? 2.4 : 1.7;
    this.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'boom', life: 0.45, sc: e.nova ? 2.4 : 1.7, z: 0.2 });
    this.sfx('boom', e.lvl, e.x, e.y); this.ev({ t: 'shake', lvl: e.lvl, x: e.x, y: e.y });
    for (const en of this.ents) if (en.k === 'en' && en.lvl === e.lvl && !en.dead && dist2(en.x, en.y, e.x, e.y) < R * R) this.damageEnemy(en, e.nova ? 6 : 4, e, { pid: e.pid, pierceShield: true });
    const tx = Math.floor(e.x), ty = Math.floor(e.y); let found = false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const bx = tx + dx, by = ty + dy; if (bx < 0 || by < 0 || bx >= L.w || by >= L.h) continue;
      if (dist2(bx + 0.5, by + 0.5, e.x, e.y) > (R * 0.9) ** 2) continue;
      const i = L.idx(bx, by); const t = L.tiles[i];
      if (TINFO[t].bomb) {
        let nt = TL.OPENDOOR; if (t === TL.ROCK_BOMB) nt = (L.secretReveal[i] && L.secretReveal[i].tile) || TL.CAVE; if (t === TL.CWALL_BOMB) nt = TL.CFLOOR;
        this.setTile(L.id, i, nt); found = true;
      }
    }
    if (found) this.sfx('secret', L.id);
  }
  pickup(p, e) {
    if (e.k === 'shop') {
      if (e.need && p.maxHp / 4 < e.need) { if (!e.warned || this.time - e.warned > 3) { e.warned = this.time; this.ev({ t: 'dialog', pid: p.id, text: 'MASTER USING IT AND YOU CAN HAVE THIS... COME BACK WITH ' + e.need + ' HEARTS.' }); } return; }
      if (!e.gift && p.gems < e.price) { if (!e.warned || this.time - e.warned > 3) { e.warned = this.time; this.ev({ t: 'hint', pid: p.id, text: 'YOU NEED ' + e.price + ' GEMS.' }); } return; }
      if (e.unique && p.cls === 'monk') { if (!e.warned || this.time - e.warned > 3) { e.warned = this.time; this.ev({ t: 'dialog', pid: p.id, text: 'YOUR HANDS ALREADY KNOW THE WAY.' }); } return; }
      if (e.item === 'chain' && p.armor >= 1) return;
      if (!e.gift) p.gems -= e.price;
      this.giveItem(p, e.item, true);
      if (e.gift) { this.team.taken[e.tk] = true; if (e.choose) { this.team.taken[e.choose] = true; for (const o of this.ents) if (o.choose === e.choose) o.dead = true; } e.dead = true; }
      return;
    }
    if (e.item === 'fairy') { p.hp = p.maxHp; e.dead = true; this.sfx('heal', p.lvl); return; }
    if (e.tk) this.team.taken[e.tk] = true;
    e.dead = true;
    this.giveItem(p, e.item, false);
  }
  giveItem(p, item, fromShop) {
    const all = Object.values(this.players);
    const fan = (text) => { this.ev({ t: 'get', pid: p.id, item, text }); };
    switch (item) {
      case 'gem1': p.gems = Math.min(999, p.gems + 1); this.sfx('gem', p.lvl); return;
      case 'gem5': p.gems = Math.min(999, p.gems + 5); this.sfx('gem', p.lvl); return;
      case 'gems30': case 'gems50': case 'gems100': p.gems = Math.min(999, p.gems + parseInt(item.slice(4))); fan('+' + item.slice(4) + ' GEMS'); return;
      case 'heart': p.hp = Math.min(p.maxHp, p.hp + 4); this.sfx('heart', p.lvl); if (fromShop) fan('HEART'); return;
      case 'bomb': p.bombs = Math.min(p.maxBombs, p.bombs + 4); this.sfx('gem', p.lvl); return;
      case 'arrow': p.arrows = Math.min(30, p.arrows + 5); this.sfx('gem', p.lvl); return;
      case 'bombs': p.bombs = Math.min(p.maxBombs, p.bombs + 4); if (!p.items.bombs) p.items.bombs = true; fan('BOMBS'); return;
      case 'arrows': p.arrows = Math.min(30, p.arrows + 15); fan('ARROWS'); return;
      case 'key': { const L = p.lvl; this.team.keys[L] = (this.team.keys[L] || 0) + 1; this.sfx('key', p.lvl); this.msg('SMALL KEY (' + this.team.keys[L] + ')'); return; }
      case 'map': this.team.maps[p.lvl] = true; fan('DUNGEON MAP'); return;
      case 'compass': this.team.comps[p.lvl] = true; fan('COMPASS'); return;
      case 'potion': p.potions = Math.min(2, p.potions + 1); p.items.potion = true; fan(p.cls === 'monk' ? 'SPIRIT TEA' : 'RED POTION'); return;
      case 'potion2': p.potions = 2; p.items.potion = true; fan('BLUE POTION (2 DOSES)'); return;
      case 'chain': p.armor = Math.max(p.armor, 1); fan(p.cls === 'monk' ? 'BLUE AURA' : 'CHAIN TUNIC'); return;
      case 'candle': p.items.candle = true; p.sel = 'candle'; fan(p.cls === 'monk' ? 'FLAME PALM' : 'CANDLE'); return;
      case 'fists': p.cls = 'monk'; this.ev({ t: 'monk', pid: p.id }); fan('THE OPEN HAND'); return;
    }
    // team-wide progression items
    const label = ITEM_NAMES[item] || item.toUpperCase();
    for (const o of all) {
      switch (item) {
        case 'sword1': o.sword = Math.max(o.sword, 1); break;
        case 'sword2': o.sword = Math.max(o.sword, 2); break;
        case 'sword3': o.sword = Math.max(o.sword, 3); break;
        case 'hcont': o.maxHp = Math.min(64, o.maxHp + 4); o.hp = o.maxHp; break;
        case 'bombbag': o.items.bombs = true; o.maxBombs = 16; o.bombs = Math.max(o.bombs, 8); break;
        case 'bow': o.items.bow = true; o.arrows = Math.max(o.arrows, 10); break;
        case 'plate': o.armor = 2; break;
        case 'shard': break;
        default: o.items[item] = true;
      }
    }
    if (item === 'shard') {
      const d = +p.lvl.slice(1); if (!this.team.shards.includes(d)) this.team.shards.push(d); if (!this.team.done.includes(d)) this.team.done.push(d);
      this.ev({ t: 'get', pid: p.id, item, text: 'EMBER SHARD ' + this.team.shards.length + '/8', all: true });
      // return everyone in this dungeon to the overworld after a beat
      const L = this.W.levels[p.lvl]; this.pendingExit = { lvl: p.lvl, at: this.time + 3.5 };
      this.autosave = true;
      return;
    }
    this.ev({ t: 'get', pid: p.id, item, text: label, all: !['sword1'].includes(item) || all.length > 1 });
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
      const def = ENEMY[e.type]; spr = def.spr; sc = def.sc; z = def.z || 0;
      if (def.fly) z += Math.sin(e.t * 6) * 0.06;
      if (e.hurt > 0) fl |= 1; if (e.stun > 0) fl |= 2; if (def.phase) fl |= 4; if (e.spawnFx > 0) { spr = 'puff'; }
      if (e.type === 'slime' && e.hop > 0) z += 0.15 * Math.sin((0.4 - e.hop) / 0.4 * Math.PI);
    }
    if (e.k === 'pick' && !e.perm) z += Math.abs(Math.sin(e.t * 3)) * 0.04;
    if (e.k === 'shop') z += Math.sin(this.time * 2) * 0.03;
    const v = [e.id, spr, Math.round(e.x * 100) / 100, Math.round(e.y * 100) / 100, Math.round(sc * 100) / 100, Math.round(z * 100) / 100, fl];
    if (e.k === 'shop' && !e.gift) v.push(e.price); else if (e.k === 'shop' && e.need) v.push(-e.need); else v.push(0);
    if (e.k === 'en' && ENEMY[e.type].boss) v.push(Math.max(0, e.hp / e.maxHp)); else v.push(-1);
    if (e.k === 'npc') v.push(e.text); else v.push(0);
    return v;
  }
  snapshotFor(pid) {
    const p = this.players[pid]; if (!p) return null;
    const en = []; for (const e of this.ents) if (e.lvl === p.lvl) en.push(this.entView(e));
    const pl = []; for (const o of Object.values(this.players)) pl.push([o.id, o.lvl, Math.round(o.x * 100) / 100, Math.round(o.y * 100) / 100, Math.round(o.a * 100) / 100, o.color, o.armor, o.cls, o.alive ? 1 : 0, o.atk, o.name, Math.round(o.revive * 10) / 10, o.hp, o.maxHp]);
    const me = {}; for (const k of ['lvl', 'hp', 'maxHp', 'gems', 'bombs', 'maxBombs', 'arrows', 'sword', 'armor', 'items', 'potions', 'alive', 'cls', 'sel', 'color', 'name']) me[k] = p[k];
    return { t: 's', me, pl, en, team: { keys: this.team.keys, maps: this.team.maps, comps: this.team.comps, shards: this.team.shards, done: this.team.done }, mv: this.modVer, over: this.over > 0 };
  }
  // ---- save ----
  makeSave() {
    const players = Object.assign({}, this.savedPlayers || {});
    for (const p of Object.values(this.players)) players[p.color] = this.playerSaveData(p);
    const cl = {}; for (const k in this.team.cleared) if (!k.startsWith('ow:')) cl[k] = true;
    return { v: 1, seed: this.W.seed, mode: this.W.mode, team: { keys: this.team.keys, maps: this.team.maps, comps: this.team.comps, shards: this.team.shards, done: this.team.done, taken: this.team.taken, cleared: cl }, mods: this.mods, players, time: Date.now() };
  }
  loadSave(s) {
    Object.assign(this.team, s.team); this.team.clearedAt = {}; this.mods = s.mods || {}; this.savedPlayers = s.players || {};
    for (const lvl in this.mods) { const L = this.W.levels[lvl]; if (!L) continue; for (const i in this.mods[lvl]) { const [t, pr] = this.mods[lvl][i]; L.tiles[i] = t; L.props[i] = pr; } }
    // never restore closed shutters
    for (const lvl in this.mods) for (const i in this.mods[lvl]) if (this.mods[lvl][i][0] === TL.SHUTTER) { this.W.levels[lvl].tiles[i] = TL.OPENDOOR; this.mods[lvl][i][0] = TL.OPENDOOR; }
  }
}
