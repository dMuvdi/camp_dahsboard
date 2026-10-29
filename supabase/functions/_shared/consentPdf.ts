import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { camp } from "./camp.ts";
import { consentTitle, type Clause, type Paragraph } from "./consentText.ts";

// Signed consent PDF: brand header, the shared legal text (lib/consentText), clauses, signatures and a footer.
// pdf-lib has no layout engine, so this file wraps runs of regular/bold text into lines itself.

export interface PdfSignature {
    image: Uint8Array; // PNG from the signature pad
    name: string;
    idLabel: string; // e.g. "C.C. 123"
    caption: string; // e.g. "Firma del participante"
}

export interface ConsentPdfInput {
    paragraphs: Paragraph[];
    clauses?: Clause[];
    signatures: PdfSignature[];
    signedAt: Date;
    documentId: string;
    logos: { camp: Uint8Array; vida: Uint8Array }; // white PNGs for the oxblood header
}

const PAGE: [number, number] = [612, 792]; // US Letter, the usual "carta" size in Colombia
const MARGIN = 60;
const WIDTH = PAGE[0] - MARGIN * 2;
const SIZE = 10.5;
const LEADING = 15.5;
const oxblood = rgb(0x4f / 255, 0x01 / 255, 0);
const ink = rgb(0x14 / 255, 0x28 / 255, 0x40 / 255);
const muted = rgb(0.42, 0.45, 0.5);

// Standard PDF fonts only encode WinAnsi; swap the few characters the text could carry that it lacks
const winAnsi = (s: string) => s.replace(/→/g, "->").replace(/[✓✔]/g, "v").replace(/[^\x00-\xff–—‘’“”•…€]/g, "?");

export const signedAtLabel = (d: Date) =>
    new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(d);

type Token = { text: string; font: PDFFont };

// Advance width without kerning: widthOfTextAtSize applies kerning pairs but drawText doesn't, so measuring a
// whole word would place the next word too close after "." and ","
const advance = (text: string, font: PDFFont, size: number) => [...text].reduce((w, ch) => w + font.widthOfTextAtSize(ch, size), 0);

export async function buildConsentPdf(input: ConsentPdfInput): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(consentTitle);
    doc.setAuthor("Ministerio Juvenil VIDA");
    doc.setSubject(`${camp.name} ${camp.year}`);
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const [campLogo, vidaLogo] = await Promise.all([doc.embedPng(input.logos.camp), doc.embedPng(input.logos.vida)]);

    let page: PDFPage = doc.addPage(PAGE);
    let y = 0;

    const header = () => {
        page.drawRectangle({ x: 0, y: PAGE[1] - 88, width: PAGE[0], height: 88, color: oxblood });
        const fit = (img: PDFImage, h: number) => img.scale(h / img.height);
        const c = fit(campLogo, 40);
        page.drawImage(campLogo, { x: MARGIN, y: PAGE[1] - 64, width: c.width, height: c.height });
        const v = fit(vidaLogo, 34);
        page.drawImage(vidaLogo, { x: PAGE[0] - MARGIN - v.width, y: PAGE[1] - 61, width: v.width, height: v.height });
        y = PAGE[1] - 88 - 34;
    };
    const newPage = () => {
        page = doc.addPage(PAGE);
        page.drawRectangle({ x: 0, y: PAGE[1] - 6, width: PAGE[0], height: 6, color: oxblood });
        y = PAGE[1] - MARGIN;
    };
    const ensure = (h: number) => {
        if (y - h < MARGIN + 20) newPage();
    };

    // Splits runs into words (keeping the trailing space) so lines can break between them
    const tokens = (runs: Paragraph): Token[] =>
        runs.flatMap((run) => {
            const filled = typeof run !== "string";
            const text = winAnsi(filled ? run.value || "____________________" : run);
            const font = filled ? bold : regular;
            return (text.match(/\S+\s*|\s+/g) ?? []).map((w) => ({ text: w, font }));
        });

    const drawRuns = (runs: Paragraph, x: number, width: number) => {
        let line: Token[] = [];
        let lineWidth = 0;
        const flush = () => {
            ensure(LEADING);
            let cx = x;
            for (const t of line) {
                page.drawText(t.text, { x: cx, y, size: SIZE, font: t.font, color: ink });
                cx += advance(t.text, t.font, SIZE);
            }
            y -= LEADING;
            line = [];
            lineWidth = 0;
        };
        for (const t of tokens(runs)) {
            const w = advance(t.text.trimEnd(), t.font, SIZE);
            if (line.length && lineWidth + w > width) flush();
            line.push(t);
            lineWidth += advance(t.text, t.font, SIZE);
        }
        if (line.length) flush();
    };

    header();

    // Title, centered and wrapped
    const titleWords = winAnsi(consentTitle).split(" ");
    let titleLine = "";
    const titleLines: string[] = [];
    for (const word of titleWords) {
        const next = titleLine ? `${titleLine} ${word}` : word;
        if (advance(next, bold, 13) > WIDTH && titleLine) {
            titleLines.push(titleLine);
            titleLine = word;
        } else titleLine = next;
    }
    titleLines.push(titleLine);
    for (const l of titleLines) {
        page.drawText(l, { x: (PAGE[0] - advance(l, bold, 13)) / 2, y, size: 13, font: bold, color: oxblood });
        y -= 18;
    }
    y -= 14;

    for (const p of input.paragraphs) {
        drawRuns(p, MARGIN, WIDTH);
        y -= 7;
    }

    for (const clause of input.clauses ?? []) {
        ensure(LEADING * 2);
        const box = 9;
        page.drawRectangle({ x: MARGIN, y: y - 1, width: box, height: box, borderColor: ink, borderWidth: 0.8, color: clause.checked ? oxblood : undefined });
        if (clause.checked) {
            page.drawLine({ start: { x: MARGIN + 2, y: y + 3.5 }, end: { x: MARGIN + 4, y: y + 1 }, thickness: 1.4, color: rgb(1, 1, 1) });
            page.drawLine({ start: { x: MARGIN + 4, y: y + 1 }, end: { x: MARGIN + 7.5, y: y + 6.5 }, thickness: 1.4, color: rgb(1, 1, 1) });
        }
        drawRuns(clause.text, MARGIN + 18, WIDTH - 18);
        y -= 7;
    }

    // Signatures side by side, two per row
    y -= 10;
    const colWidth = (WIDTH - 30) / 2;
    for (let i = 0; i < input.signatures.length; i += 2) {
        ensure(130);
        const top = y;
        for (const [j, sig] of input.signatures.slice(i, i + 2).entries()) {
            const x = MARGIN + j * (colWidth + 30);
            const img = await doc.embedPng(sig.image);
            const s = img.scaleToFit(colWidth, 70);
            page.drawImage(img, { x, y: top - 72, width: s.width, height: s.height });
            page.drawLine({ start: { x, y: top - 78 }, end: { x: x + colWidth, y: top - 78 }, thickness: 0.8, color: ink });
            page.drawText(winAnsi(sig.name), { x, y: top - 92, size: 10, font: bold, color: ink });
            page.drawText(winAnsi(sig.idLabel), { x, y: top - 105, size: 9.5, font: regular, color: ink });
            page.drawText(winAnsi(sig.caption), { x, y: top - 118, size: 9, font: regular, color: muted });
        }
        y = top - 136;
    }

    ensure(LEADING);
    page.drawText(winAnsi(`Firmado electrónicamente el ${signedAtLabel(input.signedAt)} (hora de Colombia).`), { x: MARGIN, y, size: 9, font: regular, color: muted });

    // Footer on every page once the page count is known
    const pages = doc.getPages();
    pages.forEach((p, i) => {
        const text = winAnsi(`${camp.name} ${camp.year}. Documento ${input.documentId}. Página ${i + 1} de ${pages.length}`);
        p.drawText(text, { x: MARGIN, y: 30, size: 8, font: regular, color: muted });
    });

    return doc.save();
}
