# 🌐 Localend — Futuristic Hyperlocal Mutual-Aid & Emergency Dispatch Platform

**Localend** is a production-grade, hyperlocal community assistance, municipal dispatch, and mutual-aid web application. It connects citizens, specialized municipal/department employees, and platform administrators in real-time.

---

## 🌟 Key Highlights & Capabilities

- **Multi-Role Ecosystem**: Distinct interfaces and capabilities for **Citizens**, **Department Specialists / Employees**, and **Platform Administrators**.
- **Always-Active Real-Time Proximity**: Continuous background GPS tracking (`watchPosition`), zero-latency coordinate caching, and Haversine distance calculations showing exact proximity (e.g. `📍 518 m away`) on every task card.
- **"All Community Help" & Department Job Board**: Employees can switch between departmental tasks and all community help requests, sorted with live proximity.
- **Interactive Radius Filtering**: Filter requests strictly by distance: `< 5 km`, `< 10 km`, `< 25 km`, `< 50 km`, or `All Distances`.
- **Emergency SLA & Auto-Escalation Engine**: Real-time SLA tracking that auto-escalates tasks approaching their deadline (<= 120 min) with prominent red glowing cards and countdown alerts.
- **Automated Gmail SMTP Alerts**: Automated emergency email alerts dispatched when tasks are within 50 minutes of deadline via Nodemailer.
- **Direct Dispatch with Proximity Ranking**: Administrators can assign tasks directly to the closest available specialist, highlighted as `🌟 Nearest Match`.
- **Cryptographic 4-Digit Handshake Code**: Mutual trust is guaranteed by a 4-digit verification code required to complete tasks and earn trust points.
- **Real-Time In-Task Chat**: Secure two-way messaging between citizens and specialists during active missions.
- **Dynamic Departments Engine**: Admins can create and customize departments in real-time with automatic icon detection and color selectors.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) 16 (App Router with Turbopack)
- **Frontend Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4, Lucide React icons
- **Fonts**: Next.js Google Fonts (`Plus Jakarta Sans` & `Outfit`)
- **Maps & Geolocation**: Leaflet, React-Leaflet, OpenStreetMap, HTML5 Geolocation API
- **Backend & Database**: Firebase Authentication, Cloud Firestore (Real-time snapshot listeners & transactions)
- **Email Service**: Nodemailer with Gmail SMTP Integration

---

## 📂 Project Structure

```text
localend/
├── app/
│   ├── layout.tsx              # Root Layout, fonts, AuthProvider & ModalProvider
│   ├── page.tsx                # Intelligent role-based redirector
│   ├── globals.css             # Tailwind CSS v4 design tokens & alert styling
│   ├── login/page.tsx          # Citizen & Admin login portal
│   ├── register/page.tsx       # Signup (Citizen or Employee with Department picker)
│   ├── onboarding/page.tsx     # Profile initialization & location binding
│   ├── dashboard/page.tsx      # Fast mission control, urgent SLA banners & leads feed
│   ├── discover/page.tsx       # Hyperlocal Job Board, All Community Help & Radius filter
│   ├── tasks/page.tsx          # "My Requests" & "My Missions" + 4-digit handshake
│   ├── settings/page.tsx       # Profile, coordinates geocoding, password change
│   ├── admin/page.tsx          # Control Center: Dashboard, Employee Module, User Module, All Tasks, Departments, Direct Dispatch
│   └── api/send-email/route.ts # Nodemailer Gmail SMTP route handler
│
├── components/
│   ├── ui/                     # Button, Input, Card, Badge primitives
│   ├── layout/                 # AppLayout, Sidebar, Navbar, Mobile navigation
│   ├── chat/                   # TaskChatModal, TaskChatButton (In-mission chat)
│   ├── requests/               # CreateRequestModal, HelpDetailModal
│   ├── location/               # LocationPicker (SSR-safe Leaflet wrapper), LocationPickerMap
│   ├── notifications/          # NotificationSidebar with real-time Firestore feed
│   └── reviews/                # ReviewModal (5-star ratings & mutual reviews)
│
├── contexts/
│   ├── AuthContext.tsx         # Firebase Auth state & user profile listener
│   └── ModalContext.tsx        # Global request modal manager
│
├── services/
│   ├── departments.service.ts  # Dynamic department CRUD & subscriptions
│   ├── requests.service.ts     # Help request CRUD & state transitions
│   ├── offers.service.ts       # Specialist proposals & atomic acceptance
│   ├── tasks.service.ts        # Task lifecycle, direct claim & code verification
│   ├── reviews.service.ts      # Mutual review submissions & aggregates
│   └── users.service.ts        # User profile management & queries
│
├── lib/
│   ├── firebase/client.ts      # Centralized Firebase client singleton
│   ├── distance.ts             # Haversine distance, 45+ towns gazetteer, geocoding fallbacks
│   ├── slaEscalation.ts        # SLA deadline calculation, auto-escalation, email triggers
│   ├── sortUtils.ts            # Scheduled date/time sorting utility
│   └── utils.ts                # Styling class utility (cn)
│
└── types/
    └── index.ts                # TypeScript domain models (User, HelpRequest, HelpTask, etc.)
```

---

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
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

## 🚀 Quick Start Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build Production Bundle
```bash
npm run build
```

### 4. Run Production Server
```bash
npm run start -- -p 3008
```
Runs the compiled application on [http://localhost:3008](http://localhost:3008).

---

## 🛡️ Default Access Accounts

- **Admin Login**:
  - Email: `admin@gmail.com`
  - Password: `admin123`
  - Redirects to `/admin`
- **Employee & Citizen Accounts**:
  - Register freely via `/register` (choose role and department).
