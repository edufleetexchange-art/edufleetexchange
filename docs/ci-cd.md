# CI/CD — branches, environments, deploys

> Deploy topology details (projects, env vars, domains): see
> [deploy-git-setup.md](./deploy-git-setup.md). **Everything runs on Vercel;
> Render is retired.**

## Branch model

```
feature/*  →  main  →  dev  →  stage  →  prod
                       │       │         │
                       ▼       ▼         ▼
                     DEV     STAGE      PROD
```

- `main` — integration trunk. Feature branches merge here via PR. No deploy.
- `dev` — deploys the **dev** environment (dev DB).
- `stage` — deploys the **stage** environment (test DB).
- `prod` — deploys **production** (prod DB, `www.edufleetexchange.com`).

Promotion is a fast-forward/merge up the chain: `main → dev → stage → prod`.
**Code lives in branches; configuration (which database, which secret) lives in
Vercel per project.** The branch only decides *which* environment deploys.

## CI (GitHub Actions) — the quality gate

Both repos have `.github/workflows/ci.yml`. On every push/PR to
`main`/`dev`/`stage`/`prod`:

- **server**: `npm ci` → `npm run build` (tsc) → `npm test` (vitest, in-memory
  MongoDB — no secrets).
- **ui**: `npm ci` → `npm run lint:types` (tsc) → `npm run build` (vite).

CI must be green before promoting a branch upward.

## CD — one Vercel project per environment

Six projects, each git-connected with **Production Branch = its env branch**
and an ignored-build-step so it only builds that branch:

| Project | Branch | Serves |
|---|---|---|
| `edufleetexchange-server-dev` | `dev` | `edufleetexchange-server-dev.vercel.app` → `edu_fleet_exchange_dev` |
| `edufleetexchange-server-stage` | `stage` | `edufleetexchange-server-stage.vercel.app` → `edu_fleet_exchange_test` |
| `edufleetexchange-server-prod` | `prod` | `edufleetexchange-server-prod.vercel.app` → `edu_fleet_prod` |
| `edufleetexchange-ui-dev` | `dev` | `edufleetexchange-ui-dev.vercel.app` |
| `edufleetexchange-ui-stage` | `stage` | `edufleetexchange-ui-stage.vercel.app` |
| `edufleetexchange-ui` | `prod` | `www.edufleetexchange.com` |

A push (or PR merge) to `dev`/`stage`/`prod` auto-deploys that environment's
frontend + backend pair. Nothing deploys from `main`. No CLI deploys.

The frontend resolves its backend per branch in `vite.config.ts`
(`VERCEL_GIT_COMMIT_REF` → default vercel.app backend URL); an explicit
`VITE_API_BASE_URL` env var overrides.

## Storage & email (per backend project env vars)

- `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV`, `CLIENT_URL` — per environment.
- `BLOB_READ_WRITE_TOKEN` + `BLOB_PREFIX` — image uploads go to the shared
  `edufleet-images` Vercel Blob store, namespaced `dev/` `stage/` `prod/`.
- `RESEND_API_KEY` + `EMAIL_FROM` — password-reset email via Resend; without a
  key the reset link is logged instead of emailed.
