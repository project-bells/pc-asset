'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QrCodeRendererProps {
  value: string;
  size?: number;
  includeMargin?: boolean;
  className?: string;
}

export default function QrCodeRenderer({
  value,
  size = 120,
  includeMargin = true,
  className = '',
}: QrCodeRendererProps) {
  return (
    <div className={`inline-flex items-center justify-center bg-white p-1 rounded-md ${className}`}>
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={includeMargin}
      />
    </div>
  );
}

