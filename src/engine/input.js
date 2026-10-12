// ===== input.js : keyboard, mouse, gamepad, touch =====
'use strict';
const IN = {
  keys: {}, pressed: {}, mouseDX: 0, mouseDY: 0, mouseL: false, mouseR: false, wheel: 0, locked: false,
  touch: { active: false, stick: null, look: null, btn: {} }, sens: 1, invertY: false, isTouch: false,
};
function initInput(canvas) {
  addEventListener('keydown', e => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if (!IN.keys[e.code]) IN.pressed[e.code] = true; IN.keys[e.code] = true;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { IN.keys[e.code] = false; });
  addEventListener('blur', () => { IN.keys = {}; IN.mouseL = IN.mouseR = false; });
  canvas.addEventListener('mousedown', e => {
    if (!IN.locked && G.state === 'play') { canvas.requestPointerLock && canvas.requestPointerLock(); }
    if (e.button === 0) { IN.mouseL = true; IN.pressed.Mouse0 = true; } if (e.button === 2) { IN.mouseR = true; IN.pressed.Mouse2 = true; }
  });
  addEventListener('mouseup', e => { if (e.button === 0) IN.mouseL = false; if (e.button === 2) IN.mouseR = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // locked mouse = free look; if the browser refuses pointer lock, dragging with a button held still turns the view
  addEventListener('mousemove', e => { if (IN.locked || ((IN.mouseL || IN.mouseR) && G.state === 'play')) { IN.mouseDX += e.movementX; IN.mouseDY += e.movementY; } });
  addEventListener('wheel', e => { if (G.state === 'play') IN.wheel += Math.sign(e.deltaY); }, { passive: true });
  // the browser always spends the first Esc on releasing the mouse, so treat that release as "open the menu"
  document.addEventListener('pointerlockchange', () => { const was = IN.locked; IN.locked = document.pointerLockElement === canvas; if (was && !IN.locked && G.state === 'play' && !G.disconnected) openPause(); });
}
let _padPrev = {};
function readInput(dt) {
  const k = IN.keys, p = IN.pressed; const o = { fwd: 0, str: 0, turn: 0, pitch: 0, atk: false, atkP: false, item: false, cycle: 0, cycleAll: 0, interact: false, map: false, pause: false, dash: false, anyP: false };
  if (k.KeyW || k.ArrowUp) o.fwd += 1; if (k.KeyS || k.ArrowDown) o.fwd -= 1; if (k.KeyD) o.str += 1; if (k.KeyA) o.str -= 1;
  if (k.ArrowLeft) o.turn -= 2.6 * dt; if (k.ArrowRight) o.turn += 2.6 * dt;
  o.turn += IN.mouseDX * 0.0028 * IN.sens; o.pitch -= IN.mouseDY * 0.25 * IN.sens * (IN.invertY ? -1 : 1);
  IN.mouseDX = 0; IN.mouseDY = 0;
  // Space attacks for the sword hero and dashes for the martial artist (IN.spaceDash, set by ui/main.js each frame)
  o.atk = (!IN.spaceDash && k.Space) || k.KeyJ || IN.mouseL; o.atkP = (!IN.spaceDash && p.Space) || p.KeyJ || p.Mouse0;
  o.item = p.KeyE || p.KeyK || p.Mouse2; o.itemHeld = k.KeyE || k.KeyK || IN.mouseR;
  // Wheel and R step through your favorite items (all items if none are starred). Holding Q while scrolling steps
  // through everything; a tap of Q on its own steps back one favorite.
  if (k.KeyQ) { if (IN.wheel) { o.cycleAll = IN.wheel; IN.qScrolled = true; } }
  else if (IN.qWas && !IN.qScrolled) o.cycle -= 1;
  if (!k.KeyQ) IN.qScrolled = false; IN.qWas = !!k.KeyQ;
  if (!k.KeyQ) o.cycle += IN.wheel; o.cycle += p.KeyR ? 1 : 0; IN.wheel = 0;
  o.interact = k.KeyF; o.interactP = p.KeyF;
  o.map = p.KeyM || p.Tab; o.pause = p.Escape || p.KeyP; o.dash = !!(IN.spaceDash && p.Space); o.alt = !!(k.ShiftLeft || k.ShiftRight); o.inv = p.KeyI; // Shift + item = the item's technique
  o.confirm = p.Enter || p.Space || p.KeyF || p.Mouse0; o.enterP = !!p.Enter;
  for (let i = 1; i <= 4; i++) if (p['Digit' + i]) o.slot = i; // 1-4: your first four favorites
  // gamepad
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; const gp = pads && Array.from(pads).find(x => x && x.connected);
  if (gp) {
    const dz = (v) => Math.abs(v) < 0.18 ? 0 : v; const b = (i) => gp.buttons[i] && gp.buttons[i].pressed; const bp = (i) => b(i) && !_padPrev[i];
    o.fwd -= dz(gp.axes[1] || 0); o.str += dz(gp.axes[0] || 0); o.turn += dz(gp.axes[2] || 0) * 2.8 * dt * IN.sens; o.pitch -= dz(gp.axes[3] || 0) * 120 * dt * (IN.invertY ? -1 : 1);
    if (b(0) || b(7)) o.atk = true; if (bp(0) || bp(7)) { o.atkP = true; o.confirm = true; }
    if (bp(2) || bp(6)) o.item = true; if (b(2) || b(6)) o.itemHeld = true; if (bp(3)) o.cycle += 1; if (b(4)) o.alt = true; if (bp(5)) o.cycle += 1; if (bp(14)) o.cycle -= 1; if (bp(15)) o.cycle += 1; // LB held = Shift
    if (b(1)) o.interact = true; if (bp(1)) { o.interactP = true; o.dash = true; } if (bp(9)) o.pause = true; if (bp(8)) o.map = true; if (bp(10)) o.dash = true;
    if (bp(12)) o.menuUp = true; if (bp(13)) o.menuDown = true;
    _padPrev = {}; gp.buttons.forEach((x, i) => _padPrev[i] = x.pressed);
  }
  if (p.ArrowUp || p.KeyW) o.menuUp = true; if (p.ArrowDown || p.KeyS) o.menuDown = true;
  const len = Math.hypot(o.fwd, o.str); if (len > 1) { o.fwd /= len; o.str /= len; }
  o.anyP = Object.keys(p).length > 0;
  IN.pressed = {};
  return o;
}
