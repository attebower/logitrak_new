/**
 * DYMO .dymo file generator for DYMO Connect.
 *
 * This implementation is based on a *real file produced by DYMO Connect*
 * (see scripts/dymo-template.xml) and modifies it minimally — only swapping
 * the serial text and adjusting the layout point. DYMO Connect's schema is
 * strict and undocumented; reverse-engineering it from scratch produces
 * files it rejects as invalid.
 *
 * Phase 1 strategy: emit ONE label with the first serial visible, and a
 * CSV alongside with every serial. User imports the CSV in DYMO Connect
 * to merge-print the batch. Once we have a known-good merged-data format
 * we can embed rows directly.
 */

import { formatSerial, type LabelSize, type CodeType, type LabelDesign } from "./catalog";

const MM_TO_INCH = 1 / 25.4;

/**
 * Maps our internal label size ids to the DYMO Connect catalog LabelName.
 * These names match the label SKUs baked into DYMO Connect — using the wrong
 * one causes "invalid file" errors.
 */
const DYMO_LABEL_NAMES: Record<string, string> = {
  "30252": "Addresss0722370",         // Address 28×89mm
  "30334": "MultiPurpose300680",      // Multipurpose 57×32mm
  "30336": "MultiPurpose300687",      // Small multipurpose 25×54mm
  "30256": "Shipping300707",          // Shipping 59×102mm
  "30364": "NameBadgeLabel0722710",   // Name badge 41×89mm
};

/** Per-SKU exact printable area (inches). DYMO is picky about this. */
const DYMO_LABEL_GEOMETRY: Record<string, { x: number; y: number; w: number; h: number }> = {
  "30252": { x: 0.23,  y: 0.06, w: 3.21,   h: 0.9966666 },  // Address 28×89
  "30334": { x: 0.115, y: 0.06, w: 2.0142, h: 1.1398 },     // Multipurpose 57×32
  "30336": { x: 0.115, y: 0.06, w: 0.9142, h: 1.9146 },     // Small multipurpose 25×54
  "30256": { x: 0.115, y: 0.06, w: 3.7842, h: 2.1646 },     // Shipping 59×102
  "30364": { x: 0.115, y: 0.06, w: 3.1042, h: 1.4998 },     // Name badge 41×89
};

export interface DymoArgs {
  serialStart: number;
  serialEnd: number;
  design: LabelDesign;
  codeType: CodeType;
  orgName: string;
  size: LabelSize;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build a minimal .dymo file with a single text object showing the first
 * serial. Layout, dimensions, and LabelName match a real DYMO Connect file
 * as closely as possible.
 */
export function buildDymoLabel(args: DymoArgs): string {
  const { size, serialStart } = args;

  const labelName = DYMO_LABEL_NAMES[size.id] ?? "Addresss0722370";
  const geom = DYMO_LABEL_GEOMETRY[size.id] ?? {
    x: 0.115,
    y: 0.06,
    w: +(size.widthMm * MM_TO_INCH - 0.23).toFixed(4),
    h: +(size.heightMm * MM_TO_INCH - 0.12).toFixed(4),
  };

  // Text area sits inside the printable rect, with a small margin
  const textMargin = 0.1;
  const textX = +(geom.x + textMargin).toFixed(4);
  const textY = +(geom.y + textMargin).toFixed(4);
  const textW = +(geom.w - textMargin * 2).toFixed(4);
  const textH = +(geom.h - textMargin * 2).toFixed(4);

  const firstSerial = formatSerial(serialStart);

  // NOTE: The structure below is an exact copy of a DYMO Connect-produced
  // .dymo file. Only the content (<Text>, <LabelName>, <DYMORect>, and
  // <ObjectLayout>) varies per generation.
  return `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<DesktopLabel Version="1">
  <DYMOLabel Version="4">
    <Description>DYMO Label</Description>
    <Orientation>Landscape</Orientation>
    <LabelName>${labelName}</LabelName>
    <InitialLength>0</InitialLength>
    <BorderStyle>SolidLine</BorderStyle>
    <DYMORect>
      <DYMOPoint>
        <X>${geom.x}</X>
        <Y>${geom.y}</Y>
      </DYMOPoint>
      <Size>
        <Width>${geom.w}</Width>
        <Height>${geom.h}</Height>
      </Size>
    </DYMORect>
    <BorderColor>
      <SolidColorBrush>
        <Color A="1" R="0" G="0" B="0"></Color>
      </SolidColorBrush>
    </BorderColor>
    <BorderThickness>1</BorderThickness>
    <Show_Border>False</Show_Border>
    <HasFixedLength>False</HasFixedLength>
    <FixedLengthValue>0</FixedLengthValue>
    <DynamicLayoutManager>
      <RotationBehavior>ClearObjects</RotationBehavior>
      <LabelObjects>
        <TextObject>
          <Name>TextObject0</Name>
          <Brushes>
            <BackgroundBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BackgroundBrush>
            <BorderBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </BorderBrush>
            <StrokeBrush>
              <SolidColorBrush>
                <Color A="1" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </StrokeBrush>
            <FillBrush>
              <SolidColorBrush>
                <Color A="0" R="0" G="0" B="0"></Color>
              </SolidColorBrush>
            </FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin>
            <DYMOThickness Left="0" Top="0" Right="0" Bottom="0" />
          </Margin>
          <HorizontalAlignment>Center</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <FitMode>AlwaysFit</FitMode>
          <IsVertical>False</IsVertical>
          <FormattedText>
            <FitMode>AlwaysFit</FitMode>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <IsVertical>False</IsVertical>
            <LineTextSpan>
              <TextSpan>
                <Text>${esc(firstSerial)}</Text>
                <FontInfo>
                  <FontName>Helvetica</FontName>
                  <FontSize>36</FontSize>
                  <IsBold>True</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush>
                    <SolidColorBrush>
                      <Color A="1" R="0" G="0" B="0"></Color>
                    </SolidColorBrush>
                  </FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint>
              <X>${textX}</X>
              <Y>${textY}</Y>
            </DYMOPoint>
            <Size>
              <Width>${textW}</Width>
              <Height>${textH}</Height>
            </Size>
          </ObjectLayout>
        </TextObject>
      </LabelObjects>
    </DynamicLayoutManager>
  </DYMOLabel>
  <LabelApplication>Blank</LabelApplication>
  <DataTable>
    <Columns></Columns>
    <Rows></Rows>
  </DataTable>
</DesktopLabel>`;
}

/**
 * CSV with one serial per row. User imports this in DYMO Connect via
 * File → Import Data to merge-print every serial.
 */
export function buildSerialsCsv(args: { serialStart: number; serialEnd: number; orgName: string }): string {
  const rows = ["Serial,OrgName"];
  for (let n = args.serialStart; n <= args.serialEnd; n++) {
    rows.push(`${formatSerial(n)},"${args.orgName.replace(/"/g, '""')}"`);
  }
  return rows.join("\n");
}

export function buildDymoReadme(batchId: string, serialStart: number, serialEnd: number): string {
  return `LogiTrak Labels — DYMO batch

How to print:

1. Double-click labels.dymo to open DYMO Connect.
2. The label template opens showing serial ${formatSerial(serialStart)}.
3. To print all ${serialEnd - serialStart + 1} serials:
   a. In DYMO Connect, click File → Import Data.
   b. Choose serials.csv (in this folder).
   c. Map the "Serial" column to the TextObject0 field.
   d. Hit Print.

Batch ID: ${batchId}

All serials (${formatSerial(serialStart)}–${formatSerial(serialEnd)}) are
reserved in LogiTrak and cannot be reused. If you need to re-print this
batch just open this file again — no new serials are burned.
`;
}
