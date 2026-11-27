"use client";

import { useEffect, useRef, useState } from "react";

// The browser's own barcode reader (Chrome on Android, which most counters
// use). Where it is missing, the scan button is hidden and staff type the code.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function QrScanner({ onScan }: { onScan: (value: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  useEffect(() => {
    if (!open) return;

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          if (!videoRef.current) return;
          const codes = await detector.detect(videoRef.current).catch(() => []);
          if (codes[0]?.rawValue) {
            onScan(codes[0].rawValue.trim());
            setOpen(false);
          }
        }, 300);
      } catch {
        setError("Could not open the camera. Type the code instead.");
        setOpen(false);
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, onScan]);

  if (!supported) return null;

  return (
    <div className="space-y-2">
      {open ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-square w-full rounded-2xl bg-black object-cover"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full text-sm text-ink-500"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="w-full rounded-xl border border-ink-300 bg-white py-3 text-sm font-medium hover:bg-ink-50"
        >
          📷 Scan with camera
        </button>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
