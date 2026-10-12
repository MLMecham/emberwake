// ===== content/items/bow.js : bow, arrows and silver arrows =====
// Martial artist version: SPIRIT DARTS, three at once.
'use strict';
defineItem({
  id: 'bow', name: 'BOW', sprite: 'bow', monk: { name: 'SPIRIT DARTS' }, slot: 'b', order: 3, team: true, debug: true,
  owned: (p) => !!p.items.bow,
  give(sim, p, ctx) { p.items.bow = true; p.arrows = Math.max(p.arrows, 10); ctx.banner(); },
  // Shift + bow: a BOMB ARROW (needs the scroll, one arrow and one bomb). It bursts where it lands, like a bomb,
  // and an eye it hits stays shut for good.
  useAlt(sim, p, a) {
    if (!p.items.bombarrow) return this.use(sim, p, a);
    if (p.arrows <= 0 || p.bombs <= 0) return sim.hint(p, p.arrows <= 0 ? 'NO ARROWS.' : 'NO BOMBS FOR A BOMB ARROW.');
    if (sim.ents.some(e => e.k === 'proj' && e.pid === p.id && (e.type === 'arrow' || e.type === 'dart'))) return;
    // a loaded bomb arrow: every nocked arrow flies together with the one bomb (still one burst)
    const want = a && a.loaded === true ? 2 : Math.floor(+(a && a.loaded) || 1); const n = Math.max(1, Math.min(want, nockMax(p), p.arrows));
    p.arrows -= n; p.bombs--; const kind = arrowKind(p); const silver = kind === 'silver', frost = kind === 'frost'; // the arrows you picked: silver hits twice as hard, frost freezes
    sim.fireProj(p.cls === 'monk' ? 'dart' : 'arrow', p.lvl, p.x, p.y, p.a, 'p', p.id, Object.assign({ dmg: (silver ? 4 : 2) * n, silver, frost }, frost ? { iceLeft: FREEZE_PATH } : {}, { bomb: true, spr: n > 2 ? 'arrow3_bomb' : n > 1 ? 'arrow2_bomb' : 'arrow_bomb' }, n > 1 ? { kbMul: n > 2 ? 2.1 : 1.6, shieldBreak: true } : {})); sim.sfx('arrow', p.lvl);
  },
  use(sim, p, a) {
    // Loaded Shot (items/techniques.js): each Loaded Shot scroll lets you nock one more arrow (2, then 3), whichever you found first
    const want = a && a.loaded === true ? 2 : Math.floor(+(a && a.loaded) || 1); const nocks = Math.max(1, Math.min(want, nockMax(p), p.arrows)); const loaded = nocks > 1;
    if (p.arrows <= 0) return sim.hint(p, 'NO ARROWS.');
    const monk = p.cls === 'monk';
    if (sim.ents.filter(e => e.k === 'proj' && e.pid === p.id && (e.type === 'arrow' || e.type === 'dart')).length >= (monk ? 3 : 1)) return;
    p.arrows -= nocks;
    const kind = arrowKind(p); const silver = kind === 'silver', frost = kind === 'frost'; const dmg = silver ? 4 : 2; // the kind picked in the inventory: plain, frost (freeze) or silver
    const extra = Object.assign(loaded ? { kbMul: nocks > 2 ? 2.1 : 1.6, shieldBreak: true } : {}, frost ? { iceLeft: FREEZE_PATH } : {}); const mul = nocks; // frost arrows freeze water they fly over (sim.freezeAlong)
    if (monk) for (const s of [-0.12, 0, 0.12]) sim.fireProj('dart', p.lvl, p.x, p.y, p.a + s, 'p', p.id, Object.assign({ dmg: (dmg - 1) * mul, silver, life: 1.5, frost }, extra, frost ? { spr: 'icebolt' } : {}, loaded ? { sc: 0.75 } : {}));
    else sim.fireProj('arrow', p.lvl, p.x, p.y, p.a, 'p', p.id, Object.assign({ dmg: dmg * mul, silver, frost }, extra, { spr: (nocks > 2 ? 'arrow3' : loaded ? 'arrow2' : 'arrow') + (frost ? '_ice' : silver && !loaded ? '_silver' : '') }));
    sim.sfx('arrow', p.lvl);
  },
});
defineItem({ id: 'arrows', name: 'ARROWS', sprite: 'arrow', full: (p) => p.arrows >= (p.maxArrows || ARROWS_START), give(sim, p, ctx) { p.arrows = Math.min(p.maxArrows || ARROWS_START, p.arrows + 15); ctx.banner(); } }); // shop bundle
defineItem({ id: 'arrow', name: 'ARROWS', sprite: 'arrow', give(sim, p) { p.arrows = Math.min(p.maxArrows || ARROWS_START, p.arrows + 5); sim.sfx('gem', p.lvl); } }); // enemy drop
// dungeon 8 treasure: arrows hit harder, and only silver can finish the Hollow King
defineItem({ id: 'silver', name: 'SILVER ARROWS', sprite: 'arrow_silver', team: true, debug: true, give(sim, p, ctx) { p.items.silver = true; p.arrowType = 'silver'; ctx.banner('SILVER ARROWS: PICK THEM IN THE INVENTORY'); } });
// how many arrows you can nock at once: 1, plus one for each Loaded Shot scroll
function nockMax(p) { return 1 + (p.items.loaded ? 1 : 0) + (p.items.loaded2 ? 1 : 0); }
// which arrows fly: the inventory choice (p.arrowType), as long as you own that kind
function arrowKind(p) { const t = p.arrowType; if (t === 'silver' && p.items.silver) return 'silver'; if (t === 'frost' && p.items.frostarrows) return 'frost'; if (t == null) return p.items.silver ? 'silver' : p.items.frostarrows ? 'frost' : 'plain'; return 'plain'; }
