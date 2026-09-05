# Kumite Arena — Tournament Management System

Professional platform for running karate and martial arts tournaments.

Public visitors can only view data. Administrators have full control: tournaments, categories, participants, brackets, fights, results and live updates.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- npm 10+

## 1. Install Node.js

Download LTS from https://nodejs.org and confirm:

```bash
node -v
npm -v
```

## 2. Install PostgreSQL

Install PostgreSQL and create an empty database:

```sql
CREATE DATABASE kumite_arena;
```

Or start it with Docker from the project root:

```bash
docker compose up -d
```

This starts PostgreSQL 16 on port `5432` with user/password `postgres` / `postgres` and database `kumite_arena`.

## 3. Environment

Copy the example file and edit values:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

`.env` fields:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kumite_arena?schema=public
JWT_SECRET=change-this-to-a-long-random-secret
ADMIN_EMAIL=admin@kumite-arena.local
ADMIN_PASSWORD=ChangeMe123!
PORT=5000
CLIENT_URL=http://localhost:5173
```

The admin password is hashed with bcrypt on the server. It is never stored in the frontend.

## 4. Install dependencies

From the project root:

```bash
npm install
```

This installs root, `server` and `client` packages and generates the Prisma client.

## 5. Database migrate + seed

```bash
npx prisma migrate dev --name init
npm run db:seed
```

If you prefer to push the schema without migration history:

```bash
npx prisma db push
npm run db:seed
```

Seed creates:

- the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- country list (reference data)
- default site settings and pricing plans

It does **not** create tournaments, participants, categories, fights or results. Those stay at 0.

## 6. Run development servers

```bash
npm run dev
```

- API: http://localhost:5000
- Web: http://localhost:5173

Or separately:

```bash
npm run dev:server
npm run dev:client
```

## 7. Login

Open http://localhost:5173/login

Use `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

After login you are redirected to `/admin`.

## 8. Run a tournament (admin)

1. **Create a tournament** — Admin → Турниры → СОЗДАТЬ ТУРНИР. Status starts as `DRAFT`.
2. **Create clubs** — Admin → Клубы.
3. **Open the tournament** — Admin → the tournament row.
4. **Create categories** — e.g. `KUMITE BOYS 10-11 -35 KG` with min/max age and weight.
5. **Add participants** — name, birth date (age is calculated from the tournament date), gender, country, club, photo, weight, rank, category.
6. **Close registration** when the list is ready.
7. **Create the bracket** — Сетки → choose category and mode (`RANDOM`, `SEEDED`, `CLUB_SEPARATION`, `COUNTRY_SEPARATION`) → СОЗДАТЬ СЕТКУ.
   - 10 athletes → 16 slots, extra slots are `BYE` and auto-advance.
8. **Start the tournament** — ЗАПУСТИТЬ ТУРНИР (blocked until participants, categories and brackets exist).
9. **Run fights** — open a fight card → START FIGHT → click the winner → confirm. The winner is moved into the next fight automatically.
10. **Final** — gold / silver; bronze from two semifinal losers or a third-place match, depending on category settings.
11. **Confirm results** — they become official and appear on the public results page.
12. Public live pages update over Socket.IO without reload.

## Draw engine

Logic lives in `server/src/services/drawEngine.ts` and `fightService.ts`, not in React state.

Each fight stores `nextFightId` and `nextSlot` (`A` or `B`). After a result:

1. `winnerId` / `loserId` are saved
2. the winner is written into the next fight slot
3. WebSocket events `winner_selected`, `bracket_updated`, `result_updated` are emitted
4. a page refresh restores the same bracket from PostgreSQL

## Tests

```bash
npm test
```

Covers slot padding (10 → 16), BYE generation, automatic winner advancement and round names.

## Production build

```bash
npm run build
```

Frontend output: `client/dist`  
Backend output: `server/dist`

Run API:

```bash
npm run start --prefix server
```

Serve the client build with any static host, or put it behind the same origin as the API.

## Project layout

```
/client   React + TypeScript + Vite
/server   Express + TypeScript + Socket.IO
/prisma   schema + seed
/uploads  local images (swap later for S3 / Cloudinary / Supabase)
```

## Security

- Admin-only mutation routes (`requireAdmin` + JWT cookie / Bearer token)
- Passwords hashed with bcrypt
- Helmet, CORS, rate limiting
- Upload mime/size checks
- Zod validation on the server

Public users cannot start fights, pick winners, or edit tournament data even if they call the API directly.
