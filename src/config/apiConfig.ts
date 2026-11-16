/**
 * Indirizzo del server su Cloudflare Workers, da VITE_CREW_API_URL in .env.production (vedi .env.example).
 * Vale anche in sviluppo: vite.config.ts lo legge da lì, così l'indirizzo è scritto in un solo posto.
 */
export const CREW_API_URL = (import.meta.env.VITE_CREW_API_URL ?? '').replace(/\/$/, '');
