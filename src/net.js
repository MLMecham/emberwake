// ===== net.js : WebRTC co-op with QR / code signaling, optional online short codes =====
'use strict';
const NET = { role: 'solo', conns: {}, hostConn: null, peer: null, nextPid: 2, pending: null, onStatus: null };
const CODE_PREFIX = 'EW1.';
async function packSDP(desc) {
  // strip lines that aren't needed for a data channel to shrink the QR
  let sdp = desc.sdp.split('\r\n').filter(l => l && !/^a=(extmap-allow-mixed|msid-semantic)/.test(l)).join('\n');
  const raw = JSON.stringify({ t: desc.type[0], s: sdp });
  let bytes = new TextEncoder().encode(raw), z = '0';
  if (window.CompressionStream) {
    try { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(bytes); w.close(); bytes = new Uint8Array(await new Response(cs.readable).arrayBuffer()); z = '1'; } catch (e) { bytes = new TextEncoder().encode(raw); z = '0'; }
  }
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + z + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unpackSDP(code) {
  code = code.trim().replace(/\s+/g, '');
  if (!code.startsWith(CODE_PREFIX)) throw new Error('Not a game code');
  const z = code[CODE_PREFIX.length]; let b64 = code.slice(CODE_PREFIX.length + 1).replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';
  const bin = atob(b64); let bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (z === '1') { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bytes); w.close(); bytes = new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
  const o = JSON.parse(new TextDecoder().decode(bytes));
  return { type: o.t === 'o' ? 'offer' : 'answer', sdp: o.s.split('\n').join('\r\n') + '\r\n' };
}
function waitIce(pc) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const done = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', done); res(); } };
    pc.addEventListener('icegatheringstatechange', done); setTimeout(res, 4000);
  });
}
// Connection wrapper
class Conn {
  constructor(send, close) { this._send = send; this._close = close; this.onmsg = null; this.onclose = null; this.open = false; }
  send(o) { if (!this.open) return; try { this._send(JSON.stringify(o)); } catch (e) { } }
  close() { try { this._close(); } catch (e) { } }
}
function wrapDC(dc, pc) {
  const c = new Conn((s) => dc.send(s), () => { dc.close(); pc.close(); });
  dc.onopen = () => { c.open = true; c.onopen && c.onopen(); };
  dc.onmessage = (e) => { try { c.onmsg && c.onmsg(JSON.parse(e.data)); } catch (er) { console.warn(er); } };
  dc.onclose = () => { c.open = false; c.onclose && c.onclose(); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') { c.open = false; c.onclose && c.onclose(); } };
  return c;
}
// ----- HOST: create an invite (offer) -----
async function hostCreateInvite() {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const dc = pc.createDataChannel('g', { ordered: true });
  const conn = wrapDC(dc, pc);
  await pc.setLocalDescription(await pc.createOffer());
  await waitIce(pc);
  const code = await packSDP(pc.localDescription);
  NET.pending = { pc, conn };
  return code;
}
async function hostAcceptReply(code) {
  if (!NET.pending) throw new Error('No invite open');
  const desc = await unpackSDP(code); if (desc.type !== 'answer') throw new Error('That is an invite code, not a reply code');
  const { pc, conn } = NET.pending; NET.pending = null;
  await pc.setRemoteDescription(desc);
  hostAttach(conn);
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
async function joinFromInvite(code) {
  const desc = await unpackSDP(code); if (desc.type !== 'offer') throw new Error('That is a reply code. Scan the HOST\'s invite.');
  const pc = new RTCPeerConnection({ iceServers: [] });
  const ready = new Promise(res => { pc.ondatachannel = (e) => { const conn = wrapDC(e.channel, pc); NET.hostConn = conn; e.channel.readyState === 'open' ? (conn.open = true, res(conn)) : (conn.onopen = () => res(conn)); }; });
  await pc.setRemoteDescription(desc);
  await pc.setLocalDescription(await pc.createAnswer());
  await waitIce(pc);
  const reply = await packSDP(pc.localDescription);
  return { reply, ready };
}
function joinerStart(conn) {
  NET.role = 'client'; NET.hostConn = conn;
  conn.onmsg = (m) => clientOnMsg(m);
  conn.onclose = () => { if (G.state === 'play' || G.state === 'lobby') showToast('LOST CONNECTION TO HOST'); G.disconnected = true; };
  conn.send({ t: 'hello', name: G.profile.name, color: G.profile.color, cls: G.profile.cls });
}
// ----- ONLINE (internet) short codes via PeerJS cloud -----
function onlineId(code) { return 'emberwake-gld-' + code.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function onlineHost(code) {
  return new Promise((res, rej) => {
    if (!window.peerjs) return rej(new Error('Online library missing'));
    const peer = new peerjs.Peer(onlineId(code), Object.assign({ debug: 0 }, window.EW_PEER_OPTS || {})); NET.peer = peer;
    peer.on('open', () => res(peer));
    peer.on('error', (e) => rej(new Error(e.type === 'unavailable-id' ? 'That code is taken. Try another word.' : e.type === 'network' || e.type === 'server-error' ? 'No internet. Use the QR method instead.' : String(e.type || e))));
    peer.on('connection', (dc) => {
      const conn = new Conn((s) => dc.send(s), () => dc.close());
      dc.on('open', () => { conn.open = true; hostAttach(conn); });
      dc.on('data', (d) => { try { conn.onmsg && conn.onmsg(typeof d === 'string' ? JSON.parse(d) : d); } catch (e) { } });
      dc.on('close', () => { conn.open = false; conn.onclose && conn.onclose(); });
    });
  });
}
function onlineJoin(code) {
  return new Promise((res, rej) => {
    if (!window.peerjs) return rej(new Error('Online library missing'));
    const peer = new peerjs.Peer(Object.assign({ debug: 0 }, window.EW_PEER_OPTS || {})); NET.peer = peer; let done = false;
    peer.on('error', (e) => { if (!done) rej(new Error(e.type === 'peer-unavailable' ? 'No game found with that code.' : e.type === 'network' || e.type === 'server-error' ? 'No internet. Use the QR method instead.' : String(e.type || e))); });
    peer.on('open', () => {
      const dc = peer.connect(onlineId(code), { reliable: true, serialization: 'raw' });
      const conn = new Conn((s) => dc.send(s), () => dc.close());
      dc.on('open', () => { conn.open = true; done = true; res(conn); });
      dc.on('data', (d) => { try { conn.onmsg && conn.onmsg(typeof d === 'string' ? JSON.parse(d) : d); } catch (e) { } });
      dc.on('close', () => { conn.open = false; conn.onclose && conn.onclose(); });
      setTimeout(() => { if (!done) rej(new Error('Timed out. Check the code.')); }, 12000);
    });
  });
}
function netStatus() { NET.onStatus && NET.onStatus(); }

// ----- QR draw & scan -----
function drawQR(canvas, str) {
  const qr = qrcode(0, 'L'); qr.addData(str); qr.make();
  const n = qr.getModuleCount(), m = 3; const size = 220; const cell = Math.max(2, Math.floor(size / (n + m * 2)));
  canvas.width = canvas.height = cell * (n + m * 2); const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) c.fillRect((x + m) * cell, (y + m) * cell, cell, cell);
}
const SCAN = { stream: null, timer: null };
async function startScan(video, onCode) {
  stopScan();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera not available here. Use the text code instead.');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
  SCAN.stream = stream; video.srcObject = stream; video.setAttribute('playsinline', ''); await video.play();
  const cv = document.createElement('canvas'); const ctx = cv.getContext('2d', { willReadFrequently: true });
  SCAN.timer = setInterval(() => {
    if (!video.videoWidth) return; const s = Math.min(1, 800 / video.videoWidth); cv.width = video.videoWidth * s | 0; cv.height = video.videoHeight * s | 0;
    ctx.drawImage(video, 0, 0, cv.width, cv.height); const d = ctx.getImageData(0, 0, cv.width, cv.height);
    const r = jsQR(d.data, cv.width, cv.height, { inversionAttempts: 'dontInvert' });
    if (r && r.data && r.data.startsWith(CODE_PREFIX)) { stopScan(); onCode(r.data); }
  }, 180);
}
function stopScan() { if (SCAN.timer) clearInterval(SCAN.timer); SCAN.timer = null; if (SCAN.stream) SCAN.stream.getTracks().forEach(t => t.stop()); SCAN.stream = null; }
