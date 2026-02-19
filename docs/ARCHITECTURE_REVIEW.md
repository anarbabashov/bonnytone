# Bonny Tone Radio - Architecture Review & Development Plan

**Author:** Senior Architect Review
**Date:** 2026-02-18
**Updated:** 2026-02-18 (v2 -- scope clarification)
**Status:** Ready for Development

---

## 1. Executive Summary

This document reviews the proposed "Architecture for a Web-Radio Application" PDF against the existing Bonny Tone Radio codebase and provides a development-ready plan split into two releases:

- **v1.0.0** -- A bulletproof streaming radio player. No extra features. Focus entirely on architecture, durability, scalability, and a player that outputs quality sound for hours without glitches on any device, even slow internet.
- **v2.0.0** -- User account integration. Favorites, schedule, notifications, DJ subscriptions, listening history, and all personalization features.

### What v1.0.0 IS

A single-page radio player where anyone can:
- Press play and hear music immediately
- Listen for hours without interruption -- desktop or mobile
- Get quality audio even on slow/unstable internet (adaptive bitrate)
- Control playback: play/pause, mute/unmute, volume slider -- all working properly
- Share the station with one tap
- See a "LIVE" indicator and current listener count

### What v1.0.0 is NOT

- No favorites, no schedule page, no profile page
- No database changes beyond what exists
- No new API routes for user-specific features
- No equalizer, no chat, no downloads, no recording
- Authentication exists but is not wired into the player experience

### Current Codebase State

| Component | Status |
|---|---|
| JWT auth (register, login, MFA, token rotation, rate limiting) | **Complete** |
| Glass-morphism UI with dark/light themes | **Complete** |
| Player UI components (play button, volume, action buttons, waveform) | **Visual only -- zero audio** |
| PostgreSQL + Prisma + Redis | **Configured** |
| Zustand store | **Exists, underutilized** |
| Audio streaming, HLS, any sound output | **Not started** |

---

## 2. Key Decisions That Differ from the PDF

| PDF Proposes | This Plan Recommends | Why |
|---|---|---|
| Icecast or Shoutcast | **Liquidsoap direct-to-HLS** (via AzuraCast or standalone) | Icecast doesn't output HLS. Adding it creates unnecessary middleware. |
| howler.js as player option | **Do not use howler.js** | Doesn't understand HLS streams. Maintenance-mode software. Redundant. |
| MP3 + AAC codecs | **AAC-LC primary** | MP3 at equal bitrate sounds worse. AAC-LC has universal browser/device support. |
| Service Worker for audio buffering | **Service Worker for app shell only** | HLS.js already handles buffer management. SW audio caching adds complexity with zero benefit for live streams. |
| Microservices + Kafka/RabbitMQ | **Monolith-first (Next.js API routes)** | Already have a working Next.js backend. Microservices for a radio app is over-engineering. |
| Elasticsearch for content catalog | **PostgreSQL full-text search** (v2.0.0) | Already have Postgres. Its `tsvector` handles radio metadata perfectly. Not needed in v1. |
| CQRS pattern | **Standard queries** | A radio app's read/write ratio doesn't justify CQRS complexity. |
| WebRTC for low-latency | **Low-Latency HLS only** | WebRTC doesn't scale for broadcast. LL-HLS gives sub-2s latency. |

---

## 3. v1.0.0 Architecture

### High-Level Flow

```
[Audio Source]              [Streaming Infrastructure]            [Client Browser]

DJ Software (OBS/BUTT)     Liquidsoap                            CDN / Nginx
   or                        - auto-DJ fallback                    (CORS headers,
Automated Playlists          - crossfade                           edge caching)
   or                        - HLS segment packaging                    |
Pre-recorded Mixes           - multi-bitrate encoding                   v
        |                         |                               HLS.js
        +--------> input -------->+                               (Chrome, Firefox, Edge)
                                  |                                    or
                          HLS output (.m3u8 + .ts)                Native HLS
                                  |                               (Safari, iOS)
                                  v                                    |
                          Nginx serves segments                        v
                                  |                               <audio> element
                                  v                                    |
                          CDN caches at edge                           v
                                                              AudioContext
                                                                (volume control,
                                                                 visualization)
                                                                       |
                                                                       v
                                                                   Speakers
```

### System Components (v1.0.0 only)

```
+-------------------------------------------------------------------+
|                        NEXT.JS APPLICATION                        |
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  |   Pages          |  |   API Routes     |  |   Existing DB    | |
|  |                  |  |                  |  |                  | |
|  | - / (radio)      |  | - /auth/*  [DONE]|  | - User     [DONE]| |
|  | - /auth/* [DONE] |  | - /stream/status |  | - Session  [DONE]| |
|  |                  |  | - /stream/config |  |                  | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  |   Zustand Store  |  |   Audio Engine   |  |   HLS.js         | |
|  |                  |  |   (Web Audio)    |  |   Integration    | |
|  | - isPlaying      |  | - AnalyserNode   |  | - ABR switching  | |
|  | - isBuffering    |  |   (visualization)|  | - Buffer mgmt    | |
|  | - volume/mute    |  | - GainNode       |  | - Error recovery | |
|  | - streamStatus   |  |   (volume)       |  | - Safari detect  | |
|  | - quality        |  |                  |  |                  | |
|  +------------------+  +------------------+  +------------------+ |
+-------------------------------------------------------------------+
                                    |
                                    v
                      +------------------------+
                      |   Streaming Server     |
                      |   (AzuraCast / Liquid- |
                      |    soap + Nginx)       |
                      |                        |
                      |   -> HLS segments      |
                      |   -> served via Nginx  |
                      |   -> cached on CDN     |
                      +------------------------+
```

**What's intentionally absent from v1.0.0:** No Track model, no Favorite model, no Schedule model, no ListenHistory, no new Prisma migrations, no user-facing API routes beyond stream config/status. The existing auth system stays as-is -- it works, it's tested, it doesn't need changes.

---

## 4. Critical Path: Glitch-Free Playback on Slow Internet

This is the #1 requirement of v1.0.0. Every decision serves this goal.

### Why Streams Glitch (and how to prevent each cause)

| Cause | Symptom | Solution |
|---|---|---|
| Fixed bitrate exceeds bandwidth | Buffering stalls, silence gaps | **Adaptive Bitrate Streaming** -- HLS with 3 quality tiers. HLS.js auto-downgrades. |
| Insufficient buffer before playback | Audio starts then immediately stalls | **Configure HLS.js buffer**: `maxBufferLength: 30`, `liveSyncDurationCount: 3` |
| Network blip drops a segment | Momentary silence, player error | **HLS.js auto-retry** with exponential backoff. `fragLoadingMaxRetry: 6` |
| Browser tab throttling | Background playback stutters | **`navigator.mediaSession` API** to register as media player. Audio element keeps playback alive. |
| CDN cache miss on live segment | Slow first-byte time | **Segment duration: 4s**. CDN TTL matches segment duration. Origin shield enabled. |
| Audio element garbage collection | Playback stops randomly on mobile | **Single persistent `<audio>` element**, never destroy/recreate it. |
| Codec decode error | Click/pop or silence | **AAC-LC** (universal decode support). No exotic codecs. |
| AudioContext suspension on mobile | Tap to play doesn't work | **Resume AudioContext on user gesture**. iOS requires explicit `audioContext.resume()`. |
| Mobile screen lock kills audio | Music stops when phone locks | **`navigator.mediaSession`** with metadata (title, artwork) to show lock screen controls. |

### HLS.js Configuration for Reliability

```typescript
// Optimized for radio: reliability over low-latency
const hlsConfig = {
  // Buffer settings -- generous for slow connections
  maxBufferLength: 30,              // Buffer up to 30s ahead
  maxMaxBufferLength: 60,           // Allow up to 60s on fast connections
  maxBufferSize: 10 * 1024 * 1024,  // 10MB max buffer size
  maxBufferHole: 0.5,               // Tolerate 0.5s gaps before seeking

  // Live stream settings
  liveSyncDurationCount: 3,         // Stay 3 segments behind live edge
  liveMaxLatencyDurationCount: 6,   // Max 6 segments behind before seeking
  liveDurationInfinity: true,       // Treat as infinite live stream

  // Retry settings -- aggressive for reliability
  fragLoadingMaxRetry: 6,           // Retry failed segment loads 6 times
  fragLoadingRetryDelay: 1000,      // 1s between retries
  fragLoadingMaxRetryTimeout: 8000, // Max 8s retry delay
  manifestLoadingMaxRetry: 4,       // Retry manifest loads
  levelLoadingMaxRetry: 4,          // Retry level loads

  // ABR settings
  abrEwmaDefaultEstimate: 500000,   // Start at 500kbps estimate
  abrBandWidthUpFactor: 0.7,        // Conservative upswitch
  abrBandWidthFactor: 0.95,         // Quick downswitch on bandwidth drop
  startLevel: 0,                     // Start at lowest quality, upgrade fast

  // Back buffer
  backBufferLength: 30,             // Keep 30s of past audio
}
```

### Bitrate Ladder

| Tier | Codec | Bitrate | Sample Rate | Use Case |
|---|---|---|---|---|
| Low | AAC-LC | 48 kbps | 44.1 kHz | Very slow connections (2G, poor WiFi) |
| Medium | AAC-LC | 128 kbps | 44.1 kHz | Standard listening (default start) |
| High | AAC-LC | 256 kbps | 44.1 kHz | High quality on fast connections |

**Why AAC-LC:** Decoded natively by every browser and OS. Safari plays HLS with AAC natively without HLS.js. Widest possible compatibility including older iPhones, Android WebViews, and embedded browsers. Opus can be added as an optional tier in v2.0.0 for modern browsers.

---

## 5. What Already Exists (Do Not Rebuild)

### Authentication (Complete -- untouched in v1.0.0)
- Full registration/login/logout flow with MFA
- JWT access + refresh tokens with rotation
- Rate limiting, CSRF, Argon2id hashing
- Auth middleware guards, audit logging, metrics
- Auth pages (login, register, verify-email, forgot/reset password)

### UI Foundation (Complete -- wire to audio in v1.0.0)
- Glass-morphism design system (`.glass`, `.glass-subtle`)
- Dark/light theme with `next-themes`
- `GlassPlayButton` -- needs audio connection
- `VolumeSlider` -- needs audio connection
- `ActionButtons` (mute, share, more) -- need audio + share connection
- `Waveform` canvas animation -- connect to AnalyserNode
- `AuthButtons` component -- works as-is

### Infrastructure (Complete)
- PostgreSQL + Prisma ORM
- Redis for sessions and rate limiting
- Zustand store (expand for player state)
- Jest + Playwright test setup

---

## 6. v1.0.0 -- Frontend Audio Engine

### Core Hook: `useRadioPlayer`

This is the single most important piece of code in v1.0.0. It manages the entire audio pipeline.

**Responsibilities:**
1. Initialize HLS.js and attach to persistent `<audio>` element
2. Detect Safari and use native HLS fallback
3. Handle adaptive bitrate quality switching
4. Connect Web Audio API for visualization and volume
5. Manage play/pause/volume/mute state via Zustand
6. Handle all errors with auto-recovery (no user intervention needed)
7. Register with `navigator.mediaSession` for mobile lock-screen controls
8. Expose AnalyserNode frequency data for waveform visualization

**Key Design Decisions:**
- Single `<audio>` element created once, never destroyed
- `AudioContext` created on first user gesture (browser requirement)
- HLS.js instance persists across the component lifecycle
- CORS `crossOrigin="anonymous"` set before any source loads
- All state flows through Zustand -- components are pure subscribers

### Safari Handling

```
if (audio.canPlayType('application/vnd.apple.mpegurl')) {
  // Safari/iOS: set src directly to .m3u8 URL (native HLS)
  audio.src = streamUrl
} else if (Hls.isSupported()) {
  // Chrome/Firefox/Edge: use HLS.js via MSE
  hls = new Hls(hlsConfig)
  hls.loadSource(streamUrl)
  hls.attachMedia(audio)
}
```

### Web Audio API Graph (v1.0.0 -- simplified, no EQ)

```
          <audio> element
                |
    createMediaElementSource()
                |
    MediaElementSourceNode
                |
        +-------+-------+
        |               |
   AnalyserNode    GainNode (master volume)
   (waveform data)      |
                   AudioContext.destination
                       (speakers)
```

**v1.0.0 intentionally omits EQ (BiquadFilterNode chain).** The audio graph is kept minimal: source -> analyser (for waveform) + gain (for volume) -> output. This reduces the surface area for bugs. EQ is added in v2.0.0 as a registered-user feature.

### Zustand Store (v1.0.0 scope)

```
PlayerStore {
  // Playback state
  isPlaying: boolean
  isBuffering: boolean
  volume: number              // 0-1
  isMuted: boolean
  quality: 'auto' | 'low' | 'medium' | 'high'

  // Stream status
  streamStatus: 'connecting' | 'live' | 'offline' | 'error'
  listenerCount: number | null

  // Error state
  errorCount: number
  lastError: string | null

  // Actions
  play: () => void
  pause: () => void
  togglePlay: () => void
  setVolume: (v: number) => void
  toggleMute: () => void
  setQuality: (q: Quality) => void
}
```

**What's NOT in the v1.0.0 store:** currentTrack metadata, favorites, user preferences, EQ settings, schedule data. All of those are v2.0.0.

### Waveform Visualization

Upgrade existing `Waveform.tsx` to optionally react to real audio:

- **Before AudioContext is created** (page load, before first play): current mathematical halftone animation runs as-is
- **After first play** (AudioContext active): `AnalyserNode.getByteFrequencyData()` drives the dot sizes, making the visualization react to actual music
- Smooth crossfade transition between the two modes
- Safari fallback: if AnalyserNode returns zeros (known Safari issue with native HLS), keep using the mathematical animation

### Mobile Lock-Screen Controls

```typescript
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Bonny Tone Radio',
    artist: 'Live Stream',
    artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }]
  })
  navigator.mediaSession.setActionHandler('play', () => store.play())
  navigator.mediaSession.setActionHandler('pause', () => store.pause())
}
```

This prevents mobile browsers from killing background audio and shows play/pause controls on the lock screen.

### Share Button Implementation

Use Web Share API with clipboard fallback:

```typescript
async function handleShare() {
  const shareData = {
    title: 'Bonny Tone Radio',
    text: 'Listen to Bonny Tone Radio',
    url: window.location.origin,
  }

  if (navigator.canShare?.(shareData)) {
    await navigator.share(shareData)
  } else {
    await navigator.clipboard.writeText(window.location.origin)
    // Show "Link copied!" toast
  }
}
```

---

## 7. v1.0.0 -- Streaming Server Setup

### Recommended: AzuraCast (Docker)

AzuraCast bundles Liquidsoap + Icecast + Nginx + HLS in a single Docker deployment:
- Web UI for station management
- Auto-DJ with playlist scheduling and crossfade
- Live DJ input (via BUTT, OBS, or browser)
- HLS output with multiple quality tiers
- Listener count API (used by v1.0.0 for the counter)
- Now-playing metadata API (used by v1.0.0 for display, v2.0.0 for full track catalog)

**Deployment:**
```bash
docker compose up -d
```

**HLS Configuration:**
- Segment duration: 4 seconds
- Playlist depth: 5 segments (20s of buffer available)
- Renditions: 48kbps / 128kbps / 256kbps AAC-LC
- Master playlist with adaptive bitrate

### Alternative: Standalone Liquidsoap + Nginx

```
Audio Sources ──> Liquidsoap ──> output.file.hls() ──> /var/hls/
                                                            |
                                                      Nginx serves
                                                            |
                                                      CDN caches
```

Output:
- `stream.m3u8` (master playlist)
- `stream_0.m3u8`, `stream_1.m3u8`, `stream_2.m3u8` (per-quality)
- `segment_*.ts` (4-second audio segments)

### CORS Configuration (Critical)

Without CORS, Web Audio API receives silence and HLS.js may fail to load segments.

```nginx
location /hls/ {
    alias /var/hls/;
    types {
        application/vnd.apple.mpegurl m3u8;
        video/mp2t ts;
    }
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
    add_header Access-Control-Allow-Headers "Range";
    add_header Cache-Control "no-cache";
}
```

---

## 8. v1.0.0 -- API Routes (Minimal)

Only two new endpoints. Everything else uses the existing auth routes or the streaming server's own API.

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/stream/config` | Public | Returns HLS manifest URL, available quality tiers, stream name |
| GET | `/api/stream/status` | Public | Returns stream online/offline status, listener count (proxied from AzuraCast, cached in Redis for 10s) |

That's it. Two routes. The now-playing track info can be fetched directly from AzuraCast's public API by the client, or proxied through `/api/stream/status` as part of the response.

---

## 9. v1.0.0 -- New Dependencies

```json
{
  "dependencies": {
    "hls.js": "^1.5.x"
  }
}
```

**One new dependency.** HLS.js + native Web Audio API + native `<audio>` element cover everything for v1.0.0.

---

## 10. v1.0.0 -- Development Plan

### Phase 1: Streaming Server (Week 1)
**Goal:** HLS stream is live and accessible from a browser URL.

| # | Task | Acceptance Criteria |
|---|---|---|
| 1.1 | Deploy AzuraCast (Docker) or Liquidsoap + Nginx | Stream accessible at `https://<domain>/hls/stream.m3u8` |
| 1.2 | Configure 3 bitrate tiers (48/128/256 kbps AAC-LC) | Master playlist lists 3 renditions |
| 1.3 | Upload test audio / configure auto-DJ playlists | Music plays continuously, crossfade between tracks |
| 1.4 | Configure CORS headers on Nginx | `curl -I` shows `Access-Control-Allow-Origin: *` |
| 1.5 | Verify HLS playback in raw `<video>` tag | Audio plays in Chrome, Firefox, Safari by pasting URL |

### Phase 2: Audio Engine (Week 1-2)
**Goal:** `useRadioPlayer` hook works -- audio plays through the existing UI.

| # | Task | Acceptance Criteria |
|---|---|---|
| 2.1 | `npm install hls.js` | Package installed, TypeScript types available |
| 2.2 | Create `hooks/useRadioPlayer.ts` | Hook initializes HLS.js, attaches to `<audio>`, handles Safari native fallback |
| 2.3 | Create `PlayerStore` in Zustand | `isPlaying`, `isBuffering`, `volume`, `isMuted`, `quality`, `streamStatus`, `listenerCount`, error state, actions |
| 2.4 | Wire `GlassPlayButton` to `store.togglePlay()` | Clicking play button starts/stops real audio |
| 2.5 | Wire `VolumeSlider` to `store.setVolume()` | Dragging slider changes real audio volume |
| 2.6 | Wire mute button in `ActionButtons` to `store.toggleMute()` | Mute/unmute toggles real audio |
| 2.7 | Implement HLS.js error recovery | Auto-retry on network errors, quality downgrade on decode errors, no user action needed |
| 2.8 | Implement ABR quality switching | HLS.js auto-switches based on bandwidth. Manual override via "More" menu (Auto/Low/Medium/High) |

### Phase 3: Mobile & Cross-Device (Week 2-3)
**Goal:** Audio works perfectly on phones, tablets, desktops. Hours-long sessions are stable.

| # | Task | Acceptance Criteria |
|---|---|---|
| 3.1 | `navigator.mediaSession` integration | Lock-screen controls show Bonny Tone with play/pause. Background playback survives screen lock. |
| 3.2 | AudioContext resume on user gesture | First tap on play button resumes suspended AudioContext on iOS/Safari |
| 3.3 | Test on iOS Safari | Play, pause, volume, mute all work. Audio survives screen lock. No crashes after 1+ hour. |
| 3.4 | Test on Android Chrome | Same as above. |
| 3.5 | Test on desktop Chrome, Firefox, Safari, Edge | All controls work. ABR switches correctly. |
| 3.6 | Network resilience testing | Use Chrome DevTools throttling (3G, offline). Verify: no crashes, graceful buffering indicator, auto-recovery when network returns. |
| 3.7 | Long session testing | Leave playing for 4+ hours on desktop and mobile. No memory leak, no audio drift, no crashes. |
| 3.8 | `backBufferLength` tuning | Set to 30s. Verify memory stays stable over hours (monitor via DevTools Performance tab). |

### Phase 4: UI Polish & Status (Week 3)
**Goal:** Player communicates state clearly. Share works. Listener count visible.

| # | Task | Acceptance Criteria |
|---|---|---|
| 4.1 | Stream status indicator | "LIVE" badge when streaming, "Connecting..." during buffer, "Offline" when stream is down |
| 4.2 | Buffering state in UI | Play button shows loading spinner while `isBuffering === true` |
| 4.3 | Upgrade `Waveform.tsx` | Waveform reacts to real audio via AnalyserNode. Falls back to math animation before first play or on Safari. |
| 4.4 | Share button | Web Share API with clipboard fallback. Toast "Link copied!" on desktop. |
| 4.5 | Listener count display | Small counter in top bar. Polls `/api/stream/status` every 30s. |
| 4.6 | Quality indicator | Small text showing current quality (e.g., "128kbps") near volume slider or in "More" menu |
| 4.7 | Now-playing display (basic) | Show current track title/artist from AzuraCast metadata. Below play button, animated text transition. |

### Phase 5: Production Hardening (Week 4)
**Goal:** Deployed, monitored, reliable.

| # | Task | Acceptance Criteria |
|---|---|---|
| 5.1 | `/api/stream/config` endpoint | Returns stream URL, quality tiers. Client uses this instead of hardcoded URL. |
| 5.2 | `/api/stream/status` endpoint | Proxies AzuraCast status + listener count. Cached in Redis (10s TTL). |
| 5.3 | CDN setup | CloudFront or Cloudflare in front of HLS segments. CORS configured. Cache-Control headers correct. |
| 5.4 | PWA manifest + Service Worker | App shell cached for instant load. Web app manifest for "Add to Home Screen". NOT caching audio. |
| 5.5 | Stream health monitoring | Extend `/api/monitoring/health` to check: can we fetch the HLS manifest? |
| 5.6 | Error tracking | Client-side HLS.js errors reported to Sentry or equivalent. |
| 5.7 | Performance audit | Lighthouse audit. Canvas animation optimized for mobile (larger grid on small screens). |
| 5.8 | Deployment | Docker Compose for streaming server. Vercel (or Docker) for Next.js app. CI/CD pipeline. |
| 5.9 | Smoke test suite | Playwright tests: page loads, play button works, audio element has `src`, no console errors. |

---

## 11. v1.0.0 -- Technical Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CORS misconfiguration on streaming server | **High** | Web Audio gets silence, HLS.js fails | Test CORS first thing (Phase 1.4). Smoke test in CI. |
| Safari Web Audio + native HLS issues | Medium | Visualization broken on Safari | Feature-detect. Fall back to mathematical animation. Audio still plays fine. |
| Mobile browser kills background audio | Medium | Music stops on screen lock | `navigator.mediaSession` with metadata. Test on real devices (Phase 3). |
| Streaming server goes offline | Medium | Complete silence | Liquidsoap fallback chain: live DJ -> playlist -> emergency loop. Health monitoring (Phase 5.5). |
| HLS.js memory leak on long sessions | Low | Tab crash after hours | `backBufferLength: 30` limits past buffer. Long-session testing (Phase 3.7). |
| AudioContext suspension on iOS | **High** | Tap to play does nothing | Resume AudioContext inside click handler. Test on real iOS device. |

---

## 12. v2.0.0 -- Scope (Build After v1.0.0 Ships)

Everything below is deferred to v2.0.0. None of this blocks v1.0.0.

### Database Schema Extensions (v2.0.0)

```prisma
model Track {
  id          String   @id @default(cuid())
  title       String
  artist      String
  album       String?
  genre       String?
  duration    Int?
  coverUrl    String?
  playedAt    DateTime?
  createdAt   DateTime @default(now())
  favorites   Favorite[]
  history     ListenHistory[]
  @@index([artist])
  @@index([playedAt])
}

model Favorite {
  id        String   @id @default(cuid())
  userId    String
  trackId   String
  createdAt DateTime @default(now())
  user      User     @relation(...)
  track     Track    @relation(...)
  @@unique([userId, trackId])
}

model Schedule {
  id          String   @id @default(cuid())
  title       String
  djName      String?
  description String?
  startTime   DateTime
  endTime     DateTime
  isRecurring Boolean  @default(false)
  recurrence  String?
  reminders   Reminder[]
  @@index([startTime])
}

model Reminder {
  id         String   @id @default(cuid())
  userId     String
  scheduleId String
  notifyAt   DateTime
  sent       Boolean  @default(false)
  user       User     @relation(...)
  schedule   Schedule @relation(...)
  @@unique([userId, scheduleId])
}

model ListenHistory {
  id        String   @id @default(cuid())
  userId    String?
  trackId   String
  startedAt DateTime @default(now())
  duration  Int?
  user      User?    @relation(...)
  track     Track    @relation(...)
}
```

### v2.0.0 Features (Prioritized)

| Priority | Feature | Description |
|---|---|---|
| P0 | Track catalog & history | Full track model, recently played list, search |
| P0 | Favorites | Heart button on current track, favorites page |
| P0 | Schedule page | Upcoming shows/DJ sets with times |
| P1 | Reminders | "Remind me" on schedule items, push notifications |
| P1 | DJ/Mix subscriptions | Subscribe to a DJ, get notified when they go live |
| P1 | User profile page | Display name, listening stats, favorite count |
| P1 | Equalizer | 5-band EQ via BiquadFilterNode, presets, saved per-user |
| P2 | Listening history | Personal history of what you listened to |
| P2 | Real-time chat | WebSocket chat for registered listeners |
| P2 | Listener count breakdown | Show who's listening (registered users) |
| P3 | Downloads | Pre-signed URL downloads for select tracks |

### v2.0.0 New API Routes

```
GET    /api/tracks/recent        -- Recently played tracks
GET    /api/tracks/search?q=     -- Search tracks
GET    /api/favorites            -- User's favorites
POST   /api/favorites            -- Add favorite
DELETE /api/favorites/:trackId   -- Remove favorite
GET    /api/schedule             -- Upcoming shows
POST   /api/schedule/remind      -- Set reminder
DELETE /api/schedule/remind/:id  -- Remove reminder
GET    /api/profile              -- User profile + stats
PATCH  /api/profile              -- Update profile
GET    /api/history              -- Listening history
```

### v2.0.0 Additional Dependencies

```json
{
  "socket.io-client": "^4.x",   // Real-time chat
  "bullmq": "^5.x"              // Background jobs (reminders, notifications)
}
```

---

## 13. Review of PDF Proposal (Final Assessment)

### KEEP for v1.0.0

1. **HLS as primary protocol** -- Correct. Best balance of compatibility and adaptive quality.
2. **AAC at multiple bitrates (48/128/256)** -- Industry standard bitrate ladder.
3. **CDN for segment delivery** -- Essential for scale and reliability.
4. **Web Share API for sharing** -- Simple, native, works.

### DEFER to v2.0.0

1. **Web Audio API equalizer** -- Feasible but not core. v2.0.0 feature for registered users.
2. **Pre-signed URLs for downloads** -- Good approach when download feature is built.
3. **Listener count display** -- Include a basic version in v1.0.0 (just the number), full UI in v2.0.0.
4. **Real-time chat** -- v2.0.0 feature. Socket.io + Redis adapter.
5. **Push notifications** -- v2.0.0 after schedule feature.

### REJECT (Over-Engineered or Wrong)

1. **howler.js** -- Doesn't support HLS. Redundant. Don't use.
2. **Microservices / Kafka / RabbitMQ** -- Over-engineering. Keep the monolith.
3. **Elasticsearch** -- Postgres full-text search is sufficient.
4. **CQRS** -- Unjustified complexity for this workload.
5. **WebRTC** -- Doesn't scale for broadcast. LL-HLS is enough.
6. **Service Worker for audio buffering** -- HLS.js handles this. SW is for app shell only.
7. **MediaRecorder for client recording** -- Legal risk, inconsistent browser support.

---

## 14. v1.0.0 Summary Checklist

When all of these are true, v1.0.0 is done:

- [ ] HLS stream is live with 3 quality tiers (48/128/256 kbps AAC-LC)
- [ ] `useRadioPlayer` hook manages full audio lifecycle
- [ ] Play/Pause button starts and stops real audio
- [ ] Volume slider controls real audio volume
- [ ] Mute button mutes and unmutes real audio
- [ ] Share button shares the station URL (Web Share API + clipboard fallback)
- [ ] Quality auto-switches on bandwidth changes (HLS.js ABR)
- [ ] Audio survives for 4+ hours without glitches on desktop
- [ ] Audio survives for 4+ hours without glitches on mobile
- [ ] Audio plays on slow 3G without constant buffering (downgrades to 48kbps)
- [ ] Background playback works on iOS and Android (screen lock)
- [ ] Lock screen shows Bonny Tone with play/pause controls
- [ ] "LIVE" / "Connecting..." / "Offline" status indicator works
- [ ] Waveform reacts to real audio (with math-animation fallback)
- [ ] Listener count displays in UI
- [ ] Now-playing track info shows (title/artist from streaming server)
- [ ] No console errors in production
- [ ] CDN serves HLS segments with correct CORS headers
- [ ] PWA installable ("Add to Home Screen")
- [ ] Monitoring: stream health check in `/api/monitoring/health`
- [ ] Works on: Chrome, Firefox, Safari, Edge, iOS Safari, Android Chrome
