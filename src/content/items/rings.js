// ===== content/items/rings.js : rings =====
// You wear ONE ring at a time (p.ring), picked on the inventory's GEAR page; the rest stay in your pocket. A ring is just a
// flag the sim checks with sim.ringOn(p, id). Where each ring is found in the world is still open (docs/IDEAS.md): for
// now debug hands them out, except the THORN RING, which the root merchant sells only while the thorn-folk's grudge is
// low (game/sim.js grudge).
//   CINDER RING      fire hurts half as much; burning floors, lava and fire walls don't hurt at all
//   RIME RING        frost hurts half as much; you can't be chilled
//   HOLLOW SILVER    magic hurts half as much; magic bolts slow down as they come near you
//   GLASS RING       you deal double damage and take double damage
//   MISER'S RING     foes drop twice the gems; hearts heal half as much
//   MENDER'S RING    stand still (and unhurt) for 3 s and you slowly heal
//   WARDHOLD SIGNET  a knight that sees it hesitates a moment before its first strike. They remember.
//   THORN RING       whatever hits you up close takes three times the hit back
//   HOLLOW RING      hearts don't heal you; every foe you finish heals a quarter heart
//   GALE RING        the Gale Cloak rests half as long; the martial artist dashes further and sooner
//   BAT'S EAR        in the dark, a click every couple of seconds lights the walls around you and shows foes through walls
//   LODESTONE        gems and drops drift toward you
//   SECOND WIND      once per life, a hit that would bring you down leaves you a quarter heart (it comes back when you fall)
//   ECHO RING        sword beams bounce off one wall
//   SHEPHERD'S RING  hearts you pick up also heal friends near you, if they wear one too
'use strict';
Content.rings = [
  ['ring_cinder', 'CINDER RING', '#ff6020', 'FIRE HURTS HALF AS MUCH. BURNING GROUND DOESN\'T HURT'],
  ['ring_rime', 'RIME RING', '#90e0ff', 'FROST HURTS HALF AS MUCH. NOTHING CAN CHILL YOU'],
  ['ring_hollowsilver', 'HOLLOW SILVER', '#d0d0ff', 'MAGIC HURTS HALF AS MUCH, AND SLOWS NEAR YOU'],
  ['ring_glass', 'GLASS RING', '#f0fff8', 'YOU DEAL DOUBLE DAMAGE, AND TAKE DOUBLE DAMAGE'],
  ['ring_miser', 'MISER\'S RING', '#f8d840', 'FOES DROP TWICE THE GEMS. HEARTS HEAL HALF'],
  ['ring_mender', 'MENDER\'S RING', '#60e060', 'STAND STILL, UNHURT, AND YOU SLOWLY HEAL'],
  ['ring_signet', 'WARDHOLD SIGNET', '#c08040', 'KNIGHTS HESITATE BEFORE THEIR FIRST STRIKE'],
  ['ring_thorn', 'THORN RING', '#58a030', 'WHATEVER HITS YOU UP CLOSE TAKES THREE TIMES THE HIT BACK'],
  ['ring_hollow', 'HOLLOW RING', '#7040a0', 'HEARTS DON\'T HEAL YOU. EVERY KILL HEALS A LITTLE'],
  ['ring_gale', 'GALE RING', '#b0f0e0', 'THE CLOAK RESTS HALF AS LONG. DASHES GO FURTHER'],
  ['ring_bat', 'BAT\'S EAR', '#8a7aa0', 'IN THE DARK, A CLICK SHOWS YOU WHAT\'S NEAR, EVEN THROUGH WALLS'],
  ['ring_lodestone', 'LODESTONE', '#606878', 'GEMS AND DROPS DRIFT TOWARD YOU'],
  ['ring_secondwind', 'SECOND WIND', '#ff90b0', 'ONCE PER LIFE, A FATAL HIT LEAVES YOU A QUARTER HEART'],
  ['ring_echo', 'ECHO RING', '#a0c8ff', 'SWORD BEAMS BOUNCE OFF ONE WALL'],
  ['ring_shepherd', 'SHEPHERD\'S RING', '#ffffff', 'HEARTS YOU TAKE HEAL FRIENDS NEARBY WHO WEAR ONE TOO'],
].map(([id, name, gem, desc]) => ({ id, name, gem, desc }));
defineSprite('ring', [
  '................', '................', '................', '................', '................',
  '.......kk.......',
  '......kGGk......',
  '.....kGwwGk.....',
  '......kGGk......',
  '.....kyyyyk.....',
  '....kyk..kyk....',
  '....ky....yk....',
  '....kyk..kyk....',
  '.....kyyyyk.....',
  '......kkkk......',
  '................']);
for (const r of Content.rings) {
  defineSpriteVariant(r.id, 'ring', { G: r.gem });
  defineItem({ id: r.id, name: r.name, sprite: r.id, debug: true, ring: true, full: (p) => !!p.items[r.id],
    give(sim, p, ctx) { p.items[r.id] = true; if (!p.ring) p.ring = r.id; ctx.banner(r.name + ': ' + r.desc); } });
}
