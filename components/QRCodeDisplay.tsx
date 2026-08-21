"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRCodeDisplay({ data, size = 220 }: { data: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    QRCode.toDataURL(data, { width: size, margin: 1 })
      .then((url) => {
        if (!annule) setDataUrl(url);
      })
      .catch(() => {
        if (!annule) setDataUrl(null);
      });
    return () => {
      annule = true;
    };
  }, [data, size]);

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-mist text-xs text-ink/40"
        style={{ width: size, height: size }}
      >
        Génération du QR…
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="QR code de confirmation de livraison" width={size} height={size} className="rounded-xl" />;
}