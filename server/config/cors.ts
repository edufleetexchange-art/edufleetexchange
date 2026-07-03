import type { CorsOptions } from "cors";
import { ENV, isProduction } from "./environment.js";

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

  const allowedOrigins = [
      ENV.CLIENT_URL,
      "https://www.edufleetexchange.com",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
    ].filter(Boolean);

    // ✅ Allow all Vercel deployment URLs for this project (previews + the
    // per-environment dev/stage/prod deploys, e.g. edufleetexchange-ui-git-dev-*.vercel.app).
    const isVercelDeploy =
      /^https:\/\/[a-z0-9-]*edufleetexchange[a-z0-9-]*\.vercel\.app$/.test(origin);

    // ✅ Allow any https subdomain of edufleetexchange.com (www / dev / stage /
    // app …). This covers the custom domains attached to each environment so
    // the frontend can call its own-environment backend cross-origin.
    const isOwnDomain =
      /^https:\/\/([a-z0-9-]+\.)*edufleetexchange\.com$/.test(origin);

    // ✅ In non-production, allow ANY localhost/127.0.0.1 port. Vite falls back
    // to 3001, 3002… whenever the default port is busy, and hardcoding a single
    // port silently breaks local dev with a CORS error.
    const isLocalDev =
      !isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

    if (
      allowedOrigins.includes(origin) ||
      isVercelDeploy ||
      isOwnDomain ||
      isLocalDev
    ) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },

  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};