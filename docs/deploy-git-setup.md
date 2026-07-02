# Git-based deploys — dev / stage / prod (no CLI deploys)

Goal: **merge a PR into `dev` / `stage` / `prod` → Vercel auto-deploys that
environment.** Env vars are **isolated per environment** — changing one env's
config never touches the others.

## How the branch → deploy gating works (already in code)

Both `vercel.json` files now include:

```json
"git": { "deploymentEnabled": { "main": false, "dev": true, "stage": true, "prod": true } }
```

- Push/merge to `dev`, `stage`, `prod` → triggers a deploy for that environment.
- `main` is the integration trunk → **does not** auto-deploy.
- **No more `vercel deploy` from the CLI** — Git is the only deploy trigger.

## Dashboard setup (once per project — do for BOTH projects)

Projects: `edufleetexchange-ui` (frontend) and the backend project
(the CLI made one called `server` — connect it to Git, or re-import the repo
with **Root Directory = `server`**).

1. **Connect to Git**: Project → Settings → Git → connect the GitHub repo.
   - Frontend repo → `edufleetexchange_ui`
   - Backend repo → `edufleetexchange`, **Root Directory = `server`**
2. **Production Branch**: Settings → Git → set **Production Branch = `prod`**.
   (So only `prod` deploys to production; `dev`/`stage` are their own envs.)
3. **Custom Environments**: Settings → Environments → create:
   - **`development`** → bound to git branch **`dev`**
   - **`staging`** → bound to git branch **`stage`**
   (Production is built-in, bound to `prod`.)
4. **Deployment Protection** (backend only): Settings → Deployment Protection →
   turn **off Vercel Authentication** so the public API is reachable.

## ⚠️ Env-var isolation — the important part

Vercel env vars are **scoped to an environment**. To keep them isolated, when
you add each variable choose the **specific environment**, NOT "All
Environments". Set the *same key* three times with *different values*:

### Backend project — per environment
| Key | development | staging | production |
|---|---|---|---|
| `MONGODB_URI` | `…/edu_fleet_exchange_dev` (iyowv1o) | `…/edu_fleet_exchange_test` (iyowv1o) | `…/edu_fleet_prod` (mirs6yp) |
| `JWT_SECRET` | dev secret | stage secret (distinct) | prod secret (distinct) |
| `NODE_ENV` | production | production | production |
| `CLIENT_URL` | dev frontend URL | stage frontend URL | `https://www.edufleetexchange.com` |
| SMTP/EMAIL_* | as needed | as needed | real mail creds |

### Frontend project — per environment
| Key | development | staging | production |
|---|---|---|---|
| `VITE_API_BASE_URL` | dev backend URL | stage backend URL | prod backend URL |
| `VITE_PAYMENT_*` | test/blank | test/blank | real (optional) |

Because each value is bound to one environment, editing `development`'s
`MONGODB_URI` has **zero effect** on `staging` or `production`. That's the
guarantee you asked for.

## One code change still needed for per-env backends

`edufleetexchange_ui/vercel.json` currently hardcodes the API rewrite to a
single backend (Render). A hardcoded rewrite is shared across all environments,
so it can't point dev/stage/prod at *different* backends. To make it per-env:

- Remove the `/api/*` rewrite and have the frontend call the backend via
  `VITE_API_BASE_URL` (set per environment, table above). The app already reads
  `VITE_API_BASE_URL`.
- Then the backend `cors` config must allow each frontend origin
  (dev/stage/prod domains).

Do this only once the per-env `VITE_API_BASE_URL` values are set — otherwise a
missing value falls back to `localhost` and breaks the deployed site. (Ask me
to make this change when you're ready.)

## Promotion flow
```
feature/* → PR → main   (CI runs, no deploy)
main → PR → dev          → deploys DEVELOPMENT
dev  → PR → stage        → deploys STAGING
stage→ PR → prod         → deploys PRODUCTION (www.edufleetexchange.com)
```
CI (`.github/workflows/ci.yml`) gates every PR: build + test must pass before merge.
