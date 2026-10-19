// ===== content/enemies/spider.js =====
// Boss of levels 3 and 6. Fast lunges.
'use strict';
defineEnemy({
  id: 'spider',
  hp: 8, spd: 3.2, dmg: 2, r: 0.6, sc: 1.5, boss: true,
  bossOf: [6], // (the Sunken Stair has the Bog King now: enemies/frog.js)
  ai: AI.lunge(0.55, 0.5, 1.1),
  // two body segments: the round abdomen behind and above, the head below it with its eyes and fangs; four legs a side
  // that rise to a high knee before they reach the floor. The walk ripples the legs front and back out of step.
  anim: { fps: 10, frames: (s, kit) => { const a = kit.shearRows(kit.shearRows(s, 4, 8, 1), 11, 14, -1), b = kit.shearRows(kit.shearRows(s, 4, 8, -1), 11, 14, 1); return [s, a, kit.bob(a, 1), s, b, kit.bob(b, 1)]; } },
  pal: { J: '#6a6070' }, // J: the legs (each kind sets its own, a shade of its body)
  sprite: [
    '................',
    '......kkkk......',
    '....kkGGGGkk....',
    '...kGGGrrGGGk...',
    '.J.kGGrGGrGGk.J.',
    'J.JkGGGrrGGGkJ.J',
    'J.J.kkGGGGkk.J.J',
    'J..J..kkkk..J..J',
    'J...JJkGGkJJ...J',
    '.J.kGrGGGGrGk.J.',
    '.JJkGGrGGrGGkJJ.',
    'J..kkGGGGGGkk..J',
    'J.J..kwkkwk..J.J',
    'J.J...w..w...J.J',
    '.J............J.',
    '................',
  ],
});
