// ===== content/items/boomerang.js : thrown, comes back. Stuns enemies and grabs loot. =====
// Martial artist version: ORBIT DISC, which cuts through enemies instead of stunning.
'use strict';
defineItem({
  id: 'boomerang', name: 'BOOMERANG', sprite: 'boomerang', monk: { name: 'ORBIT DISC', sprite: 'disc' }, slot: 'b', order: 1, team: true, debug: true,
  owned: (p) => !!p.items.boomerang,
  give(sim, p, ctx) { p.items.boomerang = true; ctx.banner(); },
  // a straight throw: stuns what it hits (the disc cuts instead). One out at a time, two with the second boomerang.
  use(sim, p) {
    const out = sim.ents.filter(e => e.k === 'boomer' && e.pid === p.id).length; if (out >= (p.items.boomerang2 ? 2 : 1)) return;
    throwBoomer(sim, p, p.a, 0); sim.sfx('boomer', p.lvl);
  },
  // Shift (with the Wide Throw scroll): a wide sweeping arc that hits every foe it passes for a sword's worth and knocks
  // them back, but doesn't stun. With the second boomerang in hand, both go at once in mirrored arcs.
  useAlt(sim, p, a) {
    if (!p.items.widethrow) return this.use(sim, p, a);
    const out = sim.ents.filter(e => e.k === 'boomer' && e.pid === p.id).length; const have = (p.items.boomerang2 ? 2 : 1) - out; if (have <= 0) return;
    if (have >= 2) { throwBoomer(sim, p, p.a - 0.9, 1); throwBoomer(sim, p, p.a + 0.9, -1); } else throwBoomer(sim, p, p.a - 0.9, 1);
    sim.sfx('boomer', p.lvl);
  },
});
// the second boomerang: two can be out at once. Found after the Wide Throw scroll (docs/IDEAS.md for where).
defineItem({ id: 'boomerang2', name: 'SECOND BOOMERANG', sprite: 'boomerang', monk: { name: 'SECOND DISC', sprite: 'disc' }, team: true, debug: true,
  give(sim, p, ctx) { p.items.boomerang2 = true; ctx.banner('SECOND BOOMERANG: TWO IN THE AIR AT ONCE'); } });
defineItem({ id: 'widethrow', name: 'SCROLL: WIDE THROW', sprite: 'scroll', monk: { name: 'SCROLL: WIDE ORBIT' }, team: true, debug: true,
  give(sim, p, ctx) { p.items.widethrow = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: 'HOLD SHIFT AS YOU THROW. IT SWEEPS WIDE AND HITS HARD, BUT IT WON\'T STUN.' }); } });
// wide: 0 for a straight throw, +1/-1 for an arc curving one way or the other
function throwBoomer(sim, p, a, wide) {
  const disc = p.cls === 'monk';
  sim.spawn({ k: 'boomer', lvl: p.lvl, x: p.x, y: p.y, a, pid: p.id, out: true, t: 0, spr: disc ? 'disc_spin' : 'boomerang_spin', sc: 0.6, z: 0.15, disc, wide, hitSet: {} });
}
// A frog hit while it's out of the water (or up for air) gets hooked and rides the boomerang back to you, still dizzy,
// so you can cut it down. dropCarried lets it go wherever the boomerang ends up.
function dropCarried(sim, e) {
  const f = e.carry != null && sim.ents.find(x => x.id === e.carry); e.carry = null; if (!f) return;
  f.carried = false; f.x = e.x; f.y = e.y; f.sub = false; f.st = 0; f.tgt = null; f.stun = Math.max(f.stun || 0, 2); f.stunFrom = sim.time;
}
defineEntity('boomer', {
  update(sim, e, dt) {
    const p = sim.players[e.pid]; if (!p || p.lvl !== e.lvl) { dropCarried(sim, e); e.dead = true; return; }
    const L = sim.W.levels[e.lvl]; const spd = e.disc ? 10 : e.wide ? 7.5 : 8;
    if (e.out) {
      if (e.wide) e.a += e.wide * 2.6 * dt; // curve round
      const nx = e.x + Math.cos(e.a) * spd * dt, ny = e.y + Math.sin(e.a) * spd * dt;
      if (e.t > (e.wide ? 0.85 : e.disc ? 0.65 : 0.5) || L.solidAt(nx, ny) && !TINFO[L.get(Math.floor(nx), Math.floor(ny))].low) e.out = false; else { e.x = nx; e.y = ny; }
    } else {
      const a = Math.atan2(p.y - e.y, p.x - e.x); e.x += Math.cos(a) * spd * dt; e.y += Math.sin(a) * spd * dt;
      if (dist2(p.x, p.y, e.x, e.y) < (e.carry != null ? 0.8 : 0.3)) { dropCarried(sim, e); e.dead = true; } // a hooked frog lands at your feet
    }
    if (e.carry != null) { const f = sim.ents.find(x => x.id === e.carry); if (f && !f.dead) { f.x = e.x; f.y = e.y; } else e.carry = null; }
    for (const en of sim.ents) {
      if (en.lvl !== e.lvl || en.dead) continue;
      if (en.k === 'en' && !e.hitSet[en.id] && dist2(en.x, en.y, e.x, e.y) < (sim.enemyRadius(en) + (e.wide ? 0.4 : 0.25)) ** 2) {
        e.hitSet[en.id] = 1;
        if (e.wide) sim.damageEnemy(en, e.disc ? 3 : SWORD_DMG[1] * 2, e, { pid: e.pid, ignoreIframes: true, kbMul: 1.4 }); // sweeps on through
        else if (e.disc) sim.damageEnemy(en, 2, e, { pid: e.pid, ignoreIframes: true });
        else {
          const hit = sim.damageEnemy(en, BOOMERANG_DMG, e, { pid: e.pid, stunOnly: true }); e.out = false;
          const d = enemyDef(en.type); if (hit && d.swim && !d.boss && !en.dead && !en.sub && e.carry == null) { e.carry = en.id; en.carried = true; } // hook the frog
        }
      }
      if (en.k === 'pick' && (!en.perm || en.item === 'key') && dist2(en.x, en.y, e.x, e.y) < 0.4) { en.x = e.x; en.y = e.y; } // drag loot (and small keys) back
    }
  },
});
// in flight it spins: 8 frames of the item art turned 45 degrees at a time
for (const id of ['boomerang', 'disc']) { defineSpriteVariant(id + '_spin', id, {}); defineAnim(id + '_spin', 20, (s, kit) => [0, 1, 2, 3, 4, 5, 6, 7].map(i => kit.rotate(s, i * Math.PI / 4))); }
