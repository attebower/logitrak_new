/**
 * Brother .lbx file generator.
 *
 * .lbx is a ZIP containing label.xml (main design) and prop.xml (metadata).
 * P-touch Editor 5+ can open these directly. Brother has no official spec —
 * these templates are based on files produced by P-touch Editor itself.
 *
 * Phase 1 strategy: generate a single .lbx with merge fields, bundle with
 * serials.csv. On first open, P-touch Editor asks for the CSV path —
 * afterwards serials populate automatically.
 */

import JSZip from "jszip";
import { formatSerial, type LabelSize, type CodeType } from "./catalog";

export interface BrotherArgs {
  serialStart: number;
  serialEnd: number;
  codeType: CodeType;
  orgName: string;
  size: LabelSize;
}

export async function buildBrotherLbx(args: BrotherArgs): Promise<Uint8Array> {
  const zip = new JSZip();

  const labelXml = buildLabelXml(args);
  const propXml = buildPropXml();

  zip.file("label.xml", labelXml);
  zip.file("prop.xml", propXml);

  return zip.generateAsync({ type: "uint8array" });
}

function buildLabelXml(args: BrotherArgs): string {
  const { size, codeType, orgName } = args;

  // Brother uses 1mm = 360 units in label XML coordinate space (".1mm" unit)
  const MM = 360;
  const w = Math.round(size.widthMm * MM);
  const h = Math.round(size.heightMm * MM);

  const bcType = codeType === "qr" ? "14" : "6"; // 14=QR, 6=Code128

  const codeSize = Math.min(h * 0.85, w * 0.4);
  const codeX = MM * 2;
  const codeY = (h - codeSize) / 2;

  const textX = codeX + codeSize + MM * 2;
  const textW = w - textX - MM * 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<pt:document xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main" xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style" xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text" xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw" xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image" xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode" xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database" xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table" xmlns:cable="http://schemas.brother.info/ptouch/2007/lbx/cable" version="1.9" generator="LogiTrak 1.0">
  <pt:body currentSheet="Sheet 1" direction="LTR">
    <style:sheet name="Sheet 1">
      <style:paper media="0" width="${w}" height="${h}" marginLeft="0" marginRight="0" marginTop="0" marginBottom="0" orientation="landscape" autoLength="false" monochromeDisplay="true" printColorDisplay="false" printColorsID="0" paperColor="#FFFFFF" paperInk="#000000" split="1" format="0" backgroundTheme="0" printerID="0" printerName=""/>
      <style:cutLine regularCut="0pt" freeCut=""/>
      <style:backGround x="0" y="0" width="${w}" height="${h}" brushStyle="NULL" brushId="0" userPattern="NONE" userPatternId="0" color="#000000" printColorNumber="1" backColor="#FFFFFF" backPrintColorNumber="0"/>
      <pt:objects>
        <barcode:barcode>
          <pt:objectStyle x="${codeX}" y="${codeY}" width="${codeSize}" height="${codeSize}" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE">
            <pt:pen style="NULL" widthX="0pt" widthY="0pt" color="#000000" printColorNumber="1"/>
            <pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>
            <pt:expanded objectName="SerialCode" ID="0" lock="0" templateMergeTarget="false" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/>
          </pt:objectStyle>
          <barcode:barcodeStyle protocol="${bcType}" lengths="5" zeroFill="false" barWidth="1.8pt" barRatio="1:3" humanReadable="false" humanReadableAlignment="LEFT" checkDigit="false" autoLengths="true" margin="false" sameLengthBar="false" bearerBar="false"/>
          <barcode:qrcodeStyle model="2" eccLevel="15%" cellSize="1.4pt" mbcs="auto" joint="1"/>
          <pt:data>[%Serial%]</pt:data>
        </barcode:barcode>
        <text:text>
          <pt:objectStyle x="${textX}" y="${h * 0.15}" width="${textW}" height="${h * 0.4}" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE">
            <pt:pen style="NULL" widthX="0pt" widthY="0pt" color="#000000" printColorNumber="1"/>
            <pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>
            <pt:expanded objectName="SerialText" ID="0" lock="0" templateMergeTarget="false" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/>
          </pt:objectStyle>
          <pt:ptFontInfo>
            <pt:logFont name="Courier New" width="0" italic="false" weight="700" charSet="0" pitchAndFamily="0"/>
            <pt:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="18pt" orgSize="28.8pt" textColor="#0F172A" textPrintColorNumber="1"/>
          </pt:ptFontInfo>
          <pt:textControl control="AUTOLEN" clipFrame="false" aspectNormal="true" shrink="true" autoLF="false" avoidImage="false"/>
          <pt:textAlign horizontalAlignment="CENTER" verticalAlignment="CENTER" inLineAlignment="BASELINE"/>
          <pt:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="28.8pt" combinedChars="false"/>
          <pt:data>[%Serial%]</pt:data>
          <pt:stringItem charLen="10">
            <pt:ptFontInfo>
              <pt:logFont name="Courier New" width="0" italic="false" weight="700" charSet="0" pitchAndFamily="0"/>
              <pt:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="18pt" orgSize="28.8pt" textColor="#0F172A" textPrintColorNumber="1"/>
            </pt:ptFontInfo>
          </pt:stringItem>
        </text:text>
        <text:text>
          <pt:objectStyle x="${textX}" y="${h * 0.6}" width="${textW}" height="${h * 0.25}" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE">
            <pt:pen style="NULL" widthX="0pt" widthY="0pt" color="#000000" printColorNumber="1"/>
            <pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>
            <pt:expanded objectName="OrgName" ID="0" lock="0" templateMergeTarget="false" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/>
          </pt:objectStyle>
          <pt:ptFontInfo>
            <pt:logFont name="Arial" width="0" italic="false" weight="400" charSet="0" pitchAndFamily="0"/>
            <pt:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="10pt" orgSize="16pt" textColor="#475569" textPrintColorNumber="1"/>
          </pt:ptFontInfo>
          <pt:textControl control="AUTOLEN" clipFrame="false" aspectNormal="true" shrink="true" autoLF="false" avoidImage="false"/>
          <pt:textAlign horizontalAlignment="CENTER" verticalAlignment="CENTER" inLineAlignment="BASELINE"/>
          <pt:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="16pt" combinedChars="false"/>
          <pt:data>[%OrgName%]</pt:data>
          <pt:stringItem charLen="${orgName.length}">
            <pt:ptFontInfo>
              <pt:logFont name="Arial" width="0" italic="false" weight="400" charSet="0" pitchAndFamily="0"/>
              <pt:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="10pt" orgSize="16pt" textColor="#475569" textPrintColorNumber="1"/>
            </pt:ptFontInfo>
          </pt:stringItem>
        </text:text>
      </pt:objects>
    </style:sheet>
  </pt:body>
</pt:document>`;
}

function buildPropXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<meta:properties xmlns:meta="http://schemas.brother.info/ptouch/2007/lbx/meta" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <meta:appName>LogiTrak</meta:appName>
  <dc:title>LogiTrak Labels</dc:title>
  <dc:subject></dc:subject>
  <dc:creator>LogiTrak</dc:creator>
  <meta:keyword></meta:keyword>
  <dc:description>Generated by LogiTrak</dc:description>
  <meta:template></meta:template>
  <dcterms:created>${new Date().toISOString()}</dcterms:created>
  <dcterms:modified>${new Date().toISOString()}</dcterms:modified>
  <meta:lastPrinted>${new Date().toISOString()}</meta:lastPrinted>
  <meta:modifiedBy>LogiTrak</meta:modifiedBy>
  <meta:revision>1</meta:revision>
  <meta:editTime>0</meta:editTime>
  <meta:numPages>1</meta:numPages>
  <meta:generator>LogiTrak 1.0</meta:generator>
</meta:properties>`;
}

export function buildBrotherReadme(batchId: string): string {
  return `LogiTrak Labels — Brother P-touch batch

How to print:

1. Double-click labels.lbx to open in P-touch Editor.
2. If prompted, import serials.csv as the data source.
3. P-touch Editor fills in every label for you. Hit Print.

Batch ID: ${batchId}

All serials are reserved in LogiTrak. If you need to re-print this batch,
just open the file again — no new serials will be used.
`;
}

export { formatSerial };
