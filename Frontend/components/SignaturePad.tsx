'use client';

import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (base64Png: string | null) => void;
  width?: number;
  height?: number;
}

export default function SignaturePad({
  onSignatureChange,
  width = 400,
  height = 160,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set line appearance
    ctx.strokeStyle = '#0f172a'; // dark slate ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear background to white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prevent scrolling while drawing on touch devices
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export compact JPEG or PNG (< 100KB)
    const base64Data = canvas.toDataURL('image/png', 0.85);
    onSignatureChange(base64Data);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-slate-700 rounded-xl overflow-hidden bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-40 touch-none cursor-crosshair bg-white"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {!hasSignature && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 gap-1.5 opacity-60">
            <PenTool className="w-5 h-5 text-slate-400" />
            <span className="text-xs font-medium">ลายเซ็นผู้ใช้งาน / ช่างผู้ตรวจ (Sign here with finger or stylus)</span>
          </div>
        )}

        <div className="absolute bottom-2 left-4 right-4 pointer-events-none border-b border-slate-300" />
      </div>

      <div className="flex justify-between items-center px-1">
        <span className="text-[11px] text-slate-400">
          {hasSignature ? '✓ Signature recorded (< 100KB Base64)' : 'Awaiting sign-off stroke'}
        </span>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasSignature}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 disabled:opacity-30 transition-colors py-1 px-2 rounded bg-slate-800/80 border border-slate-700"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear Signature</span>
        </button>
      </div>
    </div>
  );
}

