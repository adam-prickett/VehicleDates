# Vehicle Dates

A mobile-friendly web app for tracking important dates across all your vehicles — Tax, MOT, Insurance and Service — with automatic data retrieval from the DVLA.

---

## Features

- **Vehicle registry** — store vehicles by UK registration number with make, model, colour, year, V5C document number and notes
- **DVLA integration** — automatically fetches Tax status, Tax due date, MOT status and MOT expiry from the DVLA Vehicle Enquiry API
- **Scheduled refresh** — DVLA data is updated nightly at 03:00 for all vehicles; a manual refresh button is available per vehicle and for all vehicles at once
- **Date tracking** — track Tax, MOT, Insurance and Service dates with tap-to-edit calendar pickers
- **Service history** — record individual service jobs against a vehicle (full service, oil change, brake pads, tyres, etc.) with date, mileage, cost and notes
- **Insurance policy details** — record policy number/reference and annual premium alongside the existing provider and expiry date, and upload the certificate (PDF, JPEG, PNG or HEIC) for safekeeping
- **Dashboard alerts** — colour-coded notifications at the top of the dashboard for any dates expiring within 30 days or already overdue
- **SORN support** — mark vehicles as SORN; Tax alerts are suppressed and the Tax badge shows SORN status
- **Vehicle archiving** — archive sold or scrapped vehicles, optionally recording sale date and buyer details
- **User accounts** — username/password login with admin and standard roles; first-launch setup wizard creates the initial admin account
- **Dark mode** — toggleable, with preference saved to `localStorage` and OS preference respected on first visit
- **Installable (PWA)** — installs to your home screen with an offline-capable app shell; an in-app install banner prompts you on supported browsers, with Add to Home Screen instructions on iOS Safari
- **Export / Import** — back up all vehicle data as JSON and restore it on any device
- **Responsive** — works on mobile, tablet and desktop; grid layout on larger screens

---

## Quick Start (Docker)

The easiest way to run Vehicle Dates is with Docker Compose.

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)

```bash
# 1. Clone the repo
git clone <repo-url>
cd VehicleDates

# 2. Set required environment variables
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export DVLA_API_KEY=your_key_here   # optional

# 3. Build and start
docker compose up -d

# 4. Open in your browser — you will be prompted to create an admin account
open http://localhost:3001
```

The SQLite database is stored in a named Docker volume (`vehicle_data`) so your data persists across container restarts and rebuilds.

To stop the app:

```bash
docker compose down
```

To rebuild after updating the code:

```bash
docker compose up -d --build
```

---

## Local Development

**Prerequisites:** [Node.js](https://nodejs.org/) v20+ and npm

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET (see below)

# 3. Run database migrations
npm run db:migrate

# 4. Start the development servers
npm run dev
```

This starts:
- **API server** on `http://localhost:3001` (with hot-reload via `tsx watch`)
- **Vite dev server** on `http://localhost:5173` (proxies `/api` to the server)

Open `http://localhost:5173`. On first launch you will be prompted to create an administrator account.

---

## DVLA API Key

Vehicle Dates uses the [DVLA Vehicle Enquiry Service API](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html) to fetch Tax and MOT dates.

To obtain a key:
1. Register at the [DVLA API Developer Portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk/)
2. Request access to the **Vehicle Enquiry Service**
3. Copy your API key

You can provide the key in two ways:

**Option A — Settings screen (recommended)**
Navigate to **Settings** (gear icon in the nav) and paste your key. It is stored in the local database and takes effect immediately with no restart required.

**Option B — Environment variable**
Set `DVLA_API_KEY` in your `.env` file (local dev) or in `docker-compose.yml`. The Settings screen will show it as active but will not allow editing it from the UI.

> **Note:** The DVLA API does not return vehicle model. This field must be entered manually.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | _(insecure default)_ | Secret used to sign session tokens — **must be set in production** |
| `DVLA_API_KEY` | _(none)_ | DVLA Vehicle Enquiry Service API key (optional if set via Settings) |
| `DATABASE_URL` | `./vehicles.db` | Path to the SQLite database file |
| `UPLOADS_DIR` | `./uploads` | Directory where uploaded files (e.g. insurance certificates) are stored — must be writable and should be on a persistent volume in production |
| `PORT` | `3001` | Port the server listens on |
| `NODE_ENV` | _(none)_ | Set to `production` to enable static file serving from `dist/` |

### JWT_SECRET

Sessions are signed with an HS256 JWT stored in an HTTP-only cookie. You must set `JWT_SECRET` to a long random string before deploying — the server will log a warning at startup if it is missing or set to the default value.

Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Changing `JWT_SECRET` invalidates all existing sessions (all users will be signed out).

## Resetting a Lost Admin Password

If you are locked out of the admin account, you can reset a password directly on the server without going through the web interface. This requires shell (SSH) access to the machine running the app.

```bash
# Reset the first admin account found
npm run reset-admin-password

# Reset a specific user by username
npm run reset-admin-password -- --username alice
```

You will be prompted to enter and confirm the new password (input is hidden). The change takes effect immediately — no restart required.

In Docker:

```bash
docker compose exec app npm run reset-admin-password
```

## User Management

On first launch, the setup wizard creates an administrator account. Admins can manage users via the people icon in the navbar:

- **Add users** — choose username, password, and role (admin or standard)
- **Change passwords** — admins can change any password; standard users can change their own
- **Delete users** — admins can delete any account except their own and the last remaining admin

---

## Database

Vehicle Dates uses **SQLite** via [Drizzle ORM](https://orm.drizzle.team/). The database file is created automatically on first run and migrations are applied on startup.

```bash
# Generate a new migration after changing the schema
npm run db:generate

# Apply pending migrations manually
npm run db:migrate
```

---

## Service History

Each vehicle has its own log of service jobs, accessible from the vehicle detail page. Use it to keep a record of what was done, when, at what mileage and for how much.

Each record captures:

- **Type** — pick from common presets (Full Service, Interim Service, Oil Change, Brake Pads, Brake Discs, Tyres, Battery, Air Filter, Cabin Filter, Spark Plugs, Coolant Flush, Cambelt) or enter a custom value via **Other**
- **Date** — when the work was carried out
- **Mileage** — odometer reading at the time (optional)
- **Cost** — entered in pounds and stored as integer pence (optional)
- **Notes** — free-text (garage, parts replaced, oil grade, etc.)

Records are sorted newest-first and can be edited or deleted at any time. When a vehicle is permanently removed, its service history is removed with it (cascade delete).

This is separate from the **Next Service** date shown in the dates grid, which tracks the upcoming service due date.

---

## Insurance Policy & Certificate

Each vehicle's Insurance section captures:

- **Provider** — e.g. Admiral, Direct Line
- **Expiry date** — also surfaced on the dashboard alerts
- **Policy number / reference** — free-text, up to 100 characters
- **Annual premium** — entered in pounds and stored as integer pence
- **Certificate file** — upload your insurance certificate or schedule for safekeeping; download it back at any time

**Allowed file types:** PDF, JPEG, PNG, HEIC/HEIF. **Max size:** 10 MB. Uploading a new certificate replaces the previous one (the old file is removed from disk). Removing a vehicle also removes its certificate file.

Files are written to the directory pointed to by the `UPLOADS_DIR` environment variable (default `./uploads`). In Docker this defaults to `/data/uploads` and lives on the same persistent volume as the database, so your uploads survive container rebuilds.

---

## Install as an App (PWA)

Vehicle Dates is a Progressive Web App and can be installed to your phone, tablet or desktop for a faster, full-screen experience that looks and feels like a native app.

- **Android / Chrome / Edge** — an "Install Vehicle Dates" banner appears in-app; tap **Install** to add it to your home screen. You can also use the browser menu's "Install app" option.
- **iOS Safari** — programmatic installation isn't supported, so the in-app banner shows instructions instead: tap the **Share** icon, then **Add to Home Screen**.
- **Desktop** — supported browsers show an install icon in the address bar.

Once installed, the app runs in its own window without browser chrome and remains usable for navigation while offline (API requests still require a connection — your vehicle data isn't cached locally). Updates are picked up automatically on the next launch.

The dismiss button hides the prompt for two weeks; it won't appear again until then (or until you clear site data).

---

## Data Export & Import

Use the **Settings** screen to export all your vehicle data as a JSON file, or import a previously exported file. On import:
- Vehicles not yet in the database are **added**
- Vehicles with a matching registration number are **updated**

This makes it straightforward to move data between devices or restore from a backup.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Backend | [Hono](https://hono.dev/) + [@hono/node-server](https://github.com/honojs/node-server) |
| Database | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) + [Drizzle ORM](https://orm.drizzle.team/) |
| Frontend | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) |
| Styling | [Tailwind CSS v3](https://tailwindcss.com/) |
| Data fetching | [TanStack Query](https://tanstack.com/query) |
| Routing | [React Router v7](https://reactrouter.com/) |
| Scheduling | [node-cron](https://github.com/node-cron/node-cron) |
| Auth | [jose](https://github.com/panva/jose) (JWT) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) |
| Validation | [Zod](https://zod.dev/) |
