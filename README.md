# LexIncentive – Incentives-based Platform for Legal Service Providers

LexIncentive is a full-stack Node.js web application that aligns legal work with incentives. Providers can publish services with milestone, performance, or referral-based incentives. Clients can initiate engagements, define milestones, and trigger payouts upon completion. The app includes referral points, earnings dashboards, and demo data to showcase the flow.

## What this project showcases

- End-to-end web app using Node.js and Express
- User roles: provider and client
- Service catalog with incentive structures
- Engagements with milestones and milestone completion flow
- Payout tracking and provider earnings dashboard
- Referral system with points
- Server-side rendered UI with Bootstrap and EJS
- Windows-friendly, no native build dependencies (uses sql.js)

## Tech stack used

- Runtime: Node.js (ESM modules)
- Web framework: Express
- Views: EJS with `express-ejs-layouts`
- Styles/UI: Bootstrap 5, Google Fonts (Inter)
- Charts: Chart.js
- Sessions & Flash: `express-session` (in-memory store for demo), `connect-flash`
- Forms: `method-override` for REST-like semantics
- Auth: Email + password using `bcrypt`
- Data layer: SQLite via `sql.js` (pure JS/WASM, no native build needed)

## Why sql.js (WASM) instead of native SQLite

- Works out of the box on Windows without Visual Studio build tools
- Database is persisted to `data/app.sqlite` by exporting the in-memory DB
- Suitable for demos and small apps; for production, consider a server DB (e.g., Postgres) or native SQLite

## Project structure

```
.
├─ server.js                    # Express app bootstrap, sessions, routes, views
├─ package.json                 # Scripts and dependencies
├─ public/                      # Static assets (CSS, JS)
│  ├─ css/styles.css
│  └─ js/main.js
├─ src/
│  ├─ db.js                     # sql.js setup, schema, queries, seeding, persistence
│  ├─ routes/
│  │  ├─ auth.js                # login/logout/register
│  │  ├─ dashboard.js           # role-based dashboards
│  │  ├─ engagements.js         # create/show engagements, complete milestones
│  │  └─ services.js            # list/show/create services
│  └─ views/
│     ├─ layout.ejs             # base layout (used by express-ejs-layouts)
│     ├─ partials/header.ejs
│     ├─ partials/footer.ejs
│     ├─ index.ejs              # home/landing page
│     ├─ login.ejs
│     ├─ register.ejs
│     ├─ dashboard.ejs
│     ├─ not-found.ejs
│     ├─ services/
│     │  ├─ index.ejs
│     │  ├─ new.ejs
│     │  ├─ mine.ejs
│     │  └─ show.ejs
│     └─ engagements/
│        ├─ index.ejs
│        ├─ new.ejs
│        └─ show.ejs
└─ data/
   └─ app.sqlite                # persisted sqlite database file (created at runtime)
```

## Data model (SQLite via sql.js)

- `users` (id, role[provider|client], name, email, password_hash, referral_code, referred_by, points, created_at)
- `services` (id, provider_id, title, description, base_rate, incentive_type[milestone|referral|performance], incentive_details, created_at)
- `engagements` (id, client_id, service_id, status[active|completed|cancelled], created_at)
- `milestones` (id, engagement_id, title, amount, is_completed, completed_at)
- `payouts` (id, provider_id, engagement_id, amount, type[milestone|bonus|referral], created_at)
- `reviews` (id, engagement_id, rating, comment, created_at)
- `referrals` (id, referrer_id, referee_id, reward_points, created_at)

Key flows implemented in `src/db.js`:
- User registration with optional referral code (+points for referrer and referee)
- Service creation by providers
- Engagement creation by clients with up to 5 milestones
- Milestone completion by provider triggers a payout entry
- Provider earnings sum and payout list for dashboards
- Seed data to showcase the app

## Seed/demo data

On startup, the app seeds one provider, one client, three sample services, and one engagement with milestones if the database is empty:

- Provider: `provider@example.com` / `password123`
- Client: `client@example.com` / `password123`

Sample services include:
- Contract Drafting & Review (milestone incentives)
- IP Trademark Filing (performance bonus)
- Startup Compliance Package (referral rewards)

A demo engagement is created for the Startup Compliance Package with three milestones.

## How it works – UX overview

- Visitors can browse services. Clients must log in to start an engagement.
- Clients define milestones and create an engagement.
- Providers see engagements and can mark milestones completed, which records payouts.
- Providers have a dashboard showing total earnings, recent payouts chart, services, and referral code.
- Clients have a dashboard summarizing active/completed engagements and show their referral code.

## Setup and running locally

1. Install Node.js 18+
2. Install dependencies
   - `npm install`
3. Start the server
   - `npm start`
   - The server tries port 3000 and falls back to 3001, 3002, ... if in use
4. Open your browser
   - Visit `http://localhost:3000` (or the port printed in the console)

## Environment and configuration

- `server.js` uses `express-session` default MemoryStore (OK for dev). For production, use a persistent session store.
- `sql.js` loads the WASM locally from `node_modules/sql.js/dist` to work offline.
- Database file is saved to `data/app.sqlite` on each write operation.

## Security notes (for production)

- Add CSRF protection and stricter validation for all forms
- Use a persistent session store (Redis or SQL-backed store)
- Use HTTPS and secure cookies
- Consider rate limiting and input sanitation
- Use a managed RDBMS and a migration system for schema evolution

## Available scripts

- `npm start` – start the server
- `npm run dev` – nodemon-based dev server (install nodemon globally or add to devDependencies if desired)

## Extending the platform

- Payments: integrate Stripe for milestone payouts
- Notifications: email or webhook updates on milestone changes
- Admin: service review/approval and dispute workflows
- Search/Filters: richer service discovery for clients
- Analytics: expand provider dashboards with time-series aggregations

## License

This project is provided as-is for demonstration and educational purposes.
