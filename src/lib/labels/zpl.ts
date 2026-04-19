/**
 * ZPL batch builder for Zebra printers. Pure string generation — runs
 * on either client or server.
 */

import { formatSerial, type LabelSize, type CodeType } from "./catalog";

export interface ZplArgs {
  serialStart: number;
  serialEnd: number;
  codeType: CodeType;
  orgName: string;
  size: LabelSize;
}

export function buildZpl(args: ZplArgs): string {
  const { serialStart, serialEnd, size, codeType, orgName } = args;
  const dpi = 203; // standard Zebra desktop
  const dotsPerMm = dpi / 25.4;
  const widthDots = Math.round(size.widthMm * dotsPerMm);
  const heightDots = Math.round(size.heightMm * dotsPerMm);
  const orgSafe = orgName.toUpperCase().replace(/\^/g, "").replace(/~/g, "");

  const parts: string[] = [];
  for (let n = serialStart; n <= serialEnd; n++) {
    const serial = formatSerial(n);
    if (codeType === "qr") {
      parts.push(`^XA
^PW${widthDots}
^LL${heightDots}
^FO${Math.round(widthDots * 0.1)},${Math.round(heightDots * 0.1)}^BQN,2,6^FDQA,${serial}^FS
^FO0,${Math.round(heightDots * 0.72)}^FB${widthDots},1,0,C^A0N,40,30^FD${serial}^FS
^FO0,${Math.round(heightDots * 0.88)}^FB${widthDots},1,0,C^A0N,24,20^FD${orgSafe}^FS
^PQ1
^XZ`);
    } else {
      parts.push(`^XA
^PW${widthDots}
^LL${heightDots}
^FO${Math.round(widthDots * 0.05)},${Math.round(heightDots * 0.1)}^BCN,${Math.round(heightDots * 0.5)},Y,N,N^FD${serial}^FS
^FO0,${Math.round(heightDots * 0.78)}^FB${widthDots},1,0,C^A0N,40,30^FD${serial}^FS
^FO0,${Math.round(heightDots * 0.9)}^FB${widthDots},1,0,C^A0N,24,20^FD${orgSafe}^FS
^PQ1
^XZ`);
    }
  }
  return parts.join("\n");
}
