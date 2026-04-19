/**
 * Server-side PDF generation for label batches.
 *
 * Produces a PDF sized exactly to the label dimensions (one label per page
 * for die-cut, tiled for sheet labels). When the user prints, their OS dialog
 * sees the embedded page size and most printer drivers honour it.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import bwipjs from "bwip-js/node";
import { formatSerial, type LabelDesign, type CodeType, type LabelSize } from "./catalog";

// 1mm = 2.8346 PDF points
const MM_TO_PT = 2.834645669;

export interface PdfBatchArgs {
  serialStart: number;
  serialEnd: number;
  design: LabelDesign;
  codeType: CodeType;
  orgName: string;
  size: LabelSize;
}

export async function generateLabelPdf(args: PdfBatchArgs): Promise<Uint8Array> {
  const { serialStart, serialEnd, design, codeType, orgName, size } = args;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontMono = await doc.embedFont(StandardFonts.CourierBold);

  const widthPt = size.widthMm * MM_TO_PT;
  const heightPt = size.heightMm * MM_TO_PT;

  for (let n = serialStart; n <= serialEnd; n++) {
    const serial = formatSerial(n);
    const page = doc.addPage([widthPt, heightPt]);

    // Generate the code as a PNG
    const codePng = await generateCodePng(serial, codeType);
    const pngImage = await doc.embedPng(codePng);

    drawLabel(page, {
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      design,
      codeType,
      serial,
      orgName,
      codeImage: pngImage,
      font,
      fontRegular,
      fontMono,
    });
  }

  return doc.save();
}

async function generateCodePng(serial: string, codeType: CodeType): Promise<Uint8Array> {
  if (codeType === "qr") {
    const buf = await QRCode.toBuffer(serial, {
      margin: 0,
      width: 400,
      errorCorrectionLevel: "M",
      color: { dark: "#0F172A", light: "#FFFFFF" },
    });
    return buf;
  }
  // Pure-JS barcode via bwip-js
  const buf = await bwipjs.toBuffer({
    bcid: "code128",
    text: serial,
    scale: 3,
    height: 12,
    includetext: false,
    backgroundcolor: "FFFFFF",
    barcolor: "0F172A",
  });
  return buf;
}

// pdf-lib Page type is loose; keep interface shape small
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfPage = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfImage = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfFont = any;

interface DrawArgs {
  widthMm: number;
  heightMm: number;
  design: LabelDesign;
  codeType: CodeType;
  serial: string;
  orgName: string;
  codeImage: PdfImage;
  font: PdfFont;
  fontRegular: PdfFont;
  fontMono: PdfFont;
}

function drawLabel(page: PdfPage, args: DrawArgs) {
  const { widthMm, heightMm, design, codeType, serial, orgName, codeImage, font, fontRegular, fontMono } = args;

  // PDF coordinate system: origin at BOTTOM-LEFT, y increases upward.
  // Convert mm (top-left origin, y increases downward) to PDF coords.
  const toPt = (mm: number) => mm * MM_TO_PT;
  const heightPt = toPt(heightMm);
  const flipY = (mmFromTop: number) => heightPt - toPt(mmFromTop);

  const pad = 1.5;
  const innerW = widthMm - pad * 2;
  const innerH = heightMm - pad * 2;

  const drawImage = (xMm: number, yMmFromTop: number, wMm: number, hMm: number, preserve = true) => {
    if (preserve) {
      page.drawImage(codeImage, {
        x: toPt(xMm),
        y: flipY(yMmFromTop + hMm),
        width: toPt(wMm),
        height: toPt(hMm),
      });
    } else {
      page.drawImage(codeImage, {
        x: toPt(xMm),
        y: flipY(yMmFromTop + hMm),
        width: toPt(wMm),
        height: toPt(hMm),
      });
    }
  };

  const drawText = (text: string, xMm: number, yMmFromTop: number, opts: { size: number; font: PdfFont; align?: "left" | "center" | "right"; color?: [number, number, number] }) => {
    const { size, font: f, align = "left", color = [0.06, 0.09, 0.16] } = opts;
    const widthOfText = f.widthOfTextAtSize(text, size);
    let x = toPt(xMm);
    if (align === "center") x = toPt(xMm) - widthOfText / 2;
    if (align === "right") x = toPt(xMm) - widthOfText;
    // yMmFromTop is the BASELINE of the text measured from the top edge
    page.drawText(text, {
      x,
      y: flipY(yMmFromTop),
      size,
      font: f,
      color: rgb(color[0], color[1], color[2]),
    });
  };

  const orgUpper = orgName.toUpperCase();

  if (design === "standard") {
    const codeSize = Math.min(innerH * 0.55, innerW * 0.45);
    const codeX = pad + (innerW - codeSize) / 2;
    const codeY = pad + innerH * 0.05;
    const serialY = codeY + codeSize + innerH * 0.22;
    const orgY = pad + innerH * 0.96;
    const serialFont = toPt(Math.min(innerH * 0.18, innerW * 0.18));
    const orgFont = toPt(Math.min(innerH * 0.1, innerW * 0.1));

    if (codeType === "qr") {
      drawImage(codeX, codeY, codeSize, codeSize);
    } else {
      drawImage(pad + innerW * 0.1, codeY, innerW * 0.8, codeSize);
    }
    drawText(serial, pad + innerW / 2, serialY, { size: serialFont, font: fontMono, align: "center" });
    drawText(orgUpper, pad + innerW / 2, orgY, { size: orgFont, font: fontRegular, align: "center", color: [0.28, 0.33, 0.41] });
  } else if (design === "compact") {
    const codeSize = innerH * 0.9;
    const codeY = pad + (innerH - codeSize) / 2;
    const textX = pad + codeSize + 2;
    const textW = innerW - codeSize - 2;
    const serialFont = toPt(Math.min(innerH * 0.35, textW * 0.25));
    const orgFont = toPt(Math.min(innerH * 0.16, textW * 0.12));

    drawImage(pad, codeY, codeSize, codeSize);
    drawText(serial, textX, pad + innerH * 0.52, { size: serialFont, font: fontMono });
    drawText(orgUpper, textX, pad + innerH * 0.85, { size: orgFont, font: fontRegular, color: [0.28, 0.33, 0.41] });
  } else if (design === "barcode_focus") {
    const barH = innerH * 0.55;
    const barY = pad + innerH * 0.05;
    const serialFont = toPt(Math.min(innerH * 0.18, innerW * 0.16));
    const orgFont = toPt(Math.min(innerH * 0.1, innerW * 0.1));

    drawImage(pad, barY, innerW, barH);
    drawText(serial, pad + innerW / 2, barY + barH + innerH * 0.22, { size: serialFont, font: fontMono, align: "center" });
    drawText(orgUpper, pad + innerW / 2, pad + innerH * 0.98, { size: orgFont, font: fontRegular, align: "center", color: [0.28, 0.33, 0.41] });
  } else if (design === "full_detail") {
    const codeSize = Math.min(innerH * 0.5, innerW * 0.4);
    const codeX = pad + (innerW - codeSize) / 2;
    const codeY = pad + innerH * 0.04;
    const textStartY = codeY + codeSize + innerH * 0.16;
    const lineHeight = innerH * 0.12;
    const serialFont = toPt(Math.min(innerH * 0.11, innerW * 0.11));
    const nameFont = toPt(Math.min(innerH * 0.1, innerW * 0.1));
    const orgFont = toPt(Math.min(innerH * 0.08, innerW * 0.08));

    if (codeType === "qr") {
      drawImage(codeX, codeY, codeSize, codeSize);
    } else {
      drawImage(pad + innerW * 0.1, codeY, innerW * 0.8, codeSize);
    }
    drawText(`SN: ${serial}`, pad + innerW / 2, textStartY, { size: serialFont, font: fontMono, align: "center" });
    drawText("Unassigned", pad + innerW / 2, textStartY + lineHeight, { size: nameFont, font, align: "center", color: [0.2, 0.25, 0.33] });
    drawText(orgUpper, pad + innerW / 2, textStartY + lineHeight * 2, { size: orgFont, font: fontRegular, align: "center", color: [0.39, 0.46, 0.54] });
  } else if (design === "high_visibility") {
    const serialFont = toPt(Math.min(innerH * 0.45, innerW * 0.18));
    const codeSize = innerH * 0.3;
    const spaced = serial.split("").join(" ");
    drawText(spaced, pad + innerW / 2, pad + innerH * 0.62, { size: serialFont, font, align: "center" });
    drawImage(pad, pad + innerH - codeSize, codeSize, codeSize);
    drawText(orgUpper, pad + innerW, pad + innerH - innerH * 0.05, {
      size: toPt(Math.min(innerH * 0.12, innerW * 0.1)),
      font,
      align: "right",
      color: [0.28, 0.33, 0.41],
    });
  }
}
