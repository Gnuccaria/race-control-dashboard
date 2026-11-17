# Race Control Dashboard

Strumenti per organizzare e dirigere le gare endurance a lobby. Le parti sono due:

- l'**app desktop** (Windows, macOS, Linux) per Organizzazione, Direzione Gara e Commissari Sportivi;
- il **sito dei risultati**, pubblico, dove tutti vedono gare e classifiche e i piloti mandano ticket e proteste.

App e sito usano gli stessi dati, salvati online: quello che si inserisce nell'app compare subito sul sito.

## Accesso e ruoli

Si entra nell'app con il proprio account **Discord**: la password la vede solo Discord. L'account deve essere nel server Discord della lega con almeno uno di questi ruoli, e ognuno vede solo le sezioni del suo ruolo:

| Ruolo | Sezioni |
| --- | --- |
| **Organizzazione** | Gestione campionati, Gestione equipaggi |
| **Direttore Gara** | Strumenti pre-gara, Strumenti della Direzione Gara, notifiche dei ticket di disconnessione |
| **Commissari Sportivi** | Strumenti dei Commissari Sportivi, notifiche delle proteste |

Le sezioni di un altro ruolo non compaiono, e anche aprendo il loro indirizzo si vede "Pagina non trovata".
Con **Ricorda l'accesso** l'app ti riconosce al prossimo avvio e ricontrolla ogni volta il ruolo: chi lo perde non entra più. **Esci**, nella tendina in alto a destra, chiude la sessione.

## L'app

La home accoglie con un saluto e mostra le card degli strumenti, divise per sezione; da ogni strumento "Tutti gli strumenti" riporta alla home.

In tutte le tabelle valgono le stesse regole:

- un clic sulla testata di una colonna ordina A→Z, un secondo clic Z→A;
- il **clic destro** su una riga la seleziona o la deseleziona; con almeno una riga selezionata compare **Elimina**, che chiede conferma;
- la freccia a destra della riga apre il **dettaglio**, in sola lettura: **Modifica** rende i campi modificabili, **Salva** li controlla e li salva. **Annulla**, o uscire dalla pagina durante la modifica, chiede conferma prima di perdere le modifiche.

### Gestione campionati

- **Crea campionato**: il **nome** (unico) e le **durate di gara**, da una a tre, in ore intere. Per ogni durata si indica anche la **durata dello stint**, da 60 a 180 minuti, da cui vengono gli stint (al massimo 12, e la gara deve dividersi in stint interi) e i cambi pilota attesi: una gara di 6 ore con stint da 60 minuti ha 6 stint e 5 cambi pilota. La **X** toglie una durata; una riga lasciata vuota non conta. Poi le **vetture ammesse**: il campo apre l'elenco delle auto del catalogo con una casella di spunta per ognuna, e le vetture scelte compaiono nel campo come clip, ognuna con la **X** per toglierla. Il filtro **Gruppo delle vetture** accanto mostra nell'elenco solo le vetture di un gruppo (Gr.1–Gr.4), per trovarle prima.
- **Gestisci campionato**: tabella dei campionati con durate, stint e numero di vetture ammesse. Nel dettaglio si modificano tutti i dati:
  - un nuovo nome passa anche alle gare e agli equipaggi del campionato;
  - una durata già usata da qualche gara non si può togliere né cambiarne lo stint;
  - una vettura usata da almeno un equipaggio del campionato non si può togliere (la sua casella resta spuntata e bloccata).

  Con il clic destro si eliminano i campionati selezionati. Gli equipaggi collegati perdono quel campionato e chi non ne ha altri resta con "Nessuno". Un campionato con gare salvate non si può eliminare: prima vanno eliminate le sue gare.
- **Gestisci vetture**: tabella delle vetture Gr.1–Gr.4 con costruttore, modello, gruppo, potenza e peso di serie, trasmissione, potenza e peso con il **BoP Midspeed**, **% limitatore** (potenza BoP ÷ potenza di serie, arrotondata all'unità) e **zavorra** (peso BoP − peso di serie, negativa se il BoP toglie peso), con ricerca e filtro per gruppo.
  - **Aggiorna dati** fa scaricare al server i dati di serie dal catalogo ufficiale di Gran Turismo 7 (gran-turismo.com) e il BoP Midspeed da gt-engine.com, e mostra l'**anteprima**: vetture nuove, con dati cambiati, eliminate, e quelle non più nei siti che restano perché usate da equipaggi o gare.
  - Se un'auto ha un nome diverso nei due siti (per esempio "BMW M3 GT '11" e "M3 GT3 '11"), compare tra le **vetture senza BoP trovato**: si sceglie a mano la corrispondente di gt-engine (o "Nessuna") e si ricalcola l'anteprima. Le scelte restano per i prossimi aggiornamenti.
  - **Invia al server**, dopo una conferma, salva. Le vetture già usate restano collegate a equipaggi, gare e campionati. Se un sito non risponde o è cambiato, non si salva nulla e l'app lo dice.
- **Gestisci gare**: tabella delle gare (campionato, round, nome, tracciato, data, ultima modifica), con filtri per campionato, tracciato e intervallo di date. **Crea gara** apre un form a due schede:
  - **Anagrafica**: nome della gara (facoltativo); **campionato**, da tutti quelli creati; **durata**, solo tra quelle del campionato, scelta da sola se è una sola; **round** (1–99); **data e ora di inizio** e **data e ora di fine**, in ora italiana, obbligatorie (le ore e i minuti si scelgono dai menu, a 24 ore; a 12 ore con AM/PM solo con l'app in inglese), anche nel futuro: le gare si possono inserire in anticipo. Facoltativi il **tracciato** (si sceglie Continente → Tracciato → Configurazione, anche in versione al contrario se prevista) e i **giri totali**.
  - **Dettagli**: l'ordine di arrivo su 14 posizioni, con i soli equipaggi del campionato. Ogni riga ha la vettura (quella che l'equipaggio usa in quel campionato, che resta legata alla gara anche se poi cambia auto), i **giri completati** e il **distacco** facoltativo dal primo (es. `1:05,320`). Le righe vuote sono ammesse; un equipaggio ripetuto viene segnalato.

  Eliminare una gara cancella anche classifica, cambi pilota e penalità. Le proteste per una gara si possono mandare dal sito dall'ora di inizio fino a 48 ore esatte dopo l'ora di fine. Sul sito una gara compare solo quando è iniziata.

### Gestione equipaggi

- **Crea equipaggio**: **nome** (lettere, numeri e spazi), **numero** (0–999) e **colore**, obbligatori. I **campionati** si aggiungono da un menu: un equipaggio può partecipare a più campionati insieme, oppure a nessuno. In ogni campionato si sceglie l'**auto** tra le vetture ammesse in quel campionato; la **X** toglie il campionato. Il colore si sceglie da un cerchio che apre la tabella dei colori, con il codice esadecimale e i valori HSV. Facoltativi:
  - il **Canale Discord**, dove il bot scrive i risultati dei ticket di disconnessione;
  - il **Ruolo Discord**: chi ha quel ruolo appartiene all'equipaggio per ticket e proteste del sito, anche se il ruolo cambia nome. Senza ruolo collegato, l'equipaggio si riconosce dal nome del ruolo, es. "#16 Vez Team Lime".

  Numero, nome e ruolo devono essere unici.
- **Gestisci equipaggio**: tabella degli equipaggi con ricerca per numero o nome, filtri per auto e per campionato (anche "Nessuno"), e un avviso sugli equipaggi con dati mancanti (un campionato senza auto, il colore). Un equipaggio che compare in una gara, in una penalità o in un cambio pilota non si può eliminare.

### Strumenti pre-gara

- **Crea briefing pre-gara** e **Crea pattern meteo**: in costruzione.

### Strumenti della Direzione Gara

Ognuno riproduce un foglio Excel della Direzione Gara, con gli stessi calcoli:

- **Calcolatore di giri**: stato dello stint e giri da impostare nella lobby successiva.
- **Calcolatore deficit BoP**: penalità in secondi per un'auto fuori dai valori di peso e potenza del BoP.
- **Gestisci disconnessioni**: il tempo di attesa da comunicare a un team dopo una disconnessione, per P1 e per P2–P14; la lunghezza della pista arriva dal tracciato scelto.
  - L'interruttore **Ticket dal sito** apre o chiude l'invio dei ticket di disconnessione dal sito.
  - Il riquadro **Ticket da gestire** elenca i ticket arrivati. Il clic su un ticket compila il calcolatore e **Invia risultato** manda al pilota il tempo di attesa con il dettaglio del calcolo: il pilota lo vede sul sito e il bot lo scrive nel canale Discord dell'equipaggio.

I valori dei calcolatori restano salvati sul computer: chiudere e riaprire l'app durante la gara non perde nulla.

### Strumenti dei Commissari Sportivi

- **Gestisci proteste**: le proteste mandate dal sito, con gara, equipaggi coinvolti, stint, giro, curva, descrizione e video (caricato o da YouTube). Nel dettaglio, l'**Esito** è definitivo:
  - **Respingi protesta** acceso: la protesta è respinta, con la motivazione obbligatoria;
  - spento: la protesta è accolta e si decide la **penalità** per le vetture coinvolte: decisione per ogni vettura (reprimenda, secondi, posizioni in griglia, squalifica), articolo violato, documento e motivazione.

  La penalità va nel referto della gara, con la traduzione inglese automatica della motivazione. Alla terza reprimenda nel campionato scatta in automatico +1 posizione in griglia nella gara successiva. Sul sito l'equipaggio vede solo se la protesta è accolta o respinta.
- **Gestisci cambi pilota**: per ogni gara una tabella per ogni cambio pilota (il numero dipende dagli stint della durata della gara), con Pit In e Pit Out di ogni vettura. La penalità si calcola da sola come nel foglio "Driver Swap Checker": una vettura che riparte con meno distacco di quanto ne aveva al Pit In, oltre un margine di 2 secondi, prende 2,5 × la differenza. Una penalità si può annullare lasciandola visibile. La **X** a lato di ogni riga ne svuota il contenuto (tempi, annullata e note).
  - I tempi si scrivono come si preferisce e, uscendo dalla casella, diventano sempre `HH:MM:SS.DDD`: valgono anche `HH.MM.SS.DDD`, `HH.MM.SS,DDD`, `HH:MM:SS,DDD`, `HHMMSS,DDD` e `HHMMSS.DDD` (lo stesso vale per il distacco dei ticket di disconnessione sul sito).

### Campanella, lingue e tema

- La **campanella** in alto mostra le notifiche non lette: ticket di disconnessione per il Direttore Gara, proteste in esame per i Commissari Sportivi. Il clic su una notifica la segna come letta e la apre. Il numero compare anche nel titolo della finestra e sull'icona dell'app nella barra delle applicazioni.
- Lingue: **italiano, inglese, francese e tedesco**. Di default la lingua del sistema; dalla tendina dell'icona utente si sceglie una lingua fissa.
- **Modalità notte**: dalla stessa tendina; di default segue il sistema.

## Il sito dei risultati

Si apre nel browser, nella lingua del browser (italiano, inglese, francese o tedesco) e con il tema del sistema.

- **Sessioni di gara**: l'elenco delle gare iniziate, con gli stessi filtri dell'app (filtri e ordinamento restano nell'indirizzo, che si può condividere). La pagina di una gara mostra data, tracciato, durata, giri totali e la classifica con vettura, giri, distacco e penalità. **Visualizza referto** mostra accanto il referto in PDF, **Scarica referto** lo salva: in italiano con il sito in italiano, in inglese con le altre lingue. Nel referto la classifica ha nella colonna Leader la durata della gara per il primo e il distacco per gli altri; le penalità comprendono, in fondo, quelle dei **cambi pilota**: una riga per vettura con l'infrazione totale (es. "Infrazione: 1.515 secondi") e i secondi arrotondati per eccesso (+2 secondi), gli stessi sommati nella colonna Penalità della classifica.
- **Accesso con Discord**: basta far parte del server Discord della lega. L'equipaggio si riconosce dal ruolo Discord.
- **Invia ticket di disconnessione** (quando la Direzione Gara ha aperto l'invio): posizione, distacco e giro della disconnessione. Il risultato arriva sulla pagina del ticket, che si aggiorna da sola. Al massimo 3 ticket in attesa a persona.
- **Invia protesta**: la gara, tra quelle dei campionati del proprio equipaggio aperte alle proteste; stint, giro, curva, gli altri equipaggi coinvolti, una descrizione e, se si vuole, un video (MP4, WebM o MOV, fino a 100 MB) o un link YouTube. Il video si può aggiungere anche dopo, entro 24 ore dall'invio. I video caricati si cancellano dopo 30 giorni. Al massimo 10 proteste in 24 ore a persona.
- La **campanella del sito** avvisa quando un ticket ha il risultato o una protesta è stata decisa.

## Importare equipaggi e piste da un file CSV

Dalla cartella `server`, i file esportati da Excel ("Salva come → CSV") sostituiscono l'elenco online. Con `--dry-run` il comando mostra cosa cambierebbe senza scrivere nulla. Se anche una sola riga ha un problema non cambia niente, e ogni riga da correggere viene elencata con il motivo.

```bash
npm run crews:import -- data/crews.csv --dry-run
```
```bash
npm run tracks:import -- data/tracks.csv --dry-run
```

- **Equipaggi**: nome e numero obbligatori; auto, campionato (uno di quelli creati nell'app, oppure "Nessuno") e colore facoltativi. Ogni riga aggiorna l'equipaggio con lo stesso numero, così le gare restano collegate. Il campionato della riga si aggiunge a quelli già salvati; "Nessuno" li toglie tutti.
- **Vetture**: non si importano più da CSV: si aggiornano dall'app, in Gestisci vetture.
- **Piste**: una riga per configurazione, con continente, lunghezza e versione al contrario.

Le righe non più nel file vengono eliminate, tranne quelle ancora usate da un equipaggio o da una gara.

## Svuotare il database

Dalla cartella `server`, questo comando cancella **tutti i dati** online (equipaggi, gare, campionati, auto, piste, ticket, proteste, impostazioni) e lascia le tabelle vuote. Non si può annullare; i video delle proteste restano nel loro archivio finché non scadono.

```bash
npx wrangler d1 execute race-control --remote --file scripts/clear-all-data.sql
```

Dopo, vanno ricreati vetture (Gestisci vetture → Aggiorna dati), piste (importazione da CSV) e campionati (dall'app).

## Installazione e pubblicazione

Servono Node ≥ 22.22 e, per l'app desktop, Rust (https://rustup.rs) con gli strumenti di compilazione del sistema.

App desktop, dalla cartella principale (l'indirizzo del server va in `.env.production`, alla voce `VITE_CREW_API_URL`):

```bash
npm install
```
```bash
npm run desktop:dev
```
```bash
npm run desktop:build
```

Server e sito, dalla cartella `server`. Prima le migrazioni del database, poi la pubblicazione:

```bash
npm run db:migrate:remote
```
```bash
npm run deploy
```

Controlli prima di pubblicare, dalla cartella principale e poi dalla cartella `server`:

```bash
npm run typecheck && npm run lint && npx vitest run
```
```bash
npm run typecheck && npx vitest run
```

Gli installer di tutti e tre i sistemi si ottengono pubblicando un tag (`git tag v1.0.0 && git push --tags`): GitHub crea una release in bozza.
