import { createApp } from './app';
import type { Env } from './env';

const handleRequest = createApp();

/** Punto di ingresso del Worker Cloudflare (in locale: `npm run dev`). */
export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
};
