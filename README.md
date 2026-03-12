# Vehicle Dates

A mobile-friendly web app for tracking important dates across all your vehicles — Tax, MOT, Insurance and Service — with automatic data retrieval from the DVLA.

---

## Features

- **Vehicle registry** — store vehicles by UK registration number with make, model, colour, year, V5C document number and notes
- **DVLA integration** — automatically fetches Tax status, Tax due date, MOT status and MOT expiry from the DVLA Vehicle Enquiry API
- **Scheduled refresh** — DVLA data is updated nightly at 03:00 for all vehicles; a manual refresh button is available per vehicle and for all vehicles at once
- **Date tracking** — track Tax, MOT, Insurance and Service dates with tap-to-edit calendar pickers
- **Dashboard alerts** — colour-coded notifications at the top of the dashboard for any dates expiring within 30 days or already overdue
- **SORN support** — mark vehicles as SORN; Tax alerts are suppressed and the Tax badge shows SORN status
- **Vehicle archiving** — archive sold or scrapped vehicles, optionally recording sale date and buyer details
- **User accounts** — username/password login with admin and standard roles; first-launch setup wizard creates the initial admin account
- **Dark mode** — toggleable, with preference saved to `localStorage` and OS preference respected on first visit
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
| `PORT` | `3001` | Port the server listens on |
| `NODE_ENV` | _(none)_ | Set to `production` to enable static file serving from `dist/` |

### JWT_SECRET

Sessions are signed with an HS256 JWT stored in an HTTP-only cookie. You must set `JWT_SECRET` to a long random string before deploying — the server will log a warning at startup if it is missing or set to the default value.

Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Changing `JWT_SECRET` invalidates all existing sessions (all users will be signed out).

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
