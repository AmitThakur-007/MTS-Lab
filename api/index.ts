import { createApp } from './_server/app';

// Vercel Node function entrypoint. Keep the Express application as the
// single API implementation so /api/* requests never fall through to SPA HTML.
export default createApp();
