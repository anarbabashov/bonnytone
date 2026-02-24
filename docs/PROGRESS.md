# BTRadio DJ v1.0.0 -- Development Progress

**Branch:** `feature/music-player`, `feature/production-hardening`
**Started:** 2026-02-18

---

## Development Workflow

1. Implement feature + unit tests
2. Verify functionality is error/bug-free
3. Propose commit message and STOP
4. Wait for manual code review by developer
5. Developer commits after review
6. Update this file with results
7. Proceed to next feature

---

## Phase 1: Streaming Server

| # | Task | Status | Commit |
|---|---|---|---|
| 1.1 | Deploy AzuraCast or Liquidsoap + Nginx | Done | local Docker |
| 1.2 | Configure 3 bitrate tiers (48/128/256 kbps AAC-LC) | Deferred | -- |
| 1.3 | Auto-DJ playlists with crossfade | Done | AzuraCast default |
| 1.4 | CORS headers on Nginx | Done | AzuraCast default |
| 1.5 | Verify HLS playback in browser | Done | ff45a79 |

## Phase 2: Audio Engine

| # | Task | Status | Commit |
|---|---|---|---|
| 2.1 | Install hls.js | Done | ff45a79 |
| 2.2 | Create `useRadioPlayer` hook | Done | ff45a79 |
| 2.3 | Create PlayerStore (Zustand) | Done | ff45a79 |
| 2.4 | Wire GlassPlayButton to real audio | Done | ff45a79 |
| 2.5 | Wire VolumeSlider to real audio | Done | ff45a79 |
| 2.6 | Wire mute button to real audio | Done | ff45a79 |
| 2.7 | HLS.js error recovery | Done | ff45a79 |
| 2.8 | ABR quality switching | Done | ff45a79 |

## Phase 3: Mobile & Cross-Device

| # | Task | Status | Commit |
|---|---|---|---|
| 3.1 | navigator.mediaSession integration | Done | ff45a79 |
| 3.2 | AudioContext resume on user gesture | Done | ff45a79 |
| 3.3 | iOS Safari testing | Pending | -- |
| 3.4 | Android Chrome testing | Pending | -- |
| 3.5 | Desktop browsers testing | Pending | -- |
| 3.6 | Network resilience testing (3G, offline) | Pending | -- |
| 3.7 | Long session testing (4+ hours) | Pending | -- |
| 3.8 | backBufferLength tuning | Pending | -- |

## Phase 4: UI Polish & Status

| # | Task | Status | Commit |
|---|---|---|---|
| 4.1 | Stream status indicator (LIVE/Connecting/Offline) | Done | 6c2c71f |
| 4.2 | Buffering state in play button | Done | 6c2c71f |
| 4.3 | Upgrade Waveform.tsx to AnalyserNode | Done | ff45a79 |
| 4.4 | Share button (Web Share API + clipboard) | Done | ff45a79 |
| 4.5 | Listener count display | Done | 30c95c4 |
| 4.6 | Quality indicator | Skipped | auto only |
| 4.7 | Now-playing display (title/artist) | Done | 30c95c4 |
| 4.8 | Rebrand to BTRadio DJ + logo icon | Done | c603c2f |
| 4.9 | Dynamic tab title + favicon (stream status) | Done | c603c2f |
| 4.10 | Next.js HLS rewrite proxy (CORS fix) | Done | c603c2f |
| 4.11 | useNowPlaying sets stream status on page load | Done | c603c2f |

## Phase 5: Production Deployment

| # | Task | Status | Commit |
|---|---|---|---|
| 5.1 | Dockerfile (multi-stage standalone build) | Done | pending |
| 5.2 | docker-compose.prod.yml (Next.js + AzuraCast + Nginx + Certbot) | Done | pending |
| 5.3 | Nginx config (SSL, HLS proxy, caching, security headers) | Done | pending |
| 5.4 | next.config.js standalone output + merge mjs | Done | pending |
| 5.5 | Hide auth UI for initial launch | Done | pending |
| 5.6 | .env.production.example template | Done | pending |
| 5.7 | Provision VPS (OVHcloud VPS-1, 4vCPU/8GB) | Done | -- |
| 5.8 | VPS setup: Docker, clone repo, env config | Pending | -- |
| 5.9 | DNS: point domain A records to VPS | Pending | -- |
| 5.10 | SSL: Let's Encrypt cert via Certbot | Pending | -- |
| 5.11 | Deploy: docker compose up | Pending | -- |
| 5.12 | AzuraCast: create station, enable HLS, upload music | Pending | -- |
| 5.13 | Verify: stream plays, tab status works, share works | Pending | -- |

## Phase 6: Post-Launch (Future)

| # | Task | Status | Commit |
|---|---|---|---|
| 6.1 | PWA manifest + Service Worker | Pending | -- |
| 6.2 | Error tracking (Sentry) | Pending | -- |
| 6.3 | Performance audit (Lighthouse) | Pending | -- |
| 6.4 | CDN for static assets | Pending | -- |
| 6.5 | Stream health monitoring | Pending | -- |
| 6.6 | Smoke test suite (Playwright) | Pending | -- |
| 6.7 | Re-enable auth + user accounts | Pending | -- |
| 6.8 | Phase 3 cross-device testing | Pending | -- |

---

## Commit Log

| Date | Commit | Scope | Notes |
|---|---|---|---|
| 2026-02-18 | ff45a79 | Phase 2 (Audio Engine) | hls.js, useRadioPlayer hook, PlayerStore (Zustand), Waveform AnalyserNode, mediaSession, share button, 21 unit tests |
| 2026-02-19 | 6c2c71f | Phase 4 (UI Polish) | StreamStatus component, GlassPlayButton buffering spinner, jest jsdom + lucide-react resolver, 16 component tests |
| 2026-02-19 | 30c95c4 | Phase 4 (UI Polish) | NowPlayingBar, useNowPlaying hook (AzuraCast API polling), listener count, store nowPlaying state, 9 new tests |
| 2026-02-19 | c603c2f | Phase 4 (UI Polish) | Rebrand to BTRadio DJ, dynamic tab title + colored favicon, logo icon, CORS proxy, stream status on page load, disable play when offline, hydration fix |
| 2026-02-20 | pending | Phase 5 (Deployment) | Dockerfile, docker-compose.prod.yml, Nginx config, standalone build, hide auth, .env template |
