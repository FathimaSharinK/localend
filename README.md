# Localend — Hyperlocal Neighborhood Mutual-Aid Platform

Localend is a production-style, futuristic community favor and mutual-aid platform where neighbors can request help, volunteer for local tasks, coordinate in real time, securely verify mission completion using a 4-digit handshake code, exchange mutual reviews, and administrators can monitor community health.

---

## Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) 16 (App Router)
- **Language**: TypeScript
- **UI & Design**: React 19, Tailwind CSS v4, Lucide React
- **Typography**: Next.js Google Fonts (`Plus Jakarta Sans` & `Outfit`)
- **Maps & Geolocation**: Leaflet, React-Leaflet, OpenStreetMap, Nominatim reverse-geocoding
- **Backend & Database**: Firebase Authentication, Cloud Firestore (Real-time snapshots)

---

## Project Structure

```text
localend/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root Layout, fonts, AuthProvider & ModalProvider
│   ├── page.tsx                # Root redirector (/dashboard or /login)
│   ├── globals.css             # Tailwind CSS v4 styles, custom tokens, and animations
│   ├── login/page.tsx          # Citizen & Admin login
│   ├── register/page.tsx       # Citizen registration with GPS & location picker
│   ├── onboarding/page.tsx     # Profile completion and neighborhood binding
│   ├── dashboard/page.tsx      # Central citizen mission control
│   ├── discover/page.tsx       # Live feed of open requests with real-time filters
│   ├── tasks/page.tsx          # "My Requests" & "Helping Out" tabs with 4-digit verification
│   ├── settings/page.tsx       # Profile, password, and location settings
│   └── admin/page.tsx          # System administration, KPIs, and user inspector
│
├── components/
│   ├── ui/                     # Button, Input, Card primitives
│   ├── layout/                 # AppLayout, navigation, floating dock
│   ├── requests/               # CreateRequestModal, HelpDetailModal
│   ├── location/               # LocationPicker (SSR-safe dynamic loader), LocationPickerMap
│   ├── notifications/          # NotificationSidebar with real-time event feed
│   └── reviews/                # ReviewModal (5-star ratings & comments)
│
├── contexts/
│   ├── AuthContext.tsx         # Firebase Auth listener & user profile state
│   └── ModalContext.tsx        # Global request modal manager
│
├── services/
│   ├── requests.service.ts     # Request creation, updates, and realtime subscriptions
│   ├── offers.service.ts       # Proposals, acceptance, and rejection logic
│   ├── tasks.service.ts        # Task lifecycle & 4-digit code completion verification
│   ├── reviews.service.ts      # Mutual review submissions and calculations
│   ├── users.service.ts        # Citizen profiles and role management
│   └── notifications.service.ts# In-app notifications
│
├── lib/
│   ├── firebase/client.ts      # Centralized Firebase client singleton
│   └── utils.ts                # Styling class utilities (cn)
│
├── data/
│   └── categories.ts           # Community request categories
│
├── types/
│   └── index.ts                # TypeScript domain models and interfaces
│
├── public/                     # Static assets
├── .env.example                # Environment variables template
├── MIGRATION.md                # Comprehensive migration documentation
├── next.config.ts              # Next.js configuration
├── postcss.config.mjs          # Tailwind CSS v4 PostCSS configuration
├── tsconfig.json               # TypeScript configuration with @/* aliases
└── package.json                # Project dependencies and Next.js scripts
```

---

## Environment Setup

Create a `.env.local` file based on `.env.example`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

*(Backwards compatibility with `VITE_FIREBASE_*` environment keys is supported out-of-the-box in `lib/firebase/client.ts`.)*

---

## Commands

### Development Server
```bash
npm run dev
```
Starts the Next.js development server at [http://localhost:3000](http://localhost:3000).

### Production Build
```bash
npm run build
```
Generates an optimized production build using Turbopack with prerendered static routes.

### Start Production Server
```bash
npm start
```

### TypeScript / Lint Check
```bash
npm run lint
```

---

## Authentication & Roles

- **Citizen (`user`)**: Can create requests, browse open community requests, submit volunteer proposals, enter the 4-digit handshake code upon task completion, and exchange mutual reviews.
- **Administrator (`admin`)**: Accesses the `/admin` portal with key platform KPIs, open community metrics, and an interactive Citizen Inspector.
- **Development Credentials**: Development login support is isolated for local testing (`admin@gmail.com`).

---

## 4-Digit Handshake Verification

1. When a requester accepts an offer, an active task is created with a secure 4-digit completion code.
2. The requester sees the code in **My Requests** and shares it once the neighbor finishes the favor.
3. The helper enters the code in **Helping Out → Enter Code & Finish**.
4. Correct code validation automatically marks both the task and the request as `COMPLETED` and unlocks mutual 5-star reviews.
