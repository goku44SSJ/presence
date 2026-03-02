# Presence

> A persistent emotional state machine with media transport.

## Architecture

```
MediaStream
  └─► hidden <video>
        └─► <canvas>  (visible, single source of truth)
              └─► IndexedDB  (last frame, persists tab-reload)
```

Canvas never clears. If video dies, the last frame holds.
No flicker. No black screen. Just continuity.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Full PWA client |
| `server.js` | Minimal WebSocket signaling relay |
| `manifest.json` | PWA install manifest |
| `sw.js` | Service worker (offline shell caching) |

---

## Deploy

### 1. Signaling Server

```bash
npm install ws
node server.js
# → ws://localhost:8080
```

For production, put it behind nginx/Caddy with TLS:
```nginx
location /signal {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### 2. TURN Server (coturn)

Minimum `turnserver.conf` for bad NATs:
```
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=presence:your-secret
realm=your-domain.com
# Force TCP fallback
no-udp-relay
```

### 3. Client

Serve `index.html` over HTTPS (required for camera, Wake Lock, service worker).

```bash
# Quick local test with mkcert
mkcert -install && mkcert localhost
npx serve . --ssl-cert localhost.pem --ssl-key localhost-key.pem
```

---

## Usage

1. Open on **both** devices.
2. Device A: role = **Send**, enter room name → Begin
3. Device B: role = **Receive**, same room name → Begin
4. WebRTC negotiates via TURN. Canvas shows the stream.

When ISP drops:
- Canvas holds last frame.
- Soft overlay fades in: *"Reconnecting… I'm here."*
- ICE restart retries every 4 seconds. Forever.
- When connection returns, overlay fades out. Zero user action.

---

## What survives

| Event | Survives? |
|-------|-----------|
| ISP hiccup | ✅ ICE restart |
| Tab backgrounded | ✅ Wake Lock + SW |
| Network switch (WiFi→4G) | ✅ ICE restart |
| Page reload | ✅ Last frame from IndexedDB |
| Device sleep | ✅ Wake Lock (when active) |
| Power cut / browser closed | ❌ Nothing survives that |

---

## Design Philosophy

No red. No error tones. No spinners.
Static text is calmer than spinning icons.
Spinning = *something is wrong.*
Static = *waiting calmly.*
