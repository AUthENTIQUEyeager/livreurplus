"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const ELEMENT_ID = "qr-scanner-zone";

export default function QRScanner({
  onScan,
  onClose,
}: {
  onScan: (texte: string) => void;
  onClose: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const dejaLuRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(ELEMENT_ID);
    scannerRef.current = scanner;
    dejaLuRef.current = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (texteDecoded) => {
          if (dejaLuRef.current) return;
          dejaLuRef.current = true;
          onScan(texteDecoded);
        },
        () => {
          // erreur de lecture image par image : ignorée, normal tant que rien n'est cadré
        }
      )
      .catch(() => {
        onClose();
      });

    return () => {
      scanner.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-4">
      <div id={ELEMENT_ID} className="w-full max-w-sm overflow-hidden rounded-xl" />
      <button
        type="button"
        onClick={onClose}
        className="mt-4 rounded-md bg-white px-4 py-2 text-sm font-medium text-ink"
      >
        Annuler
      </button>
    </div>
  );
}