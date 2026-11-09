'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Printer,
  ArrowLeft,
  CheckSquare,
  Square,
  Search,
  Laptop,
  CheckCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { Asset } from '@/types/asset';
import QrCodeRenderer from '@/components/QrCodeRenderer';

export default function PrintQrPage() {
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['assets-for-print'],
    queryFn: () => apiClient.getAssets({ limit: 100 }),
  });

  const assets = data?.items || [];

  // Filter assets based on search
  const filteredAssets = assets.filter((a) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      a.hostname.toLowerCase().includes(s) ||
      (a.asset_tag && a.asset_tag.toLowerCase().includes(s)) ||
      a.pc_serial_number.toLowerCase().includes(s) ||
      (a.assigned_user && a.assigned_user.toLowerCase().includes(s))
    );
  });

  const toggleSelectAsset = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedAssetIds.length === filteredAssets.length) {
      setSelectedAssetIds([]);
    } else {
      setSelectedAssetIds(filteredAssets.map((a) => a.id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const printableAssets = assets.filter((a) =>
    selectedAssetIds.length > 0 ? selectedAssetIds.includes(a.id) : true
  );

  return (
    <div className="space-y-6">
      {/* Screen-Only Control Toolbar (Hidden when printing) */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/assets"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors border border-slate-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                <Printer className="w-6 h-6 text-indigo-400" />
                <span>Printable QR Sticker Sheet Generator</span>
              </h1>
              <p className="text-xs text-slate-400">
                Generate standard thermal or A4 sticker sheets (3x8 or 2x5 grid) encoded with mobile quick-action URLs.
              </p>
            </div>
          </div>

          <button
            onClick={handlePrint}
            disabled={printableAssets.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print {printableAssets.length} Stickers Now</span>
          </button>
        </div>

        {/* Filter and Selection Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filter by hostname, tag, or serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              {selectedAssetIds.length === filteredAssets.length && filteredAssets.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>Select All ({filteredAssets.length})</span>
                </>
              )}
            </button>
            <span className="text-xs font-mono text-slate-400">
              Selected: <strong className="text-indigo-400">{selectedAssetIds.length}</strong> of {filteredAssets.length}
            </span>
          </div>
        </div>

        {/* Quick Selection Pills */}
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
          {filteredAssets.map((asset) => {
            const isSelected = selectedAssetIds.includes(asset.id);
            return (
              <button
                key={asset.id}
                onClick={() => toggleSelectAsset(asset.id)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  isSelected
                    ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span className={isSelected ? 'text-indigo-400' : 'text-slate-600'}>
                  {isSelected ? '✓' : '+'}
                </span>
                <span>{asset.asset_tag || asset.hostname}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Print-Optimized Sticker Sheet Layout */}
      <div className="print-sheet-container bg-slate-950 print:bg-white p-2 print:p-0 rounded-xl border border-slate-800 print:border-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-3 print:gap-2">
          {printableAssets.map((asset) => {
            const scanUrl = `https://asset.company.local/scan/${asset.qr_code_token}`;
            return (
              <div
                key={asset.id}
                className="sticker-card bg-white text-slate-900 border border-slate-300 print:border-slate-800 rounded-lg p-3 flex flex-col justify-between shadow-sm page-break-inside-avoid relative overflow-hidden"
                style={{ minHeight: '185px' }}
              >
                {/* Header with Company Logo */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 print:border-black">
                  <div className="flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-indigo-700 print:text-black" />
                    <span className="text-[10px] font-black tracking-wider uppercase text-slate-800 print:text-black">
                      IT ASSET MANAGEMENT
                    </span>
                  </div>
                  <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 print:bg-transparent text-slate-600 print:text-black border border-slate-200 print:border-black">
                    PROPERTY OF CORP
                  </span>
                </div>

                {/* Body: QR Code and Tag Details */}
                <div className="flex items-center gap-3 py-2">
                  {/* QR Code Container */}
                  <div className="shrink-0 p-1 bg-white border border-slate-200 print:border-black rounded flex items-center justify-center">
                    <QrCodeRenderer value={scanUrl} size={92} includeMargin={false} />
                  </div>

                  {/* Asset Identifiers */}
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-500 print:text-black">
                      Official Asset Tag
                    </div>
                    <div className="text-base font-black font-mono text-slate-950 print:text-black tracking-tight leading-none truncate">
                      {asset.asset_tag || 'NOT BOUND'}
                    </div>

                    <div className="pt-1 text-[10px] space-y-0.5">
                      <div className="flex justify-between gap-1">
                        <span className="text-slate-500 print:text-black font-semibold">Host:</span>
                        <span className="font-mono font-bold text-slate-900 print:text-black truncate">
                          {asset.hostname}
                        </span>
                      </div>
                      <div className="flex justify-between gap-1">
                        <span className="text-slate-500 print:text-black font-semibold">S/N:</span>
                        <span className="font-mono text-slate-800 print:text-black truncate">
                          {asset.pc_serial_number}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Warning & Scan Instruction */}
                <div className="pt-1.5 border-t border-dashed border-slate-200 print:border-black flex items-center justify-between text-[8px] text-slate-500 print:text-black font-mono">
                  <span>DO NOT REMOVE</span>
                  <span className="font-bold">SCAN FOR AUDIT & PM</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Print Media Styles */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          aside, nav, header, button, .print\\:hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          .sticker-card {
            box-shadow: none !important;
            border: 1.5px solid #000000 !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

