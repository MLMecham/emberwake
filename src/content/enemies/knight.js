// ===== content/enemies/knight.js =====
// Armored chaser. Its shield blocks hits from the front, so strike from the side or use bombs.
// It turns slowly in that armor, so you can get behind it. From behind you see its back (backSprite), and only then
// do you know you're clear of the shield.
'use strict';
defineEnemy({
  id: 'knight',
  hp: 4, spd: 1.5, dmg: 2, r: 0.34, sc: 0.9,
  spawns: { biomes: ['mountain'], dungeons: [5, 6, 7, 8, 9] },
  ai: AI.chase,
  anim: { fps: 4, frames: (s, kit) => [s, kit.step(s, 12, -1, 0), s, kit.step(s, 12, 0, -1)] },
  shield: true, backSprite: 'knight_back',
  // a Heavy Pommel strike knocks the shield away (game/sim.js disarmEnemy): no more blocking, and it charges in recklessly
  disarm: 'shield_drop', disarmedSprite: 'knight_bare', disarmText: 'THE SHIELD GOES FLYING!',
  disarmedAi(sim, e, dt, ctx) { AI.chase(sim, e, dt, Object.assign({}, ctx, { spd: ctx.spd * 1.35 })); },
  sprite: [
    '................',
    '.....kkkkkk.....',
    '....kuuuuuuk....',
    '....kukkkkuk....',
    '....kuurruuk....',
    '.....kuuuuk.....',
    '..kkkUuuuuUk....',
    '.kBBkUuuuuUuk...',
    '.kBybkUuuUkuk...',
    '.kByykUUUUkuk...',
    '.kBybkUuuUk.k...',
    '.kBBk.UuuU......',
    '..kk..UU.UU.....',
    '......UU.UU.....',
    '.....kUk.kUk....',
    '................',
  ],
});
defineSprite('knight_back', [
  '................',
  '.....kkrrkk.....',
  '....kuurruuk....',
  '....kuurruuk....',
  '....kuuuuuuk....',
  '.....kuuuuk.....',
  '...kUuuuuuUkk...',
  '..kuUuuuuuUBBk..',
  '..kuUuUUuuUkBk..',
  '..kuUuUUuuUkBk..',
  '..k.UuuuuuUkk...',
  '....UuuuuuU.....',
  '.....UU.UU......',
  '.....UU.UU......',
  '....kUk.kUk.....',
  '................',
]);
// the old men know (cave hint pool)
defineHints(['KNIGHTS TURN SLOWLY IN ALL THAT ARMOR. GET BEHIND ONE AND ITS SHIELD WON\'T SAVE IT.']);
// without its shield (knocked away by a Heavy Pommel strike)
defineSprite('knight_bare', [
  '................', '.....kkkkkk.....', '....kuuuuuuk....', '....kukkkkuk....', '....kuurruuk....', '.....kuuuuk.....', '....kUuuuuUk....',
  '...kuUuuuuUuk...', '...kukUuuUkuk...', '...kukUUUUkuk...', '...k.kUuuUk.k...', '......UuuU......', '......UU.UU.....', '......UU.UU.....', '.....kUk.kUk....', '................']);
defineAnim('knight_bare', 6, (s, kit) => [s, kit.step(s, 12, -1, 0), s, kit.step(s, 12, 0, -1)]);
defineSprite('shield_drop', [ // the knight's shield, tumbling away
  '................', '................', '................', '.....kkkkkk.....', '....kBBBBBBk....', '....kByyyyBk....', '....kBybbyBk....', '....kByyyyBk....',
  '....kBBybBBk....', '.....kBBBBk.....', '......kBBk......', '.......kk.......', '................', '................', '................', '................']);
defineHints(['A BOOMERANG CURVES. IT CAN FIND THE BACK OF A SHIELDED FOE THAT YOUR BLADE CANNOT.']);
// ===================== STRONGER KNIGHTS =====================
// Sword knights hold a blade as well. Their shield counts the hits it stops (game/sim.js shieldBlocked): after
// `counter` blocks they raise the blade (KNIGHT_WINDUP, it glows: back off!) and strike everyone in front of them.
// The plain knight above has no sword on purpose, so players learn the shield before it can punish them.
// Armored knights (armor 2) and champions (armor 3) wear dark plate with red trim and carry a red war shield: bombs and the
// Heavy Pommel strip the plate first (like the armored skeletons), and only then can the shield be knocked away. A champion's
// great shield even shrugs off a double loaded shot (bigShield: only a triple shot jars it), and its great sword swings twice.
const KNIGHT_ROWS = enemyDef('knight').sprite;
// put a sword in the knight's right hand: blade (v) up the right edge, a guard (Y), the grip (n)
function withSword(rows, blade) {
  const g = rows.map(r => r.split(''));
  const put = (y, x, c, onlyEmpty) => { if (!onlyEmpty || g[y][x] === '.') g[y][x] = c; };
  put(0, 13, 'k', true); for (let y = 1; y <= 8; y++) { put(y, 13, blade || 'v'); put(y, 12, 'k', true); put(y, 14, 'k', true); }
  put(9, 13, 'Y'); put(9, 14, 'Y'); put(10, 13, 'n'); put(11, 13, 'k', true);
  return g.map(r => r.join(''));
}
// studs on the shield's rim (the red war shield)
function withSpikes(rows) { const g = rows.map(r => r.split('')); for (const y of [7, 9, 11]) if (g[y][0] === '.') g[y][0] = 'k'; if (g[6][1] === '.') g[6][1] = 'k'; if (g[12][1] === '.') g[12][1] = 'k'; return g.map(r => r.join('')); }
// a red mark on the breastplate and red eye slit (plate tiers)
function withTrim(rows) { const g = rows.map(r => r.split('')); g[7][7] = 'r'; g[7][8] = 'r'; g[8][7] = 'r'; return g.map(r => r.join('')); }
// horns on the champion's helm
function withHorns(rows) { const g = rows.map(r => r.split('')); g[0][4] = 'k'; g[1][4] = 'r'; g[0][11] = 'k'; g[1][11] = 'r'; g[1][3] = 'k'; g[1][12] = g[1][12] === '.' ? 'k' : g[1][12]; return g.map(r => r.join('')); }
const RED_SHIELD = { B: '#8a1414', y: '#ff5030', b: '#2a0808' }, PLATE = { u: '#7a7e92', U: '#3c3f52', r: '#ff2a18' }, BLACK_PLATE = { u: '#4c4a5a', U: '#24222e', r: '#ff2a18' };
const swordSprites = (id, rows, pal) => { defineSprite(id, rows, pal); defineAnim(id, 4, (s, kit) => [s, kit.step(s, 12, -1, 0), s, kit.step(s, 12, 0, -1)]); defineSpriteVariant(id + '_windup', id, { v: '#ffe040', x: '#ffe040' }); }; // the blade glows while it winds up
// the looks: blue shield + sword; plate tiers; what's left as the plate comes off; disarmed with a sword
swordSprites('knight_sword_s', withSword(KNIGHT_ROWS));
swordSprites('knight_redshield', withSpikes(withSword(KNIGHT_ROWS)), RED_SHIELD);
swordSprites('knight_plate1', withSpikes(withSword(KNIGHT_ROWS)), Object.assign({}, PLATE, RED_SHIELD));
swordSprites('knight_plate2', withTrim(withSpikes(withSword(KNIGHT_ROWS))), Object.assign({}, PLATE, RED_SHIELD));
swordSprites('knight_plate3', withHorns(withTrim(withSpikes(withSword(KNIGHT_ROWS, 'x')))), Object.assign({}, BLACK_PLATE, RED_SHIELD, { x: '#ff4020' }));
swordSprites('knight_bare_sword', withSword(enemyDef('knight').sprite.map((r, y) => ['................', '.....kkkkkk.....', '....kuuuuuuk....', '....kukkkkuk....', '....kuurruuk....', '.....kuuuuk.....', '....kUuuuuUk....', '...kuUuuuuUuk...', '...kukUuuUkuk...', '...kukUUUUkuk...', '...k.kUuuUk.k...', '......UuuU......', '......UU.UU.....', '......UU.UU.....', '.....kUk.kUk....', '................'][y])));
defineSpriteVariant('knight_back_red', 'knight_back', RED_SHIELD);
defineSpriteVariant('redshield_drop', 'shield_drop', RED_SHIELD);
defineSprite('slash_fx', [ // a knight's counter cut
  '................', '..............w.', '............ww..', '..........www...', '........wwv.....', '......wwv.......', '....wwv.........', '...wv...........',
  '..wv............', '.w..............', '................', '................', '................', '................', '................', '................']);
// The sword knights' brain: chase like any knight, but a counter that's winding up takes over (face the hero, then cut).
const KNIGHT_LUNGE = 2.2; // how far a sword knight lunges into its counter
function knightAi(sim, e, dt, ctx) {
  const def = enemyDef(e.type);
  if (e.counterT > 0) {
    const p = ctx.p; if (p) { const ta = Math.atan2(p.y - e.y, p.x - e.x); e.f += clamp(angDiff(e.f, ta), -dt * 6, dt * 6); }
    e.counterT -= dt; if (e.counterT > 0) return;
    // the cut: it lunges at whoever hit its shield (KNIGHT_LUNGE tiles at most), so stepping back alone won't save you
    const tgt = (e.counterOn && sim.players[e.counterOn] && sim.players[e.counterOn].alive && sim.players[e.counterOn].lvl === e.lvl) ? sim.players[e.counterOn] : ctx.p;
    if (tgt) { const a = Math.atan2(tgt.y - e.y, tgt.x - e.x), d = Math.sqrt(dist2(tgt.x, tgt.y, e.x, e.y)); e.f = a; const step = Math.max(0, Math.min(KNIGHT_LUNGE, d - 0.8)); for (let i = 0; i < 6; i++) sim.moveEnt(e, Math.cos(a) * step / 6, Math.sin(a) * step / 6, def); }
    sim.sfx('swing', e.lvl, e.x, e.y); sim.spawn({ k: 'fx', lvl: e.lvl, x: e.x + Math.cos(e.f) * 0.8, y: e.y + Math.sin(e.f) * 0.8, spr: 'slash_fx', life: 0.2, sc: 1, z: 0.2 });
    const followUp = e.counterHits < (def.counterHits || 1); // the champion's second cut lands even though the first just hit you
    for (const pl of Object.values(sim.players)) {
      if (!pl.alive || pl.lvl !== e.lvl) continue; const d = Math.sqrt(dist2(pl.x, pl.y, e.x, e.y));
      if (d < 1.8 && Math.abs(angDiff(e.f, Math.atan2(pl.y - e.y, pl.x - e.x))) < 1.2) { if (followUp) pl.inv = 0; sim.hurtPlayer(pl, def.counterDmg * e.dmgMul, e); }
    }
    if (--e.counterHits > 0) e.counterT = 0.28; // a champion's great sword comes back for a second cut (and lunges again)
    return;
  }
  AI.chase(sim, e, dt, ctx);
}
const lookFor = (byArmor) => (e) => { if (e.disarmed) return e.counterT > 0 ? 'knight_bare_sword_windup' : 'knight_bare_sword'; const s = byArmor[Math.max(0, Math.min(byArmor.length - 1, e.armor || 0))]; return e.counterT > 0 ? s + '_windup' : s; };
const knightVariant = (o) => defineEnemy(Object.assign({}, enemyDef('knight'), { ai: knightAi, disarmedAi: enemyDef('knight').disarmedAi, disarmedSprite: null, noElites: ['giant'] }, o));
knightVariant({ id: 'knight_sword', title: 'SWORD KNIGHT', hp: 5, counter: 2, counterDmg: 2, spawns: { dungeons: [6, 7, 8, 9] },
  sprite: withSword(KNIGHT_ROWS), sprFor: lookFor(['knight_sword_s']) });
knightVariant({ id: 'knight_armored', title: 'ARMORED KNIGHT', hp: 6, spd: 1.4, dmg: 3, sc: 0.98, armor: 2, counter: 2, counterDmg: 3, spawns: { dungeons: [8, 9, 12] },
  backSprite: 'knight_back_red', disarm: 'redshield_drop', sprite: withTrim(withSpikes(withSword(KNIGHT_ROWS))), pal: Object.assign({}, PLATE, RED_SHIELD),
  sprFor: lookFor(['knight_redshield', 'knight_plate1', 'knight_plate2']) });
knightVariant({ id: 'knight_champion', title: 'CHAMPION KNIGHT', hp: 8, spd: 1.3, dmg: 3, sc: 1.08, armor: 3, bigShield: true, counter: 2, counterHits: 2, counterDmg: 3, spawns: { dungeons: [9, 12] },
  backSprite: 'knight_back_red', disarm: 'redshield_drop', sprite: withHorns(withTrim(withSpikes(withSword(KNIGHT_ROWS, 'x')))), pal: Object.assign({}, BLACK_PLATE, RED_SHIELD, { x: '#ff4020' }),
  sprFor: lookFor(['knight_redshield', 'knight_plate1', 'knight_plate2', 'knight_plate3']) });
defineHints(['A KNIGHT WITH A BLADE WAITS BEHIND HIS SHIELD. HIT THE SHIELD TWICE AND WATCH FOR THE GLINT OF HIS SWORD.']);
