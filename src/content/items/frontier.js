// ===== content/items/frontier.js : treasures of the optional dungeons =====
// Rimefang Hollow: FROST ARROWS (treasure) and the FROST FANG (from the Matriarch).
// Cinder Caldera: MAGMA BOOTS (treasure) and the EMBER HEART (from the Patriarch).
// The Hearth (opened by the Fang + the Heart): the DAWNBLADE, from the Hearthwyrm.
'use strict';
defineItem({ id: 'frostarrows', name: 'FROST ARROWS', sprite: 'arrow_ice', monk: { name: 'FROST DARTS' }, team: true, debug: true,
  give(sim, p, ctx) { p.items.frostarrows = true; p.arrows = Math.max(p.arrows, 20); ctx.banner('FROST ARROWS: THEY FREEZE WHAT THEY HIT'); } });
defineItem({ id: 'magmaboots', name: 'MAGMA BOOTS', sprite: 'boots', team: true, debug: true,
  give(sim, p, ctx) { p.items.magmaboots = true; ctx.banner('MAGMA BOOTS: WALK ON LAVA AND VENTS'); } });
// relics: shared by the party, shown under the shards, and both are needed for the Hearth gate
const relic = (id, name, sprite, line) => defineItem({ id, name, sprite, team: true, debug: true,
  debugGrant(p, sim) { if (!sim.team.relics.includes(id)) sim.team.relics.push(id); },
  give(sim, p, ctx) {
    const t = sim.team; if (!t.relics.includes(id)) t.relics.push(id);
    const d = +p.lvl.slice(1); if (d && !t.done.includes(d)) t.done.push(d);
    ctx.banner(name + (t.relics.includes('fang') && t.relics.includes('emberheart') ? ': THE HEARTH WILL OPEN' : ': ' + line), true);
    sim.openWarp(p); sim.autosave = true;
  } });
relic('fang', 'FROST FANG', 'fang', 'ONE OF TWO HEARTH KEYS');
relic('emberheart', 'EMBER HEART', 'emberheart', 'ONE OF TWO HEARTH KEYS');
defineItem({ id: 'dawnblade', name: 'DAWNBLADE', sprite: 'dawnblade', monk: { name: 'DAWN FISTS' }, team: true,
  give(sim, p, ctx) {
    p.sword = Math.max(p.sword, 4); const d = +p.lvl.slice(1); if (d && !sim.team.done.includes(d)) sim.team.done.push(d);
    ctx.banner(p.cls === 'monk' ? 'DAWN FISTS: THE LAST FLAME IS YOURS' : 'DAWNBLADE: ITS LIGHT CUTS THROUGH ANYTHING', true);
    sim.openWarp(p); sim.autosave = true;
  } });
