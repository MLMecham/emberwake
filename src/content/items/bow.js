// ===== content/items/bow.js : bow, arrows and silver arrows =====
// Martial artist version: SPIRIT DARTS, three at once.
'use strict';
defineItem({
  id: 'bow', name: 'BOW', sprite: 'bow', monk: { name: 'SPIRIT DARTS' }, slot: 'b', order: 3, team: true, debug: true,
  owned: (p) => !!p.items.bow,
  give(sim, p, ctx) { p.items.bow = true; p.arrows = Math.max(p.arrows, 10); ctx.banner(); },
  use(sim, p, a) {
    const loaded = !!(a && a.loaded && p.items.loaded) && p.arrows >= 2; // Loaded Shot (items/techniques.js): two arrows at once
    if (p.arrows <= 0) return sim.hint(p, 'NO ARROWS.');
    const monk = p.cls === 'monk';
    if (sim.ents.filter(e => e.k === 'proj' && e.pid === p.id && (e.type === 'arrow' || e.type === 'dart')).length >= (monk ? 3 : 1)) return;
    p.arrows -= loaded ? 2 : 1;
    const silver = !!p.items.silver; const dmg = silver ? 4 : 2; const frost = !!p.items.frostarrows; // frost arrows (Rimefang Hollow) freeze
    const extra = loaded ? { kbMul: 1.6, shieldBreak: true } : {}; const mul = loaded ? 2 : 1;
    if (monk) for (const s of [-0.12, 0, 0.12]) sim.fireProj('dart', p.lvl, p.x, p.y, p.a + s, 'p', p.id, Object.assign({ dmg: (dmg - 1) * mul, silver, life: 1.5, frost }, extra, frost ? { spr: 'icebolt' } : {}, loaded ? { sc: 0.75 } : {}));
    else sim.fireProj('arrow', p.lvl, p.x, p.y, p.a, 'p', p.id, Object.assign({ dmg: dmg * mul, silver, frost }, extra, { spr: (loaded ? 'arrow2' : 'arrow') + (frost ? '_ice' : '') }));
    sim.sfx('arrow', p.lvl);
  },
});
defineItem({ id: 'arrows', name: 'ARROWS', sprite: 'arrow', full: (p) => p.arrows >= (p.maxArrows || ARROWS_START), give(sim, p, ctx) { p.arrows = Math.min(p.maxArrows || ARROWS_START, p.arrows + 15); ctx.banner(); } }); // shop bundle
defineItem({ id: 'arrow', name: 'ARROWS', sprite: 'arrow', give(sim, p) { p.arrows = Math.min(p.maxArrows || ARROWS_START, p.arrows + 5); sim.sfx('gem', p.lvl); } }); // enemy drop
// dungeon 8 treasure: arrows hit harder, and only silver can finish the Hollow King
defineItem({ id: 'silver', name: 'SILVER ARROWS', sprite: 'arrow', team: true, debug: true, give(sim, p, ctx) { p.items.silver = true; ctx.banner(); } });
