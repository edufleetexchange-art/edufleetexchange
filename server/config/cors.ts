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

    // ✅ Allow all Vercel preview deployments
    const isVercelPreview =
      origin.includes(".vercel.app") &&
      origin.includes("edufleetexchange");

    if (allowedOrigins.includes(origin) || isVercelPreview) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },

  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};