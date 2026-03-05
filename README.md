# BonnyTone Radio

Online radio platform streaming Miami club & house music 24/7. Built with Next.js, HLS.js, and AzuraCast.

**Live at [bonnytone.com](https://bonnytone.com)**

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
- Rate limiting with escalating login backoff
- JWT access + refresh token rotation with reuse detection

## Tech Stack

- **Framework:** Next.js 13 (App Router, TypeScript, standalone output)
- **Streaming:** HLS.js + AzuraCast (Auto-DJ, HLS delivery)
- **State:** Zustand (player store)
- **UI:** Tailwind CSS, shadcn/ui, Radix UI, Lucide icons
- **Auth:** JWT (access + refresh token rotation), Argon2id, TOTP MFA
- **Database:** PostgreSQL + Prisma ORM
- **Infra:** Docker Compose (Next.js + AzuraCast + Nginx + Certbot)

## Quick Start

The radio player works without the auth stack — no database or Redis needed.

```bash
git clone https://github.com/your-username/btradio.git && cd btradio
npm install
cp .env.example .env.local
npm run dev
```

The player streams from `bonnytone.com` by default via Next.js rewrites. To use your own AzuraCast instance, update `AZURACAST_ORIGIN` in `.env.local`.

## Full Setup (with Auth)

To enable user accounts, you need PostgreSQL and optionally Redis:

```bash
# 1. Configure database in .env.local
DATABASE_URL=postgresql://postgres:password@localhost:5432/btradio
TOKEN_HMAC_SECRET=$(openssl rand -base64 32)

# 2. Run database migrations
npx prisma migrate dev

# 3. Start dev server
npm run dev
```

See `.env.example` for all configuration options.

## Project Structure

```
app/
  page.tsx              # Full-screen radio player homepage
  layout.tsx            # Root layout (ThemeProvider, AuthProvider, PlayerProvider)
  auth/                 # Login, register, verify-email, forgot/reset-password pages
  api/
    auth/               # Auth endpoints (login, register, refresh, logout, etc.)
    account/            # Account management (change password/email, MFA setup)
components/
  player/               # PlayerProvider (audio engine), PersistentBottomBar
  radio/                # Waveform, GlassPlayButton, VolumeSlider, ActionButtons
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

## Production Deployment

The app runs on a single VPS with Docker Compose: Nginx (SSL termination) → Next.js + AzuraCast.

```bash
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

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |

## License

MIT — see [LICENSE](LICENSE).
