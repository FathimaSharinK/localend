# Localend — Complete React/Vite → Next.js App Router Migration Report

## 1. Overview & Objectives
This document records the complete, zero-visual-change migration of **Localend** (Hyperlocal Neighborhood Mutual-Aid Platform) from a **React 18 + Vite + React Router DOM v6** client-side SPA to the **Next.js App Router** architecture.

All business logic, Firebase Authentication, Cloud Firestore schemas, real-time listeners, 4-digit handshake security verification, Leaflet geographic pickers, role-based isolation, and UI styling tokens have been preserved with 100% fidelity.

---

## 2. Architecture Comparison

| Dimension | Previous Architecture | Target Next.js Architecture |
|---|---|---|
| **Framework** | React 18 + Vite 6 + React Router v6 | Next.js 16 (App Router) + React 19 |
| **Routing** | Client-side memory/browser history (`react-router-dom`) | Next.js App Router (`next/navigation`, `next/link`) |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite`) | Tailwind CSS v4 (`@tailwindcss/postcss`, `postcss.config.mjs`) |
| **Fonts** | CDN Google Fonts (`index.html`) | Next.js Google Fonts (`next/font/google` with CSS variables) |
| **Leaflet Maps** | Client-only render inside Vite | Next.js Dynamic Client Component (`ssr: false`) to avoid SSR window errors |
| **Backend & Database** | Firebase Auth + Cloud Firestore | Unchanged: Same live Firebase project & collections |
| **Service Layer** | Ad-hoc Firestore calls in components | Modular services in `services/` (`requests`, `offers`, `tasks`, `reviews`, `users`, `notifications`) |

---

## 3. Route Mapping (React Router DOM → Next.js App Router)

All existing URLs are retained without changes:

| Old React Router Path | Old File Location | New Next.js App Route | New File Location | Client/Server Boundary |
|---|---|---|---|---|
| `/` | `src/App.tsx` | `/` | `app/page.tsx` | Client Redirector (`"use client"`) |
| `/login` | `src/pages/Login.tsx` | `/login` | `app/login/page.tsx` | Client Component (`"use client"`) |
| `/register` | `src/pages/Register.tsx` | `/register` | `app/register/page.tsx` | Client Component (`"use client"`) |
| `/onboarding` | `src/pages/Onboarding.tsx` | `/onboarding` | `app/onboarding/page.tsx` | Client Component (`"use client"`) |
| `/dashboard` | `src/pages/Dashboard.tsx` | `/dashboard` | `app/dashboard/page.tsx` | Client Component (`"use client"`) |
| `/discover` | `src/pages/Discover.tsx` | `/discover` | `app/discover/page.tsx` | Client Component (`"use client"`) |
| `/tasks` | `src/pages/Tasks.tsx` | `/tasks` | `app/tasks/page.tsx` | Client Component (`"use client"`) |
| `/settings` | `src/pages/Settings.tsx` | `/settings` | `app/settings/page.tsx` | Client Component (`"use client"`) |
| `/admin` | `src/pages/Admin.tsx` | `/admin` | `app/admin/page.tsx` | Client Component (`"use client"`) wrapped in `<Suspense>` |

---

## 4. Component Mapping

| Old Location | New Location | Description |
|---|---|---|
| `src/components/AppLayout.tsx` | `components/layout/AppLayout.tsx` | Master application shell, navigation dock, notifications sidebar drawer |
| `src/components/CreateRequestModal.tsx` | `components/requests/CreateRequestModal.tsx` | Modal for creating and editing favor requests |
| `src/components/HelpDetailModal.tsx` | `components/requests/HelpDetailModal.tsx` | Request details, offers list, 1-click volunteering, code verification |
| `src/components/LocationPicker.tsx` | `components/location/LocationPicker.tsx` & `LocationPickerMap.tsx` | Leaflet map with GPS reverse-geocoding, SSR-safe dynamic loading |
| `src/components/NotificationSidebar.tsx` | `components/notifications/NotificationSidebar.tsx` | Real-time signal updates with mark-as-read Firestore transitions |
| `src/components/ReviewModal.tsx` | `components/reviews/ReviewModal.tsx` | 5-star mutual rating and feedback submission |
| `src/components/ui/` | `components/ui/Button.tsx`, `Input.tsx`, `Card.tsx` | Shared atomic UI primitives |

---

## 5. Firebase & Firestore Integration

The live database and auth instances are preserved without data mutation:
- **Project ID**: `hirushgloballlpramees`
- **Client Configuration**: `lib/firebase/client.ts` centralizes SDK initialization and supports both `NEXT_PUBLIC_FIREBASE_*` and backwards-compatible `VITE_FIREBASE_*` environment keys.
- **Collections Active**:
  1. `users` — Citizen profiles, lat/lng coordinates, roles (`admin` / `user`), onboarding status.
  2. `helpRequests` — Open community favor requests, priorities, statuses (`OPEN`, `OFFER_RECEIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
  3. `helpOffers` — Volunteer proposals with statuses (`PENDING`, `ACCEPTED`, `REJECTED`).
  4. `helpTasks` — Active mutual-aid missions with requester/helper binding and 4-digit completion codes.
  5. `reviews` — Mutual ratings (1–5 stars) and feedback comments.
  6. `notifications` — Real-time event notifications for proposals, assignments, completions, and reviews.

---

## 6. Key Next.js Technical Decisions

1. **Leaflet SSR Isolation**:
   - `leaflet` and `react-leaflet` access `window` and `navigator` during initialization.
   - Solved cleanly by separating the map rendering into `components/location/LocationPickerMap.tsx` and importing it in `LocationPicker.tsx` via `next/dynamic` with `{ ssr: false }`.
2. **Next.js SearchParams Suspense**:
   - `app/admin/page.tsx` uses `useSearchParams()` for tab switching. In Next.js App Router, pages using `useSearchParams()` must be wrapped in a `<Suspense>` boundary to allow static prerendering.
3. **Typography Migration**:
   - Google Fonts `Plus Jakarta Sans` and `Outfit` migrated from `index.html` `<link>` tags to `next/font/google` in `app/layout.tsx`.
4. **Tailwind CSS v4 Integration**:
   - Configured `@tailwindcss/postcss` in `postcss.config.mjs` with `@import "tailwindcss";` in `app/globals.css`.

---

## 7. Package Cleanup

### Packages Removed:
- `vite`
- `@vitejs/plugin-react`
- `@tailwindcss/vite`
- `react-router-dom`

### Packages Added / Retained for Next.js:
- `next` (v16.3.5)
- `@tailwindcss/postcss`
- `@types/react` & `@types/react-dom`

---

## 8. Build & Verification Results

- `npx tsc --noEmit`: **0 errors** (Clean TypeScript pass)
- `npm run build`: **0 errors** (All 11 routes successfully prerendered as static content)
- SSR & Hydration: **Pass**
