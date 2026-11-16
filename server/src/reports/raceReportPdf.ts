import { type PDFFont, type PDFPage, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { RaceReport } from './raceReportData';
import { type ReportTexts, reportTexts } from './reportTexts';

/**
 * Disegna il referto di gara in PDF con le misure del modello (A4, margini, colonne, grigio delle intestazioni,
 * intestazione e piè di pagina). Helvetica ha le stesse metriche del Liberation Sans del modello, quindi
 * testi e a capo cadono negli stessi punti. Le tabelle continuano sulle pagine successive ripetendo l'intestazione.
 * Coordinate: le costanti sono misurate dall'alto della pagina, come nel modello; pdf-lib conta dal basso.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 56.7;
const RIGHT = 538.6;
const CENTER = (LEFT + RIGHT) / 2;
/** Primo elemento sotto l'intestazione e limite sopra il piè di pagina. */
const CONTENT_TOP = 57;
const CONTENT_BOTTOM = 785;
/** Ascendente del carattere: dalla cima della riga alla linea di base. */
const ASCENT = 0.905;
const BLACK = rgb(0, 0, 0);
const HEADER_GREY = rgb(0.851, 0.851, 0.851);
const RULE = 0.5;
const CELL_PADDING = 4.1;

const TEXT_SIZE = 9;
const SECTION_TITLE_SIZE = 10.5;
const INTRO_SIZE = 9.5;
const HEADER_ROW_HEIGHT = 14.8;
const RESULT_ROW_HEIGHT = 15.1;
const LINE_HEIGHT = 10.35;
/** Spazio fra il bordo superiore della cella e la cima della prima riga di testo. */
const CELL_TEXT_OFFSET = 3.7;
const PENALTY_ROW_EXTRA = 4.5;
const SECTION_GAP = 24.6;

type Align = 'left' | 'center';

interface TableColumn {
  readonly title: string;
  readonly align: Align;
  readonly isBold?: boolean;
}

interface TextRun {
  readonly text: string;
  readonly isBold: boolean;
}

/** Solo i caratteri che Helvetica sa scrivere (WinAnsi); gli altri diventano "?". */
function makeEncoder(font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  return (text: string) =>
    [...text.normalize('NFC')]
      .map((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return supported.has(codePoint) || character === ' ' ? character : '?';
      })
      .join('');
}

class ReportWriter {
  private page!: PDFPage;
  private pageCount = 0;
  /** Prossima posizione libera, dall'alto della pagina. */
  top = CONTENT_TOP;

  constructor(
    private readonly document: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
    private readonly title: string,
    readonly encode: (text: string) => string,
    readonly texts: ReportTexts,
  ) {}

  font(isBold: boolean) {
    return isBold ? this.bold : this.regular;
  }

  /**
   * Larghezza come viene disegnata: somma dei singoli caratteri. widthOfTextAtSize di pdf-lib toglie la crenatura
   * (es. "Te"), che drawText non applica: misurando così il testo dopo un tratto in grassetto finiva sopra lo spazio.
   */
  width(text: string, size: number, isBold = false) {
    const font = this.font(isBold);
    let total = 0;
    for (const character of this.encode(text)) total += font.widthOfTextAtSize(character, size);
    return total;
  }

  text(text: string, x: number, top: number, size: number, isBold = false) {
    if (text === '') return;
    this.page.drawText(this.encode(text), { x, y: PAGE_HEIGHT - top - ASCENT * size, size, font: this.font(isBold), color: BLACK });
  }

  centeredText(text: string, centerX: number, top: number, size: number, isBold = false) {
    this.text(text, centerX - this.width(text, size, isBold) / 2, top, size, isBold);
  }

  line(x1: number, top1: number, x2: number, top2: number, thickness = RULE) {
    this.page.drawLine({ start: { x: x1, y: PAGE_HEIGHT - top1 }, end: { x: x2, y: PAGE_HEIGHT - top2 }, thickness, color: BLACK });
  }

  fill(x: number, top: number, width: number, height: number) {
    this.page.drawRectangle({ x, y: PAGE_HEIGHT - top - height, width, height, color: HEADER_GREY });
  }

  /** Copertina: titolo del documento e nome della gara fra due filetti. */
  coverPage() {
    this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pageCount += 1;
    this.centeredText(this.texts.documentName.toUpperCase(), CENTER, 190.2, 18, true);
    this.line(LEFT, 238.7, RIGHT - 0.1, 238.7, 1);
    const titleLines = wrapRuns(this, [{ text: this.title.toUpperCase(), isBold: true }], RIGHT - LEFT, 14);
    titleLines.forEach((lineRuns, index) => {
      this.centeredText(lineRuns.map((run) => run.text).join(''), CENTER, 267.2 + index * 17, 14, true);
    });
    const lowerRule = 307.6 + Math.max(0, titleLines.length - 1) * 17;
    this.line(LEFT, lowerRule, RIGHT - 0.1, lowerRule, 1);
  }

  /** Pagina di contenuto con intestazione e piè di pagina numerato. */
  newPage() {
    this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pageCount += 1;
    this.centeredText(`${this.texts.documentName} – ${this.title}`, CENTER, 29.5, 8);
    this.line(LEFT, 37.8, RIGHT - 0.1, 37.8);
    this.line(LEFT, 802.5, RIGHT - 0.1, 802.5);
    this.text(`${this.texts.documentName.toUpperCase()} – ${this.title.toUpperCase()}`, LEFT + 0.1, 804.1, 8);
    this.centeredText(String(this.pageCount), CENTER + 0.8, 804.1, 8);
    this.top = CONTENT_TOP;
  }

  /** Va a pagina nuova se l'altezza richiesta non entra più in questa. */
  ensureSpace(height: number) {
    if (this.top + height > CONTENT_BOTTOM) this.newPage();
  }
}

/** Testo (anche con parti in grassetto e a capo) diviso in righe che stanno nella larghezza data. */
function wrapRuns(writer: ReportWriter, runs: readonly TextRun[], maxWidth: number, size: number): TextRun[][] {
  const lines: TextRun[][] = [];
  let currentLine: TextRun[] = [];
  let currentWidth = 0;

  const pushLine = () => {
    // Niente spazi in coda alla riga.
    const lastRun = currentLine.at(-1);
    if (lastRun) currentLine[currentLine.length - 1] = { ...lastRun, text: lastRun.text.trimEnd() };
    lines.push(currentLine);
    currentLine = [];
    currentWidth = 0;
  };
  const appendToken = (token: string, isBold: boolean) => {
    const lastRun = currentLine.at(-1);
    if (lastRun && lastRun.isBold === isBold) currentLine[currentLine.length - 1] = { text: lastRun.text + token, isBold };
    else currentLine.push({ text: token, isBold });
    currentWidth += writer.width(token, size, isBold);
  };

  for (const run of runs) {
    const paragraphs = run.text.split('\n');
    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (paragraphIndex > 0) pushLine();
      for (const token of paragraph.match(/\S+\s*|\s+/g) ?? []) {
        const tokenWidth = writer.width(token.trimEnd(), size, run.isBold);
        if (currentWidth > 0 && currentWidth + tokenWidth > maxWidth) pushLine();
        if (currentWidth === 0 && token.trim() === '') continue;
        // Parola più lunga della colonna: si spezza carattere per carattere.
        if (tokenWidth > maxWidth) {
          for (const character of token) {
            if (currentWidth + writer.width(character, size, run.isBold) > maxWidth) pushLine();
            appendToken(character, run.isBold);
          }
          continue;
        }
        appendToken(token, run.isBold);
      }
    });
  }
  if (currentLine.length > 0 || lines.length === 0) pushLine();
  return lines;
}

/** Riduce un testo con "…" finché non sta nella larghezza (righe a altezza fissa della classifica). */
function fitText(writer: ReportWriter, text: string, maxWidth: number, size: number, isBold: boolean): string {
  if (writer.width(text, size, isBold) <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && writer.width(`${shortened}…`, size, isBold) > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened.trimEnd()}…`;
}

function drawSectionTitle(writer: ReportWriter, title: string, intro?: string) {
  writer.ensureSpace(60);
  writer.text(title, LEFT + 0.1, writer.top + 1.2, SECTION_TITLE_SIZE, true);
  writer.top += 15.8;
  if (intro) {
    writer.text(intro, LEFT + 0.1, writer.top + 1.2, INTRO_SIZE);
    writer.top += 14;
  }
}

function drawHeaderRow(writer: ReportWriter, columnEdges: readonly number[], columns: readonly TableColumn[]) {
  const rowTop = writer.top;
  columns.forEach((column, index) => {
    const left = columnEdges[index] ?? LEFT;
    const right = columnEdges[index + 1] ?? RIGHT;
    writer.fill(left, rowTop, right - left, HEADER_ROW_HEIGHT);
    writer.centeredText(column.title, (left + right) / 2, rowTop + CELL_TEXT_OFFSET + 0.1, TEXT_SIZE, true);
  });
  writer.line(LEFT - 0.2, rowTop, RIGHT + 0.3, rowTop);
  writer.top += HEADER_ROW_HEIGHT;
}

/** Bordi orizzontali e verticali di un tratto di tabella su una pagina. */
function drawGrid(writer: ReportWriter, columnEdges: readonly number[], rowTops: readonly number[], bottom: number) {
  for (const rowTop of rowTops) writer.line(LEFT + 0.3, rowTop, RIGHT - 0.2, rowTop);
  writer.line(LEFT - 0.2, bottom, RIGHT + 0.3, bottom);
  const top = rowTops[0] ?? bottom;
  for (const edge of columnEdges) writer.line(edge, top - HEADER_ROW_HEIGHT, edge, bottom);
}

const CLASSIFICATION_EDGES = [56.7, 86.7, 116.7, 268.6, 343.6, 378.6, 458.6, 538.6];
const CLASSIFICATION_LAYOUT: readonly Omit<TableColumn, 'title'>[] = [
  { align: 'center' },
  { align: 'center', isBold: true },
  { align: 'left' },
  { align: 'center' },
  { align: 'center' },
  { align: 'center' },
  { align: 'center' },
];

function drawClassification(writer: ReportWriter, report: RaceReport) {
  const { texts } = writer;
  const CLASSIFICATION_COLUMNS: readonly TableColumn[] = CLASSIFICATION_LAYOUT.map((layout, index) => ({
    ...layout,
    title: texts.classificationColumns[index] ?? '',
  }));
  drawSectionTitle(writer, texts.classificationTitle);
  if (report.classification.length === 0) {
    writer.text(texts.noClassification, LEFT + 0.1, writer.top, INTRO_SIZE);
    writer.top += 14;
    return;
  }

  let rowTops: number[] = [];
  const startTable = () => {
    drawHeaderRow(writer, CLASSIFICATION_EDGES, CLASSIFICATION_COLUMNS);
    rowTops = [];
  };
  startTable();
  for (const line of report.classification) {
    if (writer.top + RESULT_ROW_HEIGHT > CONTENT_BOTTOM) {
      drawGrid(writer, CLASSIFICATION_EDGES, rowTops, writer.top);
      writer.newPage();
      startTable();
    }
    const rowTop = writer.top;
    rowTops.push(rowTop);
    const cells = [line.position, line.number, line.crew, line.car, line.laps, line.leader, line.penalty];
    cells.forEach((cell, index) => {
      const column = CLASSIFICATION_COLUMNS[index];
      const left = CLASSIFICATION_EDGES[index] ?? LEFT;
      const right = CLASSIFICATION_EDGES[index + 1] ?? RIGHT;
      const isBold = column?.isBold === true;
      const text = fitText(writer, cell, right - left - 2 * CELL_PADDING, TEXT_SIZE, isBold);
      const textTop = rowTop + CELL_TEXT_OFFSET - 0.2;
      if (column?.align === 'left') writer.text(text, left + CELL_PADDING, textTop, TEXT_SIZE, isBold);
      else writer.centeredText(text, (left + right) / 2, textTop, TEXT_SIZE, isBold);
    });
    writer.top += RESULT_ROW_HEIGHT;
  }
  drawGrid(writer, CLASSIFICATION_EDGES, rowTops, writer.top);
  writer.top += SECTION_GAP;
}

const PENALTY_EDGES = [56.7, 131.7, 251.7, 538.6];

function drawPenalties(writer: ReportWriter, report: RaceReport) {
  const { texts } = writer;
  const PENALTY_COLUMNS: readonly TableColumn[] = texts.penaltyColumns.map((title) => ({ title, align: 'left' }));
  drawSectionTitle(writer, texts.penaltiesTitle, texts.penaltiesIntro);
  if (report.penalties.length === 0) {
    writer.text(texts.noPenalties, LEFT + 0.1, writer.top, TEXT_SIZE);
    writer.top += 14;
    return;
  }

  const columnWidth = (index: number) => (PENALTY_EDGES[index + 1] ?? RIGHT) - (PENALTY_EDGES[index] ?? LEFT) - 2 * CELL_PADDING;
  let rowTops: number[] = [];
  const startTable = () => {
    drawHeaderRow(writer, PENALTY_EDGES, PENALTY_COLUMNS);
    rowTops = [];
  };
  writer.ensureSpace(HEADER_ROW_HEIGHT + 2 * LINE_HEIGHT + PENALTY_ROW_EXTRA);
  startTable();

  for (const penalty of report.penalties) {
    const reasonRuns: TextRun[] = penalty.violation
      ? [{ text: penalty.violation, isBold: true }, ...(penalty.reason ? [{ text: ` - ${penalty.reason}`, isBold: false }] : [])]
      : [{ text: penalty.reason, isBold: false }];
    const cellLines = [
      wrapRuns(writer, [{ text: penalty.crews, isBold: false }], columnWidth(0), TEXT_SIZE),
      wrapRuns(writer, [{ text: penalty.decision, isBold: false }], columnWidth(1), TEXT_SIZE),
      wrapRuns(writer, reasonRuns, columnWidth(2), TEXT_SIZE),
    ];
    // Una riga molto lunga può continuare sulla pagina dopo: si scrivono le righe di testo a gruppi.
    let firstLine = 0;
    const totalLines = Math.max(...cellLines.map((lines) => lines.length));
    while (firstLine < totalLines) {
      const fittingLines = Math.floor((CONTENT_BOTTOM - writer.top - PENALTY_ROW_EXTRA) / LINE_HEIGHT);
      const remainingLines = totalLines - firstLine;
      // Se la riga intera non entra ma entrerebbe in una pagina nuova, si va a capo pagina prima di iniziarla.
      const fitsOnFreshPage = remainingLines * LINE_HEIGHT + PENALTY_ROW_EXTRA <= CONTENT_BOTTOM - CONTENT_TOP - HEADER_ROW_HEIGHT;
      if (fittingLines < remainingLines && (fittingLines < 2 || (firstLine === 0 && fitsOnFreshPage))) {
        drawGrid(writer, PENALTY_EDGES, rowTops, writer.top);
        writer.newPage();
        startTable();
        continue;
      }
      const linesHere = Math.min(remainingLines, fittingLines);
      const rowTop = writer.top;
      rowTops.push(rowTop);
      cellLines.forEach((lines, columnIndex) => {
        lines.slice(firstLine, firstLine + linesHere).forEach((lineRuns, lineIndex) => {
          let x = (PENALTY_EDGES[columnIndex] ?? LEFT) + CELL_PADDING;
          for (const run of lineRuns) {
            writer.text(run.text, x, rowTop + CELL_TEXT_OFFSET + lineIndex * LINE_HEIGHT, TEXT_SIZE, run.isBold);
            x += writer.width(run.text, TEXT_SIZE, run.isBold);
          }
        });
      });
      writer.top += linesHere * LINE_HEIGHT + PENALTY_ROW_EXTRA;
      firstLine += linesHere;
    }
  }
  drawGrid(writer, PENALTY_EDGES, rowTops, writer.top);
}

/** Referto completo: copertina, classifica finale e penalità. */
export async function renderRaceReportPdf(report: RaceReport): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const encode = makeEncoder(regular);

  const texts = reportTexts(report.language);
  document.setTitle(encode(`${texts.documentName} – ${report.title}`));
  document.setAuthor('Race Control');
  document.setCreator('Race Control Dashboard');
  document.setLanguage(texts.pdfLanguage);

  const writer = new ReportWriter(document, regular, bold, report.title, encode, texts);
  writer.coverPage();
  writer.newPage();
  drawClassification(writer, report);
  drawPenalties(writer, report);
  return document.save();
}
