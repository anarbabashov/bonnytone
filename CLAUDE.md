# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bonny Tone Radio — an online radio platform built with Next.js 13, TypeScript, and shadcn/ui components. Users can create accounts for personalized features like mix/DJ reminders, favoriting tracks, and more. The application uses:
- **Next.js 13** with App Router (`app/` directory structure)
- **TypeScript** with strict configuration
- **Tailwind CSS** for styling with shadcn/ui component library
- **Zustand** for state management
- **Radix UI** primitives for accessible components
- **next-themes** for dark/light mode support

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Architecture

### Directory Structure
- `app/` - Next.js App Router pages and layouts
- `components/ui/` - shadcn/ui components (auto-generated, avoid manual edits)
- `components/layout/` - Layout components (AuthButtons, ThemeProvider, ThemeToggle, etc.)
- `components/radio/` - Radio player components (Waveform, GlassPlayButton, ActionButtons, VolumeSlider)
- `store/` - Zustand state management with centralized State interface
- `lib/` - Utility functions and shared logic

### State Management
The app uses Zustand with a centralized store (`store/store.ts`) that manages:
- `loading: boolean` - Global loading state
- `error: boolean` - Global error state
- `success: boolean` - Global success state

### Component Architecture
- Uses shadcn/ui "new-york" style with RSC (React Server Components)
- Components follow the pattern of separate index.tsx files that re-export from main component files
- Homepage is a full-screen radio player with canvas waveform background and glass-morphism controls
- Top bar overlays BonnyTone branding, theme toggle, and auth buttons
- Path alias `@/*` maps to project root

### Styling
- Tailwind CSS with custom configuration
- CSS variables enabled for theming (light/dark via `next-themes`)
- Glass-morphism utilities (`.glass`, `.glass-subtle`) in `app/globals.css`
- Cyan/teal primary color scheme with theme-aware glass variables
- `pulse-glow` keyframe animation for active play state

## Key Files
- `components.json` - shadcn/ui configuration (do not modify manually)
- `app/layout.tsx` - Root layout with ThemeProvider and AuthProvider
- `app/page.tsx` - Radio player homepage (Waveform + player controls)
- `components/radio/` - Waveform, GlassPlayButton, ActionButtons, VolumeSlider
- `store/store.ts` - Central state management with typed interfaces