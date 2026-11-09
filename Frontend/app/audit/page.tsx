'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileCheck, ShieldCheck, QrCode, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

export default function AuditPage() {
  const { data: auditSummary, isLoading } = useQuery({
    queryKey: ['audit-progress'],
    queryFn: () => apiClient.getAuditProgress(),
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <FileCheck className="w-6 h-6 text-emerald-400" />
            <span>Annual Stocktake & Physical Audit</span>
          </h1>
          <p className="text-sm text-slate-400">
            Dual-mode audit campaign reconciles automated Windows Agent heartbeats with physical QR tag scans.
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Campaign Status: Active (FY2026)
        </span>
      </div>

      {/* Campaign Progress Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 font-medium uppercase">Total Scope</span>
          <div className="text-2xl font-bold text-slate-100 font-mono mt-1">
            {auditSummary?.totalAssets || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Corporate Inventory</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-emerald-400 font-medium uppercase flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            Agent Auto-Verified
          </span>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {auditSummary?.agentVerified || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Confirmed via Active Domain</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-indigo-400 font-medium uppercase flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5" />
            Physical QR Scan
          </span>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">
            {auditSummary?.qrScanned || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Technician On-Site Scans</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-amber-400 font-medium uppercase flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Pending Verification
          </span>
          <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
            {auditSummary?.pending || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Offline & Awaiting QR Scan</p>
        </div>
      </div>

      {/* Progress Bar Container */}
      {auditSummary && (
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300">Overall Audit Completion Rate</span>
            <span className="font-mono font-bold text-emerald-400">{auditSummary.progressPercent}%</span>
          </div>
          <div className="h-3.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${(auditSummary.agentVerified / auditSummary.totalAssets) * 100}%` }}
              className="bg-emerald-500 h-full"
              title="Agent Verified"
            />
            <div
              style={{ width: `${(auditSummary.qrScanned / auditSummary.totalAssets) * 100}%` }}
              className="bg-indigo-500 h-full"
              title="QR Scanned"
            />
          </div>
          <p className="text-xs text-slate-400">
            Assets not detected by the Windows Agent within 30 days are automatically escalated for mandatory physical QR scan.
          </p>
        </div>
      )}
    </div>
  );
}

