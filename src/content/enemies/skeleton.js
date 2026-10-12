// ===== content/enemies/skeleton.js =====
// Chases you down.
'use strict';
defineEnemy({
  id: 'skeleton',
  hp: 2, spd: 1.9, dmg: 1, r: 0.32, sc: 0.85,
  spawns: { biomes: ['desert', 'graveyard'], dungeons: [1, 3, 4, 6, 9] },
  ai: AI.chase,
  anim: { fps: 5, frames: (s, kit) => [s, kit.step(s, 12, -1, 0), s, kit.step(s, 12, 0, -1)] },
  sprite: [
    '................',
    '.....kkkkkk.....',
    '....kzzzzzzk....',
    '....kzkkzkkz....',
    '....kzkkzkkz....',
    '.....kzzzzk.....',
    '......kzkzk.....',
    '...kk.kzzzk.kk..',
    '..kzzkzkzkzkzzk.',
    '..kzk.kzzzk.kzk.',
    '..kzk.kzkzk.kzk.',
    '......kzzzk..u..',
    '......kz.zk..u..',
    '......kz.zk.....',
    '.....kzk.kzk....',
    '................',
  ],
});
// ARMORED SKELETONS (debug spawner only for now). armor 1: a breastplate; 2: plus a helmet; 3: plus gauntlets and greaves.
// Each level blocks 25% of damage (game/sim.js ARMOR_STEP). Bombs and the Heavy Pommel knock one level off (once each per
// skeleton), and the sprite loses that piece: greaves and gauntlets first, then the helmet, then the breastplate.
const SKEL_ARMOR = [null,
  [ // 1: breastplate
    '................', '.....kkkkkk.....', '....kzzzzzzk....', '....kzkkzkkz....', '....kzkkzkkz....', '.....kzzzzk.....', '......kzkzk.....',
    '...kk.kUuUk.kk..', '..kzzkUuuuUkzzk.', '..kzk.kUuUk.kzk.', '..kzk.kUUUk.kzk.', '......kzzzk..u..', '......kz.zk..u..', '......kz.zk.....', '.....kzk.kzk....', '................'],
  [ // 2: + helmet with a nose guard
    '................', '....kkkkkkkk....', '...kUuuuuuuUk...', '....kzkkUkkz....', '....kzkkUkkz....', '.....kzzzzk.....', '......kzkzk.....',
    '...kk.kUuUk.kk..', '..kzzkUuuuUkzzk.', '..kzk.kUuUk.kzk.', '..kzk.kUUUk.kzk.', '......kzzzk..u..', '......kz.zk..u..', '......kz.zk.....', '.....kzk.kzk....', '................'],
  [ // 3: + gauntlets and greaves
    '................', '....kkkkkkkk....', '...kUuuuuuuUk...', '....kzkkUkkz....', '....kzkkUkkz....', '.....kzzzzk.....', '......kzkzk.....',
    '...kk.kUuUk.kk..', '..kUUkUuuuUkUUk.', '..kUk.kUuUk.kUk.', '..kuk.kUUUk.kuk.', '......kzzzk..u..', '......kU.Uk..u..', '......kU.Uk.....', '.....kUk.kUk....', '................'],
];
for (let n = 1; n <= 3; n++) defineEnemy(Object.assign({}, enemyDef('skeleton'), {
  id: 'skeleton_a' + n, title: 'ARMORED SKELETON', armor: n, hp: 3, spawns: {}, noElites: ['giant'], sprite: SKEL_ARMOR[n],
  sprFor: (e) => e.armor >= n ? null : e.armor > 0 ? 'skeleton_a' + e.armor : 'skeleton', // shows only the armor it still has
}));
defineSprite('armorbits', [ // bits of armor flying off
  '................', '..u.........U...', '...U....u.......', '.......U........', '.u..........u...', '......k.........', '...U.......U....', '.........u......',
  '..u...U.........', '............U...', '.....u..........', '..........k..u..', '...U............', '.......u....U...', '................', '................']);
