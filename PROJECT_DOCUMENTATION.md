# 🌐 Localend — Hyperlocal Neighborhood Mutual-Aid Platform
## Complete Technical Documentation & Setup Manual

---

## 1. 📖 Project Overview

**Localend** is a production-grade, hyperlocal neighborhood mutual-aid and volunteering web application. It connects residents within the same community so they can post help requests (groceries, elderly assistance, pet care, emergency favors, tutoring, etc.), discover nearby requests using real-time distance calculations and interactive maps, volunteer safely via a proposal/approval system, verify completion using a cryptographic 4-digit handshake code, and exchange mutual reputation reviews.

### 🌟 Core Value Proposition
- **Hyperlocal Precision**: Requests are tagged with precise GPS coordinates. Neighbors can filter requests within 5 km, 10 km, 25 km, or 50 km using the Haversine formula.
- **Two-Sided Safety & Trust**: No one can claim a task without requester approval. A 4-digit secret handshake code guarantees that the helper was physically present and completed the task.
- **Zero-Friction Real-Time Updates**: Firestore real-time snapshot listeners ensure offers, tasks, and status changes reflect instantly across screens without page reloads.

---

## 2. 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | **Next.js 16 (App Router)** | Server & Client Components, Turbopack, Fast Navigation |
| **Frontend Library** | **React 19** | UI rendering, Hooks, Concurrency |
| **Language** | **TypeScript 5** | Strict end-to-end type safety |
| **Styling** | **Tailwind CSS v4** | Modern CSS styling, design tokens, responsive UI |
| **Icons & Fonts** | **Lucide React** + Google Fonts | Plus Jakarta Sans & Outfit typography |
| **Maps & Geocoding** | **Leaflet & React-Leaflet** | OpenStreetMap interactive tile map & reverse-geocoding (Nominatim) |
| **Backend & Auth** | **Firebase Authentication** | Email/Password citizen & admin authentication |
| **Database** | **Cloud Firestore** | Real-time NoSQL database with atomic `runTransaction` operations |

---

## 3. 📂 Folder & Architecture Structure

```text
localend/
├── app/                          # Next.js App Router (Pages & Layouts)
│   ├── layout.tsx                # Root layout, fonts, AuthProvider & ModalProvider
│   ├── page.tsx                  # Root redirector (redirects to /dashboard or /login)
│   ├── globals.css               # Tailwind CSS v4 styling & custom tokens
│   ├── login/page.tsx            # Login portal (Citizen & Admin toggle)
│   ├── register/page.tsx         # Citizen signup with live GPS & Leaflet map picker
│   ├── onboarding/page.tsx       # Profile initialization & neighborhood setup
│   ├── dashboard/page.tsx        # Citizen Mission Control (stats, active tasks, nearby feed)
│   ├── discover/page.tsx         # Live request feed, radius filters, interactive map & search
│   ├── tasks/page.tsx            # "My Requests" & "Helping Out" tabs + 4-digit handshake
│   ├── settings/page.tsx         # Profile edit, location update, password change
│   └── admin/page.tsx            # Admin dashboard: community KPIs, status charts, user inspector
│
├── components/                   # Reusable UI Components
│   ├── ui/                       # Primitive components (Button, Input, Card, Badge)
│   ├── layout/                   # AppLayout, Top Navbar, Mobile Navigation
│   ├── requests/                 # CreateRequestModal, HelpDetailModal
│   ├── location/                 # LocationPicker (SSR-safe Leaflet wrapper), LocationPickerMap
│   ├── notifications/            # NotificationSidebar with live Firestore listener
│   └── reviews/                  # ReviewModal (5-star rating & comment dialog)
│
├── contexts/                     # Global Client State
│   ├── AuthContext.tsx           # Firebase Auth state & User Profile provider
│   └── ModalContext.tsx          # Global Create Request Modal controller
│
├── services/                     # Business Logic & Firestore Operations
│   ├── requests.service.ts       # Create, update, cancel, and fetch help requests
│   ├── offers.service.ts         # Volunteer proposals, atomic acceptance via runTransaction
│   ├── tasks.service.ts          # Task lifecycle, atomic 4-digit code verification
│   ├── reviews.service.ts        # 5-star reviews, rating aggregates, trust points
│   ├── users.service.ts          # Citizen profile management & admin queries
│   └── notifications.service.ts  # In-app notifications
│
├── lib/                          # Shared Utilities
│   ├── firebase/client.ts        # Firebase client singleton & environment resolver
│   ├── distance.ts               # Haversine distance calculator & coordinate fallbacks
│   └── utils.ts                  # Class utility (cn)
│
├── data/
│   └── categories.ts             # Community categories (Groceries, Tech, Pet Care, etc.)
│
├── types/
│   └── index.ts                  # Domain models (User, HelpRequest, HelpOffer, Task, Review)
│
├── firestore.rules               # Cloud Firestore security rules
├── next.config.ts                # Next.js configuration
├── package.json                  # Dependencies and scripts
└── tsconfig.json                 # TypeScript path aliases (@/*)
```

---

## 4. 🔄 End-to-End Feature Workflows

### 1. Account Creation & Location Binding
- Citizens register at `/register` with their email, password, name, phone, and home location.
- An interactive OpenStreetMap picker lets the user search an address or click "Use Current Location" to fetch GPS coordinates (`navigator.geolocation`).
- Coordinates and address are saved to the user profile in the `users` collection.

### 2. Posting a Help Request
- From the Dashboard or Discover page, click **"Post a Request"**.
- User fills in:
  - Title, Description, and Category (Groceries, Transport, Medical, etc.).
  - Urgency (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
  - Expected time commitment & Location.
- Automatically captures user's GPS coordinates for accurate distance matching.
- Status initializes as `OPEN`.

### 3. Hyperlocal Distance & Radius Filtering
- Located at `/discover`:
  - **Distance Filters**: `All Distances`, `< 5 km`, `< 10 km`, `< 25 km`, `< 50 km`.
  - **Sorting**: `Nearest First` (calculates Haversine distance from viewer's coordinates) or `Newest First`.
  - **Category & Urgency Filters**: Real-time filtering.
  - **Map Toggle**: Shows requests plotted on an interactive Leaflet map with colored urgency pins.

### 4. Volunteering & Offer Acceptance (Proposal Flow)
1. Neighbor opens a request card in `/discover` or `/dashboard`.
2. Neighbor enters a short note (e.g., *"I can pick this up on my way home"*) and clicks **"Send Help Offer"**.
3. Request status updates to `OFFER_RECEIVED`.
4. The requester gets notified and views incoming offers under `/tasks` (My Requests tab).
5. Requester clicks **"Accept"**:
   - Executes an **atomic Firestore transaction** (`runTransaction`).
   - Marks the chosen offer as `ACCEPTED`.
   - Rejects any other offers.
   - Updates request status to `IN_PROGRESS`.
   - Generates a **random 4-digit verification code** (e.g. `4821`) and creates an active entry in `helpTasks`.

### 5. Task Execution & 4-Digit Handshake Verification
1. Requester sees the **4-digit code** in their **My Requests** screen.
2. Helper sees the assignment in **Helping Out** with the requester's phone number and location.
3. Helper performs the favor.
4. Upon meeting, the requester shares the 4-digit code with the helper.
5. Helper clicks **"Enter Code & Finish"** and submits the 4 digits:
   - Validated atomically in Firestore (`verifyHandshakeCode`).
   - If incorrect: displays an error message.
   - If correct: sets task and request to `COMPLETED`, awards +15 Trust Points to the helper.
6. A review prompt immediately opens on both sides for 5-star ratings.

### 6. Admin Panel (`/admin`)
- Accessible to users with `role: 'admin'`.
- Real-time KPIs: Total Citizens, Open Requests, Active Missions, Completed Tasks.
- Citizen Inspector: Search users, view reputation points, inspect roles.

---

## 5. 📦 How to Send this Project to a Friend

When sharing this project, **do NOT send the huge `node_modules` or `.next` folders**. Those folders take hundreds of megabytes and should always be re-generated on your friend's computer.

### Recommended Files to Share:
```text
✅ app/
✅ components/
✅ contexts/
✅ data/
✅ lib/
✅ public/
✅ services/
✅ types/
✅ .env.example
✅ .gitignore
✅ firestore.rules
✅ next.config.ts
✅ package.json
✅ package-lock.json
✅ postcss.config.mjs
✅ tsconfig.json
✅ README.md
✅ PROJECT_DOCUMENTATION.md
```

### Exclude:
```text
❌ node_modules/      (Generated automatically by npm install)
❌ .next/             (Generated automatically by npm run build / dev)
❌ dist/
```

### ⚡ Quick 1-Step Command to Zip (Run in PowerShell):
```powershell
Compress-Archive -Path app, components, contexts, data, lib, public, services, types, .env.example, .gitignore, firestore.rules, next.config.ts, package.json, package-lock.json, postcss.config.mjs, tsconfig.json, README.md, PROJECT_DOCUMENTATION.md -DestinationPath ..\localend-clean.zip
```
*(This produces `localend-clean.zip` in your parent folder, ready to send via Google Drive, WhatsApp, or email!)*

---

## 6. 🚀 Setup Guide for Your Friend (Step-by-Step)

Share these exact steps with your friend:

### Step 1: Install Node.js
Make sure you have **Node.js 18.18 or higher** (recommended: Node.js 20 LTS or Node.js 22).
Check with:
```bash
node -v
npm -v
```

### Step 2: Unzip and Open in Terminal
Extract the zip file, open your terminal (PowerShell, Command Prompt, or VS Code terminal), and navigate into the folder:
```bash
cd localend-main
```

### Step 3: Install Dependencies
Run:
```bash
npm install
```
*(This installs all packages listed in `package.json`: Next.js 16, React 19, Tailwind CSS v4, Firebase, Leaflet, Lucide, etc.)*

### Step 4: Configure Environment Variables
Create a file named `.env.local` in the project root:
```bash
cp .env.example .env.local
```
*(Or create `.env.local` manually in VS Code and paste your Firebase credentials):*
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Step 5: Firebase Setup & Security Rules
1. In the **[Firebase Console](https://console.firebase.google.com/)**:
   - **Authentication**: Enable **Email/Password** sign-in provider.
   - **Cloud Firestore Database**: Create a database (test mode or production).
2. Go to **Firestore Database → Rules** and publish these rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
*(This ensures all signed-in users can create requests, submit offers, update tasks, and write reviews without getting "Missing or insufficient permissions".)*

### Step 6: Run the Application
Start the development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

To test the production build:
```bash
npm run build
npm run start
```

---

## 7. 🧪 Testing the Complete Flow with Two Accounts

To test the entire application lifecycle locally:
1. Open **[http://localhost:3000](http://localhost:3000)** in Chrome (Window 1) and register as **Alice** (`alice@test.com`).
2. Open an **Incognito Window** in Chrome (Window 2) and register as **Bob** (`bob@test.com`).
3. In **Window 1 (Alice)**: Click **Post a Request**, title it *"Need milk from market"*, and post it.
4. In **Window 2 (Bob)**: Go to `/discover`. The request will appear instantly! Click it, type a message, and click **"Send Help Offer"**.
5. In **Window 1 (Alice)**: Go to `/tasks` (My Requests). Bob's offer appears. Click **"Accept"**.
   - Notice the **4-digit handshake code** (e.g. `7129`) displayed for Alice.
6. In **Window 2 (Bob)**: Go to `/tasks` (Helping Out). Click **"Enter Code & Finish"**, type the 4-digit code, and submit.
7. Both screens will update to **COMPLETED** and prompt for a 5-star review!
