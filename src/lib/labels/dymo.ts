/**
 * DYMO .dymo file generator for DYMO Connect.
 *
 * DYMO Connect uses the DesktopLabel v1 / DYMOLabel v4 XML schema (inches,
 * not the 1/20mm "twips" of the older DYMO Label v8 format). This template
 * is based on a real file produced by DYMO Connect on macOS.
 *
 * We emit the file with embedded data rows in <DataTable> — DYMO Connect
 * shows a merge preview and prints each row as its own label.
 */

import { formatSerial, type LabelSize, type CodeType, type LabelDesign } from "./catalog";

const MM_TO_INCH = 1 / 25.4;

/**
 * Map our label size ids to DYMO Connect internal LabelName strings. These
 * match the SKU catalog DYMO Connect ships with — using the right name is
 * what makes DYMO recognise the file as a real label for a specific roll.
 *
 * Format is always `<LabelType><SKU>` where the SKU comes from the DYMO
 * label reel packaging (e.g. 30252 Address labels → "Addresss0722370").
 */
const DYMO_LABEL_NAMES: Record<string, string> = {
  "30252": "Addresss0722370",        // Address 28×89mm
  "30334": "MultiPurpose300680",      // Multipurpose 57×32mm
  "30336": "MultiPurpose300687",      // Small multipurpose 25×54mm
  "30256": "Shipping300707",          // Shipping 59×102mm
  "30364": "NameBadgeLabel0722710",   // Name badge 41×89mm
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
 * Build a single DYMO .dymo file sized to the given label. The layout is
 * simple and consistent: barcode on the left, serial + org stacked on the right.
 * Data rows are embedded directly (one row per serial) so the user just
 * opens the file and prints — no separate CSV needed.
 */
export function buildDymoLabel(args: DymoArgs): string {
  const { size, codeType, orgName, serialStart, serialEnd } = args;

  // Whole label dimensions (inches, DYMO native unit)
  const labelW = +(size.widthMm * MM_TO_INCH).toFixed(4);
  const labelH = +(size.heightMm * MM_TO_INCH).toFixed(4);

  // Use the proper DYMO LabelName if we know the SKU, otherwise fall back.
  // Unknown names are a common cause of "invalid file" errors in DYMO Connect.
  const labelName = DYMO_LABEL_NAMES[size.id] ?? "Addresss0722370";

  // Safe inset so we don't draw right on the edge
  const inset = 0.08;
  const innerW = +(labelW - inset * 2).toFixed(4);
  const innerH = +(labelH - inset * 2).toFixed(4);

  // Barcode on the left, 80% of inner height, aspect 1:1 for QR, wider for 1D
  const isQR = codeType === "qr";
  const codeW = +(isQR ? Math.min(innerH * 0.95, innerW * 0.4) : innerW * 0.55).toFixed(4);
  const codeH = +(innerH * 0.95).toFixed(4);
  const codeX = +(inset + 0.04).toFixed(4);
  const codeY = +(inset + (innerH - codeH) / 2).toFixed(4);

  // Text block on the right
  const textX = +(codeX + codeW + 0.08).toFixed(4);
  const textW = +(labelW - textX - inset).toFixed(4);

  // Serial text — upper 55% of text block
  const serialY = +(inset + innerH * 0.08).toFixed(4);
  const serialH = +(innerH * 0.5).toFixed(4);

  // Org text — lower 35%
  const orgY = +(inset + innerH * 0.62).toFixed(4);
  const orgH = +(innerH * 0.3).toFixed(4);

  const dataRows = buildDataRows({ serialStart, serialEnd, orgName });

  const barcodeFormat = isQR ? "QRCode" : "Code128Auto";

  // DYMO Connect requires a UTF-8 BOM at the start of the file.
  return `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<DesktopLabel Version="1">
  <DYMOLabel Version="4">
    <Description>LogiTrak Labels</Description>
    <Orientation>Landscape</Orientation>
    <LabelName>${labelName}</LabelName>
    <InitialLength>0</InitialLength>
    <BorderStyle>SolidLine</BorderStyle>
    <DYMORect>
      <DYMOPoint>
        <X>0</X>
        <Y>0</Y>
      </DYMOPoint>
      <Size>
        <Width>${labelW}</Width>
        <Height>${labelH}</Height>
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
        <BarcodeObject>
          <Name>Serial_Barcode</Name>
          <Brushes>
            <BackgroundBrush><SolidColorBrush><Color A="0" R="0" G="0" B="0"/></SolidColorBrush></BackgroundBrush>
            <BorderBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></BorderBrush>
            <StrokeBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></StrokeBrush>
            <FillBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin><DYMOThickness Left="0" Top="0" Right="0" Bottom="0"/></Margin>
          <BarcodeFormat>${barcodeFormat}</BarcodeFormat>
          <Data>
            <DataString>${formatSerial(serialStart)}</DataString>
          </Data>
          <HorizontalAlignment>Center</HorizontalAlignment>
          <VerticalAlignment>Middle</VerticalAlignment>
          <Size>Medium</Size>
          <TextPosition>None</TextPosition>
          <TextFont>
            <FontName>Helvetica</FontName>
            <FontSize>8</FontSize>
            <IsBold>False</IsBold>
            <IsItalic>False</IsItalic>
            <IsUnderline>False</IsUnderline>
            <FontBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></FontBrush>
          </TextFont>
          <CheckSumFont>
            <FontName>Helvetica</FontName>
            <FontSize>8</FontSize>
            <IsBold>False</IsBold>
            <IsItalic>False</IsItalic>
            <IsUnderline>False</IsUnderline>
            <FontBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></FontBrush>
          </CheckSumFont>
          <TextEmbedding>None</TextEmbedding>
          <ECLevel>0</ECLevel>
          <ObjectLayout>
            <DYMOPoint><X>${codeX}</X><Y>${codeY}</Y></DYMOPoint>
            <Size><Width>${codeW}</Width><Height>${codeH}</Height></Size>
          </ObjectLayout>
        </BarcodeObject>
        <TextObject>
          <Name>Serial_Text</Name>
          <Brushes>
            <BackgroundBrush><SolidColorBrush><Color A="0" R="0" G="0" B="0"/></SolidColorBrush></BackgroundBrush>
            <BorderBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></BorderBrush>
            <StrokeBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></StrokeBrush>
            <FillBrush><SolidColorBrush><Color A="0" R="0" G="0" B="0"/></SolidColorBrush></FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin><DYMOThickness Left="0" Top="0" Right="0" Bottom="0"/></Margin>
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
                <Text>${formatSerial(serialStart)}</Text>
                <FontInfo>
                  <FontName>Courier New</FontName>
                  <FontSize>22</FontSize>
                  <IsBold>True</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush><SolidColorBrush><Color A="1" R="0.06" G="0.09" B="0.16"/></SolidColorBrush></FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint><X>${textX}</X><Y>${serialY}</Y></DYMOPoint>
            <Size><Width>${textW}</Width><Height>${serialH}</Height></Size>
          </ObjectLayout>
        </TextObject>
        <TextObject>
          <Name>Org_Name</Name>
          <Brushes>
            <BackgroundBrush><SolidColorBrush><Color A="0" R="0" G="0" B="0"/></SolidColorBrush></BackgroundBrush>
            <BorderBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></BorderBrush>
            <StrokeBrush><SolidColorBrush><Color A="1" R="0" G="0" B="0"/></SolidColorBrush></StrokeBrush>
            <FillBrush><SolidColorBrush><Color A="0" R="0" G="0" B="0"/></SolidColorBrush></FillBrush>
          </Brushes>
          <Rotation>Rotation0</Rotation>
          <OutlineThickness>1</OutlineThickness>
          <IsOutlined>False</IsOutlined>
          <BorderStyle>SolidLine</BorderStyle>
          <Margin><DYMOThickness Left="0" Top="0" Right="0" Bottom="0"/></Margin>
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
                <Text>${esc(orgName.toUpperCase())}</Text>
                <FontInfo>
                  <FontName>Helvetica</FontName>
                  <FontSize>10</FontSize>
                  <IsBold>False</IsBold>
                  <IsItalic>False</IsItalic>
                  <IsUnderline>False</IsUnderline>
                  <FontBrush><SolidColorBrush><Color A="1" R="0.28" G="0.33" B="0.41"/></SolidColorBrush></FontBrush>
                </FontInfo>
              </TextSpan>
            </LineTextSpan>
          </FormattedText>
          <ObjectLayout>
            <DYMOPoint><X>${textX}</X><Y>${orgY}</Y></DYMOPoint>
            <Size><Width>${textW}</Width><Height>${orgH}</Height></Size>
          </ObjectLayout>
        </TextObject>
      </LabelObjects>
    </DynamicLayoutManager>
  </DYMOLabel>
  <LabelApplication>Blank</LabelApplication>
  <DataTable>
    <Columns>
      <DataColumn>
        <Name>Serial_Barcode</Name>
        <DataColumnType>Text</DataColumnType>
      </DataColumn>
      <DataColumn>
        <Name>Serial_Text</Name>
        <DataColumnType>Text</DataColumnType>
      </DataColumn>
      <DataColumn>
        <Name>Org_Name</Name>
        <DataColumnType>Text</DataColumnType>
      </DataColumn>
    </Columns>
    <Rows>
${dataRows}
    </Rows>
  </DataTable>
</DesktopLabel>`;
}

function buildDataRows(args: { serialStart: number; serialEnd: number; orgName: string }): string {
  const rows: string[] = [];
  for (let n = args.serialStart; n <= args.serialEnd; n++) {
    const serial = formatSerial(n);
    rows.push(`      <DataRow>
        <DataCell>
          <Name>Serial_Barcode</Name>
          <CellValue>${esc(serial)}</CellValue>
        </DataCell>
        <DataCell>
          <Name>Serial_Text</Name>
          <CellValue>${esc(serial)}</CellValue>
        </DataCell>
        <DataCell>
          <Name>Org_Name</Name>
          <CellValue>${esc(args.orgName.toUpperCase())}</CellValue>
        </DataCell>
      </DataRow>`);
  }
  return rows.join("\n");
}

/**
 * CSV with one row per label — kept as a fallback for users who'd rather
 * import data manually (e.g. large batches or custom workflows).
 */
export function buildSerialsCsv(args: { serialStart: number; serialEnd: number; orgName: string }): string {
  const rows = ["Serial,OrgName"];
  for (let n = args.serialStart; n <= args.serialEnd; n++) {
    rows.push(`${formatSerial(n)},"${args.orgName.replace(/"/g, '""')}"`);
  }
  return rows.join("\n");
}

export function buildDymoReadme(batchId: string): string {
  return `LogiTrak Labels — DYMO batch

How to print:

1. Double-click labels.dymo to open DYMO Connect.
2. Every serial is already embedded — DYMO Connect will show them all in the data panel.
3. Hit Print.

If DYMO Connect doesn't show the data rows, click the "Data" tab and
import serials.csv from this folder.

Batch ID: ${batchId}

All serials are reserved in LogiTrak. If you need to re-print this batch,
just open the file again — no new serials will be used.
`;
}
