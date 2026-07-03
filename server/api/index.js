// Vercel serverless entrypoint.
//
// `dist/` is gitignored, so git-based deploys can't use it as a function
// source directly — but it DOES exist at build time (npm install runs the
// `postinstall` → `npm run build` → tsc). This checked-in file is what Vercel
// detects and bundles as the function; the import below pulls the whole
// compiled app in via dependency tracing.
//
// All routes are rewritten to this function (see ../vercel.json); the Express
// app receives the original URL, so its own /api/* routing works unchanged.
export { default } from '../dist/index.js';
