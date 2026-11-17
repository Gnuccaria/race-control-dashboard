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

La home accoglie con un saluto e mostra le card degli strumenti, divise per sezione. Il **menu laterale**, in tutte le pagine, porta alla home, a ogni sezione e ai suoi strumenti; la voce della pagina aperta è evidenziata. Nelle finestre strette il menu si apre con il pulsante **Menu**.

In tutte le tabelle valgono le stesse regole:

- un clic sulla testata di una colonna ordina A→Z, un secondo clic Z→A;
- il **clic destro** su una riga la seleziona o la deseleziona; con almeno una riga selezionata compare **Elimina**, che chiede conferma;
- la freccia a destra della riga apre il **dettaglio**, in sola lettura: **Modifica** rende i campi modificabili, **Salva** li controlla e li salva. **Annulla**, o uscire dalla pagina durante la modifica, chiede conferma prima di perdere le modifiche.

### Gestione campionati

- **Crea campionato**: il **nome** (unico) e le **durate di gara**, da una a tre, in ore intere. Per ogni durata si indica anche la **durata dello stint** in minuti, da cui vengono gli stint e i cambi pilota attesi: una gara di 6 ore con stint da 60 minuti ha 6 stint e 5 cambi pilota. Poi le **vetture ammesse**, scelte dal catalogo delle auto: una alla volta con il menu e **Aggiungi vettura**, oppure scritte una per riga e aggiunte insieme con **Aggiungi le vetture scritte** (le righe che non corrispondono a un'auto del catalogo restano nel campo, da correggere). La **X** toglie una durata o una vettura.
- **Gestisci campionato**: tabella dei campionati con durate, stint e numero di vetture ammesse. Nel dettaglio si modificano tutti i dati:
  - un nuovo nome passa anche alle gare e agli equipaggi del campionato;
  - una durata già usata da qualche gara non si può togliere né cambiarne lo stint;
  - se si toglie una vettura, gli equipaggi che la usavano restano nel campionato senza auto, da completare.

  Con il clic destro si eliminano i campionati selezionati. Gli equipaggi collegati perdono quel campionato e chi non ne ha altri resta con "Nessuno". Un campionato con gare salvate non si può eliminare: prima vanno eliminate le sue gare.
- **Gestisci gare**: tabella delle gare (campionato, round, nome, tracciato, data, ultima modifica), con filtri per campionato, tracciato e intervallo di date. **Crea gara** apre un form a due schede:
  - **Anagrafica**: nome della gara (facoltativo); **campionato**, da tutti quelli creati; **durata**, solo tra quelle del campionato, scelta da sola se è una sola; **round** (1–99); **data e ora di inizio** e **data e ora di fine**, in ora italiana, obbligatorie, anche nel futuro: le gare si possono inserire in anticipo. Facoltativi il **tracciato** (si sceglie Continente → Tracciato → Configurazione, anche in versione al contrario se prevista) e i **giri totali**.
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
- **Gestisci cambi pilota**: per ogni gara una tabella per ogni cambio pilota (il numero dipende dagli stint della durata della gara), con Pit In e Pit Out di ogni vettura. La penalità si calcola da sola come nel foglio "Driver Swap Checker": una vettura che riparte con meno distacco di quanto ne aveva al Pit In, oltre un margine di 2 secondi, prende 2,5 × la differenza. Una penalità si può annullare lasciandola visibile.

### Campanella, lingue e tema

- La **campanella** in alto mostra le notifiche non lette: ticket di disconnessione per il Direttore Gara, proteste in esame per i Commissari Sportivi. Il clic su una notifica la segna come letta e la apre. Il numero compare anche nel titolo della finestra e sull'icona dell'app nella barra delle applicazioni.
- Lingue: **italiano, inglese, francese e tedesco**. Di default la lingua del sistema; dalla tendina dell'icona utente si sceglie una lingua fissa.
- **Modalità notte**: dalla stessa tendina; di default segue il sistema.

## Il sito dei risultati

Si apre nel browser, nella lingua del browser (italiano, inglese, francese o tedesco) e con il tema del sistema.

- **Sessioni di gara**: l'elenco delle gare iniziate, con gli stessi filtri dell'app (filtri e ordinamento restano nell'indirizzo, che si può condividere). La pagina di una gara mostra data, tracciato, durata, giri totali e la classifica con vettura, giri, distacco e penalità. **Visualizza referto** mostra accanto il referto in PDF, **Scarica referto** lo salva: in italiano con il sito in italiano, in inglese con le altre lingue.
- **Accesso con Discord**: basta far parte del server Discord della lega. L'equipaggio si riconosce dal ruolo Discord.
- **Invia ticket di disconnessione** (quando la Direzione Gara ha aperto l'invio): posizione, distacco e giro della disconnessione. Il risultato arriva sulla pagina del ticket, che si aggiorna da sola. Al massimo 3 ticket in attesa a persona.
- **Invia protesta**: la gara, tra quelle dei campionati del proprio equipaggio aperte alle proteste; stint, giro, curva, gli altri equipaggi coinvolti, una descrizione e, se si vuole, un video (MP4, WebM o MOV, fino a 100 MB) o un link YouTube. Il video si può aggiungere anche dopo, entro 24 ore dall'invio. I video caricati si cancellano dopo 30 giorni. Al massimo 10 proteste in 24 ore a persona.
- La **campanella del sito** avvisa quando un ticket ha il risultato o una protesta è stata decisa.

## Importare equipaggi, auto e piste da un file CSV

Dalla cartella `server`, i file esportati da Excel ("Salva come → CSV") sostituiscono l'elenco online. Con `--dry-run` il comando mostra cosa cambierebbe senza scrivere nulla. Se anche una sola riga ha un problema non cambia niente, e ogni riga da correggere viene elencata con il motivo.

```bash
npm run crews:import -- data/crews.csv --dry-run
```
```bash
npm run cars:import -- data/cars.csv --dry-run
```
```bash
npm run tracks:import -- data/tracks.csv --dry-run
```

- **Equipaggi**: nome e numero obbligatori; auto, campionato (uno di quelli creati nell'app, oppure "Nessuno") e colore facoltativi. Ogni riga aggiorna l'equipaggio con lo stesso numero, così le gare restano collegate. Il campionato della riga si aggiunge a quelli già salvati; "Nessuno" li toglie tutti.
- **Auto**: costruttore, modello, PS, kg, limitatore e zavorra. In quali campionati un'auto è ammessa si decide nell'app, in Gestione campionati. Le auto nuove non sono ammesse in nessun campionato finché non le si aggiunge.
- **Piste**: una riga per configurazione, con continente, lunghezza e versione al contrario.

Le righe non più nel file vengono eliminate, tranne quelle ancora usate da un equipaggio o da una gara.

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
