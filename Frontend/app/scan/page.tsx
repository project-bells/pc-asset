'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  QrCode,
  Flashlight,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Upload,
} from 'lucide-react';

export default function MobileScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Start mobile camera stream with environment/rear facing preference
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API is not supported in this browser environment.');
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setHasCamera(true);
          setIsScanning(true);
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setCameraError(err.message || 'Unable to access rear camera.');
        setHasCamera(false);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleProcessToken = (tokenOrUrl: string) => {
    let cleanToken = tokenOrUrl.trim();
    if (cleanToken.includes('/scan/')) {
      const parts = cleanToken.split('/scan/');
      cleanToken = parts[parts.length - 1].split('?')[0];
    }
    if (cleanToken) {
      router.push(`/scan/${encodeURIComponent(cleanToken)}`);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken) {
      handleProcessToken(manualToken);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-400" />
          <span>Mobile Asset Scanner</span>
        </h1>
        <p className="text-xs text-slate-400">
          Point camera at the QR sticker on the chassis for 1-Tap Audit and Smart PM.
        </p>
      </div>

      {/* Camera Viewfinder */}
      <div className="relative aspect-square w-full rounded-2xl bg-black border-2 border-indigo-500/60 overflow-hidden shadow-2xl flex items-center justify-center">
        {hasCamera ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-6 space-y-3">
            <Camera className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 max-w-xs">
              {cameraError || 'Camera preview not available. You can use manual code input or test tokens below.'}
            </p>
          </div>
        )}

        {/* Reticle / Viewfinder Frame */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-56 h-56 border-2 border-indigo-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(99,102,241,0.25)]">
            {/* Corner highlights */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />

            {/* Scanning Line Animation */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_#6366f1] animate-[pulse_2s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* Bottom Tag Line */}
        <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
          <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur text-[10px] font-mono text-slate-300 border border-slate-700">
            Center QR Code in box
          </span>
        </div>
      </div>

      {/* Manual Input & Token Simulation */}
      <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
          Manual Token / QR Code Entry
        </span>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. QR-UUID-001-TOKEN or Scan URL..."
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all"
          >
            <span>Go</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Quick Demo Shortcuts */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
          <span className="block font-medium text-slate-400">Quick Test Stickers:</span>
          <div className="flex flex-wrap gap-1.5 font-mono">
            <button
              onClick={() => handleProcessToken('QR-B1F601-GM119Q7N')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition-colors"
            >
              B1F601 (Lenovo i5-14400)
            </button>
            <button
              onClick={() => handleProcessToken('QR-B1F101-NEW')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
            >
              B1F101-RECEPT (Unregistered)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
