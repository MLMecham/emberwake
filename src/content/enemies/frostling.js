// ===== content/enemies/frostling.js =====
// Little ice imps of the Frozen Reach. Hop at you and spit ice that slows your legs.
'use strict';
const hopSpit = (proj) => (sim, e, dt, ctx) => {
  AI.hop(sim, e, dt, ctx);
  e.spit = (e.spit == null ? 1 + Math.random() * 2 : e.spit) - dt;
  if (e.spit <= 0 && ctx.p && dist2(ctx.p.x, ctx.p.y, e.x, e.y) < 49) { e.spit = 2 + Math.random() * 1.5; sim.fireProj(proj, e.lvl, e.x, e.y, Math.atan2(ctx.p.y - e.y, ctx.p.x - e.x), 'e', null, { dmg: Content.projectiles[proj].dmg * e.dmgMul }); sim.sfx('shoot', e.lvl, e.x, e.y); }
};
defineEnemy({
  id: 'frostling', hp: 3, spd: 1.6, dmg: 1, r: 0.32, sc: 0.8,
  spawns: { biomes: ['snow'], dungeons: [10, 12] },
  ai: hopSpit('icebolt'),
  anim: { fps: 6, frames: (s, kit) => [s, kit.squash(s, 0.85), s, kit.squash(s, 1.1)] },
  view: (e) => e.hop > 0 ? 0.18 * Math.sin((0.4 - e.hop) / 0.4 * Math.PI) : 0,
  sprite: [
    '................',
    '.....k....k.....',
    '....kvk..kvk....',
    '....kcvkkvck....',
    '...kcccccccck...',
    '..kccwkcckwcck..',
    '..kcckkcckkcck..',
    '..kccccccccccck.',
    '..kCcckwwkcccCk.',
    '...kCccccccCCk..',
    '...kCCccccCCk...',
    '..kvkCCCCCCkvk..',
    '..kk.kkkkkk.kk..',
    '................',
    '................',
    '................',
  ],
});
// its fiery cousin from the Cinder Wastes
defineEnemy({
  id: 'cinderling', hp: 3, spd: 1.6, dmg: 1, r: 0.32, sc: 0.8, hot: true,
  spawns: { biomes: ['ash'], dungeons: [11, 12] },
  ai: hopSpit('fire'),
  anim: { fps: 6, frames: (s, kit) => [s, kit.squash(s, 0.85), s, kit.squash(s, 1.1)] },
  view: (e) => e.hop > 0 ? 0.18 * Math.sin((0.4 - e.hop) / 0.4 * Math.PI) : 0,
  sprite: [
    '................',
    '......k..k......',
    '.....kyk.kyk....',
    '....kyokkoyk....',
    '...koooooooook..',
    '..korrwkookwrrk.',
    '..korrkkookkrrk.',
    '..koooooooooook.',
    '..kRookxxkooRk..',
    '...kRooooooRk...',
    '...kRRooooRRk...',
    '..kxkRRRRRRkxk..',
    '..kk.kkkkkk.kk..',
    '................',
    '................',
    '................',
  ],
});
