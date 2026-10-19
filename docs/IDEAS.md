# Emberwake: ideas for later

Not built yet. Parked here so they don't get lost. Newest at the bottom.

## Dev tools
- Built: the TEST ZONE, the enemy spawner and the boss-room warps (pause menu, debug on). Add more test strips as new mechanics arrive.

## Items to place
- **Gale Cloak** (fly for 4 s over water, lava, pits and vents; outdoors and in tall rooms it lifts you a level, over hedges, rocks and trees). Built, but not in the world yet. Where should it come from? Maybe a late dungeon or a hard optional grotto.
- **Skeleton Key** (every lock, no keys used). Built, but not in the world yet. A post-game reward, or the prize for finding every secret?

## Combat
- **A clearer lunge-ready cue.** When the reverse grip is held long enough to lunge, the blade should glow (or get some bigger effect) so you know it's ready. Right now it's just a chime and a few sparkles. Keep the lunge itself as it is.
- **Gauntlets as their own item.** Their job: **push rocks, boulders and tombs** aside to uncover secrets (stairs, grottos, heart pieces) hidden under them. Maybe also heavier knockback. In first person your hands turn steel when you wear them.
- **Armored enemies.** A bomb (or bomb arrow) cracks the armor; only then do sword hits land.
- **Shield enemy rework.** Shield knights are fine early but too tough later, even in a group. Add a technique that knocks their shield down for 1–2 s. Armored versions can ignore it, for another layer.

## Enemies
- **Spider webs and a spider boss:** built as the Silkwood (dungeon 13). Maybe reuse webs in a late main dungeon too.
- **Silk Arm:** switchable for now; pick one stance for good, or keep the switch?
- **Knight tiers: built** (sword knight, armored knight, champion). Tune where they spawn after playtesting.
- **Knight tiers (old notes).** (1) Today's knight: a loaded shot stuns it, and a Heavy Pommel strike knocks its shield away (built). (2) Big-shield knight: only a three-arrow loaded shot (the triple-shot scroll) stuns it. (3) Armored knight with a sword: it swings at you, takes less damage, and only a triple bomb arrow stuns it. Later dungeons mix them.
- **Knight tiers.** A lava monster that pulls you into the lava :

## Bow techniques
- **Knight shield tiers.** Better shields on later knights, so a loaded shot stops stunning them and you need the triple shot (or something else).
- **Enemies with loaded shots.** Archers that fire doubled arrows you can't block without a better shield.

## Technique scrolls
- **Metal boomerang.** A metal-coated boomerang upgrade: heavier hits (maybe breaks a level of armor, or cuts webs and brambles on the way). A good third step after the wide throw and the second boomerang.
- **Boomerang path:** built (wide throw, then a second boomerang), debug only. Still to decide: where in the world each one is found.
- Hidden in grottos. The **candle** should be the way to find them (lighting a hidden grotto), so the candle stays useful for beginners.
- **Magic wand: built** (debug only for the orbs and spells). Still to place: the Flame Orb (near Cinder Caldera?), the Storm Orb (a later dungeon?), and the three spell scrolls (grottos).
- **The Tandem Casting grotto.** A hidden grotto where two wizards cast in tandem (linked by a crackling beam, a long warning, then a nasty combined spell). Beating them drops the TANDEM CASTING scroll.
- **Wizards casting in tandem (late game only, dungeons 8, 9 and the Hearth).** Pairs of wizards link up for about 1.2 s and fire a combined spell (a closing ring of fireballs, a lightning blast where their aims cross). Break it by stepping into the link, hitting or stunning either one, or knocking a staff away.
- **Fire and thunder combos.** Combined Flame Wall becomes a ring of fire around the area between the casters; combined Lightning Lance becomes a Thunderstrike where the beams cross that leaps to every foe in the room. Later maybe mixed combos (fire + thunder).
- **Built, debug only (still need a place in the world):** Lunge and Heavy Pommel scrolls, Loaded Shot 2 (triple shot), Great Quiver (50), Gale Slam scroll, armored skeletons.
- **Bomb arrows scroll.** Damage of an arrow plus one bomb, with the bomb's effects on enemies. Permanently closes eye targets, so some eye timers can be very short. That's safe because eyes are timers that always need hitting again, never one-way switches.

## Bombs
- Built: 1 bomb without a bag, 8 with Bramble Keep's, 16 from the hidden grotto shop. Later: late-game fire magic could open the grotto if it was missed.
- Give players a reason to want more bombs later, so the bag's value rises.

## World
- **Test the darkness.** Play the dark rooms (Starless Deep) with and without the candle and tune how much the light matters, now that the candle only flames every 4 s.
- **Push-open tombs.** Graves or tombs you push aside to find stairs. (Grottos under hollow trees are built: spring, cache, hermit, root merchant. More kinds welcome: a thornling den, a gem game, a lore room.)
- **Salt water.** Tiles marked `salty` never freeze (only the rough southern sea for now). Later: salty pools or a coastal dungeon where frost arrows don't work, so you need another way across.
- Grottos you've already found still regrow their trees, just differently.

## Monk
- **The monk needs a full rework.** He has no pommel strike or lunge. For now his punches split gourds (marked `TODO(monk rework)` in sim.js; remove it in the rework). Maybe his fists just break armor outright.

## Text to replace
- Two shop lines are lifted from another game: the merchant's "BUY SOMETHIN' WILL YA!" and the secret cave's "IT'S A SECRET TO EVERYONE" (content/caves.js). Write our own.

## Story
- **The Hearthwyrm's third head.** Iron Cathedral's tablet says the Hollow King took it, and "what remains of it hungers for light." Decide what he did with it: does he wear it, did it become the stolen light the Hearth needs, can it be won back? It could become a fight, a quest or an item.
- **Not every tablet points to the Hollow King, on purpose.** Other powers are at play. The wyrms look like his allies, but they aren't. Keep it that way.

## Lore
- The hollow king can offer one of the players a deal. if they accept they can kill their teamates for an alternate ending?

## The south: the King's island (plan, from Mitch)
- **It's an island, not a continent**, out past the rough southern sea (the raft can't cross rough water). Its castle shows on the
  southern horizon all game: faint from the ground, plain from THE LOOKOUT, the stone stair by the Hearthgate (BUILT: content/south.js,
  `genLookout`; the island itself is BUILT empty as level `isle`, debug warp only).
- **The way across: the Gale Cloak.** 4 s of flight can't cross a sea, so a chain of sea stacks runs south with updrafts on some of them
  that refill the flight: hop, glide, catch the wind. The King in dungeon 9 wears the cloak (that's how he crossed) and drops it.
- **The fake ending:** beating dungeon 9 rolls credits as if it's over. You wake in the start cave; the tunnels are still getting
  colder, one old man says "HE WAS NEVER ALL HERE. LOOK SOUTH, WHERE THE WIND GOES.", and you hold a cloak you've never used. Keep the
  clues fair: obvious if you're paying attention, missable if you rush.
- **Progression:** the north is the first half (dungeons 1-9, the frontier, the Silkwood) and tops out at adepts and armored knights.
  The island is the second half: archmages (never random spawns: bosses and minibosses only), champions in numbers, bone mages, and
  the unplaced items (Gale Cloak aside: the Skeleton Key, most rings, the wand's scrolls). Move difficulty and rewards south, not
  the dungeons we have.
- **Three wizard towers, one per element (force, fire, storm).** Each is a 9x9 shell with a hollow middle: every floor is a corridor
  two tiles wide around an open shaft, with a stair up at the end of each loop, mages the whole way, 4-5 floors. The shaft is a real
  drop: a push or a Force Wave can knock you down a floor (the stand-still block matters here). On top: THREE archmages, buffed, at
  once (bone, the tower's element, and one more). Super endgame, very hard.
  - They hold up the King's ward but DON'T lock the castle (the 8 shards do). Every tower left standing sends its archmages to the
    room before the King. You can skip them; it's a bad idea.
  - Rewards: the element's super-spell scroll (Force Wave, Flame Wall, Lightning Lance); the first bone archmage drops the Hollow
    Ring; all three cleared gives Tandem Casting.
- **The King, phase two: the stolen head.** When he falls, the Hearthwyrm's third head rises in bone, burning with the stolen fire
  (pale, wrong-colored). Bone mages circle it, raising skeletons and holding SHIELDS over it: kill them to open it up.
- **Two endings.** Normal: the King falls, the dead stop marching, but the Hearth stays cold (bittersweet). True: carry the freed fire
  back north to the Hearth (dungeon 12); its third lock ("ONE THAT WAS STOLEN LONG AGO") opens and it lights again.
- **The betrayal (co-op).** The King whispers a deal to one player ("never be cold again"), probably whoever has gone down the most.
  Whispers only on that player's screen, a few lines through the island; there's no way to refuse before the end. At the stolen
  head's last stand only they get YES/NO: YES heals the head and turns them on the party (needs player-vs-player damage, which
  doesn't exist yet: the biggest piece of work here), with its own ending. Solo: YES is simply the bad ending.
- **Rings for the north (first pass):** Rime (Rimefang Hollow), Cinder (Cinder Caldera), Moth (Starless Deep, hidden room), Echo
  (Whispering Vault, hidden room), Wardhold Signet (Iron Cathedral), Second Wind (the Lament grotto), Mender's (the warm spring),
  Shepherd's (a co-op side quest), Gale (the sea stacks), Hollow Silver and Glass (the towers). Side quests could give others.
- Wizard bosses in the north still to do: a storm archmage boss (dungeon 5, Storm Orb) and a fire archmage boss (dungeon 8, Flame
  Orb), each bringing adepts, replacing the repeated Orb boss there.

## Open questions (from Mitch, to decide)
- **Lakes: drain or dive?** Draining reuses the eye/tide machinery: a sluice eye on the shore of two lake regions drains them for good and shows a cave on the lakebed. It's cheap, but it's another eye puzzle. Diving would be a new item: swim under deep fresh water, with a blue underwater view and caves under the surface. It's more novel, but it would be the fourth way across water (raft, frost arrows, cloak). Leaning: drain now, dive later if a water dungeon wants it.
- **Shield techniques.** Perfect block is the Wardhold shield's (built). The Mirror Guard scroll (reflected shots x3) still needs a place in the world. Still open:
  - **Taunt**, a co-op scroll: Shift + three quick clicks with the shield up bangs blade on shield; every foe within 8 tiles comes for you for 5 s and you take 25% less damage.
  - **Cover:** a raised shield also stops shots aimed at a friend standing right behind you.
- **Story mechanic: EMBERS** (see docs/STORY.md). Hollow foes drop their ember when they fall. Take it within a few seconds or they stand back up. Embers rekindle Wardhold braziers (safe rooms and respawn points the Hollow won't enter) and, later, the Hearth. (Mitch: no "one player grabs embers" co-op role.)
- **A hero's homing shot.** Homing works for hero projectiles too (`homing` on the projectile def). A "seeker" wand orb or scroll could use it.
- **Elevation next steps.** Smooth ramps (not just steps), cliffs on the overworld, a mountain region with levels you climb, and ledges in dungeons. Enemies that climb steps. Arrows shot down from a ledge.

## Rings (built, debug only except the Thorn Ring)
- Decide where each ring is found: frontier dungeons (Cinder, Rime), late game (Hollow Silver, Second Wind), shops, grottos, bosses. A second ring slot as a late, hard-won item?
