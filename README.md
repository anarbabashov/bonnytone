# BonnyTone Radio

Online radio platform streaming Miami club & house music 24/7. Built with Next.js, HLS.js, and AzuraCast.

**Live at [bonnytone.com](https://bonnytone.com)**

## Stack

- **Framework:** Next.js 13 (App Router, TypeScript, standalone output)
- **Streaming:** HLS.js + AzuraCast (Auto-DJ, HLS delivery)
- **State:** Zustand (player store)
- **UI:** Tailwind CSS, shadcn/ui, Radix UI, Lucide icons
- **Auth:** JWT (access + refresh token rotation), Argon2id, TOTP MFA
- **Database:** PostgreSQL + Prisma ORM
- **Infra:** Docker Compose (Next.js + AzuraCast + Nginx + Certbot)

## Features

- Full-screen radio player with real-time canvas waveform visualization (Web Audio API `AnalyserNode`)
- Glass-morphism UI with dark/light theme support
- HLS adaptive streaming with automatic reconnection (exponential backoff)
- Safari native HLS fallback
- Persistent mini-player bottom bar on non-homepage routes
- Now-playing metadata polling from AzuraCast API
- Media Session API integration (OS-level play/pause controls)
- User accounts with email verification, password reset, email change
- TOTP-based two-factor authentication
- Rate limiting with escalating login backoff (Redis in production)
- Refresh token rotation with reuse detection

## Project Structure

```
app/
  page.tsx              # Full-screen radio player homepage
  layout.tsx            # Root layout (ThemeProvider, AuthProvider, PlayerProvider)
  auth/                 # Login, register, verify-email, forgot/reset-password pages
  api/
    auth/               # Auth endpoints (login, register, refresh, logout, etc.)
    account/            # Account management (change password/email, MFA setup)
    monitoring/         # Health, metrics, alerts
components/
  player/               # PlayerProvider (audio engine), PersistentBottomBar
  radio/                # Waveform, GlassPlayButton, VolumeSlider, ActionButtons, etc.
  layout/               # AuthButtons, ThemeToggle, ThemeProvider
  ui/                   # shadcn/ui components
hooks/
  usePlayer.ts          # Thin context consumer for PlayerProvider
  useNowPlaying.ts      # AzuraCast now-playing metadata polling
store/
  playerStore.ts        # Zustand store (playback, volume, stream status, now-playing)
lib/
  auth/                 # JWT, sessions, guards, rate limiting, CSRF, MFA, crypto
prisma/
  schema.prisma         # User, Session, RefreshToken, EmailActionToken, AuditLog
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis (optional, in-memory fallback for dev)

### Setup

```bash
git clone <repo-url> && cd artistmanager
npm install
cp .env.production.example .env.local
```

Configure `.env.local`:

```env
# Stream (relative paths — proxied via Next.js rewrites)
NEXT_PUBLIC_STREAM_URL=/stream/hls/btradio/live.m3u8
NEXT_PUBLIC_AZURACAST_API_URL=/api/azuracast/nowplaying/btradio
AZURACAST_ORIGIN=http://localhost:8080

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/btradio

# Auth
JWT_SECRET=<random-64-char-string>
TOKEN_HMAC_SECRET=<random-64-char-string>
```

```bash
npx prisma migrate dev
npm run dev
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `npm run test:coverage` | Jest with coverage |

## Production Deployment

The app runs on a single VPS with Docker Compose: Nginx (SSL termination) → Next.js (:3000) + AzuraCast (internal).

```bash
# On the VPS
git pull
docker compose -f docker-compose.prod.yml up -d --build nextjs
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Architecture

```
Internet → Nginx (80/443, SSL)
             ├── /                  → Next.js (:3000)
             ├── /stream/hls/*     → AzuraCast (HLS)
             └── /api/azuracast/*  → AzuraCast (metadata API)
```

### Services

| Service | Container | Ports |
|---------|-----------|-------|
| Next.js | btradio-app | 127.0.0.1:3000 |
| AzuraCast | btradio-azuracast | 127.0.0.1:8080, 8000, 8010 |
| Nginx | btradio-nginx | 80, 443 |
| Certbot | btradio-certbot | — (auto-renew) |

## License

Private.
