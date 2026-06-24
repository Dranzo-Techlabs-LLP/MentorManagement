# Elevate U — Mentoring Management Portal

A digital mentoring ecosystem for **SLEP (Student Leadership Empowerment Program)**, an initiative of **NDHR Global Solutions**. Manages structured mentoring, student growth tracking, parent communication, age‑based assessments, reporting, and multi‑institution program administration.

> Proposed deployment: `elevateu.ndhrglobal.com`

## Tech stack
- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Prisma ORM** → **MySQL** (`ndhr` database)
- **Tailwind CSS** (brand design system) + **Recharts** + **lucide-react**
- Cookie‑based **JWT auth** (`jose`) with role‑based middleware
- Mutations via **Next Server Actions**

## Roles
Super Admin · Chief Mentor · Supervisor · Mentor · Parent · Student — each with a dedicated, data‑scoped dashboard and feature set, mirroring the reporting hierarchy (Mentor → Supervisor → Chief Mentor → Admin).

## Features
- **Onboarding** — public parent application (`/apply`) → admin review → approve creates student + parent account, or admin adds students directly.
- **Student master profile & digital growth portfolio** — Academic, Personality, Life Skills, Moral/Value, Health & Wellbeing, Career (radar + timeline), goals, achievements, documents.
- **Advanced assessment engine** — age‑wise levels (L1 Self Discovery 10–12, L2 Talent Discovery 13–15, L3 Career Aptitude 16–18) plus Multiple Intelligence, Learning Style, Leadership, etc. Auto‑scored with per‑trait interpretation.
- **Session management** — online (2×/week) & offline (monthly) sessions, scheduling, attendance, observations, action points, parent notes, follow‑up tasks.
- **Reporting** — monthly/quarterly progress reports, supervisor review workflow, printable parent‑facing report, share‑to‑parent.
- **Communication** — internal messaging, announcements, parent feedback, notifications.
- **Dashboards & analytics** — role‑specific KPIs, growth trends, assessment completion, mentor performance, alerts. **Audit log** + RBAC for data governance (minors’ data).

## Getting started
```bash
npm install
# .env already contains DATABASE_URL (MySQL) and AUTH_SECRET
npm run db:push      # sync schema to the ndhr database
npm run db:seed      # load demo institutions, users, students, sessions, assessments…
npm run dev          # http://localhost:3000
```
> If port 3000 is busy, run `npx next dev -p 3100`.

### Useful scripts
| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build & serve |
| `npm run db:push` | Push Prisma schema to MySQL |
| `npm run db:seed` | Reseed demo data (wipes & reloads) |
| `npm run db:studio` | Prisma Studio data browser |

## Demo accounts
Password for all: **`Elevate@123`**

| Role | Email |
| --- | --- |
| Super Admin | superadmin@ndhrglobal.com |
| Chief Mentor | chief@ndhrglobal.com |
| Supervisor | supervisor@ndhrglobal.com |
| Mentor | mentor@ndhrglobal.com |
| Parent | parent@ndhrglobal.com |
| Student | student@ndhrglobal.com |

## Project layout
```
prisma/schema.prisma     # full data model (22 models)
prisma/seed.ts           # demo data
src/lib/                 # db, auth, rbac, guard, utils, actions (server actions)
src/components/          # brand, ui kit, charts, dashboard widgets, app shell
src/middleware.ts        # route protection per role
src/app/
  login/  apply/         # public auth + parent application
  (dash)/                # authenticated shell
    admin/ chief/ supervisor/ mentor/ parent/ student/
```

## Security notes (production)
- Change `AUTH_SECRET` and the MySQL credentials in `.env`; never commit real secrets.
- Restrict the MySQL host to the app server; the seed/demo passwords are for development only.
- Document storage currently records metadata + URLs — wire an object store (S3/R2) and signed URLs before going live.
