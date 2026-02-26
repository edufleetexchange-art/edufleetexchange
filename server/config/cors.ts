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

    if (isProduction) {
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    }

    // In dev: allow from list (or you can allow all in dev if you want)
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },

  // ✅ THIS fixes your error
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  credentials: true,
};