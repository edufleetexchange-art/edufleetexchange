# CI/CD — branches, environments, deploys

## Branch model

```
feature/*  →  main  →  dev  →  stage  →  prod
                       │       │         │
                       ▼       ▼         ▼
                     DEV     STAGE      PROD
```

- `main` — integration trunk. Feature branches merge here via PR.
- `dev` — deploys to the **dev** environment (dev DB).
- `stage` — deploys to the **stage** environment (stage DB).
- `prod` — deploys to **production** (prod DB, `www.edufleetexchange.com`).

Promotion is a fast-forward/merge up the chain: `main → dev → stage → prod`.
**Code lives in branches; configuration (which database, which secret) lives in
the hosting platform per environment.** A `dev` deploy uses dev env vars, a
`prod` deploy uses prod env vars — the branch only decides *which* deploy runs.

## CI (GitHub Actions) — the quality gate

Both repos have `.github/workflows/ci.yml`. On every push/PR to
`main`/`dev`/`stage`/`prod`:

- **server**: `npm ci` → `npm run build` (tsc) → `npm test` (vitest, in-memory
  MongoDB — no secrets).
- **ui**: `npm ci` → `npm run lint:types` (tsc) → `npm run build` (vite).

CI must be green before promoting a branch upward.

## CD — deploy per branch (native platform integration, recommended)

The app is split: **frontend → Vercel**, **backend → Render**. The cleanest CD
is each platform's own Git integration — no deploy secrets in GitHub.

### Frontend (Vercel, project `edufleetexchange-ui`)
- Settings → Git → **Production Branch = `prod`**.
- Create **Custom Environments** `dev` and `stage`, each tied to its branch, each
  with its own env vars and (optionally) its own domain
  (e.g. `dev.edufleetexchange.com`, `stage.edufleetexchange.com`).
- Env var **per environment**: `VITE_API_BASE_URL` → the matching backend
  (dev→dev backend, stage→stage backend, prod→prod backend).

### Backend (Render)
Create **three services**, each watching its branch, each with its own env vars:

| Service | Branch | `MONGODB_URI` (database) |
|---|---|---|
| edufleet-api-dev | `dev` | `iyowv1o` cluster → `edu_fleet_exchange_dev` |
| edufleet-api-stage | `stage` | `iyowv1o` cluster → `edu_fleet_exchange_test` |
| edufleet-api-prod | `prod` | `mirs6yp` cluster → `edu_fleet_prod` |

Every service also needs: `JWT_SECRET` (unique per env, ≥32 bytes),
`NODE_ENV=production`, `CLIENT_URL` (the matching frontend URL), SMTP vars.

## ⚠️ One architectural fix required

`edufleetexchange_ui/vercel.json` currently **hardcodes** the API rewrite to a
single Render URL:

```json
"destination": "https://edufleetexchange.onrender.com/api/$1"
```

For per-environment backends this must differ by environment. Two options:
1. **Drop the rewrite, use `VITE_API_BASE_URL`** directly in the frontend
   (set per Vercel environment to each backend's URL). Cleanest.
2. Keep the rewrite but point each environment's build at its own backend via
   an env-substituted `vercel.json` (more moving parts).

Until this is changed, all three frontends call the same (prod) backend.

## Optional: Action-driven deploy (only if not using native integration)

If you'd rather deploy from GitHub Actions, add these repo **secrets**
(Settings → Secrets → Actions) and a deploy workflow:
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and a
`RENDER_DEPLOY_HOOK_{DEV,STAGE,PROD}` URL per Render service. Native integration
is simpler and is the recommended path.

## First-time setup checklist
1. Push all four branches (`main`, `dev`, `stage`, `prod`) to origin.
2. Vercel: set Production Branch = `prod`; add `dev`/`stage` custom environments + env vars.
3. Render: create the 3 services above with their env vars.
4. Fix the `vercel.json` API routing (§ above) so each frontend hits its own backend.
5. Verify: push to `dev` → CI runs → dev env deploys → smoke test.
