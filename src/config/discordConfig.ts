/**
 * Configurazione del login con Discord. Sono identificativi pubblici, non segreti:
 * l'app usa il flusso PKCE per client pubblici e non contiene alcun client secret.
 */
export const DISCORD_CONFIG = {
  /** Developer Portal → Informazioni generali → ID applicazione. */
  applicationId: '1570595596836937748',
  /** Server in cui si verifica il ruolo. */
  guildId: '1569698028938600458',
  /** Ruolo Organizzazione: Gestisci campionato (e accesso all'app). */
  organizationRoleId: '1569700040602292346',
  /** Ruolo Direttore Gara: Crea documentazione e strumenti della Direzione Gara (e accesso all'app). */
  raceControlRoleId: '1569716852886605844',
  /** Ruolo Commissari Sportivi: strumenti dei Commissari Sportivi (e accesso all'app). */
  stewardsRoleId: '1569718968183296130',
  /** Deve coincidere con il reindirizzamento registrato nel Developer Portal (OAuth2 → Reindirizzamenti). */
  redirectPort: 47823,
  redirectPath: '/discord/callback',
  /** identify: profilo (nome e avatar) · guilds.members.read: ruoli nel server. */
  scopes: ['identify', 'guilds.members.read'],
} as const;

export const DISCORD_REDIRECT_URI = `http://127.0.0.1:${DISCORD_CONFIG.redirectPort}${DISCORD_CONFIG.redirectPath}`;
