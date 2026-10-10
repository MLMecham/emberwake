// ===== content/dungeons.js : the nine dungeons =====
// Each dungeon is drawn as a shape: '#' room, 'S' entrance (keep the space below it empty), 'H' hidden room, '.' nothing.
// Up to 8 rows of 8. The generator wires doors, keys, locks, the boss (deepest room) and the treasure inside the shape.
// Hidden rooms sit behind a secret wall (secret: tile name) and hold a heart piece (or gems) plus a lore tablet.
// theme: wall / mortar / hi (brick), floor / edge / fhi (floor tiles), trim (door frames) as [r, g, b].
// gimmicks: ids from content/gimmicks/. Enemies and bosses come from each enemy's spawns / bossOf.
// Optional dungeons (10+) can also set: mapLabel (letter on the maps), bossDrop (item the boss leaves),
// bossParty (several bosses at once, instead of the single bossOf one).
'use strict';
defineDungeon(1, {
  name: 'THE MOSSY HOLLOW', item: 'boomerang', gimmicks: ['brambles'], secret: 'BRAMBLE',
  theme: { wall: [62, 96, 52], mortar: [30, 44, 24], hi: [96, 138, 70], floor: [92, 76, 52], edge: [54, 42, 28], fhi: [120, 100, 70], trim: [70, 52, 30] },
  shape: [ // a leaf
    '....##..',
    '...###..',
    '..####..',
    '..###H..',
    '...##...',
    '...#....',
    '...S....',
  ],
  lore: ['THE WYRMLING OF THIS HOLLOW HATCHED FROM A FROST-BLUE EGG. ITS MOTHER SLEEPS FAR TO THE WEST, BEYOND THE PASS.'],
});
defineDungeon(2, {
  name: 'BRAMBLE KEEP', item: 'bombbag', gimmicks: ['cracked'], loops: 0.4, bombLoops: 1,
  theme: { wall: [118, 110, 104], mortar: [52, 46, 44], hi: [150, 142, 134], floor: [104, 70, 60], edge: [58, 36, 30], fhi: [130, 90, 76], trim: [120, 50, 40] },
  shape: [ // a key
    '..###...',
    '..#.#...',
    '..###...',
    '...#....',
    '...##...',
    '...#....',
    '...##H..',
    '...S....',
  ],
  lore: ['THE KEEP WAS BUILT TO GUARD AN EMBER SHARD. ITS BUILDERS CRACKED EVERY WALL THEY COULD NOT AFFORD TO FINISH.'],
});
defineDungeon(3, {
  name: 'THE SUNKEN STAIR', item: 'bow', gimmicks: ['drain'],
  theme: { wall: [44, 104, 110], mortar: [18, 46, 52], hi: [70, 140, 146], floor: [56, 96, 92], edge: [26, 54, 52], fhi: [80, 124, 118], trim: [40, 80, 90] },
  shape: [ // a spiral
    '#####...',
    '#...#...',
    '#.#.#...',
    '#.#H#...',
    '#.###...',
    '#.......',
    'S.......',
  ],
  lore: ['WATER REMEMBERS. THE STAIR SANK THE NIGHT THE HOLLOW KING FIRST WOKE.'],
});
defineDungeon(4, {
  name: 'EMBERFORGE', item: 'rod', gimmicks: ['conveyors'],
  theme: { wall: [52, 48, 50], mortar: [20, 16, 18], hi: [84, 74, 72], floor: [70, 54, 46], edge: [36, 24, 20], fhi: [120, 70, 40], trim: [200, 90, 30] },
  shape: [ // a hammer
    '#######.',
    '#######.',
    '...#....',
    '...#....',
    '...#H...',
    '...#....',
    '...S....',
  ],
  lore: ['THE FORGE WYRM WAS BORN IN MAGMA. ITS FATHER STILL BREATHES BENEATH THE EASTERN VOLCANO.'],
});
defineDungeon(5, {
  name: 'WHISPERING VAULT', item: 'whistle', gimmicks: ['fakewalls'], secret: 'FAKEWALL',
  theme: { wall: [86, 64, 116], mortar: [36, 24, 52], hi: [120, 96, 150], floor: [196, 186, 160], edge: [120, 110, 90], fhi: [220, 212, 186], trim: [140, 110, 170] },
  shape: [ // a keyhole
    '..###...',
    '.#####..',
    '.##H##..',
    '.#####..',
    '..###...',
    '..#.#...',
    '..#.#...',
    '..#S#...',
  ],
  lore: ['SOME WALLS ARE ONLY HABITS. LISTEN FOR THE ONES THAT WHISPER.'],
});
defineDungeon(6, {
  name: 'TIDEGLASS HALLS', item: 'raft', gimmicks: ['glass'],
  theme: { wall: [70, 150, 170], mortar: [30, 70, 84], hi: [140, 210, 224], floor: [200, 230, 236], edge: [120, 170, 184], fhi: [236, 250, 252], trim: [60, 120, 140] },
  shape: [ // a fish
    '.......#',
    '.H###.##',
    '########',
    '.####.##',
    '..#....#',
    '..S.....',
  ],
  lore: ['THE GLASS WAS POURED FROM THE SEA ITSELF. IT HOLDS ITS BREATH FOR TWO HEARTBEATS, NO MORE.'],
});
defineDungeon(7, {
  name: 'IRON CATHEDRAL', item: 'plate', gimmicks: ['statues'],
  theme: { wall: [110, 114, 126], mortar: [50, 52, 60], hi: [150, 154, 168], floor: [90, 86, 80], edge: [50, 48, 44], fhi: [170, 140, 70], trim: [200, 170, 70] },
  shape: [ // a cathedral
    '...#....',
    '...#....',
    '..###...',
    '.#####..',
    '.##H##..',
    '.#####..',
    '.#####..',
    '.##S##..',
  ],
  lore: ['THE HOLLOW KING TOOK THE THIRD HEAD OF THE HEARTHWYRM. WHAT REMAINS OF IT HUNGERS FOR LIGHT.'],
});
defineDungeon(8, {
  name: 'THE STARLESS DEEP', item: 'silver', gimmicks: ['darkness'],
  theme: { wall: [30, 34, 66], mortar: [10, 10, 24], hi: [52, 58, 100], floor: [36, 38, 60], edge: [16, 16, 30], fhi: [60, 64, 100], trim: [90, 100, 160] },
  shape: [ // a constellation
    '##....##',
    '.#....#.',
    '.###.##.',
    '...###..',
    '....#...',
    '...H#...',
    '....#...',
    '....S...',
  ],
  lore: ['THREE FLAMES, ONE HEART. FIRE, FROST, AND A LIGHT THAT WAS STOLEN. THE HEARTH WAITS FOR ALL THREE.'],
});
defineDungeon(9, {
  name: 'HOLLOW CROWN', item: null, gimmicks: ['statues', 'glass'],
  theme: { wall: [40, 34, 30], mortar: [12, 10, 8], hi: [120, 96, 40], floor: [60, 52, 40], edge: [24, 20, 14], fhi: [200, 160, 60], trim: [230, 190, 70] },
  shape: [ // a crown
    '#..#..#.',
    '##.#.##.',
    '#######.',
    '#######.',
    '#H###H#.',
    '#######.',
    '...#....',
    '...S....',
  ],
  lore: ['HERE THE KING WEARS WHAT HE STOLE.', 'EVEN A HOLLOW CROWN CASTS A SHADOW.'],
});

// ---- the optional dungeons: beyond the passes, and the Hearth they unlock ----
defineDungeon(10, {
  name: 'RIMEFANG HOLLOW', mapLabel: 'R', item: 'frostarrows', bossDrop: 'fang', gimmicks: ['ice'],
  theme: { wall: [150, 190, 220], mortar: [70, 100, 140], hi: [220, 240, 255], floor: [170, 200, 225], edge: [100, 130, 170], fhi: [230, 245, 255], trim: [90, 160, 220] },
  shape: [ // a fang
    '.######.',
    '..####..',
    '..##H#..',
    '...##...',
    '...##...',
    '...#....',
    '...S....',
  ],
  lore: ['THE MATRIARCH LAID THREE EGGS. ONE HATCHED IN THE MOSSY HOLLOW. ONE WAS NEVER FOUND. ONE IS STILL WARM.'],
});
defineDungeon(11, {
  name: 'CINDER CALDERA', mapLabel: 'C', item: 'magmaboots', bossDrop: 'emberheart', gimmicks: ['vents'],
  theme: { wall: [70, 46, 40], mortar: [24, 12, 10], hi: [120, 70, 50], floor: [60, 44, 40], edge: [30, 18, 16], fhi: [140, 70, 30], trim: [255, 120, 40] },
  shape: [ // a volcano
    '...#....',
    '..###...',
    '..#H#...',
    '.#####..',
    '.#####..',
    '##.#.##.',
    '...S....',
  ],
  lore: ['THE PATRIARCH FORGED THE EMBER SHARDS IN HIS OWN BELLY, AND THE HOLLOW KING STOLE EVERY ONE.'],
});
defineDungeon(12, {
  name: 'THE HEARTH', mapLabel: 'H', item: null, bossDrop: 'dawnblade', gimmicks: ['ice', 'vents'],
  bossParty: ['hearth_frost', 'hearth_fire', 'hearth_hollow'],
  theme: { wall: [96, 70, 60], mortar: [30, 20, 18], hi: [200, 150, 90], floor: [110, 90, 80], edge: [50, 38, 34], fhi: [240, 200, 120], trim: [255, 220, 140] },
  shape: [ // a flame
    '...##...',
    '..####..',
    '.##..##.',
    '.#H..##.',
    '.######.',
    '..####..',
    '...##...',
    '...S....',
  ],
  lore: ['FROST, FIRE AND THE LIGHT THAT WAS STOLEN. WHEN ALL THREE BURN AS ONE, A BLADE OF DAWN IS FORGED.'],
});
