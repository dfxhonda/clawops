# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClawOps (クレーンゲーム運営管理システム) is a mobile-first React SPA for managing crane game (claw machine) arcade operations. Operators use it to record meter readings, track prize inventory, and view performance rankings across stores and machines.

## Commands

- `npm run dev` - Start Vite dev server
- `npm run build` - Production build (output to `dist/`)
- `npm run preview` - Preview production build locally
- No test framework is configured.

## Architecture

**Frontend:** React 19 + React Router v7 + Vite 7. All source is JSX (not TypeScript). No state management library; state is local `useState` with an in-memory cache in `sheets.js`.

**Backend:** There is no backend server. The app reads/writes directly to a Google Spreadsheet via the Sheets API v4, authenticated with Google OAuth2 implicit flow (access token stored in `sessionStorage`).

**Data layer (`src/services/sheets.js`):**
- All data operations go through this single file
- Wraps `fetch()` calls to `sheets.googleapis.com` with Bearer token auth
- Spreadsheet has these sheets: `stores`, `machines`, `booths`, `meter_readings`
- In-memory `cache` object avoids redundant API calls per session; `clearCache()` invalidates after writes
- Column mapping in `meter_readings` is resolved dynamically from header row; other sheets use hardcoded column indices

**Routing (`src/App.jsx`):**
- All routes except `/login` are wrapped in `PrivateRoute` (redirects to login if no token)
- Flow: Login -> StoreSelect (`/`) -> MachineList (`/machines/:storeId`) -> BoothInput (`/booth/:machineId`) -> DraftList (`/drafts`) -> Complete (`/complete`)
- Additional routes: `/ranking/:storeId`, `/datasearch`, `/edit/:boothId`

**Draft system:** `BoothInput` saves readings to `sessionStorage` as drafts before final submission. `DraftList` reviews and submits all drafts to the spreadsheet.

**Styling:** Single `src/index.css` with CSS custom properties. Dark mode is the default theme (dark backgrounds defined in `:root`). Many components use inline styles.

## Deployment

Hosted on Vercel. `vercel.json` rewrites all routes to `index.html` for SPA routing.

## Language

UI text is in Japanese. Commit messages use Japanese with a category prefix (e.g., `ui:`, `feat:`, `fix:`).
