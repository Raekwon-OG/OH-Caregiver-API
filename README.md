# OneHaven Caregiver API (scaffold)

This repository is a TypeScript + Express backend scaffold for the OneHaven challenge. It includes:

- TypeScript Express app scaffold
- Mongoose models for Caregiver and ProtectedMember
- JWT-based auth middleware (development skip mode supported)
- Socket.IO wiring for realtime events
- Basic services, controllers and routes
- Harness script to create a sample caregiver and create members concurrently

See `.env.example` for required environment variables.

To run locally:

1. Install dependencies

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in values (JWT_SECRET, MONGODB_URI)

3. Start dev server

```bash
npm run dev
```

Notes:
- This is initial scaffold. Continue implementing validation with Zod, Swagger generation, tests, and CI as the next steps.
# OH-Caregiver-API
