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
- `components/layout/` - Custom layout components (Header, Sidebar, ThemeProvider, etc.)
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
- Layout uses a Header + Sidebar structure with ThemeProvider wrapper
- Path alias `@/*` maps to project root

### Styling
- Tailwind CSS with custom configuration
- CSS variables enabled for theming
- Base color scheme: zinc
- Global styles in `app/globals.css`

## Key Files
- `components.json` - shadcn/ui configuration (do not modify manually)
- `app/layout.tsx` - Root layout with theme provider and navigation structure
- `store/store.ts` - Central state management with typed interfaces