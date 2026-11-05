import QRCode from "qrcode";

/** A QR code for a stamper label: opens the dashboard's activation form. */
export function labelQr(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 240 });
}
