# Race Control Dashboard

Applicazione desktop (Windows, macOS, Linux) con gli strumenti per le gare endurance a lobby.
È la stessa applicazione React, impacchettata con **Tauri 2**: una finestra nativa leggera che usa il motore web del sistema.
La home è divisa in tre sezioni.

**Gestisci campionato** (dati salvati sul server degli equipaggi, vedi [Server degli equipaggi](#server-degli-equipaggi)):

- **Aggiungi equipaggio**: nome, numero, auto, campionato e colore, tutti obbligatori, convalidati nell'app e di nuovo sul server prima del salvataggio; facoltativi il **Canale Discord** e il **Ruolo Discord** dell'equipaggio (vedi "Bot Discord" nella parte del sito). Il colore si sceglie da un cerchio che apre un popup con la tabella dei colori, il codice esadecimale e i valori HSV (sincronizzati tra loro); si salva come esadecimale `#RRGGBB`.
- **Gestisci equipaggio**: tabella di tutti gli equipaggi (di default per numero crescente; clic sulla testata per ordinare A→Z, di nuovo per Z→A), ricerca per numero o nome a ogni carattere, filtri per auto e campionato, avviso sugli equipaggi con dati mancanti. Il clic destro su una riga la seleziona o deseleziona (da tastiera: tasto Menu o Maiusc+F10 sulla freccia della riga); con almeno una selezione compare "Elimina", che chiede conferma, elimina tutti gli equipaggi selezionati in un'unica operazione e ricarica l'elenco dal server mantenendo filtri e ordinamento. Si eliminano solo i selezionati visibili con i filtri correnti. La freccia di ogni riga apre il dettaglio in sola lettura; "Modifica" rende i campi modificabili e "Salva" li ricontrolla nell'app e sul server. "Annulla" e l'uscita dalla pagina durante la modifica chiedono conferma.
- **Gestisci ordini di arrivo**: tabella delle gare (campionato, round, nome, tracciato, data di svolgimento, ultima modifica), dalla più recente; testate ordinabili, filtri per campionato, tracciato (per ora disattivato) e intervallo di date con calendario; selezione con il tasto destro ed eliminazione come negli equipaggi; eliminare una gara cancella anche tutto ciò che le appartiene (classifica, cambi pilota, penalità con le loro vetture e traduzioni), in un'unica operazione. "Crea gara" apre un form a quattro schede: **Anagrafica** (nome della gara facoltativo, campionato con accanto la **durata**, sempre presente e obbligatoria, con le voci del campionato scelto (6 o 12 ore nel Cool1 FIE Championship, solo 3 ore nell'All Japan GT Championship, scelta da sola), disattivata finché non si sceglie il campionato, round solo numerico 1–99, data con calendario, tracciato e **giri totali** facoltativi; nessun equipaggio può avere più giri completati dei giri totali) e **Dettagli** (ordine di arrivo su 14 posizioni, con un menu per riga che propone solo gli equipaggi di quel campionato, mostrati con cerchio colorato, #numero e nome, la colonna **Auto** con la vettura che resta legata a quella gara, i **giri completati**, obbligatori per ogni equipaggio inserito, e il **distacco** facoltativo dal primo in minuti:secondi,millesimi (es. `1:05,320`; anche solo secondi, `12,045`), che nella prima riga non c'è; la **X** a destra di ogni riga, visibile solo in modifica, svuota quella riga. Le righe vuote sono ammesse, non serve riempirle tutte e 14; un equipaggio ripetuto viene sottolineato in rosso con il rimando alla prima posizione) e **Penalità** (i **Cambi pilota** sono in **Gestisci cambi pilota**, tra gli strumenti dei Commissari Sportivi). Il dettaglio di una gara ha le stesse funzioni del dettaglio equipaggi: sola lettura, Modifica/Salva, conferma su Annulla e all'uscita.
  - **Cambi pilota** riproduce il foglio "Driver Swap Checker". Il campionato decide quanti cambi ci sono: **5** nel Cool1 FIE Championship, **1** nell'All Japan GT Championship. Con più di un cambio, un menu sopra la tabella ("Da stint 1 a stint 2"…) sceglie quale mostrare; i cambi con tempi non validi sono segnati nel menu. Ogni tabella ha una riga per ogni vettura del campionato. Si scrivono Pit In (vettura ferma in piazzola, fine dello stint) e Pit Out (pit stop effettuato, inizio dello stint successivo): uscendo dalla casella il tempo diventa sempre `HH:MM:SS.DDD` (si possono scrivere anche `2:13:20,642`, `2.13.20,642`, `13:20.5` per minuti:secondi, oppure solo cifre `021320642`); ciò che non si può interpretare resta in rosso e blocca il salvataggio. Distacco Pit In = Pit In − il più basso, distacco Pit Out = Pit Out − il più basso; c'è penalità se distacco Pit Out + 2 s < distacco Pit In e vale 2,5 × (distacco Pit In − distacco Pit Out − 2 s). Margine (2 s) e coefficiente (× 2,5) sono fissi nel codice (`shared/driverSwapRules.ts`), non modificabili dall'app. Una vettura senza uno dei due tempi non viene controllata. "Annullata" lascia la penalità visibile ma la toglie dal totale (come "Crash, penalità annullata"); poi ci sono le note. In alto, le **penalità per vettura** (somma delle non annullate). Con la gara si salva tutta la tabella in `driver_swaps`: vettura, Pit In, Pit Out, penalità (ricalcolata dal server), annullata e note.
  - **Penalità**: tabella delle penalità della gara con "Aggiungi penalità" sopra; selezione con il tasto destro ed eliminazione di più righe come negli altri elenchi; la freccia apre il dettaglio con Modifica/Salva. "Aggiungi penalità" apre una pagina con **Vetture coinvolte** (elenco a discesa con una casella per ogni vettura del campionato; le scelte compaiono come clip con il numero), poi, per ogni vettura scelta, la sua **Decisione** (facoltativa: Reprimenda, +5/+10/+20/+30/+60/+120/+300 secondi, da +1 a +7 posizioni in griglia, Squalifica dalla gara, Squalifica dal campionato), **Violazione** (il numero dell'articolo violato: si possono scrivere solo cifre e punti, es. `2.5.5.3.1`) con accanto **Documento** (Codice di Condotta o Regolamento Tecnico) e **Motivazione**. **Reprimende**: vanno alla vettura e contano tutte uguali; si numerano nel campionato (gare per data e round, poi ordine di inserimento) e alla terza scatta in automatico +1 posizione in griglia di partenza nella gara successiva, dopo di che il conteggio riparte da zero. Scegliendo "Reprimenda" il form dice quale sarebbe (1ª, 2ª o 3ª, con la penalità automatica); la tabella mostra "Reprimenda (n)" (testo libero su 5 righe, facoltativa), poi **Aggiungi**. Le penalità si salvano subito, una per una, anche senza premere Modifica sulla gara; in una gara nuova si aggiungono dopo averla salvata. Nel dettaglio di una penalità, sotto, il pannello **Traduzione inglese** mostra la motivazione in inglese (usata dal referto in inglese del sito) con il loro stato: automatica, corretta a mano, corretta a mano ma da ricontrollare (è cambiato il testo originale) o assente; **Modifica** per correggerla a mano, **Rifai traduzione** per chiederla di nuovo al modello.

**Crea documentazione**:

- **Crea briefing pre-gara**: in costruzione.

**Strumenti della Direzione Gara**, ognuno traduzione 1:1 del foglio Excel originale:

- **Calcolatore di giri** (`Calcolatore_di_giri.xlsx`): stato dello stint e giri da impostare nella lobby successiva. Gli orari si scelgono con un menu per le ore e uno per i minuti, nel formato della lingua dell'app: 24 ore in italiano, francese e tedesco, 12 ore con AM/PM in inglese (lo decide `Intl`, in `src/i18n/hourCycle.ts`).
- **Calcolatore deficit BoP** (`Calcolatore_deficit_BoP.xlsx`): penalità in secondi per un'auto fuori da peso e potenza del BoP.
- **Calcolatore disconnessioni** (`Disconnessioni_FIE.xlsx`): tempo di attesa da comunicare al team dopo una disconnessione, per P1 e per P2–P14. La lunghezza della pista arriva dal campo **Tracciato** (stesso popup delle gare), aggiornata dal server in sottofondo. Sotto il tempo di attesa c'è il riquadro **Ticket da gestire**, alto quanto "Pista e stint" (con più ticket l'elenco scorre): i ticket di disconnessione mandati dal sito, come card basse ("Ticket disconnessione #12", equipaggio, posizione, giro e distacco), riletti dal server ogni 20 secondi. Il clic su un ticket compila il calcolatore: posizione (P1 se il pilota era primo, altrimenti P2–P14), giro e distacco in secondi. Il riquadro "Dettaglio del calcolo" non è più mostrato nell'app, ma i suoi valori vengono calcolati lo stesso: **Invia risultato** (attivo solo con un ticket scelto e tutti i campi compilati) manda al server il risultato completo (giri mancanti, penalità, distacco, ingresso in pit stall, tempo di attesa, lunghezza della pista, giri dello stint, durata del drive-through), che il pilota vede sul sito sotto il suo ticket; chiude il ticket e lo toglie dall'elenco, svuota solo i dati del ticket (giro e distacco) e riporta la posizione a P2–P14; pista e stint restano per il ticket successivo.
- **Campanella** (in alto, accanto al profilo, in tutta l'app, per Direttore Gara e Commissari Sportivi): il numero rosso è quello delle notifiche arrivate e non ancora viste, con una sezione per ruolo. **Ticket di disconnessione** (Direttore Gara): la tendina li elenca (i nuovi segnati "Nuovo") e il clic su un ticket apre il calcolatore disconnessioni con quel ticket già compilato. **Proteste in esame** (Commissari Sportivi): le ultime 10 proteste ancora in esame, le nuove segnate "Nuova" (contano solo quelle arrivate dopo l'ultima apertura e ancora in esame); il clic apre la protesta in Gestisci proteste. Aprendo la tendina le notifiche diventano viste (ricordate in `localStorage`: `disconnection-tickets:seen-up-to` e `protests:seen-up-to`); ticket e proteste si rileggono ogni 20 secondi (`ticketStoreCore.ts`, usato anche da `src/features/protests/protestStore.ts`). Lo stesso numero compare anche sull'icona dell'app nella barra delle applicazioni: su Windows un pallino rosso con il numero ("9+" da 10 in su), disegnato al momento e sovrapposto all'icona (`setOverlayIcon`, permesso `core:window:allow-set-overlay-icon`, funzione `image-png` di Tauri); su macOS e Linux il contatore del sistema (`setBadgeCount`). Il pallino somma ticket e proteste nuove secondo i ruoli. Codice in `src/features/disconnection-tickets` (`taskbarBadge.ts`, `NotificationBell`).
- **Strumenti dei Commissari Sportivi** (sezione `commissari`, sotto gli Strumenti della Direzione Gara):
  - **Gestisci proteste**: tabella delle proteste mandate dal sito (numero, equipaggio coinvolto, altri equipaggi coinvolti come clip, stint, giro, data), dalla più recente; la freccia apre il dettaglio con tutti i dati inviati, la descrizione e i video: quello caricato si riproduce nel player dell'app (lo scarica con il token e lo tiene in memoria finché la pagina è aperta), quello di YouTube nel player "privacy avanzata" (youtube-nocookie.com) con il link "Apri su YouTube"; passati 30 giorni dall'invio il video caricato risulta cancellato. Sotto, il pannello **Esito**: l'interruttore **Respingi protesta** e, se acceso, la **Motivazione** facoltativa (al massimo 500 caratteri); **Salva** chiede conferma e l'equipaggio vede l'esito nella pagina della protesta sul sito. Il rifiuto è **definitivo**: la conferma lo ricorda, dopo il salvataggio il pannello mostra solo l'esito e la motivazione, e il server rifiuta un secondo esito (`409 protest-already-rejected`); l'equipaggio riceve una notifica nella campanella del sito. La tabella ha la colonna **Stato** (In esame / Respinta). Codice in `src/features/protests`.
  - **Gestisci cambi pilota**: la stessa tabella delle gare di Gestisci ordini di arrivo, senza selezione né eliminazione; il dettaglio mostra solo i cambi pilota, con Modifica/Salva e la stessa logica di prima; il salvataggio manda solo i cambi pilota (`PUT /races/:id/driver-swaps`, ruolo Commissari Sportivi). Salvando una gara da Gestisci ordini di arrivo (`PUT /races/:id`, ruolo Organizzazione) i cambi pilota restano quelli salvati.

## App desktop

### Requisiti (una volta sola)

- **Node** ≥ 22.22
- **Rust**: installalo da https://rustup.rs
- **Windows**: "Microsoft C++ Build Tools" (componente "Sviluppo di applicazioni desktop con C++"). WebView2 è già presente su Windows 10 e 11.
- **macOS**: `xcode-select --install`
- **Linux**: `webkit2gtk-4.1`, `librsvg2`, `libappindicator3`, `patchelf`

### Comandi

```bash
npm install
npm run desktop:dev     # l'app in sviluppo (con ricaricamento automatico), collegata al server su Cloudflare
npm run desktop:build   # crea l'installer per il sistema su cui lo lanci
```

L'app usa sempre i dati online: l'indirizzo del server è `VITE_CREW_API_URL` in `.env.production` (vedi "Pubblicarlo su Cloudflare"); senza quel file `desktop:dev`, `dev` e `desktop:build` si fermano dicendo cosa manca. Il workflow di GitHub lo legge dalla variabile `VITE_CREW_API_URL` del repository (Settings → Secrets and variables → Actions → Variables).

Gli installer finiscono in `src-tauri/target/release/bundle/`:
`nsis/*.exe` e `msi/*.msi` su Windows, `dmg/*.dmg` su macOS, `deb/` e `appimage/` su Linux.

Ogni sistema operativo produce solo i propri installer. Per averli tutti senza tre computer
c'è il workflow `.github/workflows/desktop-release.yml`: pubblica un tag (`git tag v1.0.0 && git push --tags`)
e GitHub crea una release in bozza con gli installer di tutti e tre i sistemi.

### Da sapere

- **Firma del codice**: gli installer non sono firmati, quindi Windows SmartScreen e macOS Gatekeeper mostrano un avviso al primo avvio.
  Per distribuirli al pubblico servono un certificato di firma (Windows) e un account Apple Developer (macOS).
- **Icona**: generata da `app-icon.png`. Per cambiarla sostituisci il file e lancia `npm run desktop:icons`.
- **Identificativo**: `it.racecontroldashboard.desktop` in `src-tauri/tauri.conf.json`. Sceglilo definitivo prima di distribuire:
  cambiarlo dopo fa perdere agli utenti i dati salvati (valori del calcolatore e tema).
- **Versione**: letta da `package.json`.

## Sviluppo nel browser

L'interfaccia funziona anche in un normale browser, utile per lavorare solo sul frontend (con i dati online, come l'app):

```bash
npm run dev        # http://localhost:5173
npm run test       # Vitest (logica + componenti di app e sito; i test del server si lanciano da server/)
npm run lint       # ESLint, incluse le regole del React Compiler
npm run build      # type-check + build del frontend in dist/
```

## Stack

- **React 19** + **TypeScript** strict
- **React Router 8** in data mode con hash router: rotte da un catalogo unico, ogni strumento caricato in lazy
- **Tauri 2** per la finestra desktop e gli installer; nessuna logica in Rust
- **Vite 8** con `@vitejs/plugin-react` v6 e **React Compiler** (via `@rolldown/plugin-babel`): niente `useMemo`/`useCallback` a mano
- **CSS Modules** + design token in variabili CSS, tema chiaro/scuro automatico con `light-dark()`
- Font **Saira** self-hosted (`@fontsource-variable/saira`), asse di larghezza per le cifre condensate
- **Vitest** + Testing Library

## Design

- **Testi non selezionabili**: come in un'applicazione, i testi dell'interfaccia (app e sito) non si selezionano trascinando il mouse; restano selezionabili i campi in cui si scrive (`src/styles/global.css`).

- Base quasi monocromatica (asfalto, pista, linee) in stile Linear/Vercel: superfici piatte, niente ombre, molto spazio.
- Un solo elemento forte: la **lavagna dei box** con i giri da impostare, in giallo su grafite.
- Il colore semantico (verde/ambra/rosso) è riservato allo stato dello stint.
- Tutti i token sono in `src/styles/tokens.css`: cambiare palette o raggi significa toccare solo quel file.
- **Pulsanti di accesso con Discord** (`DiscordSignInButton`, nell'app e nel sito): palette di Discord (blurple `#5865F2`, testo bianco) con il simbolo di Discord prima del testo. Il simbolo è `src/assets/discord-mark.svg`: il file nel progetto è un segnaposto, sostituiscilo con il simbolo ufficiale scaricato da https://discord.com/branding (qualsiasi SVG del simbolo va bene, il pulsante lo colora di bianco da solo).
- **Campi in sola lettura** (`Input` e `Textarea` con `readOnly`): non ricevono clic, Tab né focus, nemmeno dal clic sull'etichetta (il focus si toglie subito), quindi non compare mai il cursore di testo e non si seleziona nulla. In modifica tornano campi normali.

**Pulsanti**, un colore per ruolo (`variant` di `Button`): **verde** (`confirm`) per confermare o salvare (Salva, Aggiungi, Salva gara); **nero** (`primary`, e `ButtonLink`) per le azioni di servizio che aprono o avviano qualcosa (Modifica, Crea gara, Aggiungi penalità, Riprova); **rosso** (`danger`) per eliminare o uscire perdendo le modifiche (Elimina, Annulla modifiche, Esci senza salvare); **contorno neutro** (`secondary`) per restare nell'azione in corso o annullare (Annulla, Continua a modificare). Tutti i pulsanti sono larghi almeno 7rem (`--button-min-inline-size`); con un testo più lungo si allargano solo quanto serve, mantenendo il padding. Dove non c'è una posizione precisa stanno a destra ("Accedi con Discord" resta al centro del riquadro di accesso).

## Accesso con Discord

All'apertura l'app mostra la schermata di login: si entra solo con un account Discord che ha nel server almeno uno dei tre ruoli dell'app, e ognuno vede solo le sue sezioni. **Organizzazione** (`1569700040602292346`): **Gestisci campionato** (equipaggi, gare, ordini di arrivo, penalità). **Direttore Gara** (`1569716852886605844`): **Crea documentazione**, **Strumenti della Direzione Gara** e la campanella dei ticket. **Commissari Sportivi** (`1569718968183296130`): **Strumenti dei Commissari Sportivi** (proteste e cambi pilota). Senza il ruolo, le pagine di quella sezione rispondono "Pagina non trovata" anche aprendo l'indirizzo, e il server rifiuta le sue richieste (403): equipaggi, gare e penalità si modificano solo con Organizzazione (nuovi tracciati anche con Direttore Gara); ticket di disconnessione solo con Direttore Gara; proteste e cambi pilota solo con Commissari Sportivi; equipaggi, gare, piste e auto si leggono con uno qualsiasi dei tre. I ruoli sono in `server/wrangler.jsonc` (`DISCORD_ORGANIZATION_ROLE_ID`, `DISCORD_REQUIRED_ROLE_ID`, `DISCORD_STEWARDS_ROLE_ID`) e in `src/config/discordConfig.ts`.
Gli ID sono in `src/config/discordConfig.ts` e in `server/wrangler.jsonc` (identificativi pubblici, non segreti): server Discord `1569698028938600458`, ruolo Direttore Gara `1569716852886605844`.

**Come funziona**
1. "Accedi con Discord" apre il browser sulla pagina ufficiale di autorizzazione: la password la vede solo Discord.
2. Discord rimanda a `http://127.0.0.1:47823/discord/callback`, dove l'app è in ascolto (lato nativo, `src-tauri/src/discord_oauth_redirect.rs`).
3. L'app scambia il codice con PKCE, senza alcun client secret, e legge i ruoli con `/users/@me/guilds/{server}/member`.
4. Con il ruolo si entra; senza, la schermata di login spiega il motivo.

**Dati**
- Nome, avatar e ruoli restano solo in memoria.
- Con "Ricorda l'accesso" viene conservato soltanto il token di rinnovo nell'archivio protetto del sistema
  (Gestione credenziali su Windows), tramite `src-tauri/src/session_vault.rs`. A ogni avvio viene rinnovato e il ruolo ricontrollato:
  chi perde il ruolo non entra più. Senza la spunta i token restano solo in memoria (servono al server degli equipaggi) e vengono invalidati all'uscita; se chiudi l'app senza uscire, il token di accesso scade da solo (Discord lo rende valido per circa una settimana).
- "Esci" (rosso, nella tendina) chiede conferma; confermando dimentica i token, li invalida su Discord e torna alla schermata di login.

**Configurazione del Developer Portal** (già fatta): applicazione con "Public Client" attivo e reindirizzamento
`http://127.0.0.1:47823/discord/callback`. Se cambi porta, aggiornala sia nel portale sia in `discordConfig.ts`.

**Limite**: il controllo avviene sul PC dell'utente e gli strumenti calcolano in locale; chi modifica l'app installata
potrebbe aggirare il login. Per l'uso normale il login ferma chi non ha il ruolo.

Il login richiede le funzioni native: con `npm run dev` nel browser la schermata di login spiega che è disponibile solo nell'app desktop.

## Server degli equipaggi

Gli equipaggi vanno salvati in un posto condiviso, quindi serve un server. La cartella `server/` contiene una piccola API
che gira su **Cloudflare Workers** con il database **D1** (SQLite gestito). Perché questa scelta:

- il piano gratuito basta ampiamente per un campionato e non richiede carta di credito;
- non si "addormenta" per inattività (i progetti gratuiti di Supabase, per esempio, vengono messi in pausa dopo una settimana senza uso);
- HTTPS, backup del database e disponibilità sono gestiti da Cloudflare, senza un PC sempre acceso.

### Cosa controlla il server prima di salvare

Richieste disponibili:

- **Equipaggi**: `GET /crews`, `POST /crews`, `DELETE /crews` con `{ "ids": [...] }` (al massimo 200 per volta), `GET /crews/:id`, `PUT /crews/:id`. Un equipaggio presente in un ordine di arrivo, in una penalità o in un cambio pilota non si può eliminare (409 `crew-in-race-results`).
- **Gare**: `GET /races` (dalla più recente), `POST /races`, `DELETE /races` con `{ "ids": [...] }`, `GET /races/:id` (con l'ordine di arrivo), `PUT /races/:id`. Regole in `shared/raceRules.ts` (tra cui: la data non può essere successiva a oggi); il server controlla anche che il round sia libero nel campionato (409 `duplicate-race-round`), che la pista esista e che gli equipaggi esistano e partecipino al campionato. Gara, classifica e penalità dei cambi pilota (`driverSwaps`: `[{ swap, crewId, pitInMs, pitOutMs, isCancelled, notes }]`, solo vetture del campionato e cambi previsti dal campionato; la penalità di ogni riga la ricalcola il server) si salvano in un'unica transazione.
- **Penalità di una gara**: `GET /races/:id/penalties`, `POST /races/:id/penalties`, `DELETE /races/:id/penalties` con `{ "ids": [...] }`, `GET /races/:id/penalties/:penaltyId`, `PUT /races/:id/penalties/:penaltyId`, e `GET /races/:id/reprimands[?before=:penaltyId]` (reprimende di ogni vettura già date prima di una penalità, per il form). Regole in `shared/penaltyRules.ts`: almeno una vettura, del campionato della gara (422 `invalid-penalty`), per ogni vettura (`crews: [{ crewId, decision }]`) una decisione facoltativa tra quelle previste (nelle risposte ogni reprimenda ha anche `reprimandNumber`, da 1 a 3, calcolato dal server), violazione obbligatoria: il numero dell'articolo, solo cifre separate da punti (al massimo 20 caratteri; altrimenti 422 `violation: 'invalid'`), `document` obbligatorio (`'code-of-conduct'` o `'technical-regulations'`), decisione tra quelle previste, motivazione facoltativa (al massimo 2000). Ogni penalità ha `english`: `null` oppure `{ reason, source: 'automatic' | 'manual', isOutdated }` (la motivazione inglese); nel `PUT` si può mandare `englishText: { reason }` (correzione a mano, non vuota, al massimo 3000 caratteri) oppure `englishText: null` (rifai la traduzione automatica).
- **Traduzione inglese delle penalità** (`server/src/translation/penaltyTranslation.ts`): l'unica lingua in cui si traduce è l'inglese, qualunque sia la lingua in cui la Direzione Gara scrive, e si traduce solo la motivazione: la violazione è numero dell'articolo + documento e il referto la scrive con una frase fissa ("Violazione dell’art. 2.4 del C.d.C." / "Breach of Art. 2.4 of the C. C."). Avviene al salvataggio, e solo quando cambia la motivazione: una traduzione automatica si rifà, una corretta a mano resta e diventa "da ricontrollare". Come funziona:
  1. **Termini protetti**: prima della richiesta numeri delle vetture (`#54`), numeri degli articoli (`2.5.5.3.1`), tempi (`1:34.065`) e sigle dei regolamenti diventano segnaposto `[[1]]`, `[[2]]`…; dopo, ognuno deve tornare esattamente una volta, altrimenti la traduzione si scarta. Le sigle tornano in inglese: `C.d.C.` (Codice di Condotta) → `C. C.` (Code of Conduct), `Reg. Tec.` (Regolamento Tecnico) → `Tech. Reg.` (Technical Regulations).
  2. La motivazione va a Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, risposta in JSON validato, temperatura 0) con un glossario della Direzione Gara (vettura → car, Curva 13 → Turn 13, Codice di Condotta → Code of Conduct, Regolamento Tecnico → Technical Regulations, reprimenda → reprimand, scia → slipstream, staccata → braking zone, traiettoria → line, non ha il diritto allo spazio → is not entitled to racing room, bandiera verde → green flag, griglia di partenza → starting grid, manto erboso → grass, muretto → wall…).
  3. Se il modello non risponde, la quota gratuita giornaliera è finita o la risposta non è valida, la penalità si salva comunque senza traduzione e il referto in inglese usa la motivazione originale.

  Per provare il modello vero sui testi del referto di Suzuka, senza toccare il database: `CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… npm run translation:try` nella cartella `server` (token con il permesso "Workers AI: Read"; si può passare anche un testo: `npm run translation:try -- "Violazione" "Motivazione"`).
- **Auto**: `GET /cars` — tabella `cars` con costruttore, modello, PS, kg, limitatore e zavorra (si popola con `npm run cars:import`, vedi sotto). L'app la rilegge ogni volta che si usa un menu delle auto (form equipaggio, dettaglio, filtro dell'elenco); gli equipaggi salvano l'id dell'auto (`carId`) e il server rifiuta auto inesistenti. Nell'importazione da CSV l'auto si cerca per nome nella stessa tabella.
- **Piste**: `GET /tracks` (ordine alfabetico, con configurazione, continente, lunghezza in metri e senso inverso) e `POST /tracks` con `{ "name": "..." }` (nomi unici senza distinguere maiuscole). Il campo **Tracciato** dell'app (`src/features/tracks`) apre un popup con tre menu a cascata, Continente → Tracciato → Configurazione (ognuno abilitato dal precedente; con una sola configurazione la sceglie da solo), e la casella "Versione al contrario" quando la configurazione la prevede; le piste vengono rilette dal server a ogni apertura. Nelle gare si salvano `trackId` e `isTrackReversed` (il server rifiuta "al contrario" se la configurazione non lo prevede: 422 `reverse-unavailable`) e la pista compare come "Tracciato - Configurazione al contrario".
- `GET /health`.

Tabelle (migrazioni in `server/migrations`): `cars`, `crews` (con `car_id`), `tracks` (una riga per configurazione), `races` (unica per campionato + round, con `name`, `duration` — `'3 hours'`, `'6 hours'` o `'12 hours'`, dalla migrazione 0017 —, `total_laps` e `is_track_reversed`) e `race_results` (una riga per posizione occupata, con i giri completati, `car_id` e `gap`, il distacco in millisecondi, facoltativo; eliminando una gara si elimina la sua classifica), `penalties` (con `violation` = numero dell'articolo e `document`, dalla migrazione 0016 che converte le violazioni già salvate nella forma "Violazione dell'art. X del …"; `reason_en`, `english_source` ed `english_outdated` per la motivazione inglese, dalla 0015) con `penalty_crews` (vetture coinvolte, ognuna con la sua `decision` facoltativa, dalla migrazione 0014) e `driver_swaps` (una riga per cambio e vettura compilata: `swap`, `crew_id`, `pit_in`, `pit_out` e `penalty` in millisecondi, `is_cancelled`, `notes`; dalla migrazione 0012); eliminando una gara se ne eliminano anche penalità e cambi pilota. Un'auto usata da un equipaggio o in una gara salvata non si può eliminare.

**Vettura delle gare salvate** (`resolveResultCars` in `shared/raceRules.ts`, applicata dal server e mostrata dall'app): al salvataggio ogni riga dell'ordine di arrivo registra l'auto che l'equipaggio ha in quel momento. Se poi l'equipaggio cambia auto, le gare già salvate tengono quella vecchia; modificando una gara, le righe rimaste uguali (stessa posizione, stesso equipaggio) tengono la loro, mentre quelle nuove o cambiate prendono l'auto attuale. Un equipaggio senza auto non si può inserire in una riga nuova o cambiata (422 `crew-without-car`). Per le gare salvate prima di questa regola la migrazione 0008 ha copiato l'auto attuale dell'equipaggio.

1. **Chi sei**: per ogni richiesta, anche di sola lettura, l'app invia il token Discord della sessione; il server chiede a Discord se l'account è nel server con il ruolo richiesto (risposta tenuta in memoria 5 minuti). Senza ruolo risponde 403, senza token valido 401.
2. **I dati**: rilegge tutto con le stesse regole dell'app (`shared/crewRules.ts`): nome di lettere, numeri e spazi tra le parole (massimo 48; spazi in più vengono tolti), numero intero 0–999, auto della tabella `cars`, campionato tra quelli previsti (`CREW_CHAMPIONSHIPS` in `shared/crewRules.ts`, Cool1 FIE Championship e All Japan GT Championship) oppure **Nessuno** (salvato come `'None'`: l'equipaggio non partecipa a nessun campionato e non compare nelle gare); nei CSV si accettano anche il nome precedente "FIE Cool1" e "Nessuno"/"None" e colore in esadecimale a 6 cifre: tutti e tre obbligatori dall'app, facoltativi solo nell'importazione da CSV (gli equipaggi importati incompleti mostrano l'avviso e vanno completati dal dettaglio prima di poterli salvare). Corpo massimo 2 KB (64 KB per le gare, che contengono anche i cambi pilota, e 16 KB per le penalità, che possono avere una motivazione lunga).
3. **Duplicati**: numero già usato o nome già usato da un altro equipaggio (senza distinguere maiuscole e minuscole; in modifica l'equipaggio stesso non conta) → 409 con il motivo. Gli stessi vincoli sono anche nel database (`UNIQUE`), così due richieste simultanee non possono passare entrambe.

Il token resta solo in memoria nell'app e viene invalidato su Discord all'uscita. Il server non lo salva: nel database finisce solo l'ID Discord di chi ha creato l'equipaggio.

### Test

`npm test` nella cartella `server` esegue i test dell'API su un vero SQLite in memoria.

### Sostituire gli equipaggi da un CSV

Il file diventa il nuovo elenco degli equipaggi (es. esportato da Excel con "Salva come → CSV"):

```bash
cd server
npm run crews:import -- data/crews.csv --dry-run   # mostra cosa cambierebbe nel database online, non scrive nulla
npm run crews:import -- data/crews.csv             # applica al database online
```

- **Formato**: una riga per equipaggio con nome e numero; auto, campionato e colore (esadecimale, con o senza `#`) sono facoltativi. Un `#` davanti al numero viene ignorato. Separatore `;` (Excel in italiano), `,` o tabulazione, riconosciuto da solo.
  L'intestazione è facoltativa e le colonne possono essere in qualsiasi ordine se intitolate `crew_name`, `crew_number`, `car`, `championship`, `crew_color` (si accettano anche i nomi italiani, es. `Nome`, `Numero`, `Auto`, `Campionato`, `Colore`); senza intestazione l'ordine è nome, numero, auto, campionato, colore.
- **Controlli**: le stesse regole dell'app e del server (auto vuota o della tabella `cars`, scritta come nel menu dell'app senza badare alle maiuscole), più i duplicati dentro il file.
- **Sovrascrittura**: ogni riga aggiorna l'equipaggio con lo stesso numero (o, se il numero è nuovo, con lo stesso nome: equipaggio rinumerato) tenendo il suo id, così gli ordini di arrivo restano collegati; le righe nuove creano equipaggi. Auto, campionato e colore lasciati vuoti nel file **non cancellano** quelli già salvati (si possono quindi assegnare dall'app). Gli equipaggi che non sono nel file vengono eliminati, tranne quelli presenti in un ordine di arrivo, che restano e vengono segnalati.
- **Equipaggi FIE**: `server/data/crews.csv` contiene i 15 equipaggi ricavati dal file delle licenze (team della colonna D, numero della E senza `#`, campionato della G; esclusi Svincolato e righe senza numero; #20 e #21 rinominati "GT Tribe Team Yellow" e "GT Tribe Team Purple"). Auto e colore sono da completare (nel file o dall'app).
- **Tutto o niente**: se anche una riga ha un problema, non salva nulla ed elenca ogni riga da correggere con il motivo.
- Il percorso del file si indica intero o relativo alla cartella `server`. Prima di importare, applica le migrazioni con `npm run db:migrate:remote`. Gli import scrivono sempre nel database online su Cloudflare (serve `npx wrangler login`).

### Sostituire auto e piste da un CSV

```bash
cd server
npm run cars:import -- C:\percorso\auto.csv --dry-run       # mostra cosa cambierebbe, non scrive nulla
npm run cars:import -- C:\percorso\auto.csv                 # applica al database online
npm run tracks:import -- C:\percorso\piste.csv --dry-run
npm run tracks:import -- C:\percorso\piste.csv
```

- **Auto**: colonne `manufacturer`, `model`, `horsepower_ps`, `weight_kg`, `power_limiter`, `ballast_kg` (in qualsiasi ordine; senza intestazione in quest'ordine; si accettano anche `Costruttore`, `Modello`, `PS`, `kg`, `Limitatore`, `Zavorra`). Solo il costruttore è obbligatorio. Numeri all'italiana ammessi (`1.250`, `95,5`); il limitatore accetta i decimali. File attuale: `server/data/cars.csv`.
- **Piste**: una riga per configurazione, colonne `continent`, `track_name`, `configuration`, `length_meters` (metri), `has_reverse_layout` (`true`/`false`); obbligatorio solo il nome. Nome + configurazione devono essere unici ("Monza (Full Course)" e "Monza (No Chicane)" sono due piste). File attuale: `server/data/tracks.csv` (84 configurazioni). Un file senza piste viene rifiutato, così non svuota la tabella per sbaglio.
- **Sostituzione senza rompere i collegamenti**: il file diventa il nuovo elenco, ma le righe con lo stesso nome (senza badare alle maiuscole) vengono aggiornate tenendo il loro id, così equipaggi e gare restano collegati. Un'auto salvata con il solo costruttore (es. `Ferrari`) diventa quella del file se il file contiene un solo modello di quel costruttore (es. `Ferrari 296 GT3`). Le righe non più nel file vengono eliminate, tranne quelle ancora usate da un equipaggio o da una gara, che restano e vengono segnalate: riassegnale dall'app e rilancia il comando.
- **Tutto o niente**: con anche una sola riga sbagliata (dato non valido, doppione nel file, valori oltre l'ultima colonna: di solito un `;` al posto della virgola decimale) non cambia nulla e viene elencato ogni problema.
- **Un comando per riga**: lancia i comandi uno alla volta; incollati di seguito senza a capo diventano un unico comando con argomenti sbagliati.

### File pronti in `server/data`

Un CSV per tabella, con intestazioni in inglese:

| File | Contenuto | Comando |
| --- | --- | --- |
| `crews.csv` | i 15 equipaggi FIE | `npm run crews:import -- data/crews.csv` (sovrascrive) |
| `cars.csv` | 17 auto con PS, kg, limitatore e zavorra | `npm run cars:import -- data/cars.csv` |
| `tracks.csv` | 84 configurazioni con continente, lunghezza e senso inverso | `npm run tracks:import -- data/tracks.csv` |
| `races.csv` | solo intestazione: `championship`, `round`, `race_date` (AAAA-MM-GG), `track_name` | nessuno per ora: le gare si inseriscono dall'app |
| `race_results.csv` | solo intestazione: `championship`, `round`, `finishing_position`, `crew_number`, `laps_completed`, `gap` (distacco, es. `1:05,320`, facoltativo) | nessuno per ora |

Le tabelle non nascono dai CSV ma dalle migrazioni (`npm run db:migrate:remote`), che le creano vuote: i CSV servono solo a riempirle. Gare e ordini di arrivo usano campionato + round, numero dell'equipaggio e nome della pista invece degli id interni, così i file restano leggibili.

### Pubblicarlo su Cloudflare (gratis)

```bash
cd server
npx wrangler login                     # apre il browser per accedere/creare l'account Cloudflare
npx wrangler d1 create race-control    # stampa un database_id
```

1. Copia il `database_id` in `server/wrangler.jsonc` al posto degli zeri.
2. `npm run db:migrate:remote` crea la tabella sul database online.
   La traduzione inglese delle penalità usa Workers AI tramite il binding `AI` già in `wrangler.jsonc`: non serve altro (la quota gratuita giornaliera basta per l'uso normale).
3. `npm run deploy` pubblica il Worker e stampa l'indirizzo, es. `https://race-control-api.<tuo-sottodominio>.workers.dev`.
4. Nella cartella principale copia `.env.example` in `.env.production` e metti quell'indirizzo in `VITE_CREW_API_URL`.
5. Ricrea l'installer con `npm run desktop:build`.

I permessi di rete dell'app (`src-tauri/capabilities/default.json`) consentono solo Discord e gli indirizzi `*.workers.dev`.
Se usi un dominio tuo, aggiungilo lì.

## Sito dei risultati

Sito pubblico (cartella `site/`) che mostra le gare inserite in **Gestisci ordini di arrivo** (senza accesso) e offre servizi per chi accede con Discord, nella lingua del browser (italiano, inglese, francese, tedesco; se non è tra queste, l'inglese) e con il tema chiaro/scuro del sistema. L'icona utente in alto a destra apre la stessa tendina dell'app per scegliere modalità notte e lingua ("Predefinita" = lingua del browser); le scelte restano salvate nel browser.

- **`/`** (home): due sezioni, come nell'app. **Sessioni di gara**: **Sessione di qualifica** (in costruzione) e **Sessioni di gara**, che apre l'elenco delle gare. **Ticketing**: **Invia ticket di disconnessione** e **Invia protesta**, che si aprono solo dopo l'accesso con Discord: prima dell'accesso le card mostrano "Accesso richiesto" e il clic non le apre ma ricorda di accedere, con il pulsante di Discord. La pagina del ticket (`/ticket-disconnessione`) senza accesso mostra lo stesso promemoria; dopo l'accesso mostra il modulo: **Equipaggio coinvolto** (compilato in automatico dal ruolo Discord di equipaggio di chi è collegato, es. "#16 Vez Team Lime", e non modificabile; vedi "Bot Discord" sotto), **Posizione** (intero da 1 a 14), **Distacco da P1** (o **Distacco da P2** se la posizione è 1; formato HH:MM:SS.DDD; uscendo dal campo si formatta da solo: un numero intero sono secondi (`83` → `00:01:23.000`), i decimali vanno dopo un punto o una virgola (`83,5`, `1:23.456`), e valgono anche `HH:MM:SS,DDD` e `HH.MM.SS.DDD`; regole in `parseTicketGap`, `shared/disconnectionTicketRules.ts`) e **Giro della disconnessione** (intero 0–999), con un avviso a non inserire dati personali o sensibili. **Invia ticket** chiede conferma ricordando che i dati sono definitivi; con **Conferma** il ticket va al server (`POST /public/disconnection-tickets`, con il token Discord del sito) e si apre la sua pagina, con un messaggio di conferma che dopo 5 secondi si dissolve e sparisce. Ognuno può avere al massimo 3 ticket in attesa. Sotto il modulo, **Ticket del tuo equipaggio** elenca gli ultimi ticket inviati da te e da chi ha il tuo stesso ruolo di equipaggio, con chi li ha inviati e lo stato (In attesa / Gestito).
- **`/protesta`** (dopo l'accesso): **Equipaggio coinvolto** dal ruolo Discord come nel ticket; **Campionato** (i campionati dell'app; all'inizio quello del proprio equipaggio), **Stint** (1–20), **Giro dello stint** (1–999) e **Curva** (numero o nome, fino a 40 caratteri), obbligatori; **Altri equipaggi coinvolti** (facoltativo, gli equipaggi del campionato scelto, che si svuotano cambiando campionato, scelti con le caselle e mostrati come clip, come in "Vetture coinvolte" delle penalità); **Descrizione dell'episodio** (5 righe, al massimo 500 caratteri; negli ultimi 50 compare in basso a destra il conto dei caratteri rimasti); **Video** (facoltativo: si sceglie o si trascina nella zona tratteggiata; MP4, WebM o MOV, al massimo 100 MB: limite scelto, perché il video arriva al Worker in una sola richiesta e Cloudflare non ne accetta di più grandi; il caricamento a più parti non è previsto) e **Link YouTube** (facoltativo; valgono watch, youtu.be, shorts, live). **Invia protesta** chiede conferma, manda i dati, carica il video mostrando la percentuale e apre la pagina della protesta (la conferma "Protesta #N inviata" si dissolve dopo 5 secondi; se il video non si è caricato, la pagina dice perché). Al massimo 10 proteste in 24 ore a persona. Sotto il modulo, **Proteste del tuo equipaggio** elenca le proteste inviate da te e da chi ha il tuo stesso ruolo di equipaggio, con l'esito.
- **`/protesta/:id`**: dati inviati, esito (In esame / Respinta; se respinta, in evidenza la motivazione dei Commissari o "Nessuna motivazione indicata") e video (quello caricato nel player, scaricato con il token, e quello di YouTube incorporato). Chi ha mandato la protesta può aggiungere il video caricato e il link YouTube che mancano **fino a 24 ore dall'invio**; poi l'aggiunta si chiude. I video caricati si cancellano 30 giorni dopo l'invio.
- **`/ticket-disconnessione/:id`**: dati inviati (con chi lo ha inviato) e stato del ticket, visibili a chi lo ha mandato e a chi ha lo stesso ruolo di equipaggio (salvato nel ticket all'invio; i ticket precedenti restano visibili solo a chi li ha mandati); quando la Direzione Gara invia il risultato dall'app, sotto compaiono il tempo di attesa, il dettaglio del calcolo e i valori di pista e stint usati. La pagina si aggiorna da sola.
- **Campanella del sito** (accanto al profilo, dopo l'accesso): il numero rosso conta le notifiche arrivate e non ancora viste: i risultati dei ticket e le **proteste respinte** dai Commissari Sportivi (proprie o del proprio equipaggio, "Respinta dai Commissari Sportivi"). Il sito ricontrolla ogni 30 secondi e quando torni sulla scheda; il clic su una notifica apre subito il ticket o la protesta, e aprire la pagina di una protesta respinta ne segna la notifica come vista. Le notifiche già viste sono ricordate nel browser, per account (`site/src/notifications/createSiteNotificationStore.ts`).
- **Bot Discord "Michael Masi"**: con il permesso `identify guilds.members.read` Discord dà al sito solo gli ID dei ruoli dell'utente, non i nomi; il server legge i nomi dei ruoli del server Discord con il token del bot (`GET /guilds/{server}/roles`, in cache 5 minuti) e cerca quello di equipaggio. **Prima** controlla se uno dei ruoli dell'utente è collegato a un equipaggio, campo **Ruolo Discord** della scheda dell'equipaggio nell'app (facoltativo; si incolla l'ID del ruolo, «Copia ID ruolo» con la Modalità sviluppatore, o la sua menzione `<@&…>`, che diventa l'ID; colonna `crews.discord_role_id`, migrazione 0023, un ruolo per un solo equipaggio, `409 duplicate-crew-role` altrimenti; l'importazione da CSV non lo cambia): in quel caso vale qualunque sia il nome del ruolo e il bot non serve. **Altrimenti** cerca un ruolo il cui nome inizia con `#` e il numero, es. `#16 Vez Team Lime`, e confronta il numero con gli equipaggi dei campionati che non hanno un ruolo collegato (un equipaggio con il ruolo collegato si riconosce solo da quello; codice in `server/src/tickets/ticketCrewFromRoles.ts`). Se l'utente non ha un ruolo di equipaggio, ne ha più di uno o il numero non corrisponde a nessun equipaggio, il modulo lo spiega e non si può inviare. Per leggere i ruoli basta che il bot sia nel server, senza intent privilegiati. Per scrivere i risultati dei ticket deve poter **vedere** e **scrivere** nei canali degli equipaggi ("Visualizza canale" e "Invia messaggi": invito con `permissions=3072`, oppure permessi dati canale per canale); perché la menzione del ruolo mandi la notifica, il ruolo dell'equipaggio deve essere menzionabile da tutti oppure il bot deve avere "Menziona @everyone, @here e tutti i ruoli". Il canale di ogni equipaggio si imposta nell'app, campo **Canale Discord** della scheda dell'equipaggio (facoltativo; si incolla l'ID del canale o il suo link, che diventa l'ID; colonna `crews.discord_channel_id`, migrazione 0020; l'importazione da CSV non lo cambia). Il token va messo come secret su Cloudflare (`npx wrangler secret put DISCORD_BOT_TOKEN` nella cartella `server`), mai nel codice.
- **Accesso con Discord** (tendina in alto a destra): basta far parte del server Discord della lega, nessun ruolo richiesto (a differenza dell'app). Dopo l'accesso la tendina mostra avatar, nome e handle Discord (`@nome`) ed **Esci**. Flusso PKCE senza client secret: il sito va su Discord, torna su `/accesso/discord` e il server (`/public/discord/session`) scambia il codice e controlla l'appartenenza al server; chi non ne fa parte viene rifiutato e i suoi token revocati. I token restano nel browser (localStorage) finché non si esce; a ogni apertura il sito rilegge il profilo (`/public/discord/me`, con rinnovo automatico via `/public/discord/refresh`), così chi lascia il server Discord perde l'accesso; **Esci** li cancella e li revoca su Discord (`/public/discord/sign-out`). Il server ricorda per un minuto profilo e ruoli di ogni token (e unisce le richieste contemporanee in un'unica chiamata a Discord), perché Discord risponde "troppe richieste" (429) se lo si interroga più volte di fila, come succede aprendo una pagina; con un 429 breve aspetta e riprova (`server/src/discord/discordRateLimit.ts`), e il sito riprova da solo se Discord non risponde per un momento. Codice in `site/src/auth` e `server/src/siteAuth`.
  **Da fare una volta nel Discord Developer Portal** (OAuth2 → Redirects): aggiungi `https://race-control-api.<tuo-sottodominio>.workers.dev/accesso/discord` (o il dominio del sito) e, per `npm run site:dev`, `http://localhost:5174/accesso/discord`.
- **`/gare`**: tabella delle gare disputate con gli stessi filtri dell'app (campionato, tracciato, date); filtri e ordinamento restano nell'indirizzo (`/gare?pista=12&ordine=round-ascending`; i vecchi indirizzi `/?pista=…` portano qui), quindi si possono condividere. La freccia a destra della riga apre la gara, come nell'app.
- **`/gare/:id`**: nome della gara con campionato e round, una riga con data, tracciato, durata e giri totali, poi la classifica: posizione (podio segnato dalla linea gialla), numero, equipaggio, vettura usata in quella gara, giri completati, distacco dal primo come inserito nell'app (es. "+1:05,320"); se manca, i giri in meno rispetto al primo ("+ 1 giro", "+ 2 giri"; "–" a parità di giri e per il primo), e penalità. Sopra la classifica, **Visualizza referto** (solo nei browser che sanno mostrare i PDF dentro la pagina; sugli altri, per esempio molti telefoni, resta solo "Scarica referto") divide lo spazio a metà: la classifica si stringe a sinistra con una breve animazione e a destra compare il referto in PDF (su schermi stretti va sotto la classifica); il pulsante diventa "Chiudi referto". **Scarica referto** salva lo stesso PDF sul dispositivo. Il referto, sia visualizzato sia scaricato, è in italiano se il sito è in italiano e in inglese con qualunque altra lingua (con la violazione e le sigle inglesi e la motivazione tradotta).

Comandi (dalla cartella principale):

```bash
npm run site:dev     # sito su http://localhost:5174 con le gare vere del server su Cloudflare (indirizzo da .env.production)
npm run site:build   # compila il sito in site/dist (lo fa da solo `npm run deploy` nella cartella server)
```

Come è fatto:
- **Ticket di disconnessione** (tabella `disconnection_tickets`, migrazioni 0018, 0019 e 0020, ruolo collegato all'equipaggio con la 0023; codice in `server/src/tickets`, regole in `shared/disconnectionTicketRules.ts`): `GET /public/disconnection-tickets/crew` (equipaggio dal ruolo Discord; 422 con `no-crew-role`, `multiple-crew-roles` o `crew-not-found`, 503 `bot-unavailable` se manca il token del bot), `POST /public/disconnection-tickets` (dal sito: basta far parte del server Discord, verificato con il token; l'equipaggio lo decide il server dal ruolo, stessa convalida del sito, al massimo 3 ticket aperti a persona → 429), `GET /public/disconnection-tickets/mine` e `GET /public/disconnection-tickets/:id` (i propri ticket e quelli del proprio equipaggio, con stato e risultato), `GET /disconnection-tickets` e `POST /disconnection-tickets/:id/result` con `{ details }` (il risultato completo del calcolatore; dall'app, ruolo Direzione Gara; 409 se il ticket era già chiuso), che risponde `{ discordMessage: 'sent' | 'no-channel' | 'failed' }`: dopo aver salvato il risultato il bot lo scrive nel canale Discord dell'equipaggio (`server/src/tickets/ticketResultNotice.ts`), con un messaggio formale e impersonale solo sul tempo di attesa, prima in italiano e poi in inglese, con il link alla pagina del ticket sul sito per i dettagli, e alla fine la menzione del solo ruolo dell'equipaggio di chi ha mandato il ticket; se l'equipaggio non ha un canale o il bot non riesce a scrivere, il risultato resta salvato e il calcolatore lo segnala. Il ticket salva numero e nome dell'equipaggio, il suo ruolo Discord (`crew_role_id`), nome e handle Discord di chi l'ha mandato e, alla chiusura, tempo di attesa, risultato completo (`result_json`), chi l'ha gestito e quando.
- **Proteste** (tabella `protests`, migrazione 0021; codice in `server/src/protests`, regole in `shared/protestRules.ts`): `GET /public/protests/form` (equipaggio dal ruolo Discord e gli altri equipaggi di tutti i campionati, con il loro campionato; se il server online non lo conosce, 404, il sito dice che va ripubblicato), `POST /public/protests` (stessa convalida del sito; gli altri equipaggi devono essere del campionato scelto; 429 oltre le 10 proteste in 24 ore), `PUT /public/protests/:id/video` (il file del video come corpo, con Content-Type e Content-Length: solo chi ha mandato la protesta, una volta, entro 24 ore dall'invio; 413 oltre 100 MB, il limite di una richiesta a Cloudflare Workers), `PUT /public/protests/:id/youtube` (`{ youtubeUrl }`, alle stesse condizioni del video), `GET /public/protests/mine`, `GET /public/protests/:id` e `GET /public/protests/:id/video` (le proprie proteste e quelle del proprio equipaggio, con `canAddVideo`/`canAddYoutube`), `GET /protests`, `GET /protests/:id`, `GET /protests/:id/video` e `PUT /protests/:id/review` (`{ isRejected: true, reason }`: rifiuto definitivo, `409 protest-already-rejected` se la protesta è già respinta; app, ruolo Commissari Sportivi). Esito nelle colonne `status`, `rejection_reason`, `reviewed_by_discord_id`, `reviewed_at` (migrazione 0022). Il video si può aggiungere entro 24 ore dall'invio (prima un'ora); passati 30 giorni dall'invio il server lo considera scaduto (410) e R2 lo cancella con la regola del bucket: `npx wrangler r2 bucket lifecycle add race-control-protest-videos cancella-video-proteste protests/ --expire-days 30` (oppure dal pannello: R2 → bucket → Settings → Object lifecycle rules). I video stanno nel bucket R2 `race-control-protest-videos` (binding `PROTEST_VIDEOS` in `server/wrangler.jsonc`), da creare una volta con `npx wrangler r2 bucket create race-control-protest-videos`; senza il bucket le proteste funzionano ma il caricamento dei video risponde 503.
- **Referto di gara**: `GET /public/races/:id/report.pdf?lang=…`, in italiano con `lang=it` (o senza `lang`) e in inglese con qualunque altra lingua del sito (inglese, francese, tedesco…), generato dal server a ogni richiesta (con la stessa cache di un minuto) sul modello del "Referto di gara – 1000 km di Suzuka": copertina, intestazione e piè di pagina numerato, **1. Classifica finale di gara** (posizione, numero, equipaggio, costruttore della vettura, giri, distacco dal leader in tempo o in giri, penalità = secondi delle decisioni a tempo di ogni vettura + penalità dei cambi pilota non annullate) e **2. Penalità** (vetture coinvolte, decisione scritta per esteso nominando sempre le vetture, una riga per decisione, es. "+2 posizioni in griglia di partenza nel Round 7 per la vettura #54"; se nessuna vettura ha una decisione, "Nessuna azione ulteriore"; le reprimende hanno il loro numero, "Reprimenda per la vettura #16 (1)", e alla terza segue la riga "+1 posizione in griglia di partenza nel Round 7 per la vettura #16 (terza reprimenda)"; motivazione con la violazione in grassetto); le tabelle continuano sulle pagine successive ripetendo l'intestazione. Giro veloce e pole position non ci sono ancora. I testi fissi (titoli, colonne, frasi delle decisioni con singolari e plurali, "+1 giro", nome del file) sono in `reportTexts.ts`, in italiano e in inglese; i tempi restano col punto per i millesimi. La violazione è una frase fissa con numero e documento: "Violazione dell’art. 2.4 del C.d.C." / "… del Reg. Tec." in italiano, "Breach of Art. 2.4 of the C. C." / "… of the Tech. Reg." in inglese; (le penalità salvate prima, con un testo libero non convertibile, mostrano quel testo). La motivazione resta come l'ha scritta la Direzione Gara, tranne nel referto in inglese, che usa la sua traduzione salvata quando c'è. Codice in `server/src/reports` (dati in `raceReportData.ts`, disegno con [pdf-lib](https://pdf-lib.js.org) in `raceReportPdf.ts`, con Helvetica, che ha le stesse misure del Liberation Sans del modello).
- **Dati**: `GET /public/races` e `GET /public/races/:id` del server, in sola lettura e senza accesso Discord; la classifica arriva già con numero, nome e colore dell'equipaggio e nome della vettura. Le risposte si possono tenere in cache per un minuto. Le API dell'app restano protette.
- **Pubblicazione**: il sito lo serve lo stesso server su Cloudflare (`assets` in `server/wrangler.jsonc`): stesso indirizzo `…workers.dev` di sempre, la pagina iniziale è il sito; un solo `npm run deploy` compila il sito e pubblica entrambi.
- **Codice**: React 19 + React Router (pagine caricate su richiesta, dati letti dai `loader` prima del rendering, pagine d'errore per gara inesistente o rete assente). Riusa dall'app `RaceBrowser` (filtri, conteggio e tabella delle gare, usato anche da Gestisci ordini di arrivo), `ToolPageHeader`, `PageFrame`, `BrandHeader`, `DefinitionList`, `ColorDot`, gli stili della tabella, i token grafici e i testi.

## Lingue

L'app è tradotta in **italiano, inglese, francese e tedesco**. Di default usa la lingua del sistema operativo
(se non è tra queste, l'inglese); dalla tendina dell'icona utente si può scegliere una lingua fissa o tornare a "Predefinita".

- I testi sono in `src/i18n/messages/` (`it.ts` è il riferimento, gli altri devono avere la stessa struttura: lo verifica TypeScript).
- I testi con parti variabili sono funzioni, es. `deviationBy: (duration) => \`di ${duration}\``, così ogni lingua può riordinare le parole.
- `useI18n()` restituisce testi e formattatori dei numeri della lingua corrente (190,403 in italiano, 190.403 in inglese).
- Anche la pagina "Accesso completato" mostrata nel browser dopo il login è tradotta.
- Per aggiungere una lingua: un nuovo file in `messages/`, la voce in `MESSAGES_BY_LOCALE` e in `SUPPORTED_LOCALES`.

## Navigazione e tema

- `#/` home con il benvenuto e le sezioni di card; `#/campionato/<slug>` per la gestione del campionato e `#/strumenti/<slug>` per gli strumenti della Direzione Gara; qualsiasi altro percorso mostra la pagina "non trovata". L'hash router fa funzionare il ricaricamento (Ctrl+R) su ogni pagina anche senza server.
- **Aggiungere uno strumento**: crea `features/<nome>/` e aggiungi una voce alla sezione giusta in `features/tools/toolCatalog.ts`. Card e rotta compaiono da sole. Una voce con `availability: { status: 'under-construction' }` mostra la card disattivata con l'etichetta "In costruzione" e non crea la rotta: per attivarla basta passare a `{ status: 'available', loadPage }`.
- **Modalità notte**: dalla tendina dell'icona utente; l'interruttore contiene un'icona che si trasforma da sole a luna. Di default segue il sistema; la scelta manuale è salvata, applicata prima del primo paint da uno script in `index.html` e nell'app desktop colora anche la barra del titolo.
- **Utente**: nome e avatar arrivano dall'account Discord; i componenti li leggono solo tramite `useCurrentUser()`.

## Struttura

```
src-tauri/                    guscio desktop: login nel browser, archivio sicuro del token, permessi, icone
shared/                       regole degli equipaggi usate sia dall'app sia dal server (una sola fonte)
server/                       API degli equipaggi: Cloudflare Worker + database D1
src/
├─ app/                       router, layout, header, pagine di errore e 404
├─ config/                    nome del sito, titoli delle schede, Discord, indirizzo del server
├─ components/
│  ├─ ui/                     atomi: Input, IconButton, Switch, SegmentedControl, StatusBadge,
│  │                          ProgressBar, LabeledProgress, Panel, DefinitionList,
│  │                          HighlightBoard (la "lavagna" dei risultati), UsageGuide, icone
│  ├─ form/                   molecole: FormField, NumberField, TimeField, InputWithUnit,
│  │                          NumberStepper, FractionInput, FieldGrid, FieldMessage
│  ├─ layout/                 ToolLayout e ToolPageHeader: struttura comune delle pagine strumento
│  ├─ navigation/             BackLink, ButtonLink
│  └─ feedback/               StatusMessage, InlineAlert, ConfirmDialog
├─ hooks/                     usePersistentState, usePersistentForm (form salvato + convalida)
├─ i18n/                      lingue supportate, cataloghi dei testi, preferenza di lingua, useI18n
├─ lib/                       funzioni Excel (MOD, ROUND, ROUNDUP, INT), parsing e formattazione
│                             dei numeri, parseFormFields, reviveStoredForm
├─ styles/                    token e stili globali
├─ test/                      setup di Vitest e helper per montare l'app con il router
└─ features/
   ├─ home/                   HomePage, WelcomeMessage, ToolSectionList, ToolCard
   ├─ tools/                  catalogo a sezioni (fonte unica per card e rotte)
   ├─ theme/                  preferenza di tema, tema della finestra desktop, NightModeSetting, SunMoonIcon
   ├─ language/               LanguageSetting (scelta della lingua nella tendina)
   ├─ auth/                   login con Discord: PKCE, verifica del ruolo, sessione, LoginPage, AuthGate
   ├─ user/                   utente corrente e UserMenu (avatar, nome, modalità notte, lingua, logout)
   ├─ crews/                  Aggiungi equipaggio e Gestisci equipaggio: form condiviso, elenco con filtri e
   │                          ordinamento (model/crewList.ts), dettaglio con modifica, chiamate al server
   ├─ race-results/           Gestisci ordini di arrivo: elenco gare, form a schede, menu equipaggi con colore,
   │                          dettaglio con modifica (model/raceList.ts, model/raceDraft.ts), cambi pilota
   │                          (model/driverSwapDraft.ts, components/DriverSwapTables) e penalità (penalties/)
   ├─ lap-calculator/
   ├─ bop-deficit/
   └─ fie-disconnections/     Calcolatore disconnessioni
```

Ogni strumento ha la stessa forma:

```
features/<strumento>/
├─ model/          logica pura senza React, con i riferimenti alle celle del foglio originale
├─ form/           campi, valori di default e regole di convalida
├─ hooks/          unico punto di stato dello strumento
├─ components/     pannelli dei dati e dei risultati
├─ toolInfo.ts     indirizzo e chiave dei testi (nome e descrizione sono in i18n/messages)
├─ <Nome>Icon.tsx  icona della card
└─ <Nome>.tsx      composizione della pagina con ToolLayout
```

## Comportamento

- I valori vengono salvati in locale: chiudere e riaprire l'app durante la gara non perde nulla.
- Un campo numerico vuoto vale 0, come in Excel. Giro medio > 0, lobby ≥ 1, orari obbligatori:
  un valore non valido mostra un messaggio sotto il campo e la lavagna resta vuota finché non viene corretto.
- Logica confrontata con i fogli originali ricalcolati: 36 scenari per il calcolatore di giri, 20 per il deficit BoP,
  20 per ciascun caso delle disconnessioni.
- Penalità BoP negativa (auto svantaggiata) o tempo di attesa negativo (distacco maggiore della penalità):
  il calcolo resta identico al foglio e il valore esatto è nel dettaglio, ma la lavagna mostra 0 con una spiegazione.
