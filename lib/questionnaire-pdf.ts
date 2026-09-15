import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { SECTIONS, isShown, answerText, fieldLabel, type Answers } from "./questionnaire-form";
import { fmtDate } from "./when";

/**
 * The questionnaire as a document — what the agent gets attached to the email
 * and what you drag onto the listing in Box & Dice.
 *
 * WHY A PDF EXISTS AT ALL: the Website API takes no uploads. Its only writes
 * are contacts, categories, contact notes, enquiries, search criteria and
 * appraisal leads, and the sales-listing PATCH accepts exactly `url` and
 * `internet_hits` — `public_files` and `soi_file` are read-only, served out and
 * never in. So nothing can put a file on a listing automatically. This makes
 * the file; a person files it.
 *
 * HELVETICA, NOT GOTHAM, AND THAT IS DELIBERATE. Gotham exists in this repo
 * only as woff2 for the web, which fontkit cannot embed, and this is a working
 * record rather than a brand artefact — it is read once by the office and
 * archived. The brochure is where the typography matters. Using a base-14 font
 * also means no font is embedded at all, so the file stays a few kilobytes and
 * opens anywhere.
 *
 * Laid out by hand because the content is simple and known: a heading, then
 * label-and-answer pairs that wrap and break across pages. No table, no
 * columns, nothing that needs a layout engine.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const WIDTH = A4[0] - MARGIN * 2;
const INK = rgb(0, 0, 0);
const MUTED = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.85, 0.85, 0.85);

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  body: PDFFont;
  bold: PDFFont;
  pages: number;
};

/**
 * A base-14 font can only encode WinAnsi, and pdf-lib THROWS on anything else.
 *
 * This is not hypothetical: vendors write these answers on their phones, and an
 * emoji in "we love the garden 🌿" would otherwise take down the whole document
 * — the one artefact of a ten-minute effort we cannot ask them to repeat. The
 * few characters outside WinAnsi are dropped, which leaves the sentence intact,
 * and the plain-text copy in the email and the CRM note keeps every character
 * regardless, so nothing the vendor typed is lost anywhere it matters.
 *
 * The 0x80–0x9F block is listed out because WinAnsi puts typographic characters
 * there rather than control codes — curly quotes and dashes are common in
 * anything pasted out of Word, and losing those would be visible.
 */
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

function winansi(text: string): string {
  let out = "";
  let dropped = 0;
  for (const ch of String(text)) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.includes(ch)) {
      out += ch;
    } else if (ch === "\t") {
      out += "    ";
    } else {
      dropped++;
    }
  }
  if (dropped) console.warn(`[questionnaire pdf] dropped ${dropped} character(s) the PDF font can't set`);
  return out;
}

/** Greedy wrap at the measured width — the only text measurement we need. */
function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  for (const para of winansi(text).split(/\r?\n/)) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= max) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      /**
       * A single word wider than the page — a long URL, or a filename with no
       * spaces. Broken by character, because the alternative is text running
       * off the edge of the paper.
       */
      if (font.widthOfTextAtSize(word, size) > max) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > max) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else line = word;
    }
    if (line) out.push(line);
  }
  return out;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage(A4);
  ctx.pages += 1;
  ctx.y = A4[1] - MARGIN;
}

/** Reserve vertical space, starting a page when what's coming won't fit. */
function room(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 28) newPage(ctx);
}

function draw(
  ctx: Ctx,
  text: string,
  opts: { size?: number; font?: PDFFont; color?: typeof INK; gap?: number; lead?: number } = {}
) {
  const size = opts.size ?? 10.5;
  const font = opts.font ?? ctx.body;
  const lead = opts.lead ?? size * 1.42;
  const lines = wrap(text, font, size, WIDTH);

  for (const line of lines) {
    room(ctx, lead);
    if (line) {
      ctx.page.drawText(line, {
        x: MARGIN,
        y: ctx.y - size,
        size,
        font,
        color: opts.color ?? INK,
      });
    }
    ctx.y -= lead;
  }
  ctx.y -= opts.gap ?? 0;
}

function rule(ctx: Ctx, gap = 14) {
  room(ctx, gap + 2);
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: MARGIN + WIDTH, y: ctx.y },
    thickness: 0.75,
    color: RULE,
  });
  ctx.y -= gap;
}

export type PdfInput = {
  address: string;
  answers: Answers;
  submittedName: string | null;
  submittedAt: string | null;
  vendors: { name: string; email: string }[];
  /** Names of anything the vendor uploaded — the files ride on the email. */
  attachments?: string[];
};

/**
 * An unanswered question is printed too, as "Not answered".
 *
 * A gap in a document you are about to rely on has to be visible. Silently
 * dropping the empty ones produces a tidy page that quietly implies every
 * question was covered, and the first anyone learns of the missing answer is
 * when a buyer's solicitor asks.
 */
export async function questionnairePdf(input: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = { doc, page: doc.addPage(A4), y: A4[1] - MARGIN, body, bold, pages: 1 };

  doc.setSubject("Vendor questionnaire");
  doc.setProducer("Loutakis Real Estate");
  doc.setCreator("loutakis.com.au");

  draw(ctx, "LOUTAKIS REAL ESTATE", { size: 8, font: bold, color: MUTED, gap: 16 });
  draw(ctx, "Property information", { size: 21, font: bold, gap: 6 });
  draw(ctx, input.address, { size: 13, color: MUTED, gap: 10 });

  const who = input.submittedName || input.vendors.map((v) => v.name).filter(Boolean).join(" & ");
  const when = input.submittedAt ? fmtDate(input.submittedAt) : "";
  draw(
    ctx,
    [who ? `Completed by ${who}` : "", when ? `on ${when}` : ""].filter(Boolean).join(" "),
    { size: 9.5, color: MUTED, gap: 4 }
  );
  rule(ctx, 22);

  for (const section of SECTIONS) {
    const live = section.fields.filter((f) => isShown(f, input.answers));
    if (!live.length) continue;

    // Keep a section heading with at least its first question, never orphaned
    // at the foot of a page.
    room(ctx, 64);
    draw(ctx, section.title.toUpperCase(), { size: 8.5, font: bold, color: MUTED, gap: 12 });

    for (const f of live) {
      const answer = answerText(f, input.answers);
      room(ctx, 40);
      draw(ctx, fieldLabel(f), { size: 10, font: bold, gap: 3 });
      if (f.kind === "files") {
        const names = input.attachments ?? [];
        draw(
          ctx,
          names.length ? `Attached to the covering email: ${names.join(", ")}` : "None provided",
          { size: 10.5, color: names.length ? INK : MUTED, gap: 14 }
        );
      } else {
        draw(ctx, answer || "Not answered", {
          size: 10.5,
          color: answer ? INK : MUTED,
          gap: 14,
        });
      }
    }
    rule(ctx, 20);
  }

  draw(
    ctx,
    "Given by the vendor and recorded as given. It is not a statement by Loutakis Real Estate, " +
      "and it is not a substitute for the vendor statement or any disclosure required under the " +
      "Sale of Land Act.",
    { size: 8.5, color: MUTED }
  );

  // Page numbers last, once the count is known.
  // Metadata goes through the same filter — a title pdf-lib cannot encode
  // would throw on save, after every page had already been drawn.
  doc.setTitle(winansi(`Property information — ${input.address}`));

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `${i + 1} of ${pages.length}`;
    p.drawText(label, {
      x: A4[0] - MARGIN - body.widthOfTextAtSize(label, 8),
      y: MARGIN - 18,
      size: 8,
      font: body,
      color: MUTED,
    });
  });

  return doc.save();
}

/** "property-information-19-william-street-newport.pdf" */
export function pdfFilename(address: string): string {
  const slug = address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `property-information-${slug || "property"}.pdf`;
}
