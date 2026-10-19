import "server-only";
import path from "node:path";
import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

export type ExportBlock = { heading: string; text: string };
export type ExportDoc = { title: string; subtitle: string; blocks: ExportBlock[]; footer: string };

function fontPath(weight: "Regular" | "Medium" | "SemiBold") {
  // Bundled Inter (OFL) covers Latin and Cyrillic.
  const candidates = [
    path.join(process.cwd(), "assets", "fonts", `Inter-${weight}.ttf`),
    path.join(process.cwd(), "apps", "web", "assets", "fonts", `Inter-${weight}.ttf`),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

export async function toPdf(doc: ExportDoc): Promise<Uint8Array> {
  const pdf = new PDFDocument({ size: "A4", margins: { top: 64, bottom: 64, left: 64, right: 64 }, info: { Title: doc.title } });
  pdf.registerFont("Body", fontPath("Regular"));
  pdf.registerFont("Strong", fontPath("SemiBold"));
  const chunks: Buffer[] = [];
  pdf.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => pdf.on("end", () => resolve()));

  pdf.font("Strong").fontSize(18).fillColor("#2F3A35").text(doc.title);
  pdf.moveDown(0.3).font("Body").fontSize(10).fillColor("#66726B").text(doc.subtitle);
  pdf.moveDown(1);
  for (const b of doc.blocks) {
    pdf.font("Strong").fontSize(10).fillColor("#4F7361").text(b.heading.toUpperCase(), { characterSpacing: 0.6 });
    pdf.moveDown(0.25).font("Body").fontSize(11).fillColor("#2F3A35").text(b.text || "—", { lineGap: 3 });
    pdf.moveDown(0.9);
  }
  pdf.moveDown(1).font("Body").fontSize(8.5).fillColor("#66726B").text(doc.footer);
  pdf.end();
  await done;
  return new Uint8Array(Buffer.concat(chunks));
}

export async function toDocx(doc: ExportDoc): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: doc.title, font: "Inter" })] }),
    new Paragraph({ children: [new TextRun({ text: doc.subtitle, color: "66726B", font: "Inter", size: 20 })] }),
  ];
  for (const b of doc.blocks) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240 }, children: [new TextRun({ text: b.heading, font: "Inter" })] }));
    for (const line of (b.text || "—").split("\n")) children.push(new Paragraph({ children: [new TextRun({ text: line, font: "Inter", size: 22 })] }));
  }
  children.push(new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: doc.footer, color: "66726B", font: "Inter", size: 16 })] }));
  const file = new Document({ creator: "HavenSpace", title: doc.title, sections: [{ children }] });
  return new Uint8Array(await Packer.toBuffer(file));
}

export function fileResponse(body: Uint8Array, filename: string, type: string) {
  return new Response(Buffer.from(body), {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "cache-control": "no-store",
    },
  });
}
