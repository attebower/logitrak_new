"use client";

/**
 * Live SVG label preview. Used both in the Generate Labels page and as the
 * renderer for PDF output (captured via html-to-image or toDataURL).
 *
 * Renders one label at the given physical dimensions. The SVG viewBox is
 * sized in mm — let the browser scale it visually for preview.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import type { LabelDesign, CodeType } from "@/lib/labels/catalog";

export interface LabelPreviewProps {
  widthMm: number;
  heightMm: number;
  design: LabelDesign;
  codeType: CodeType;
  serial: string;            // e.g. "00048"
  orgName: string;
  equipmentName?: string;    // only shown in full_detail design
  /** Display scale — CSS px per mm. Default 4 (good for on-screen). */
  scale?: number;
}

export function LabelPreview(props: LabelPreviewProps) {
  const { widthMm, heightMm, scale = 4 } = props;

  return (
    <svg
      width={widthMm * scale}
      height={heightMm * scale}
      viewBox={`0 0 ${widthMm} ${heightMm}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        background: "#ffffff",
        border: "1px solid #E5E7EB",
        borderRadius: "2px",
        display: "block",
      }}
    >
      <LabelSvgContent {...props} />
    </svg>
  );
}

/**
 * The pure SVG content — extracted so it can be used by the PDF renderer too.
 * Accepts viewBox in mm.
 */
export function LabelSvgContent(props: LabelPreviewProps) {
  const { widthMm, heightMm, design, codeType, serial, orgName, equipmentName } = props;

  const [codeDataUrl, setCodeDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      try {
        if (codeType === "qr") {
          const url = await QRCode.toDataURL(serial, {
            margin: 0,
            width: 400,
            errorCorrectionLevel: "M",
            color: { dark: "#0F172A", light: "#FFFFFF" },
          });
          if (!cancelled) setCodeDataUrl(url);
        } else {
          // Barcode via JsBarcode into a detached canvas
          const canvas = document.createElement("canvas");
          JsBarcode(canvas, serial, {
            format: "CODE128",
            displayValue: false,
            margin: 0,
            height: 60,
            width: 2,
            background: "#ffffff",
            lineColor: "#0F172A",
          });
          if (!cancelled) setCodeDataUrl(canvas.toDataURL("image/png"));
        }
      } catch {
        if (!cancelled) setCodeDataUrl("");
      }
    }

    void generate();
    return () => { cancelled = true; };
  }, [codeType, serial]);

  // Layout helpers
  const pad = 1.5; // mm padding inside label
  const innerW = widthMm - pad * 2;
  const innerH = heightMm - pad * 2;

  switch (design) {
    case "standard":
      return <StandardDesign
        padding={pad} innerW={innerW} innerH={innerH}
        codeDataUrl={codeDataUrl} codeType={codeType}
        serial={serial} orgName={orgName}
      />;

    case "compact":
      return <CompactDesign
        padding={pad} innerW={innerW} innerH={innerH} heightMm={heightMm}
        codeDataUrl={codeDataUrl} codeType={codeType}
        serial={serial} orgName={orgName}
      />;

    case "barcode_focus":
      return <BarcodeFocusDesign
        padding={pad} innerW={innerW} innerH={innerH}
        codeDataUrl={codeDataUrl}
        serial={serial} orgName={orgName}
      />;

    case "full_detail":
      return <FullDetailDesign
        padding={pad} innerW={innerW} innerH={innerH}
        codeDataUrl={codeDataUrl} codeType={codeType}
        serial={serial} orgName={orgName}
        equipmentName={equipmentName || "Unassigned"}
      />;

    case "high_visibility":
      return <HighVisibilityDesign
        padding={pad} innerW={innerW} innerH={innerH} widthMm={widthMm} heightMm={heightMm}
        codeDataUrl={codeDataUrl}
        serial={serial} orgName={orgName}
      />;
  }
}

// ── Design 1: Standard ──────────────────────────────────────────────────
// Code centred, serial below in mono, org name at bottom.

function StandardDesign(props: {
  padding: number; innerW: number; innerH: number;
  codeDataUrl: string; codeType: CodeType;
  serial: string; orgName: string;
}) {
  const { padding, innerW, innerH, codeDataUrl, codeType, serial, orgName } = props;
  const codeSize = Math.min(innerH * 0.55, innerW * 0.45);
  const codeX = padding + (innerW - codeSize) / 2;
  const codeY = padding + innerH * 0.05;

  const serialY = codeY + codeSize + innerH * 0.13;
  const orgY = padding + innerH * 0.92;

  const serialFont = Math.min(innerH * 0.18, innerW * 0.18);
  const orgFont = Math.min(innerH * 0.1, innerW * 0.1);

  return (
    <g>
      {codeDataUrl && (
        codeType === "qr" ? (
          <image href={codeDataUrl} x={codeX} y={codeY} width={codeSize} height={codeSize} />
        ) : (
          <image href={codeDataUrl} x={padding + innerW * 0.1} y={codeY} width={innerW * 0.8} height={codeSize} preserveAspectRatio="none" />
        )
      )}
      <text
        x={padding + innerW / 2} y={serialY}
        textAnchor="middle"
        fontFamily="ui-monospace, 'Menlo', monospace"
        fontSize={serialFont}
        fontWeight="700"
        fill="#0F172A"
        letterSpacing="0.5"
      >{serial}</text>
      <text
        x={padding + innerW / 2} y={orgY}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={orgFont}
        fill="#475569"
        letterSpacing="0.3"
      >{orgName.toUpperCase()}</text>
    </g>
  );
}

// ── Design 2: Compact (Horizontal) ──────────────────────────────────────
// Code left, stacked text right. Good for narrow labels.

function CompactDesign(props: {
  padding: number; innerW: number; innerH: number; heightMm: number;
  codeDataUrl: string; codeType: CodeType;
  serial: string; orgName: string;
}) {
  const { padding, innerW, innerH, codeDataUrl, codeType, serial, orgName } = props;
  const codeSize = innerH * 0.9;
  const codeX = padding;
  const codeY = padding + (innerH - codeSize) / 2;

  const textX = codeX + codeSize + 2;
  const textW = innerW - codeSize - 2;

  const serialFont = Math.min(innerH * 0.35, textW * 0.25);
  const orgFont = Math.min(innerH * 0.16, textW * 0.12);

  return (
    <g>
      {codeDataUrl && (
        codeType === "qr" ? (
          <image href={codeDataUrl} x={codeX} y={codeY} width={codeSize} height={codeSize} />
        ) : (
          <image href={codeDataUrl} x={codeX} y={codeY} width={codeSize} height={codeSize} preserveAspectRatio="none" />
        )
      )}
      <text
        x={textX} y={padding + innerH * 0.48}
        fontFamily="ui-monospace, 'Menlo', monospace"
        fontSize={serialFont}
        fontWeight="700"
        fill="#0F172A"
      >{serial}</text>
      <text
        x={textX} y={padding + innerH * 0.78}
        fontFamily="system-ui, sans-serif"
        fontSize={orgFont}
        fill="#475569"
      >{orgName.toUpperCase()}</text>
    </g>
  );
}

// ── Design 3: Barcode Focus ─────────────────────────────────────────────
// Wide barcode dominant. Always barcode (even if user picked QR).

function BarcodeFocusDesign(props: {
  padding: number; innerW: number; innerH: number;
  codeDataUrl: string;
  serial: string; orgName: string;
}) {
  const { padding, innerW, innerH, codeDataUrl, serial, orgName } = props;
  const barH = innerH * 0.55;
  const barY = padding + innerH * 0.05;

  const serialFont = Math.min(innerH * 0.18, innerW * 0.16);
  const orgFont = Math.min(innerH * 0.1, innerW * 0.1);

  return (
    <g>
      {codeDataUrl && (
        <image href={codeDataUrl} x={padding} y={barY} width={innerW} height={barH} preserveAspectRatio="none" />
      )}
      <text
        x={padding + innerW / 2} y={barY + barH + innerH * 0.18}
        textAnchor="middle"
        fontFamily="ui-monospace, 'Menlo', monospace"
        fontSize={serialFont}
        fontWeight="700"
        fill="#0F172A"
        letterSpacing="0.5"
      >{serial}</text>
      <text
        x={padding + innerW / 2} y={padding + innerH * 0.95}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={orgFont}
        fill="#475569"
      >{orgName.toUpperCase()}</text>
    </g>
  );
}

// ── Design 4: Full Detail ──────────────────────────────────────────────
// Adds equipment name.

function FullDetailDesign(props: {
  padding: number; innerW: number; innerH: number;
  codeDataUrl: string; codeType: CodeType;
  serial: string; orgName: string; equipmentName: string;
}) {
  const { padding, innerW, innerH, codeDataUrl, codeType, serial, orgName, equipmentName } = props;
  const codeSize = Math.min(innerH * 0.5, innerW * 0.4);
  const codeX = padding + (innerW - codeSize) / 2;
  const codeY = padding + innerH * 0.04;

  const textStartY = codeY + codeSize + innerH * 0.1;
  const lineHeight = innerH * 0.12;
  const serialFont = Math.min(innerH * 0.11, innerW * 0.11);
  const nameFont = Math.min(innerH * 0.1, innerW * 0.1);
  const orgFont = Math.min(innerH * 0.08, innerW * 0.08);

  return (
    <g>
      {codeDataUrl && (
        codeType === "qr" ? (
          <image href={codeDataUrl} x={codeX} y={codeY} width={codeSize} height={codeSize} />
        ) : (
          <image href={codeDataUrl} x={padding + innerW * 0.1} y={codeY} width={innerW * 0.8} height={codeSize} preserveAspectRatio="none" />
        )
      )}
      <text
        x={padding + innerW / 2} y={textStartY}
        textAnchor="middle"
        fontFamily="ui-monospace, 'Menlo', monospace"
        fontSize={serialFont}
        fontWeight="700"
        fill="#0F172A"
      >SN: {serial}</text>
      <text
        x={padding + innerW / 2} y={textStartY + lineHeight}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={nameFont}
        fontWeight="600"
        fill="#334155"
      >{truncate(equipmentName, 24)}</text>
      <text
        x={padding + innerW / 2} y={textStartY + lineHeight * 2}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={orgFont}
        fill="#64748B"
      >{orgName.toUpperCase()}</text>
    </g>
  );
}

// ── Design 5: High Visibility ──────────────────────────────────────────
// Oversized spaced serial dominates.

function HighVisibilityDesign(props: {
  padding: number; innerW: number; innerH: number; widthMm: number; heightMm: number;
  codeDataUrl: string;
  serial: string; orgName: string;
}) {
  const { padding, innerW, innerH, codeDataUrl, serial, orgName } = props;
  const serialFont = Math.min(innerH * 0.45, innerW * 0.18);
  const codeSize = innerH * 0.3;
  const spacedSerial = serial.split("").join(" ");

  return (
    <g>
      <text
        x={padding + innerW / 2}
        y={padding + innerH * 0.55}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={serialFont}
        fontWeight="900"
        fill="#0F172A"
        letterSpacing="0"
      >{spacedSerial}</text>

      {codeDataUrl && (
        <image href={codeDataUrl} x={padding} y={padding + innerH - codeSize} width={codeSize} height={codeSize} />
      )}
      <text
        x={padding + innerW}
        y={padding + innerH - innerH * 0.1}
        textAnchor="end"
        fontFamily="system-ui, sans-serif"
        fontSize={Math.min(innerH * 0.12, innerW * 0.1)}
        fontWeight="700"
        fill="#475569"
      >{orgName.toUpperCase()}</text>
    </g>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
