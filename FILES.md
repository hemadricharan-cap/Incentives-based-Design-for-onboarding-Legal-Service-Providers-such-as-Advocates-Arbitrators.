# Project File Guide

This document explains the purpose of each file and directory in the LexIncentive project.

## Top-level
- `package.json`: Project metadata, dependencies, and scripts (`start`, `dev`).
- `server.js`: Express application entry point. Configures middleware, sessions, view engine, routes, seeds demo data, and starts the server with port fallback.
- `README.md`: Project overview, tech stack, data model, setup instructions, and seed accounts.
- `FILES.md`: This file. Overview of files and what they do.
- `public/`: Static assets served directly by Express.
- `src/`: All application source code (database layer, routes, and views).
- `data/`: Persisted SQLite database file created/updated at runtime.

## public/
- `public/css/styles.css`: Global styles customized on top of Bootstrap (hero background, stat cards, fonts).
- `public/js/main.js`: Small client-side helpers (e.g., dynamic year in footer).

## src/
- `src/db.js`: Database layer using sql.js (WASM SQLite). Responsibilities:
  - Initializes database and schema on startup.
  - Persists the in-memory DB to `data/app.sqlite` after writes.
  - User management (register, auth, referral points).
  - Service CRUD (create, list, fetch by id, list by provider).
  - Engagement CRUD (create with milestones, list by role, fetch with milestones).
  - Milestone completion logic (marks done and records payouts).
  - Payouts queries (sum of earnings, list of payouts).
  - Reviews (basic create).
  - `seedDemoData()` to insert demo users, services, and a sample engagement.

### src/routes/
- `src/routes/auth.js`: Authentication routes.
  - GET `/login`, POST `/login`, POST `/logout`.
  - GET `/register`, POST `/register` with optional referral code.
- `src/routes/services.js`: Services catalog for providers and clients.
  - GET `/services` (list), GET `/services/new` (form for providers), POST `/services` (create), GET `/services/mine` (provider’s own), GET `/services/:id` (detail).
- `src/routes/engagements.js`: Engagement lifecycle.
  - GET `/engagements` (role-based list), GET `/engagements/new/:serviceId` (create form with milestones), POST `/engagements` (create), GET `/engagements/:id` (detail with milestones), POST `/engagements/milestones/:milestoneId/complete` (provider completes milestone → payout).
- `src/routes/dashboard.js`: Role-based dashboards.
  - Providers: earnings total, payouts list, recent services, referral code.
  - Clients: active/completed engagement counts, referral code.

### src/views/
Server-rendered EJS templates with Bootstrap styling and `express-ejs-layouts`.

- `src/views/layout.ejs`: Base layout wrapper (header, footer, flash messages, container).
- `src/views/index.ejs`: Landing page with hero, quick explanation, and features.
- `src/views/login.ejs`: Login form.
- `src/views/register.ejs`: Registration form (role + optional referral code).
- `src/views/dashboard.ejs`: Role-specific dashboard content and (for providers) Chart.js line chart of payouts.
- `src/views/not-found.ejs`: 404 page.

#### src/views/partials/
- `src/views/partials/header.ejs`: Top navigation bar (role-aware links and auth controls).
- `src/views/partials/footer.ejs`: Footer (dynamic year and small note).

#### src/views/services/
- `src/views/services/index.ejs`: Services listing with provider name and incentive type.
- `src/views/services/new.ejs`: Create service form (title, description, base rate, incentive type/details).
- `src/views/services/mine.ejs`: Provider’s own services list.
- `src/views/services/show.ejs`: Service detail with CTA for clients to start an engagement.

#### src/views/engagements/
- `src/views/engagements/index.ejs`: Engagements listing (labels differ for provider vs client).
- `src/views/engagements/new.ejs`: Create engagement form with up to five milestones.
- `src/views/engagements/show.ejs`: Engagement detail page showing milestones; provider can mark milestones complete.

## data/
- `data/app.sqlite`: SQLite database file persisted by sql.js. Created and updated at runtime; safe to delete if you want a fresh start (the app will recreate schema and reseed demo data).

## How requests flow
1. Request hits `server.js` where middleware, sessions, and routes are registered.
2. A route in `src/routes/*` handles the request and interacts with `src/db.js` for data.
3. The route renders an EJS template in `src/views/*` using the shared layout, or redirects to another route.
4. On DB writes, `src/db.js` persists the database to `data/app.sqlite`.

## Development commands
- `npm install`: Install dependencies.
- `npm start`: Start the server (falls back to the next port if 3000 is busy).
