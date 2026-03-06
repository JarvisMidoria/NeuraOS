import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { TEMPLATE_PALETTES } from "@/lib/documents/templates";
import type { DocumentModel, DocumentTemplateId } from "@/lib/documents/types";

function moneyOrDash(value: string | undefined) {
  if (!value || value.trim().length === 0) return "-";
  return value;
}

export async function buildPdfDocument(model: DocumentModel, templateId: DocumentTemplateId) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const palette = TEMPLATE_PALETTES[templateId];

  const pageWidth = page.getWidth();
  const margin = 42;
  let y = page.getHeight() - margin;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: page.getHeight(),
    color: rgb(...palette.background),
  });

  page.drawText(model.companyName, {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: rgb(...palette.ink),
  });

  page.drawText(model.title.toUpperCase(), {
    x: pageWidth - margin - 180,
    y: y + 2,
    size: 12,
    font: fontBold,
    color: rgb(...palette.accent),
  });

  y -= 24;
  page.drawText(model.companyMeta ?? "", {
    x: margin,
    y,
    size: 10,
    font: fontRegular,
    color: rgb(...palette.muted),
  });

  y -= 22;
  page.drawText(`Ref: ${model.code}`, {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: rgb(...palette.ink),
  });
  page.drawText(`Date: ${model.issueDate}`, {
    x: margin + 180,
    y,
    size: 10,
    font: fontRegular,
    color: rgb(...palette.ink),
  });
  if (model.dueDate) {
    page.drawText(`Due: ${model.dueDate}`, {
      x: margin + 320,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(...palette.ink),
    });
  }

  y -= 30;
  page.drawText(model.counterpartLabel, {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: rgb(...palette.muted),
  });

  y -= 14;
  page.drawText(model.counterpartName, {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: rgb(...palette.ink),
  });

  y -= 14;
  if (model.counterpartMeta) {
    page.drawText(model.counterpartMeta, {
      x: margin,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(...palette.muted),
    });
    y -= 14;
  }

  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(...palette.border),
  });

  y -= 20;
  page.drawText("Item", { x: margin, y, size: 10, font: fontBold, color: rgb(...palette.muted) });
  page.drawText("Qty", { x: margin + 260, y, size: 10, font: fontBold, color: rgb(...palette.muted) });
  page.drawText("Unit", { x: margin + 340, y, size: 10, font: fontBold, color: rgb(...palette.muted) });
  page.drawText("Total", { x: margin + 440, y, size: 10, font: fontBold, color: rgb(...palette.muted) });

  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.8,
    color: rgb(...palette.border),
  });

  y -= 18;
  model.rows.slice(0, 18).forEach((row) => {
    page.drawText(row.label.slice(0, 44), {
      x: margin,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(...palette.ink),
    });
    if (row.meta) {
      page.drawText(row.meta.slice(0, 38), {
        x: margin,
        y: y - 11,
        size: 8,
        font: fontRegular,
        color: rgb(...palette.muted),
      });
    }

    page.drawText(moneyOrDash(row.quantity), {
      x: margin + 260,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(...palette.ink),
    });
    page.drawText(moneyOrDash(row.unitPrice), {
      x: margin + 340,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(...palette.ink),
    });
    page.drawText(moneyOrDash(row.total), {
      x: margin + 440,
      y,
      size: 10,
      font: fontBold,
      color: rgb(...palette.ink),
    });

    y -= row.meta ? 28 : 20;
  });

  y -= 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.8,
    color: rgb(...palette.border),
  });

  y -= 18;
  (model.totals ?? []).forEach((line) => {
    page.drawText(line.label, {
      x: margin + 320,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(...palette.muted),
    });
    page.drawText(line.value, {
      x: margin + 440,
      y,
      size: 10,
      font: fontBold,
      color: rgb(...palette.ink),
    });
    y -= 16;
  });

  if (model.notes) {
    y -= 8;
    page.drawText("Notes", {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(...palette.muted),
    });
    y -= 14;
    page.drawText(model.notes.slice(0, 210), {
      x: margin,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(...palette.ink),
    });
  }

  return pdf.save();
}
