/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Indirizzo del server degli equipaggi (vedi .env.example). */
  readonly VITE_CREW_API_URL?: string;
  /** Solo per il sito dei risultati: server da cui leggere le API pubbliche (di default lo stesso indirizzo del sito). */
  readonly VITE_PUBLIC_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
