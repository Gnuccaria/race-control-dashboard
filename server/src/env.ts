import type { SqlDatabase } from './database/sqlDatabase';
import type { TranslationModel } from './translation/penaltyTranslation';

/** Binding e variabili configurati in wrangler.jsonc. */
export interface Env {
  readonly CREWS_DB: SqlDatabase;
  /** ID dell'applicazione Discord (pubblico): serve all'accesso con Discord del sito. */
  readonly DISCORD_APPLICATION_ID: string;
  readonly DISCORD_GUILD_ID: string;
  /** Ruolo Organizzazione: Gestisci campionato (equipaggi, gare, penalità). */
  readonly DISCORD_ORGANIZATION_ROLE_ID: string;
  /** Ruolo Direttore Gara: strumenti della Direzione Gara. */
  readonly DISCORD_REQUIRED_ROLE_ID: string;
  /** Ruolo Commissari Sportivi: strumenti dei Commissari (proteste, cambi pilota). */
  readonly DISCORD_STEWARDS_ROLE_ID: string;
  /** Token del bot Discord "Michael Masi" (segreto: `npx wrangler secret put DISCORD_BOT_TOKEN`): legge i nomi dei ruoli. */
  readonly DISCORD_BOT_TOKEN?: string;
  /** Workers AI, per tradurre in inglese le penalità; senza (test, sviluppo offline) le traduzioni restano vuote. */
  readonly AI?: TranslationModel;
  /** Bucket R2 dei video delle proteste (`npx wrangler r2 bucket create race-control-protest-videos`). */
  readonly PROTEST_VIDEOS?: VideoBucket;
}

/** La parte dell'API di R2 usata dal server (così i test possono usare un bucket in memoria). */
export interface VideoBucket {
  put(key: string, value: ReadableStream | ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ readonly body: ReadableStream; readonly size: number; readonly httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}
