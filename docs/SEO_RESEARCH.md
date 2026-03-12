# BonnyTone Radio — SEO Meta Optimization Research

> Research date: March 2026
> Domain: bonnytone.com
> Stack: Next.js 13 (App Router) with static `Metadata` export

---

## 1. Current State Audit

### What's Live on bonnytone.com

| Tag | Status | Value |
|-----|--------|-------|
| `<title>` | OK | BonnyTone Radio — Miami Club & House Music Internet Radio |
| `meta description` | OK | Stream Miami's club music internet radio 24/7 — house, deep house, tech house, breaks, progressive & electronic music. Tune in to BonnyTone Radio for the perfect vibe. |
| `meta keywords` | OK | 14 keywords covering target queries |
| `meta robots` | OK | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| `meta author/creator/publisher` | OK | BonnyTone Radio |
| `geo.region / geo.placename / geo.position / ICBM` | OK | US-FL, Miami, Florida, 25.7617;-80.1918 |
| `og:title, og:description, og:type, og:locale, og:site_name, og:url` | OK | All set correctly |
| `og:image` | MISSING | References `/og-image.png` but file does not exist in `public/` |
| `twitter:card` | OK | summary_large_image |
| `twitter:site` | MISSING | No @handle set |
| `twitter:creator` | MISSING | No @handle set |
| `link rel="canonical"` | OK | https://bonnytone.com/ |
| `robots.txt` | OK | Allows all, points to sitemap |
| `sitemap.xml` | PARTIAL | Live site only has `/` — code has `/privacy`, `/terms`, `/contact` but not deployed |
| `favicon` | WEAK | Only 16x16 .ico — no apple-touch-icon, no 32x32, no 192/512 PNG |
| JSON-LD structured data | MISSING | No structured data at all |
| `manifest.json` (PWA) | MISSING | No web app manifest |
| `theme-color` meta | MISSING | No theme-color for browser chrome |
| `apple-touch-icon` | MISSING | No touch icon for iOS home screen |
| Page-level meta (legal pages) | BASIC | Title + description only, no OG overrides |

### Page-Level Metadata Coverage

| Page | Title | Description | OG Override | Notes |
|------|-------|-------------|-------------|-------|
| `/` (homepage) | Inherited from layout | Inherited from layout | No | `page.tsx` is `'use client'` — cannot export metadata |
| `/privacy` | Privacy Policy - BonnyTone Radio | Yes | No | OK but generic |
| `/terms` | Terms of Service - BonnyTone Radio | Yes | No | OK but generic |
| `/contact` | Contact - BonnyTone Radio | Yes | No | OK but generic |
| `/auth/*` | No metadata | No | No | Should have noindex |
| `/mini-player` | BTRadio DJ — Mini Player | noindex, nofollow | No | Correct — internal tool |

---

## 2. Competitor Analysis

Research from top 15 radio stations ranking for target keywords.

### Target Keywords

1. `miami club music radio`
2. `club music internet radio`
3. `deep house internet radio`
4. `house internet radio`

### Top Competitors — Meta Tag Breakdown

#### Best in Class: Deep House Radio (deephouse-radio.com)

| Tag | Value |
|-----|-------|
| Title | Deep House Radio - Ireland's #1 Deep House Streaming Station \| DHR1 & DHR2 |
| Description | Experience premium deep house music streaming from Cork City, Ireland. DHR1 & DHR2 offer 24/7 deep house radio with real-time track identification, VIP content, and Ireland's largest deep house community. |
| Keywords | deep house radio, deep house streaming, deep house music, DHR1, DHR2, house music ireland, radio cork city, online radio ireland, premium deep house, track identification |
| OG | Full set — title, description, image, type, site_name, url, locale |
| Twitter | summary_large_image with full tags |
| Geo | geo.region=IE-CO, geo.placename=Cork City, geo.position, ICBM |
| Robots | index, follow, max-snippet:-1, max-image-preview:large |
| Structured Data | JSON-LD present |
| Extra | `bingbot`, `googlebot` specific directives, business contact meta, color-scheme, theme-color (light/dark) |

**Why they rank:** Comprehensive meta coverage, geo-targeting, keywords, structured data, descriptive title with location + genre + USP.

#### Strong Competitors

| Station | Title Pattern | Key Strength |
|---------|--------------|-------------|
| My House Radio (myhouseradio.fm) | My House Radio: America's House Music Entertainment Radio | Location claim ("America's"), full OG + Twitter, JSON-LD |
| Revolution 93.5 (revolution935.com) | Revolution 93.5 - Revolution 935 | Miami-specific description, JSON-LD (WebPage, Organization, BreadcrumbList) |
| Dogglounge (dogglounge.com) | Dogglounge Deep House Radio \| Streaming Deep House 24/7 | Meta keywords, full OG + Twitter, JSON-LD (Organization) |
| 54house.fm | 54house.fm — Club & House Music Radio Station | Meta keywords (club music, house music, funky house, disco house, etc.) |
| USA Dance Radio (usadanceradio.com) | internet radio station \| USA DANCE RADIO | Good description with "24/7 worldwide" positioning |

#### Weak Competitors (opportunity to outrank)

| Station | Weakness |
|---------|----------|
| Miami Global Radio | No OG tags, no Twitter, no keywords, no structured data |
| House Radio Net (houseradio.net) | No description, no OG, no Twitter, no keywords |
| NYC House Radio | Description is just a tagline ("Let There Be House"), no OG image |
| 54house.fm | Empty og:description, missing og:title, wrong locale (de_DE) |
| filtermusic.net | Minimal description, no Twitter card |

### Competitor Title Patterns

| Pattern | Example | Keywords Hit |
|---------|---------|-------------|
| Brand — Location's #1 Genre Station | Deep House Radio - Ireland's #1 Deep House Streaming Station | location, genre, brand |
| Brand: Location's Genre Radio | My House Radio: America's House Music Entertainment Radio | location claim, genre, brand |
| Brand — Genre \| Action 24/7 | Dogglounge Deep House Radio \| Streaming Deep House 24/7 | genre, action verb, 24/7 |
| Brand — Genre Radio Station | 54house.fm — Club & House Music Radio Station | genre combo, brand |
| **BonnyTone (current)** | **BonnyTone Radio — Miami Club & House Music Internet Radio** | **miami, club, house, internet radio, brand** |

**Assessment:** Our title is competitive. Hits all 4 target keywords. 57 characters — within the 60-char sweet spot.

### Competitor Description Patterns

| Station | Chars | Structure |
|---------|-------|-----------|
| Deep House Radio | 195 | "Experience [adjective] [genre] streaming from [location]. [Features] with [USP]." |
| My House Radio | 138 | "Streaming the best [genres] 24/7: [features] from [location] — [brand]" |
| Revolution 93.5 | 138 | "Stream [location] [genre] live on [brand]. Listen to [genres] 24/7 with [USP]" |
| Dogglounge | 146 | "Since [year], [brand] plays [description] 24/7 from [era] to present." |
| **BonnyTone (current)** | **168** | **"Stream Miami's club music internet radio 24/7 — [genres]. Tune in to BonnyTone Radio for the perfect vibe."** |

**Assessment:** Our description is good. Could be slightly shorter (aim for 150-155 chars for full display in Google).

---

## 3. Gaps & Recommendations

### Critical (high SEO impact)

| # | Issue | Impact | Action |
|---|-------|--------|--------|
| 1 | **No OG image** | Social shares show no image — massively reduces CTR on Facebook, Twitter, Discord, Telegram | Create `public/og-image.png` (1200x630px) with BonnyTone branding + tagline |
| 2 | **No JSON-LD structured data** | Missing from Google rich results, Knowledge Panel, radio station cards | Add `RadioBroadcastService` or `RadioStation` schema to layout |
| 3 | **Sitemap not deployed** | Google only sees `/` — missing 3 indexed pages | Deploy latest code with `/privacy`, `/terms`, `/contact` entries |
| 4 | **Auth pages not noindexed** | `/auth/login`, `/auth/register`, etc. could get indexed as thin content | Add `robots: { index: false, follow: false }` metadata to auth pages |

### Important (moderate SEO impact)

| # | Issue | Impact | Action |
|---|-------|--------|--------|
| 5 | **No web app manifest** | Fails PWA checks, no install prompt, worse Lighthouse score | Create `app/manifest.ts` with name, icons, theme_color, background_color |
| 6 | **Weak favicon setup** | Only 16x16 .ico — poor display on tabs, bookmarks, home screens | Add favicon.svg, apple-touch-icon (180x180), icon-192.png, icon-512.png |
| 7 | **No `theme-color` meta** | Browser chrome doesn't match brand; Lighthouse flags it | Add `themeColor` to metadata in layout.tsx |
| 8 | **No Twitter `@handle`** | Shares don't link back to a Twitter/X profile | Add `twitter: { site: "@bonnytone", creator: "@andygart" }` or similar |
| 9 | **Description slightly long** | 168 chars — may get truncated in Google (155 char display limit) | Trim to ~155 chars |

### Nice to Have (low SEO impact, good practice)

| # | Issue | Impact | Action |
|---|-------|--------|--------|
| 10 | **No `hreflang`** | Not needed now but useful if you add multi-language support later | N/A for now |
| 11 | **Legal pages lack OG overrides** | Shares of `/privacy` or `/contact` show radio description instead of page-specific | Add OG title/description per page |
| 12 | **No `application-name` meta** | Minor — affects pinned tabs and app launchers | Add to metadata `applicationName: "BonnyTone Radio"` |
| 13 | **Homepage is client component** | Can't export page-level metadata; relies entirely on layout metadata | Not a problem currently since layout meta is comprehensive |

---

## 4. Recommended JSON-LD Structured Data

The highest-impact missing piece. This is what enables Google's radio station rich results and Knowledge Panel.

```json
{
  "@context": "https://schema.org",
  "@type": "RadioStation",
  "name": "BonnyTone Radio",
  "alternateName": "BTRadio",
  "url": "https://bonnytone.com",
  "logo": "https://bonnytone.com/icon-512.png",
  "image": "https://bonnytone.com/og-image.png",
  "description": "Miami's club music internet radio streaming house, deep house, tech house, breaks, progressive & electronic music 24/7.",
  "slogan": "Miami Club & House Music Internet Radio",
  "genre": ["House", "Deep House", "Tech House", "Breaks", "Progressive", "Electronica"],
  "broadcastFrequency": "Internet-only",
  "broadcastTimezone": "America/New_York",
  "areaServed": {
    "@type": "Place",
    "name": "Worldwide"
  },
  "location": {
    "@type": "Place",
    "name": "Miami, Florida",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Miami",
      "addressRegion": "FL",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 25.7617,
      "longitude": -80.1918
    }
  },
  "broadcaster": {
    "@type": "Organization",
    "name": "BonnyTone",
    "url": "https://bonnytone.com",
    "sameAs": [
      "https://soundcloud.com/andygart"
    ]
  },
  "potentialAction": {
    "@type": "ListenAction",
    "target": "https://bonnytone.com",
    "actionStatus": "PotentialActionStatus"
  }
}
```

### Where to implement

Next.js App Router supports JSON-LD via a `<script>` tag in layout or page components:

```tsx
// In app/layout.tsx or a dedicated component
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
/>
```

---

## 5. Recommended Metadata Updates

### layout.tsx — additions needed

```typescript
// Add to metadata object:
applicationName: "BonnyTone Radio",
themeColor: [
  { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
],

// Update twitter to include handles:
twitter: {
  card: "summary_large_image",
  site: "@bonnytone",       // create this account
  creator: "@bonnytone",
  title: "BonnyTone Radio — Miami Club & House Music Internet Radio",
  description: "Stream Miami's club music internet radio 24/7 — house, deep house, tech house, breaks & progressive electronic music.",
  images: ["/og-image.png"],
},
```

### Trimmed description (155 chars)

Current (168 chars):
> Stream Miami's club music internet radio 24/7 — house, deep house, tech house, breaks, progressive & electronic music. Tune in to BonnyTone Radio for the perfect vibe.

Recommended (152 chars):
> Stream Miami's club music internet radio 24/7 — house, deep house, tech house, breaks & progressive electronic music. Tune in to BonnyTone Radio.

### Auth pages — add noindex

Each file in `app/auth/*/page.tsx` needs:
```typescript
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

---

## 6. Assets Checklist

| Asset | Spec | Status |
|-------|------|--------|
| `public/og-image.png` | 1200x630px, BonnyTone branding + tagline | NOT CREATED |
| `public/icon-192.png` | 192x192px PNG icon | NOT CREATED |
| `public/icon-512.png` | 512x512px PNG icon | NOT CREATED |
| `public/apple-touch-icon.png` | 180x180px PNG | NOT CREATED |
| `app/favicon.ico` | 32x32 multi-size .ico | EXISTS (16x16 only) |
| `app/manifest.ts` | Web app manifest | NOT CREATED |

---

## 7. Priority Implementation Order

1. **Create OG image** (`public/og-image.png`) — immediate social sharing impact
2. **Add JSON-LD structured data** — enables rich results in Google
3. **Deploy updated sitemap** — Google discovers all pages
4. **Add `themeColor` + `applicationName`** to layout metadata — quick wins
5. **Noindex auth pages** — prevents thin content indexing
6. **Create web app manifest** — PWA readiness, better Lighthouse score
7. **Upgrade favicon set** — better display across devices
8. **Create Twitter/X account** and add handles to meta — social attribution
9. **Trim description** to 152 chars — prevent Google truncation

---

## 8. Google Search Console

After deploying these changes:

1. Verify domain in [Google Search Console](https://search.google.com/search-console)
2. Submit sitemap: `https://bonnytone.com/sitemap.xml`
3. Request indexing for homepage
4. Monitor "Coverage" report for any crawl errors
5. Check "Enhancements" for structured data validation
6. Use [Rich Results Test](https://search.google.com/test/rich-results) to validate JSON-LD

Also submit to [Bing Webmaster Tools](https://www.bing.com/webmasters) for Bing/DuckDuckGo coverage.
