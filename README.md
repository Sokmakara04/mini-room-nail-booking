# 💅 Luxe Nails Studio — Fingernail Salon Booking System

A specialized, bilingual (Khmer 🇰🇭 and English 🇬🇧) booking system built with **Node.js**, **Express.js**, **Supabase PostgreSQL Cloud Database**, and a **Telegram Bot** designed exclusively for **fingernail care, manicures, and nail art**.

---

## 🌟 Key Features

### 1. Supabase Cloud Database Integration
- Full migration from MongoDB to **Supabase PostgreSQL**.
- Official `@supabase/supabase-js` client library with server-side privilege isolation.
- Complete SQL schema in `supabase/schema.sql` covering `users`, `services`, `salon_settings`, `bookings`, `staff`, and `notifications`.
- Row Level Security (RLS) enabled on all tables, protecting customer data while granting public access only to active services and salon hours.
- Automated data migration script (`npm run migrate:supabase`) to import existing MongoDB collections with zero data loss.

### 2. Strictly Fingernail Services Only
- Exclusively dedicated to fingernails: Basic Manicure, Gel Polish, Nail Art Design, Nail Extensions (Gel/Acrylic), Gel Removal & Care, and French Tips.
- Full Admin CRUD: add, edit, toggle active status, and delete nail services with custom prices, durations, descriptions, and images.

### 3. Intelligent Appointment Scheduling
- **Phnom Penh Timezone (`Asia/Phnom_Penh`)** enforced across all booking operations.
- Duration-based time slot calculator ensures start-to-end times (`e.g. 10:00 - 10:45`) do not overlap beyond the salon's concurrent station capacity.
- Salon operating hours, break times (e.g. 12:30 - 13:30), working days, and custom days off/holidays are fully configurable by the administrator.
- Concurrency and double-booking protection rejects overlapping simultaneous booking requests.
- Past appointment dates and times are automatically blocked.

### 4. Telegram Booking Bot
- Interactive bilingual flow:
  1. `/start` -> Choose Language (🇰🇭 ភាសាខ្មែរ / 🇬🇧 English)
  2. Select active fingernail service with instant price and duration preview.
  3. Inline date picker for upcoming days.
  4. Real-time available time slots picker.
  5. Customer name and phone input (supports text and Telegram Contact card).
  6. Live review summary with **Confirm** and **Cancel** buttons.
  7. Unique Booking Reference code generated (e.g. `NL-AB254U`).
  8. Instant admin Telegram alert with 1-click **Confirm** and **Reject** buttons.
  9. Automatic customer notification sent in their selected language upon status update.
- Commands: `/start`, `/book`, `/services`, `/status`, `/cancel`, `/language`, `/myid`, `/help`.

### 5. Modern Bilingual Website
- **Home Page (`/`)**: Hero section, service highlights, salon hours, and quick status lookup.
- **Services Page (`/services`)**: Detailed fingernail catalog with images, durations, and pricing.
- **Booking Page (`/book`)**: Dynamic appointment booking with interactive slot grid fetched via `/api/available-slots`.
- **Confirmation Page (`/book` POST result)**: Clean reference summary with status pill.
- **Status Lookup Page (`/status`)**: Customer lookup by Booking Reference code or phone number.
- High-end aesthetics using **Google Fonts (Plus Jakarta Sans + Noto Sans Khmer)** and responsive CSS.

### 6. Secure Admin Dashboard (`/admin`)
- HTTP Basic Authentication protection using credentials from `.env`.
- **Appointments Management**:
  - Filter by date and status (`pending`, `confirmed`, `rejected`, `cancelled`, `completed`).
  - Search by customer name, phone number, or booking reference.
  - 1-click Confirm, Reject, Complete, Cancel actions.
  - Reschedule modal with date/time availability validation.
- **Fingernail Services Management**:
  - Add, edit, activate/deactivate, and delete services.
- **Salon Operating Hours & Capacity**:
  - Opening/closing hours, slot interval, concurrent nail stations, break times, and days off list.

---

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **Supabase Account & Project**: [supabase.com](https://supabase.com)
- **Telegram Bot Token**: Created via [@BotFather](https://t.me/BotFather)

---

## 🚀 Supabase Cloud Setup & Running

### 1. Run the Database Schema in Supabase

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** in the left sidebar.
3. Click **New Query**.
4. Copy and paste the entire contents of `supabase/schema.sql`.
5. Click **Run**.
   - This creates tables: `users`, `services`, `salon_settings`, `bookings`, `staff`, `notifications`.
   - Enables Row Level Security (RLS) policies.
   - Pre-seeds 6 default fingernail services and salon operating hours.

### 2. Configure Environment Variables

Edit `.env` (or copy from `.env.example`):

```env
PORT=3000

# Supabase Credentials (Project Settings -> API)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
ADMIN_TELEGRAM_CHAT_ID=-1004461715880

# Admin Dashboard Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_to_a_strong_password

# Salon Settings
SALON_NAME=Mini Room Nail & Eyelash
SALON_PHONE=012345678
SALON_TIMEZONE=Asia/Phnom_Penh

# Optional (Only if migrating from MongoDB):
MONGODB_URI=mongodb://127.0.0.1:27017/beauty_salon_booking
```

### 3. (Optional) Migrate Existing MongoDB Data

If you have existing data in MongoDB Atlas or local MongoDB:

```powershell
npm run migrate:supabase
```

This script will:
- Connect to MongoDB and Supabase.
- Migrate salon settings, fingernail services, and customer bookings.
- Preserve MongoDB IDs, booking reference codes, and timestamps.
- Report migration counts and verification summary.

### 4. Start the Application

**Development Mode (Auto-reloads on edits):**
```powershell
npm run dev
```

**Production Mode:**
```powershell
npm start
```

- **Customer Website:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin (Default: `admin` / `123`)

---

## ☁️ Render.com Cloud Deployment Guide

Follow these steps to deploy **Mini Room Nail & Eyelash Booking System** to [Render](https://render.com).

### Step 1: Upload Project to GitHub

1. Ensure sensitive files like `.env` and `node_modules` are excluded (already configured in `.gitignore`).
2. Initialize Git, stage files, and make your initial commit:
   ```powershell
   git init
   git add .
   git commit -m "feat: prepare nail salon booking system for Render deployment"
   ```
3. Create a **new repository** on [GitHub](https://github.com/new) (recommended: **Private**).
4. Link your local repository and push:
   ```powershell
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git
   git push -u origin main
   ```

---

### Step 2: Create a Web Service on Render

#### Option A: Using the Render Blueprint (`render.yaml`) — Recommended
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository.
4. Render will automatically detect `render.yaml` and configure:
   - **Service Type:** Web Service
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
5. Fill in the required environment variables prompted by the Blueprint wizard.
6. Click **Apply**.

#### Option B: Manual Web Service Setup
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your repository.
4. Configure service settings:
   - **Name:** `mini-room-nail-booking` (or your preferred name)
   - **Region:** Choose the region closest to your customers (e.g., Singapore for Cambodia/Southeast Asia)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (or higher)
5. Scroll down to **Advanced** -> **Health Check Path** and set it to `/health`.

---

### Step 3: Configure Environment Variables in Render

In your Web Service page on Render, navigate to **Environment** tab and add the following variables:

| Variable Name | Required | Default / Example | Purpose |
|---|:---:|---|---|
| `NODE_ENV` | **Yes** | `production` | Enables production optimizations |
| `PORT` | Auto | *Provided by Render* | Render injects this automatically (defaults to 10000 on Render) |
| `SUPABASE_URL` | **Yes** | `https://xyzproject.supabase.co` | Project URL from Supabase Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | `eyJhbGciOi...` | `service_role` secret key from Supabase Settings -> API |
| `TELEGRAM_BOT_TOKEN` | **Yes** | `123456789:ABCdef...` | Bot token obtained from [@BotFather](https://t.me/BotFather) |
| `ADMIN_TELEGRAM_CHAT_ID` | Optional | `-1001234567890` or `12345678` | Telegram Chat/Group ID to receive new booking alerts with 1-click Confirm/Reject |
| `ADMIN_USERNAME` | **Yes** | `admin` | Admin dashboard HTTP Basic Auth username |
| `ADMIN_PASSWORD` | **Yes** | `CreateAStrongPassword!` | Admin dashboard HTTP Basic Auth password |
| `SALON_NAME` | Optional | `Mini Room Nail & Eyelash` | Salon name displayed across website and receipts |
| `SALON_PHONE` | Optional | `012345678` | Contact phone displayed to customers |
| `SALON_TIMEZONE` | Optional | `Asia/Phnom_Penh` | Timezone for appointment slots and operating hours |

> ⚠️ **Important:** Do NOT commit your real `.env` file to GitHub. Only configure production secrets directly inside the Render Dashboard under **Environment**.

---

### Step 4: Verify Database Connectivity in Supabase

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** -> paste and run the queries from `supabase/schema.sql` if not already executed.
3. Check the **Table Editor** in Supabase to ensure the following tables exist:
   - `services`
   - `salon_settings`
   - `bookings`
   - `users`
   - `notifications`
4. When the Render Web Service deploys, review the **Logs** tab in Render:
   - You should see: `[Database] Supabase PostgreSQL connected successfully.`

---

### Step 5: Post-Deployment Verification Checklist

Once Render shows **Deploy succeeded**, test your live URL (`https://your-service.onrender.com`):

1. **Health Check:**
   - Open `https://your-service.onrender.com/health` -> verify it returns `{"status":"ok"}`.
2. **Customer Website & Services:**
   - Visit `https://your-service.onrender.com` -> check hero banner, services, and language toggle (🇰🇭 / 🇬🇧).
   - Visit `https://your-service.onrender.com/services` -> verify fingernail service catalog loads from Supabase.
3. **Interactive Booking:**
   - Go to `https://your-service.onrender.com/book` -> select service, pick a date, choose a time slot, and submit.
   - Confirm you receive a `NL-XXXXXX` reference code.
4. **Admin Dashboard:**
   - Visit `https://your-service.onrender.com/admin` -> enter `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
   - Verify the newly created booking appears with `pending` status.
5. **Telegram Bot:**
   - Send `/start` to your bot in Telegram -> test the bilingual booking flow.
   - If `ADMIN_TELEGRAM_CHAT_ID` is set, check for the new appointment alert with inline Confirm/Reject buttons.

---

### Step 6: Common Issues & Troubleshooting

- **Telegram 409 Conflict during Deploy:**
  - *Cause:* Telegram only permits one polling connection per bot token. During Render zero-downtime rolling deploys, the new instance boots while the old instance shuts down.
  - *Resolution:* Normal behavior. The new container automatically recovers within seconds once the previous container stops.
- **`TABLES_NOT_FOUND` Warning in Logs:**
  - *Cause:* `supabase/schema.sql` has not been executed on the connected Supabase database.
  - *Resolution:* Copy the contents of `supabase/schema.sql` into the Supabase SQL Editor and click **Run**.
- **Admin Login Fails:**
  - *Cause:* Browser cached old basic auth credentials or `ADMIN_USERNAME` / `ADMIN_PASSWORD` in Render environment differs from input.
  - *Resolution:* Test in an incognito window or clear basic auth session in the browser.
- **Render Free Tier Spin-Down:**
  - *Behavior:* Free instances spin down after 15 minutes of inactivity and take ~30-50 seconds to wake up on the first incoming request.
  - *Tip:* Upgrade to Render Starter ($7/mo) or use a free uptime monitor (e.g. UptimeRobot) pinging `/health` every 10 minutes to keep it warm.

---

### Step 7: Continuous Deployment & Redeployment

Whenever you make changes to your codebase:
```powershell
git add .
git commit -m "fix: your commit description"
git push origin main
```
Render will automatically detect the new commit on `main`, build, and deploy the updated version without manual intervention.

---

## 📁 Project Structure

```
beauty-salon-booking/
├── bot/
│   └── messages.js             # Bilingual Telegram messages (Khmer/English)
├── config/
│   └── supabase.js             # Reusable Supabase client & connection validator
├── models/
│   ├── Booking.js              # Supabase-backed Booking model
│   ├── Notification.js         # Supabase-backed Notification logging model
│   ├── SalonSetting.js         # Supabase-backed Salon operating hours & settings
│   ├── Service.js              # Supabase-backed Fingernail services catalog
│   └── User.js                 # Supabase-backed User and Admin authentication model
├── public/
│   └── styles.css              # Nail salon design system (Khmer & English fonts)
├── scripts/
│   └── migrate-mongo-to-supabase.js  # Safe MongoDB to Supabase migration script
├── supabase/
│   └── schema.sql              # Supabase PostgreSQL schema, RLS policies & seed data
├── utils/
│   └── scheduler.js            # Scheduling engine, timezone, slot availability
├── views/
│   ├── admin.ejs               # Admin dashboard (Appointments, Services CRUD, Hours)
│   ├── book.ejs                # Interactive nail booking page with slot picker
│   ├── home.ejs                # Bilingual homepage with service showcase
│   ├── result.ejs              # Confirmation result page with reference code
│   ├── services.ejs            # Dedicated Fingernail Services catalog
│   └── status.ejs              # Customer booking lookup page
├── .env                        # Local environment configuration (do not commit)
├── .env.example                # Example environment variables template
├── package.json                # Project dependencies and npm scripts
├── render.yaml                 # Render.com cloud deployment blueprint
└── server.js                   # Express application backend & Telegram bot
```
