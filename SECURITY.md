# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Vehicle Dates, please report it responsibly by opening a [GitHub Security Advisory](https://github.com/adam-prickett/VehicleDates/security/advisories/new) rather than a public issue.

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations if known

You can expect an acknowledgement within 48 hours and a resolution or status update within 14 days.

## Security Considerations for Self-Hosters

### JWT Secret

Sessions are signed with an HS256 JWT stored in an HTTP-only cookie. You **must** set `JWT_SECRET` to a long random value before deploying. The server logs a warning at startup if this is missing or set to the default.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Changing `JWT_SECRET` invalidates all existing sessions.

### DVLA API Key

The DVLA API key is stored in the SQLite database. Ensure the database file is not publicly accessible and that your host is not exposing the database path via a misconfigured web server or volume mount.

### Authentication

- Passwords are hashed with bcrypt before storage — plaintext passwords are never persisted.
- Session cookies are `HttpOnly` and should be served over HTTPS in production. Put the app behind a TLS-terminating reverse proxy (e.g. nginx, Caddy) when exposing it to the internet.

### Network Exposure

Vehicle Dates is designed for personal or small-team use on a trusted network. If you expose it to the internet, ensure:
- HTTPS is enforced via a reverse proxy
- The server port (default `3001`) is not directly exposed
- Your Docker volume containing `vehicles.db` is not world-readable

### Data

The database contains UK vehicle registration numbers and personal notes. Treat it as sensitive data and include it in your backup and access-control policies.
