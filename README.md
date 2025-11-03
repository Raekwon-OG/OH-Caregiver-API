# OneHaven Caregiver API

[![Prechecks](https://github.com/Raekwon-OG/OH-Caregiver-API/actions/workflows/prechecks.yml/badge.svg?branch=main)](https://github.com/Raekwon-OG/OH-Caregiver-API/actions/workflows/prechecks.yml)

A compact backend for the OneHaven caregiver app. Built with TypeScript, Express, Mongoose, Supabase auth (JWT), Zod validation and Socket.IO realtime hooks.

## Quick setup

Prerequisites
- Node.js 18+
- npm (or pnpm/yarn)
- MongoDB (local or Atlas)
- Supabase project (for authentication)

Clone & install
```bash
git clone https://github.com/Raekwon-OG/OH-Caregiver-API.git
cd OH-Caregiver-API
npm install
```

Environment
```bash
cp .env.example .env
# edit .env: set MONGODB_URI, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
# SUPABASE_SERVICE_ROLE_KEY (server-only) and JWT_SECRET (server-only if HS tokens used)
```

Run
```bash
npm run dev
```

Swagger UI: http://localhost:4000/docs
Health: http://localhost:4000/health

Dev helpers
```bash
npx ts-node scripts/supabase-client.ts signup you@example.com 'Password1!'
npx ts-node scripts/supabase-client.ts login you@example.com 'Password1!' -t
```

Running the real-socket concurrency test (local only)
```bash
# This test uses a real Socket.IO client and is skipped by default. To run it locally:
RUN_REAL_SOCKET=true npm test -- tests/integration/protectedMember.realSocket.test.ts
```

## Design explanation (succinct)

1. Language & framework
	- TypeScript for type safety and DX (autocomplete, early errors).
	- Express for lightweight routing and middleware.
	- Socket.IO for realtime events; OpenAPI v3 for docs; Winston for logging.

2. Authentication & identity
	- Supabase as identity provider.
	- Verify RS*/ES* via JWKS, HS* via server `JWT_SECRET`.
	- Local-only verification (no remote introspection) with strict issuer/audience/maxAge.

3. Database & architecture
	- MongoDB for application data; Express services are the single source of truth for business logic.
	- Modular separation (routes, controllers, services, middleware) for maintainability.

4. Security considerations
	- Token alg detection and appropriate verification path.
	- Mask sensitive info in logs/health and require server-only secrets where appropriate.

5. Scalability & maintainability
	- Prewarm JWKS to reduce cold-start latency.
	- Modular code and CI/CD-friendly layout for easier testing and reviews.

6. Request lifecycle
	- Token verification → payload mapping → caregiver sync → controller execution →  Socket.IO emit.

7. Developer experience & observability
	- Per-request debug/audit logs for auth verification paths.
	- Health endpoint includes masked JWKS status for monitoring.

## Event flow (brief)

1. Client obtains JWT from Supabase.
2. Client calls protected API with Authorization: Bearer <token>.
3. `requireAuth` middleware detects alg and verifies token (JWKS or HMAC), syncs caregiver record, attaches `req.user`.
4. Controllers run business logic and should emit Socket.IO events to connected clients.

## AI usage summary (short)

- The AI assistant was used as a developer tool to accelerate implementation: scaffolding, auth/JWKS handling, per-request audit logs, Socket.IO wiring, diagnostics for JWKS prewarm, the supabase-client helper, and OpenAPI docs.
- Implementation was iterative and guided by the developer: design choices, security hardening, and logging hygiene were reviewed and adjusted.
- All code changes are in the repository for human review; server only secrets remain the developer's responsibility to provision in environment.

## Continuous Integration

A GitHub Actions workflow named `prechecks` runs on PRs to `main`. It performs TypeScript type-checking, ESLint linting, builds the project, and starts the built server to run a minimal /health smoke test (a MongoDB service is available to the job). The badge above links to the workflow run page.

## Branch Protection

Direct pushes to the main branch are disabled. All changes must be proposed via pull requests and must pass the prechecks workflow (.github/workflows/prechecks.yml) before they can be merged. The prechecks workflow runs TypeScript type-check, ESLint, build, and a minimal /health smoke test.
