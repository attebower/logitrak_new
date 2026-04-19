/**
 * DYMO .label file generator.
 *
 * DYMO uses an XML-based label format that DYMO Connect and DYMO Label v8
 * both open. We generate one label design with placeholder fields for
 * `Serial` and `OrgName`, then bundle it with a CSV so the DYMO software
 * can merge-print.
 *
 * Format reference: https://developers.dymo.com/ (legacy docs), and the
 * LabelWriter XML schema that ships with DYMO Connect.
 */

import { formatSerial, type LabelDesign, type CodeType, type LabelSize } from "./catalog";

export interface DymoArgs {
  serialStart: number;
  serialEnd: number;
  design: LabelDesign;
  codeType: CodeType;
  orgName: string;
  size: LabelSize;
}

/**
 * Build a single DYMO .label file with placeholder <DataString/> on the
 * serial and org fields. DYMO Connect will prompt the user to assign the
 * CSV on first open, then merge-print every row.
 */
export function buildDymoLabel(args: DymoArgs): string {
  const { codeType, size, design } = args;

  // DYMO uses 1/20 mm units for coordinates (twentieths of a mm)
  const w = Math.round(size.widthMm * 20);
  const h = Math.round(size.heightMm * 20);

  // We build a generic design that works for all 5 layouts.
  // For Phase 1 keep it simple: code on left, serial + org on right.
  const codeSize = Math.min(h * 0.8, w * 0.4);
  const codeX = 20 * 2;
  const codeY = (h - codeSize) / 2;

  const textX = codeX + codeSize + 40;
  const textW = w - textX - 40;

  const bcType = codeType === "qr" ? "QRCode" : "Code128Auto";

  // DYMO Barcode element
  const barcodeObj = `
    <BarcodeObject>
      <Name>SerialBarcode</Name>
      <ForeColor Alpha="255" Red="15" Green="23" Blue="42"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <Text>00000</Text>
      <Type>${bcType}</Type>
      <Size>Medium</Size>
      <TextPosition>None</TextPosition>
      <TextFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
      <CheckSumFont Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
      <TextEmbedding>None</TextEmbedding>
      <ECLevel>0</ECLevel>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
    </BarcodeObject>`;

  const serialTextObj = `
    <TextObject>
      <Name>SerialText</Name>
      <ForeColor Alpha="255" Red="15" Green="23" Blue="42"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>00000</String>
          <Attributes>
            <Font Family="Courier New" Size="16" Bold="True" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="15" Green="23" Blue="42"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>`;

  const orgTextObj = `
    <TextObject>
      <Name>OrgName</Name>
      <ForeColor Alpha="255" Red="71" Green="85" Blue="105"/>
      <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>ORG NAME</String>
          <Attributes>
            <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
            <ForeColor Alpha="255" Red="71" Green="85" Blue="105"/>
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>`;

  // Build coordinate bounds for each object (X, Y, Width, Height in 1/20mm)
  const barcodeBounds = `<Bounds X="${codeX}" Y="${codeY}" Width="${codeSize}" Height="${codeSize}"/>`;
  const serialBounds = `<Bounds X="${textX}" Y="${h * 0.15}" Width="${textW}" Height="${h * 0.45}"/>`;
  const orgBounds = `<Bounds X="${textX}" Y="${h * 0.65}" Width="${textW}" Height="${h * 0.25}"/>`;

  // Design hint (used so I can vary layout per design later, keeping for now)
  void design;

  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Custom</Id>
  <PaperName>Custom Label</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${w}" Height="${h}" Rx="80" Ry="80"/>
  </DrawCommands>
  <ObjectInfo>
    ${barcodeObj}
    ${barcodeBounds}
  </ObjectInfo>
  <ObjectInfo>
    ${serialTextObj}
    ${serialBounds}
  </ObjectInfo>
  <ObjectInfo>
    ${orgTextObj}
    ${orgBounds}
  </ObjectInfo>
  <DataTable>
    <DataTableName>LogiTrakSerials</DataTableName>
    <HasHeaderRow>True</HasHeaderRow>
    <Columns>
      <Column>
        <Name>Serial</Name>
        <DataType>Text</DataType>
      </Column>
      <Column>
        <Name>OrgName</Name>
        <DataType>Text</DataType>
      </Column>
    </Columns>
  </DataTable>
</DieCutLabel>`;
}

/**
 * CSV with one row per label. DYMO Connect's "Import Data" feature maps
 * columns to placeholder objects automatically if names match.
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

1. Double-click labels.label to open DYMO Connect (or DYMO Label v8).
2. If prompted, point the data source at serials.csv (same folder).
3. Check the preview looks right, then hit Print.

Batch ID: ${batchId}

All serials are reserved in LogiTrak. If you need to re-print this batch,
just open the file again — no new serials will be used.
`;
}
