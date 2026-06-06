# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-06-07

### Added

- **Scheduled push notifications.** Configurable per-user reminders for Tax / MOT / Insurance / Service expiries, dispatched server-side hourly.
  - **Pluggable provider system** under `src/server/notifications/providers/`. **ntfy** is the first implementation (works with `ntfy.sh` and self-hosted instances; supports auth tokens). New providers (Pushover, Twilio, webhook, etc.) drop in as a single file plus one registry line — see `BACKLOG.md` for tracked follow-ups.
  - **Per-event lead-day thresholds** (`30 / 14 / 7 / 3 / 1 / Day of`) selectable independently for each event type via a chip UI. Each threshold fires at most once per `(vehicle, event, expiry-date, channel)` and the dedupe key includes the expiry date so renewing automatically resets the cycle.
  - **Master enabled switch + send-at hour + timezone picker** (with browser-tz suggestion). Time-of-day matching is computed per-user in their configured IANA timezone.
  - **Per-channel Test button**, label, enabled toggle, edit and delete actions under **Settings → Notification Channels**. Confirmation flow on delete; cascade-removes the channel's past activity log rows.
  - **Notification Activity** panel — last 20 sends with status (✓/✗), vehicle, event, lead-day, channel and upstream error message on failure. Auto-refreshes every 30s. Red failure callout appears at the top when any of the recent attempts failed.
  - **`POST /api/notifications/run-now`** — per-user manual trigger that bypasses the time-of-day check (useful right after configuring a channel).
  - **Retry cap on failed sends.** After 3 consecutive failures for the same `(vehicle, event, expiry-date, lead-days, channel)` tuple the scheduler stops retrying until the underlying date changes — prevents a permanently broken channel from filling the log forever.
  - **Click-action deep links.** Set `PUBLIC_BASE_URL` and outbound notifications carry a deep link to the vehicle (ntfy `Click` header). Omitted gracefully when the env var is unset.
  - **Daily log pruning.** A 4am cron drops `notification_log` rows older than 180 days so the table doesn't grow unbounded.
- **New tables and migration `0008_awesome_spirit.sql`:**
  - `notification_channels` — per-user channel definitions, provider type + JSON config + enabled flag.
  - `notification_preferences` — per-user master switch, JSON lead-day arrays, send hour/minute, IANA timezone.
  - `notification_log` — every send and failure with timestamp, status, error and the full dedupe key.
- **New env var:** `PUBLIC_BASE_URL` — base URL the scheduler uses to build deep links inside outbound notifications. Documented in `.env.example` and `docker-compose.yml`.
- **`BACKLOG.md`** — new top-level file tracking application-wide follow-ups and known limitations. Replaces the (intermediate, never-shipped) `NOTIFICATIONS.md`.

### Fixed

- Long-standing TypeScript error on `src/client/pages/VehicleDetailPage.tsx:176` — the `api.vehicles.update` payload type now declares `make: string | null`, matching the server schema. The whole project now typechecks clean.

### Tests

- **66 new tests**, total **219/219** — compute lifecycle / dedupe / threshold selection / SORN + archive skip / calendar-day diff; ntfy URL + header + priority mapping + auth + ASCII coercion + error paths; every API endpoint (preferences upsert, channel CRUD with cross-user isolation, test endpoint with mocked fetch, log scoping, run-now); scheduler (timezone matching, per-channel dedupe, failure persistence, retry cap and cap-reset-on-renewal, click links with and without `PUBLIC_BASE_URL`, log pruning).

## [0.3.4] — 2026-06-06

### Changed

- **Service-history rows are now swipe-to-delete on touch devices** (and pointer-drag on desktop). Swiping a row left reveals a red Delete action; tap to delete with no extra confirmation. Swiping right or tapping outside the row closes the swipe. Only one row can be open at a time. Uses the same iOS-style ease curve as the modal animations.
- **Edit button replaced with a 3-dot (kebab) icon** on each service-history row — opens the edit modal exactly as before.

### Fixed

- **iOS Safari no longer zooms into a focused form field.** All inputs across the app now render at 16 px on touch devices (the threshold below which iOS Safari triggers its auto-zoom), without affecting the denser 14 px sizes used on desktop.

## [0.3.3] — 2026-06-06

### Changed

- **Service history add/edit moved into a modal dialog** matching the date-picker pattern: full-screen blurred backdrop, bottom-sheet on mobile and centred card on desktop, click-outside and Esc to dismiss, body scroll locked while open.
- **Both modals (service record + date picker) now animate in:** the backdrop fades opacity 0 → 1 while the blur grows 0 → 4px in sync; on mobile the panel slides up from below with an iOS-style ease, and on desktop it fades in with a subtle 96 % → 100 % scale.

## [0.3.2] — 2026-06-06

### Fixed

- **Date inputs overflowed the form card on iOS Safari.** Native `input[type="date"]` has an intrinsic min-width based on its picker chrome that ignores `width: 100%`. Stripping `-webkit-appearance` and resetting `min-width` to `0` lets the input respect its container. Affects the service-record form, the vehicle edit form (insurance and next-service dates) and the archive sale-date field.

## [0.3.1] — 2026-06-06

### Security

- **CSRF / cross-origin protection** — added a same-origin middleware on every `/api/*` state-changing request (POST/PUT/DELETE/PATCH). Origin/Referer host must match the request's own host or an entry in the new `ALLOWED_ORIGINS` env var. Closes the cross-site cookie-replay path that `SameSite=Lax` alone left open.
- **Upload content sniffing** — insurance-certificate uploads now verify the leading bytes of the file (PDF `%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47…`, HEIC/HEIF `ftyp…`). Client-declared `Content-Type` is no longer trusted; mismatched contents are rejected with 415, and the sniffed type is stored as the canonical MIME on disk and in the DB.
- **`JWT_SECRET` hard-fail in production** — the server now refuses to issue tokens when `NODE_ENV=production` and `JWT_SECRET` is missing or equals the insecure dev default. `docker-compose.yml` requires the variable via `${JWT_SECRET:?…}`.
- **Token revocation** — added `users.token_version` (migration `0007_clever_crystal.sql`); JWTs carry `ver`. Logout, `PUT /users/:id/password`, and `npm run reset-admin-password` all increment the version, immediately invalidating every existing session for that user.
- **Settings endpoints are now admin-only** — `GET /api/settings/dvla-key`, `POST /api/settings/dvla-key`, `DELETE /api/settings/dvla-key`, `GET /api/settings/export`, and `POST /api/settings/import` reject non-admin users with 403. Previously any authenticated user could read the masked DVLA key hint, replace the key, or wipe/dump every vehicle.
- **Removed DVLA key last-4 hint** from the `/settings/dvla-key` response.
- **RFC 6266 download header** — `Content-Disposition` for the insurance certificate now emits both a quote/backslash-escaped ASCII `filename="…"` fallback and a `filename*=UTF-8''…` parameter so non-ASCII filenames round-trip correctly.

### Tests

- 16 new tests covering CSRF enforcement, content sniffing, token revocation, JWT secret hard-fail and admin gating of settings. Total: **136** (was 120).

## [0.3.0] — 2026-06-05

### Added

- **Insurance policy details** — record policy number/reference and annual premium (stored as integer pence) alongside the existing provider and expiry date.
- **Insurance certificate uploads** — upload, download, and replace a PDF/JPEG/PNG/HEIC certificate per vehicle. 10 MB cap. Stored under `UPLOADS_DIR` (defaults to `./uploads`, `/data/uploads` in Docker). Old files are cleaned up on replace and on vehicle deletion.
- **Progressive Web App** — manifest, service worker, app-shell precache, and in-app install prompt. Shows native install on Chromium browsers and Add-to-Home-Screen instructions on iOS Safari. `/api/*` is `NetworkOnly` (never cached).

### Security

- Patched **6 high-severity CVEs** by bumping `react-router-dom` (7.13.1 → 7.17.x), `drizzle-orm` (0.38.4 → 0.45.x), and `vite` (6.2.1 → 6.4.x).
- Patched **multiple moderate CVEs** by bumping `hono` (4.7.4 → 4.12.23), `@hono/node-server` (1.13.7 → 1.19.14), `postcss` (8.5.3 → 8.5.15), `drizzle-kit` (0.30.4 → 0.31.10), `node-cron` (3.0.3 → 4.2.1). `npm audit` moderate count went from 21 to 4 (remaining are dev-only transitives via `drizzle-kit` → `@esbuild-kit`).

### Tests

- 18 new tests for the insurance feature (CRUD, validation, replace, cascade delete).

## [0.2.0] — 2026-03-30

### Added

- **Per-vehicle service history** — record service jobs (full service, oil change, brake pads, tyres, etc.) with date, mileage, cost (in pence), and notes. Preset type list plus free-text "Other". Records sorted newest-first; cascade-deleted with the vehicle.

### Tests

- 18 new tests covering CRUD, validation, cross-vehicle isolation, and cascade delete.

## [0.1.4] — 2026-03-30

### Maintenance

- Dependabot bump in the npm_and_yarn group.

## [0.1.3] — 2026-03-29

### Fixed

- DVLA API key hint no longer no-ops on replace.

## [0.1.2] — 2026-03-29

### Maintenance

- Dependabot bumps in the npm_and_yarn group (including `undici`).

## [0.1.1] — earlier

### Maintenance

- Dependabot bump.

## [0.1.0] — initial

### Added

- Vehicle registry by UK registration number with make, model, colour, year, V5C and notes
- DVLA Vehicle Enquiry integration with manual + nightly 03:00 refresh
- Tax, MOT, Insurance and Service date tracking with tap-to-edit pickers
- Dashboard alerts for dates within 30 days or overdue
- SORN support
- Vehicle archiving (sold / scrapped / other)
- Username/password auth with admin and standard roles, JWT in HttpOnly cookies
- First-launch setup wizard
- Dark mode
- JSON export / import
- Mobile-friendly responsive UI
- Server-side admin password reset script
- Dockerfile + docker-compose for self-hosting

[0.4.0]: https://github.com/adam-prickett/VehicleDates/compare/v0.3.4...v0.4.0
[0.3.4]: https://github.com/adam-prickett/VehicleDates/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/adam-prickett/VehicleDates/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/adam-prickett/VehicleDates/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/adam-prickett/VehicleDates/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/adam-prickett/VehicleDates/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/adam-prickett/VehicleDates/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/adam-prickett/VehicleDates/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/adam-prickett/VehicleDates/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/adam-prickett/VehicleDates/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/adam-prickett/VehicleDates/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/adam-prickett/VehicleDates/releases/tag/v0.1.0
