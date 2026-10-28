"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Generates the QR locally (no external API). `path` is turned into an absolute URL. */
export function QrCode({ path, size = 112, label }: { path: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = path.startsWith("http") ? path : `${window.location.origin}${path}`;
    QRCode.toDataURL(url, { margin: 1, width: size * 2, errorCorrectionLevel: "M", color: { dark: "#0b0b0f", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [path, size]);
  if (!src) return <div className="sk" style={{ width: size, height: size }} aria-label={label} role="img" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={label} style={{ width: size, height: size }} />;
}

export function QrCard({ path, title, subtitle }: { path: string; title: string; subtitle: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <QrCode path={path} size={96} label={`${title} QR code`} />
      <div className="min-w-0">
        <p className="eb">QR verification</p>
        <p className="h3 mt-1">{title}</p>
        <p className="mono mut m-0 mt-1 break-all text-[12.5px]">{subtitle}</p>
      </div>
    </div>
  );
}
