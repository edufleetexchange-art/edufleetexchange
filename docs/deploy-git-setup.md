# Deploy — all on Vercel (dev / stage / prod), Render retired

**Goal:** both the frontend AND the backend run on **Vercel**, with three
environments (dev / stage / prod), each frontend talking to its **own**
backend, each backend on its **own** database. Env vars are **isolated per
environment** — changing one never touches the others. **Render is no longer
used.**

```
                 dev branch          stage branch         prod branch
frontend  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
(Vercel)  │ dev.edufleet…    │ │ stage.edufleet…  │ │ www.edufleet…    │
          └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
                   │ VITE_API_BASE_URL   │                    │
          ┌────────▼─────────┐ ┌────────▼─────────┐ ┌────────▼─────────┐
backend   │ api-dev.edufleet…│ │ api-stage.edufl… │ │ api.edufleet…    │
(Vercel)  └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
                   │ MONGODB_URI         │                    │
             edu_fleet_exchange_dev  edu_fleet_exchange_test  edu_fleet_prod
```

## What's already done in code
- **Backend is serverless-ready:** `server/index.ts` exports a serverless
  handler; `app.listen()`, graceful-shutdown, and `/uploads` static serving are
  all guarded by `if (!process.env.VERCEL)`. Uploads use in-memory storage →
  base64 (no disk needed). DB connection is cached across invocations.
- **`server/vercel.json`** builds `dist/index.js` via `@vercel/node` and gates
  deploys to the `dev`/`stage`/`prod` branches (`main` does not deploy).
- **Frontend** resolves its backend URL per branch in `vite.config.ts` and via a
  per-environment `VITE_API_BASE_URL` env var (env var wins). No Render rewrite.
- **CORS** (`server/config/cors.ts`) allows any `*.edufleetexchange.com` https
  origin and any `*edufleetexchange*.vercel.app` deploy URL, so each frontend
  can call its own-environment backend cross-origin.

## Dashboard setup — do once per project (TWO Vercel projects)

### A. Backend project (repo `edufleetexchange`, **Root Directory = `server`**)
1. **New Project** → import the `edufleetexchange` repo → set **Root Directory =
   `server`**.
2. **Production Branch** = `prod` (Settings → Git).
3. **Custom Environments** (Settings → Environments): create `development` → git
   branch `dev`; `staging` → git branch `stage`. (Production is built-in → `prod`.)
4. **Deployment Protection** → turn **OFF Vercel Authentication**. ⚠️ Required —
   otherwise the API returns 302/401 to the browser and nothing works.
5. **Domains** (recommended, gives stable URLs): attach
   `api-dev.edufleetexchange.com` → development, `api-stage.…` → staging,
   `api.edufleetexchange.com` → production. (Or skip and use the Vercel-generated
   per-env URLs — then paste those into the frontend's `VITE_API_BASE_URL`.)

### B. Frontend project (repo `edufleetexchange_ui`, root = repo root)
1. **New Project** → import `edufleetexchange_ui`.
2. **Production Branch** = `prod`; create the same `development`/`staging`
   custom environments bound to `dev`/`stage`.
3. **Domains:** `dev.edufleetexchange.com` → development, `stage.…` → staging,
   `www.edufleetexchange.com` → production.

## ⚠️ Env-var isolation — the important part
Vercel env vars are **scoped to an environment**. When adding each variable pick
the **specific environment**, NOT "All Environments". Set the same key three
times with different values.

### Backend project — per environment
| Key | development | staging | production |
|---|---|---|---|
| `MONGODB_URI` | `…/edu_fleet_exchange_dev` (iyowv1o) | `…/edu_fleet_exchange_test` (iyowv1o) | `…/edu_fleet_prod` (mirs6yp) |
| `JWT_SECRET` | dev secret (≥32 bytes) | stage secret (distinct) | prod secret (distinct) |
| `NODE_ENV` | production | production | production |
| `CLIENT_URL` | `https://dev.edufleetexchange.com` | `https://stage.edufleetexchange.com` | `https://www.edufleetexchange.com` |
| SMTP/EMAIL_* | as needed | as needed | real mail creds |

### Frontend project — per environment
| Key | development | staging | production |
|---|---|---|---|
| `VITE_API_BASE_URL` | `https://api-dev.edufleetexchange.com/api` | `https://api-stage.edufleetexchange.com/api` | `https://api.edufleetexchange.com/api` |

(If you skipped custom domains, paste each backend environment's Vercel-generated
URL here instead — `.../api`.)

Because each value is bound to one environment, editing `development`'s config
has **zero effect** on `staging` or `production`.

## Promotion flow
```
feature/* → PR → main   (CI runs, no deploy)
main → PR → dev          → deploys DEVELOPMENT (frontend + backend)
dev  → PR → stage        → deploys STAGING
stage→ PR → prod         → deploys PRODUCTION (www.edufleetexchange.com)
```
CI (`.github/workflows/ci.yml`) gates every PR: build + test must pass first.

## Serverless caveats to know
- **Cold starts** exist on Vercel too, but are shorter than Render's free tier
  and scale automatically. The cached Mongo connection keeps warm invocations fast.
- **No local disk / no long-running work.** Fine here — uploads are base64, and
  there are no cron/background jobs (the only timer is in the guarded shutdown path).
- If you later add real file storage or scheduled jobs, use Vercel Blob and
  Vercel Cron respectively — don't write to the function filesystem.
