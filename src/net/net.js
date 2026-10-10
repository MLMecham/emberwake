// ===== net.js : online co-op over WebRTC (PeerJS): short room codes, host runs the game =====
'use strict';
const NET = { role: 'solo', conns: {}, hostConn: null, peer: null, nextPid: 2, onStatus: null };
// Connection wrapper
class Conn {
  constructor(send, close) { this._send = send; this._close = close; this.onmsg = null; this.onclose = null; this.open = false; }
  send(o) { if (!this.open) return; try { this._send(JSON.stringify(o)); } catch (e) { } }
  close() { try { this._close(); } catch (e) { } }
}
function hostAttach(conn) {
  conn.onmsg = (m) => hostOnMsg(conn, m);
  conn.onclose = () => { if (conn.pid) { G.sim && G.sim.removePlayer(conn.pid); delete NET.conns[conn.pid]; netStatus(); } };
  const ready = () => netStatus();
  if (conn.open) ready(); else conn.onopen = ready;
}
function hostOnMsg(conn, m) {
  const sim = G.sim; if (!sim) return;
  if (m.t === 'hello') {
    const pid = 'p' + (NET.nextPid++); conn.pid = pid; NET.conns[pid] = conn;
    // ensure unique color
    const used = new Set(Object.values(sim.players).map(p => p.color)); let color = m.color;
    if (used.has(color)) color = (PCOLORS.find(c => !used.has(c.name)) || PCOLORS[0]).name;
    const p = sim.addPlayer(pid, (m.name || 'HERO').slice(0, 8).toUpperCase(), color, m.cls === 'monk' ? 'monk' : 'sword');
    if (m.dbg && m.dbg.on && isDevName(m.name)) applyDebugLoadout(p, m.dbg, true);
    conn.send({ t: 'welcome', pid, seed: G.world.seed, mode: G.world.mode, color, mods: sim.mods, mv: sim.modVer, x: p.x, y: p.y, a: p.a, lvl: p.lvl });
    conn.mv = sim.modVer; netStatus(); sfx('fanfare');
    return;
  }
  if (!conn.pid) return;
  if (m.t === 'ps') sim.onPlayerState(conn.pid, m);
  else if (m.t === 'a') sim.onAction(conn.pid, m.a);
}
function hostBroadcast(events) {
  const sim = G.sim;
  for (const pid in NET.conns) {
    const c = NET.conns[pid]; if (!c.open) continue;
    const snap = sim.snapshotFor(pid); if (!snap) continue;
    snap.ev = events.filter(e => !e.pid || e.pid === pid || e.t === 'msg');
    if (c.mv !== sim.modVer) { snap.mods = sim.mods; c.mv = sim.modVer; }
    c.send(snap);
  }
}
// ----- JOINER -----
function joinerStart(conn) {
  NET.role = 'client'; NET.hostConn = conn;
  conn.onmsg = (m) => clientOnMsg(m);
  conn.onclose = () => { if (G.state === 'play' || G.state === 'lobby') showToast('LOST CONNECTION TO HOST'); G.disconnected = true; };
  conn.send({ t: 'hello', name: G.profile.name, color: G.profile.color, cls: G.profile.cls, dbg: debugLoadout() });
}
// ----- ONLINE (internet) short codes via PeerJS cloud -----
function onlineId(code) { return 'emberwake-gld-' + code.toLowerCase().replace(/[^a-z0-9]/g, ''); }
async function peerOptions() { return Object.assign({ debug: 0, config: { iceServers: await iceServers() } }, window.EW_PEER_OPTS || {}); }
async function onlineHost(code) {
  const opts = await peerOptions();
  return new Promise((res, rej) => {
    if (!window.peerjs) return rej(new Error('Online library missing'));
    const peer = new peerjs.Peer(onlineId(code), opts); NET.peer = peer;
    peer.on('open', () => res(peer));
    peer.on('error', (e) => rej(Object.assign(new Error(e.type === 'unavailable-id' ? 'That code is taken.' : e.type === 'network' || e.type === 'server-error' ? 'No internet connection.' : String(e.type || e)), { type: e.type })));
    peer.on('connection', (dc) => {
      const conn = new Conn((s) => dc.send(s), () => dc.close());
      dc.on('open', () => { conn.open = true; hostAttach(conn); setTimeout(async () => { conn.kind = await connectionKind(dc.peerConnection); netStatus(); }, 1500); });
      dc.on('data', (d) => { try { conn.onmsg && conn.onmsg(typeof d === 'string' ? JSON.parse(d) : d); } catch (e) { } });
      dc.on('close', () => { conn.open = false; conn.onclose && conn.onclose(); });
    });
  });
}
async function onlineJoin(code) {
  const opts = await peerOptions();
  return new Promise((res, rej) => {
    if (!window.peerjs) return rej(new Error('Online library missing'));
    const peer = new peerjs.Peer(opts); NET.peer = peer; let done = false;
    peer.on('error', (e) => { if (!done) rej(new Error(e.type === 'peer-unavailable' ? 'No game found with that code.' : e.type === 'network' || e.type === 'server-error' ? 'No internet connection.' : String(e.type || e))); });
    peer.on('open', () => {
      const dc = peer.connect(onlineId(code), { reliable: true, serialization: 'raw' });
      const conn = new Conn((s) => dc.send(s), () => dc.close());
      dc.on('open', () => { conn.open = true; done = true; res(conn); setTimeout(async () => { NET.kind = await connectionKind(dc.peerConnection); }, 1500); });
      dc.on('data', (d) => { try { conn.onmsg && conn.onmsg(typeof d === 'string' ? JSON.parse(d) : d); } catch (e) { } });
      dc.on('close', () => { conn.open = false; conn.onclose && conn.onclose(); });
      // The host was found (otherwise we'd have had "no game found"), but no route got through.
      setTimeout(() => { if (!done) { done = true; try { peer.destroy(); } catch (e) { } NET.peer = null; rej(new Error('FOUND THE GAME BUT COULD NOT CONNECT. ONE OF YOUR NETWORKS IS BLOCKING IT. TRY AGAIN, OR PUT EVERYONE ON THE SAME PHONE HOTSPOT.')); } }, 20000);
    });
  });
}
function netStatus() { NET.onStatus && NET.onStatus(); }
