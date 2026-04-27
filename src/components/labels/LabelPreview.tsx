"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { LabelDesign, CodeType } from "@/lib/labels/catalog";

export interface LabelPreviewProps {
  widthMm:  number;
  heightMm: number;
  design:   LabelDesign;
  codeType: CodeType;
  serial:   string;
  orgName:  string;
  /** px per mm — default 4 */
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
      style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "2px", display: "block" }}
    >
      <LabelSvgContent {...props} />
    </svg>
  );
}

export function LabelSvgContent(props: LabelPreviewProps) {
  const { widthMm, heightMm, design, codeType, serial, orgName } = props;
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(serial, {
      margin: 0,
      width: 400,
      errorCorrectionLevel: "M",
      color: { dark: "#0F172A", light: "#FFFFFF" },
    }).then((url) => { if (!cancelled) setQrDataUrl(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [serial, codeType]);

  const pad    = 1.5;
  const innerW = widthMm - pad * 2;
  const innerH = heightMm - pad * 2;

  switch (design) {
    case "minimal":
      return <MinimalDesign pad={pad} innerW={innerW} innerH={innerH} qrDataUrl={qrDataUrl} />;
    case "standard":
      return <StandardDesign pad={pad} innerW={innerW} innerH={innerH} qrDataUrl={qrDataUrl} serial={serial} />;
    case "full":
      return <FullDesign pad={pad} innerW={innerW} innerH={innerH} qrDataUrl={qrDataUrl} serial={serial} orgName={orgName} />;
  }
}

// ── Minimal: QR only, centred ─────────────────────────────────────────────────

function MinimalDesign({ pad, innerW, innerH, qrDataUrl }: {
  pad: number; innerW: number; innerH: number; qrDataUrl: string;
}) {
  const size = Math.min(innerW, innerH) * 0.88;
  const x    = pad + (innerW - size) / 2;
  const y    = pad + (innerH - size) / 2;
  return <g>{qrDataUrl && <image href={qrDataUrl} x={x} y={y} width={size} height={size} />}</g>;
}

// ── Standard: QR top, serial below ───────────────────────────────────────────

function StandardDesign({ pad, innerW, innerH, qrDataUrl, serial }: {
  pad: number; innerW: number; innerH: number; qrDataUrl: string; serial: string;
}) {
  // QR occupies the top 65% of the height as a square, centred horizontally
  const qrSize = Math.min(innerW * 0.85, innerH * 0.65);
  const qrX    = pad + (innerW - qrSize) / 2;
  const qrY    = pad;

  const textY      = qrY + qrSize + innerH * 0.08;
  const serialFont = Math.min(innerH * 0.18, innerW * 0.14);

  return (
    <g>
      {qrDataUrl && <image href={qrDataUrl} x={qrX} y={qrY} width={qrSize} height={qrSize} />}
      <text
        x={pad + innerW / 2} y={textY + serialFont}
        textAnchor="middle"
        fontFamily="ui-monospace, 'Menlo', monospace"
        fontSize={serialFont} fontWeight="700" fill="#0F172A" letterSpacing="1"
      >{serial}</text>
    </g>
  );
}

// ── Full: QR top, serial + org name below ─────────────────────────────────────

function FullDesign({ pad, innerW, innerH, qrDataUrl, serial, orgName }: {
  pad: number; innerW: number; innerH: number; qrDataUrl: string; serial: string; orgName: string;
}) {
  // QR occupies the top 55% of the height, centred horizontally
  const qrSize = Math.min(innerW * 0.75, innerH * 0.55);
  const qrX    = pad + (innerW - qrSize) / 2;
  const qrY    = pad;

  const gap        = innerH * 0.06;
  const serialFont = Math.min(innerH * 0.16, innerW * 0.13);
  const orgFont    = Math.min(innerH * 0.11, innerW * 0.09);
  const lineH      = serialFont * 1.4;

  const serialY = qrY + qrSize + gap + serialFont;
  const orgY    = serialY + lineH;

  return (
    <g>
      {qrDataUrl && <image href={qrDataUrl} x={qrX} y={qrY} width={qrSize} height={qrSize} />}
      <text
        x={pad + innerW / 2} y={serialY}
        textAnchor="middle"
        fontFamily="ui-monospace, 'Menlo', monospace"
        fontSize={serialFont} fontWeight="700" fill="#0F172A" letterSpacing="1"
      >{serial}</text>
      <text
        x={pad + innerW / 2} y={orgY}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={orgFont} fill="#475569"
      >{orgName.toUpperCase()}</text>
    </g>
  );
}
