/**
 * Presence — Signaling Server
 * Minimal WebSocket relay. No state, no storage.
 * Each room holds at most 2 peers.
 *
 * Deploy:
 *   npm install ws
 *   node server.js
 *
 * With TLS (required for HTTPS client):
 *   Use nginx/Caddy reverse proxy with SSL termination,
 *   or pass --cert / --key flags and use https.createServer.
 */

const { WebSocketServer } = require('ws');
const https  = require('http');

const PORT  = process.env.PORT || 8080;

// rooms: Map<roomId, Set<WebSocket>>
const rooms = new Map();

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('presence signaling');
});

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  let roomId  = null;
  let role    = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); }
    catch { return; }

    // ── Join room ──────────────────────────────────────────
    if (msg.type === 'join') {
      roomId = msg.room;
      role   = msg.role;

      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(ws);

      console.log(`[${roomId}] ${role} joined (${rooms.get(roomId).size} peers)`);

      // Tell existing peer(s) that someone joined
      broadcast(roomId, { type: 'peer-joined', role }, ws);
      return;
    }

    // ── Relay everything else to room peers ────────────────
    if (roomId) {
      broadcast(roomId, msg, ws);
    }
  });

  ws.on('close', () => {
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).delete(ws);
      console.log(`[${roomId}] peer left (${rooms.get(roomId).size} remaining)`);
      broadcast(roomId, { type: 'peer-left' }, ws);
      if (rooms.get(roomId).size === 0) rooms.delete(roomId);
    }
  });

  ws.on('error', () => ws.close());
});

function broadcast(roomId, msg, exclude) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(msg);
  for (const peer of room) {
    if (peer !== exclude && peer.readyState === 1 /* OPEN */) {
      peer.send(data);
    }
  }
}

server.listen(PORT, () => {
  console.log(`Presence signaling server running on ws://localhost:${PORT}`);
});
