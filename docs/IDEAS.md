# Emberwake: ideas for later

Not built yet. Parked here so they don't get lost. Newest at the bottom.

## Dev tools
- Built: the TEST ZONE, the enemy spawner and the boss-room warps (pause menu, debug on). Add more test strips as new mechanics arrive.

## Items to place
- **Gale Cloak** (fly for 4 s over water, lava, pits and vents; walls still stop you). Built, but not in the world yet. Where should it come from? Maybe a late dungeon or a hard optional grotto.
- **Skeleton Key** (every lock, no keys used). Built, but not in the world yet. A post-game reward, or the prize for finding every secret?

## Combat
- **Gauntlets as their own item.** Their job: **push rocks, boulders and tombs** aside to uncover secrets (stairs, grottos, heart pieces) hidden under them. Maybe also heavier knockback. In first person your hands turn steel when you wear them.
- **Armored enemies.** A bomb (or bomb arrow) cracks the armor; only then do sword hits land.
- **Shield enemy rework.** Shield knights are fine early but too tough later, even in a group. Add a technique that knocks their shield down for 1–2 s. Armored versions can ignore it, for another layer.

## Enemies
- **Spider webs and a better spider boss.** Web tiles that slow or stick you (fire burns them away), and a spider boss (Tideglass Halls) that uses them: strings webs across the room, drops from the ceiling, wraps you if you stand still.
- **Knight tiers.** (1) Today's knight: a loaded shot stuns it. (2) Big-shield knight: only a three-arrow loaded shot (the triple-shot scroll) stuns it. (3) Armored knight with a sword: it swings at you, takes less damage, and only a triple bomb arrow stuns it. Later dungeons mix them.

## Bow techniques
- **Loaded Shot 2: triple shot.** A second scroll lets you nock a third arrow (sprite `arrow3` is already drawn). The order you find the two scrolls in shouldn't matter.
- **Knight shield tiers.** Better shields on later knights, so a loaded shot stops stunning them and you need the triple shot (or something else).
- **Enemies with loaded shots.** Archers that fire doubled arrows you can't block without a better shield.
- **Quiver 50.** The third quiver (15 → 30 from Bramble Keep → 50). Somewhere later: a grotto shop or a later dungeon.

## Technique scrolls
- **Boomerang path:** built (wide throw, then a second boomerang), debug only. Still to decide: where in the world each one is found.
- **Gale Cloak slam:** only if you end the flight early (press the item again mid-flight): you drop and slam, stunning foes around where you land. Riding the flight out to the end gives no slam.
- **Sword:** dash strike (Shift + attack charges forward), a quick follow-up slash on every third swing in a chain, pommel bash (Shift: little damage, long stun; hold for a bigger stun), spin attack on a full charge.
- Hidden in grottos. The **candle** should be the way to find them (lighting a hidden grotto), so the candle stays useful for beginners.
- **Fire rod → magic rod.** Fire this early is too strong (free, fast, spammable projectiles, and great against ice enemies). Make it a plain magic rod. Scrolls then add fire or ice to it, which pushes elemental magic later in the game.
- **Bomb arrows scroll.** Damage of an arrow plus one bomb, with the bomb's effects on enemies. Permanently closes eye targets, so some eye timers can be very short. That's safe because eyes are timers that always need hitting again, never one-way switches.

## Bombs
- You can carry 1 bomb (maybe fewer?) without a bomb bag. Right now skipping the bag is fine, and lots of bombs barely matter.
- One bomb bag in its temple, and a second one sold in a grotto, for more gem and candle use. Late-game fire magic could open it if the grotto was missed.
- Give players a reason to want more bombs later, so the bag's value rises.

## World
- **Test the darkness.** Play the dark rooms (Starless Deep) with and without the candle and tune how much the light matters, now that the candle only flames every 4 s.
- **More grottos and push-open tombs.** Extra hidden grottos, and graves or tombs you push aside to find stairs, so exploring pays off beyond bombing walls.
- **Salt water.** Tiles marked `salty` never freeze (only the rough southern sea for now). Later: salty pools or a coastal dungeon where frost arrows don't work, so you need another way across.
- Grottos you've already found still regrow their trees, just differently.
