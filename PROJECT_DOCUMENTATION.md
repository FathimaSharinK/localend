# 🌐 Localend — Futuristic Hyperlocal Mutual-Aid & Emergency Dispatch Platform
## Complete Technical Architecture & System Documentation (Updated Latest Release)

---

## 1. 📖 Project Overview

**Localend** is a production-grade, hyperlocal community assistance, municipal dispatch, and mutual-aid web application. It connects citizens, specialized municipal/department employees, and platform administrators in real-time.

The platform provides:
- **Citizen Service Requests**: Citizens can broadcast urgent needs across specialized categories (`Medical`, `Groceries`, `Electrical`, `Plumbing`, and custom dynamic departments).
- **Specialist Employee Engine**: Employees registered under specific departments can view departmental leads or explore all community help requests, claim urgent missions, chat with citizens, and execute tasks.
- **Always-Active Real-Time Proximity**: Continuous background GPS tracking (`watchPosition`), 0-delay coordinate caching, and Haversine distance calculations showing exact proximity (e.g. `📍 518 m away`) on every task card.
- **Emergency SLA Escalation Engine**: Automated real-time tracking of deadlines. Tasks approaching their SLA deadline (<= 120 minutes) automatically escalate to `URGENT` with prominent glowing red alert cards.
- **Automated Gmail SMTP Alerts**: Automated email notifications triggered 50 minutes before deadlines or on emergency dispatch via Nodemailer and secure Gmail App Passwords.
- **Direct Dispatch with Proximity Ranking**: Administrators can dispatch open emergency requests directly to specialists, automatically ranking and highlighting the nearest available specialist (`🌟 Nearest Match`).
- **Cryptographic 4-Digit Handshake Code**: Mutual trust is guaranteed by a 4-digit verification code generated for each mission, required to complete the task and award trust points.
- **Real-Time In-Task Chat**: Secure two-way messaging between citizen and assigned specialist during active missions.

---

## 2. 👥 User Roles & Access Control

| Role | Module Access | Key Responsibilities & Capabilities |
|---|---|---|
| **Citizen (`user`)** | `/dashboard`, `/tasks`, `/settings` | • Post help requests with interactive map & GPS.<br>• View technician proposals & accept with 1 click.<br>• Receive 4-digit verification handshake code.<br>• Chat live with assigned technician.<br>• Submit 5-star ratings and reviews upon completion. |
| **Employee (`employee`)** | `/dashboard`, `/discover`, `/tasks`, `/settings` | • Bound to a specialized department (e.g. `Medical`, `Electrical`, `Plumbing`).<br>• View live departmental leads or toggle **`🌟 All Community Help`**.<br>• Inspect exact live distance (`📍 X km away`) to each task.<br>• Filter by distance radius (`< 5 km`, `< 10 km`, `< 25 km`, `< 50 km`).<br>• Claim open emergency missions directly with handshake generation.<br>• In-mission live chat with requester.<br>• Enter citizen's 4-digit code to complete mission and earn trust points. |
| **Administrator (`admin`)** | `/admin`, `/dashboard`, `/discover`, `/tasks`, `/settings` | • Master overview of community KPIs, SLA health, and active missions.<br>• **Employee Module**: View all employees, active/inactive toggles, direct registration.<br>• **User Module**: Inspect citizen accounts and reputations.<br>• **All Tasks**: Master task feed with status filters.<br>• **Departments**: Create, edit, and delete departments dynamically with auto-icon and color selection.<br>• **Direct Dispatch**: Proximity-ranked modal to assign tasks to the closest specialist with 1 click.<br>• Emergency SLA monitoring and manual/automated escalation triggers. |

---

## 3. 🛠️ Technical Stack

| Layer | Technology | Specification / Details |
|---|---|---|
| **Framework** | **Next.js 16 (App Router)** | Turbopack compilation, React Server & Client Components, Route Handlers |
| **Frontend Library** | **React 19** | Concurrent rendering, Hooks, dynamic imports |
| **Language** | **TypeScript 5** | Strict type definitions across models, services, and components |
| **Styling** | **Tailwind CSS v4** | Modern theme tokens, CSS variables, glassmorphic cards, responsive breakpoints |
| **Icons & Typography** | **Lucide React** + Google Fonts | Plus Jakarta Sans & Outfit typography |
| **Maps & Location** | **Leaflet & React-Leaflet** | OpenStreetMap interactive tile map with custom pins |
| **Geocoding & Gazetteer**| **Nominatim + Haversine** | Forward/reverse geocoding, 45+ Kerala/Malappuram towns gazetteer, deterministic offsets |
| **Geolocation** | **HTML5 Geolocation API** | Continuous `navigator.geolocation.watchPosition` with `localStorage` 0ms caching |
| **Authentication** | **Firebase Auth** | Email/password authentication, secondary admin creation instance |
| **Database** | **Cloud Firestore** | Real-time `onSnapshot` listeners, atomic `runTransaction` operations |
| **Email Service** | **Nodemailer + Gmail SMTP** | Google App Password SMTP on `/api/send-email` for SLA notifications |

---

## 4. 📂 Directory & Architecture Structure

```text
localend/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root Layout, global fonts, AuthProvider & ModalProvider
│   ├── page.tsx                      # Root intelligent redirector (/dashboard or /login)
│   ├── globals.css                   # Tailwind CSS v4 design tokens, alerts & animations
│   ├── login/page.tsx                # Citizen & Admin authentication portal
│   ├── register/page.tsx             # Multi-role signup (Citizen or Employee with Department picker)
│   ├── onboarding/page.tsx           # Profile completion & location binding
│   ├── dashboard/page.tsx            # Fast mission control, urgent SLA banners & leads feed
│   ├── discover/page.tsx             # Hyperlocal Job Board, All Community Help, Radius filter & GPS
│   ├── tasks/page.tsx                # "My Requests" (citizen) & "My Missions" (employee) + Handshake
│   ├── settings/page.tsx             # Profile details, coordinates geocoding, password change
│   ├── admin/page.tsx                # Control Center: Dashboard, Employee Module, User Module, All Tasks, Dynamic Departments, Direct Dispatch
│   └── api/
│       └── send-email/
│           └── route.ts              # Nodemailer Gmail SMTP route handler for SLA alerts
│
├── components/                       # Reusable UI Components
│   ├── ui/                           # Button, Input, Card, Badge primitives
│   ├── layout/                       # AppLayout, Sidebar, Navbar, Mobile navigation
│   ├── chat/                         # TaskChatModal, TaskChatButton (Real-time in-mission chat)
│   ├── requests/                     # CreateRequestModal, HelpDetailModal
│   ├── location/                     # LocationPicker (SSR-safe Leaflet wrapper), LocationPickerMap
│   ├── notifications/                # NotificationSidebar with live Firestore listener
│   └── reviews/                      # ReviewModal (5-star ratings & mutual feedback)
│
├── contexts/                         # React Contexts
│   ├── AuthContext.tsx               # Firebase Auth state, user profile listener & refresh
│   └── ModalContext.tsx              # Global request modal controller
│
├── services/                         # Business Logic & Firestore Operations
│   ├── departments.service.ts        # Dynamic department CRUD & real-time subscription
│   ├── requests.service.ts           # Help request CRUD & state transitions
│   ├── offers.service.ts             # Specialist proposals, atomic acceptance via runTransaction
│   ├── tasks.service.ts              # Task lifecycle, direct claim, atomic 4-digit code verification
│   ├── reviews.service.ts            # Mutual review submissions & rating calculation
│   └── users.service.ts              # User profile management & queries
│
├── lib/                              # Shared Utilities & Engines
│   ├── firebase/client.ts            # Firebase app singleton, Firestore db, Auth instance
│   ├── distance.ts                   # Haversine distance, 45+ towns gazetteer, geocoding fallbacks
│   ├── slaEscalation.ts              # SLA deadline calculation, auto-escalation, email triggers
│   ├── sortUtils.ts                  # Scheduled date/time sorting utility
│   └── utils.ts                      # Class merging utility (cn)
│
├── data/
│   └── categories.ts                 # Default categories (Medical, Groceries, Electrical, Plumbing)
│
├── types/
│   └── index.ts                      # Domain models (User, HelpRequest, HelpTask, HelpOffer, Department)
│
├── firestore.rules                   # Cloud Firestore security rules
├── package.json                      # Dependencies and scripts
└── tsconfig.json                     # TypeScript configuration with @/* aliases
```

---

## 5. 🔍 Deep Dive into Core Systems

### 5.1. Always-Active GPS & Proximity Engine (`lib/distance.ts`)
- **Continuous Tracking**: Uses `navigator.geolocation.watchPosition` with high accuracy.
- **Zero-Latency Cache**: Coordinates are synced to `localStorage('localend_live_coords')` so distances display instantaneously on page load without waiting for GPS lock.
- **Great-Circle Haversine Formula**: Calculates real spherical distance in kilometers between user and request.
- **Regional Gazetteer**: Built-in coordinates for 45+ locations in Kerala (Perinthalmanna, Angadipuram, Tirurkad, Mankada, Melattur, Pandikkad, Pulamanthole, Pattambi, Shornur, Ottapalam, Malappuram, Manjeri, Calicut, etc.).
- **Deterministic Coordinate Fallback**: Any uncatalogued street name or address is deterministically mapped to a realistic coordinate near the operations hub, ensuring distance is **never null**.
- **Interactive Radius Filters**: `< 5 km`, `< 10 km`, `< 25 km`, `< 50 km`, and `All Distances` filter strictly using computed distance.

### 5.2. Emergency SLA & Auto-Escalation Engine (`lib/slaEscalation.ts`)
- **Deadline Calculation**: Parses request scheduled date and start time (`YYYY-MM-DD` and `HH:MM`).
- **Urgent SLA Threshold (120 Minutes)**: If a request's remaining time is <= 120 minutes or overdue, it automatically escalates:
  - `priority` set to `'URGENT'`.
  - `isEscalated` set to `true`.
  - Renders with an animated pulsating red badge: `🚨 Urgent SLA (Xm left)` or `🚨 Urgent SLA (OVERDUE)`.
  - Card turns into a high-visibility rose-tinted emergency alert with glowing red borders.
- **Automated Gmail SMTP Email Alert (50 Minutes)**: When SLA reaches 50 minutes or less, the system calls `/api/send-email` to dispatch an urgent notification email with task title, department, time remaining, and location.

### 5.3. Real-Time In-Task Chat (`components/chat/TaskChatModal.tsx`)
- Active during `IN_PROGRESS` tasks.
- Dedicated Firestore subcollection: `chats/{taskId}/messages`.
- Features real-time listener, unread badges, automated scroll-to-bottom, sender role tags (`Technician` / `Requester`), and formatted timestamps.

### 5.4. Dynamic Department System (`services/departments.service.ts`)
- Stored in the `departments` Firestore collection.
- Admins can add new departments dynamically at `/admin`.
- Auto-icon detection (`getAutoIconForDepartment`) automatically assigns appropriate Lucide icons based on department names (e.g., "Fire" -> Flame, "Water" -> Droplet, "Solar" -> Sun).
- One-click emoji selector and color picker.
- Live real-time subscription in `/register`, `/discover`, and `CreateRequestModal`.

### 5.5. 4-Digit Cryptographic Handshake Verification
1. When a task is accepted or claimed, a secure 4-digit code is generated (e.g. `7391`).
2. Requester sees the code on their card in **My Requests** with a one-click copy button.
3. Specialist executes the favor, meets the requester, and asks for the code.
4. Specialist clicks **"Enter Code & Finish"** on their **My Missions** card.
5. Code is validated in Firestore via atomic verification (`verifyHandshakeCode`).
6. Task updates to `COMPLETED` and awards +15 Trust Points to the helper.
7. Mutual 5-star review modal automatically triggers on both ends.

---

## 6. ⚙️ Environment Configuration

Create or update your `.env.local` file with the following keys:

```bash
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Automated Gmail SMTP SLA Alert Configuration
SMTP_USER=fathimasharin18@gmail.com
SMTP_PASS="gzen esbk pkdh frez"
ADMIN_ALERT_EMAIL=fathimasharin18@gmail.com
```

---

## 7. 🚀 Running and Building

### Development Mode
```bash
npm run dev
```
Starts development server on [http://localhost:3000](http://localhost:3000).

### Production Build
```bash
npm run build
```
Creates an optimized Turbopack production bundle with static page generation.

### Production Server
```bash
npm run start -- -p 3008
```
Launches the production server on port 3008.

---

## 8. 🛡️ Default Platform Accounts

| Role | Email | Password | Landing Page |
|---|---|---|---|
| **Admin** | `admin@gmail.com` | `admin123` | `/admin` (Redirects to Admin Control Center) |
| **Employee** | Register at `/register` as Employee | Custom | `/dashboard` & `/discover` (Department Job Board) |
| **Citizen** | Register at `/register` as Citizen | Custom | `/dashboard` & `/tasks` (Citizen Hub) |

---
*Documentation updated and verified with all latest platform capabilities.*
