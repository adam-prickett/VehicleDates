# Backlog

Running list of follow-up work, known limitations, and ideas across the whole application. Each item names the area it refers to in its lead-in. Items shipped get crossed off rather than deleted.

- [ ] **Settings — gate admin-only sections.** Standard users can navigate to `/settings` and the DVLA-key, Export and Import sections render but every API call 403s (those endpoints are admin-only). Conditionally render via `useAuth()` so non-admins only see Dashboard Alerts, Notifications and Notification Channels.
- [ ] **Notifications — timezone auto-detect on first setup.** Preferences default to `Europe/London`. The client knows the browser's zone via `Intl.DateTimeFormat().resolvedOptions().timeZone` — pre-fill the picker, or seed server-side on first create from a value the client supplies.
- [ ] **Notifications — "test before saving" path.** The Test button exists on saved channels only. Add a "Send test" button inside the Add Channel modal that hits a new `POST /api/notifications/preview-channel` taking `{ type, config }` and dispatching without persisting.
- [ ] **Notifications — flag tests in the activity view.** `POST /channels/:id/test` calls the provider but does not write to `notification_log`. Intentional, but worth a one-line note in the Activity panel explaining "Tests don't appear here."
- [ ] **Notifications — minute granularity in the UI.** `send_minute` is in the schema but pinned to `0` in the UI. Either remove the column or expose a minute picker and switch the scheduler from `0 * * * *` to per-minute polling.
- [ ] **Notifications — per-vehicle subscription / opt-out.** Every user's enabled channels receive alerts for *every* vehicle in the shared registry. Needs a join table (or a denylist field on the user) plus a per-vehicle toggle on the detail page.
- [ ] **Notifications — digest mode.** One push per `(vehicle × event × lead-day)` — a Tuesday with three things expiring sends three notifications. Add an opt-in daily-digest mode that batches everything into a single message per channel.
- [ ] **Notifications — quiet hours / day-of-week filter.** The cron fires whenever the user's configured `send_hour` rolls around, including weekends. Extend prefs schema with an allowed-days bitmask or JSON.
- [ ] **Notifications — `run-now` UI hardening.** Currently API-only; if/when wired into UI, add a "dry run" toggle that returns what *would* be sent without dispatching.
- [ ] **Notifications — exponential backoff on transient failures.** A flaky network blip records `failed`, and the next hour we try again. The retry cap masks the worst case but `(2^failures) * 1h` spacing would be friendlier to upstream providers.
- [ ] **Notifications — templatable body.** `renderNotification(p)` in `src/server/notifications/compute.ts` produces a fixed string. Replace with a templating function and an optional per-channel template field.
- [ ] **Notifications — further providers (Twilio, Slack, email, generic webhook).** ntfy, Pushover and Discord are now shipped. Each addition is a single file under `src/server/notifications/providers/` plus a line in `providers/index.ts`; the channel modal is now field-driven so no client changes are needed.
- [ ] **Notifications — ntfy UTF-8 header support.** Non-ASCII chars in title/tags get coerced to `?` because of HTTP/1.1 header rules. ntfy supports a JSON request format that handles UTF-8; switch when we hit a real complaint. Body is UTF-8 and unaffected.
- [ ] **Notifications — envelope-encrypt channel configs.** `notification_channels.config` is stored as plain JSON — same protection level as the DVLA key. AES-GCM keyed on `JWT_SECRET` (or a separate `CONFIG_ENCRYPTION_KEY`) would be a small lift, with a migration to encrypt existing rows.
- [ ] **Notifications — mask secrets on GET /channels.** Endpoint scopes by user, but any XSS would leak tokens back from the response. Mirror the DVLA-key approach: provider declares which fields are secret, serializer redacts, edit modal treats a blank field as "keep existing".
- [ ] **Notifications — rate-limit `/api/notifications/*`.** Especially `run-now` could be abused to spam upstream. In-memory per-user 1-call-per-minute limit would do.
- [ ] **Notifications — multi-replica safe scheduler.** `node-cron` runs in the API process; multiple replicas would double-fire. Either gate on a SQLite-row "leader lease" or move to an external scheduler. Not urgent on single-host.
- [ ] **Notifications — Web Push provider.** Service worker push subscription, VAPID keys, persisted push subscriptions per user, new provider type. Real work but the only no-third-party push path.
- [ ] **Notifications — iCal `.ics` feed.** Server-side export (one VEVENT per `vehicle × date`) lets users subscribe from Google/Apple Calendar without push at all. Different shape from notifications but the same source data; share an opaque per-user token to avoid auth on the calendar URL.
- [x] **Notifications — activity / log view.**
- [x] **Notifications — surface failures beyond per-channel test result.**
- [x] **Notifications — failed sends don't dedupe.**
- [x] **Notifications — click-action deep links.**
- [x] **Notifications — log table pruning.**
- [x] **Settings — `make` field type mismatch.**

---

## How to use this file

- When you spot a limitation or "we should do X later" thought during a feature, drop it here as a single bullet. Lead with the **area — short title** so the file scans.
- When something ships, change `[ ]` to `[x]` and leave the bullet in place — the consolidated list of what's been addressed lives in CHANGELOG.md.
