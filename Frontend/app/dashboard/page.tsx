'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Server,
  Activity,
  AlertTriangle,
  HelpCircle,
  Wrench,
  CheckCircle2,
  HardDrive,
  Network,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { SystemHygieneAlert } from '@/types/asset';

export default function DashboardPage() {
  const {
    data: kpis,
    isLoading: loadingKpis,
    refetch: refetchKpis,
  } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => apiClient.getDashboardKpis(),
  });

  const {
    data: hygieneAlerts,
    isLoading: loadingHygiene,
    refetch: refetchHygiene,
  } = useQuery({
    queryKey: ['hygiene-alerts'],
    queryFn: () => apiClient.getHygieneAlerts(),
  });

  const {
    data: auditSummary,
    isLoading: loadingAudit,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['audit-progress'],
    queryFn: () => apiClient.getAuditProgress(),
  });

  const refreshAll = () => {
    refetchKpis();
    refetchHygiene();
    refetchAudit();
  };

  const getHygieneIcon = (type: SystemHygieneAlert['issueType']) => {
    switch (type) {
      case 'LOW_DISK':
        return <HardDrive className="w-4 h-4 text-rose-400" />;
      case 'UNHEALTHY_SMART':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'DEGRADED_LAN':
        return <Network className="w-4 h-4 text-amber-400" />;
      case 'HIGH_UPTIME':
        return <Clock className="w-4 h-4 text-sky-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Executive & Operations Dashboard</h1>
          <p className="text-sm text-slate-400">
            Real-time endpoint telemetries, stocktake audit progress, and hardware health alerts.
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards (5 key metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Assets */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Endpoints</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            {loadingKpis ? '...' : kpis?.totalAssets ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">Managed Workstations & Laptops</p>
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Online Now */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Online Now</span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {loadingKpis ? '...' : kpis?.onlineNow ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1">Reported within last 15 min</p>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Unregistered PCs */}
        <Link
          href="/assets?status=Unregistered"
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 shadow-sm transition-all relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">Unregistered</span>
            <HelpCircle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {loadingKpis ? '...' : kpis?.unregistered ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>Awaiting Tag Binding</span>
            <ArrowRight className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </Link>

        {/* Critical Alerts */}
        <Link
          href="/alerts"
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-rose-500/50 shadow-sm transition-all relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">Hardware Alerts</span>
            <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            {loadingKpis ? '...' : kpis?.criticalAlerts ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>RAM/Display Tamper</span>
            <ArrowRight className="w-3 h-3 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
        </Link>

        {/* Urgent PM */}
        <Link
          href="/pm"
          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 shadow-sm transition-all relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Urgent PM</span>
            <Wrench className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono">
            {loadingKpis ? '...' : kpis?.urgentPm ?? 0}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>Maintenance Queue</span>
            <ArrowRight className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
        </Link>
      </div>

      {/* Middle Section: Audit Progress Widget */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-slate-100">
                {auditSummary?.name || 'Annual Stocktake Audit Campaign'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Dual-verification engine combining Windows Agent auto-checks with physical technician QR scans.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Total Assets: {auditSummary?.totalAssets ?? 0}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {auditSummary?.progressPercent ?? 0}% Complete
            </span>
          </div>
        </div>

        {/* Visual Multi-Segment Progress Bar */}
        {auditSummary && (
          <div className="space-y-3">
            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
              {/* Agent Verified (Emerald) */}
              <div
                style={{
                  width: `${(auditSummary.agentVerified / auditSummary.totalAssets) * 100}%`,
                }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`Agent Auto-Verified: ${auditSummary.agentVerified}`}
              />
              {/* QR Scanned (Indigo) */}
              <div
                style={{
                  width: `${(auditSummary.qrScanned / auditSummary.totalAssets) * 100}%`,
                }}
                className="bg-indigo-500 h-full transition-all duration-500"
                title={`Physical QR Scanned: ${auditSummary.qrScanned}`}
              />
              {/* Pending (Slate/Remaining) */}
              <div
                style={{
                  width: `${(auditSummary.pending / auditSummary.totalAssets) * 100}%`,
                }}
                className="bg-slate-700/60 h-full transition-all duration-500"
                title={`Pending Verification: ${auditSummary.pending}`}
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Agent Auto-Verified:</span>
                <strong className="text-slate-200 font-mono">{auditSummary.agentVerified}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <span>QR Physical Scan:</span>
                <strong className="text-slate-200 font-mono">{auditSummary.qrScanned}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                <span>Pending Verification:</span>
                <strong className="text-slate-200 font-mono">{auditSummary.pending}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: System Hygiene Alerts Widget */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              <span>System Hygiene & Operational Risk Monitor</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated triggers on Disk Space &lt;15%, S.M.A.R.T. failures, degraded NIC speed, or excessive uptime.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {hygieneAlerts?.length ?? 0} Endpoints Flagged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Endpoint / Tag</th>
                <th className="py-3 px-4">Assigned User</th>
                <th className="py-3 px-4">Issue Category</th>
                <th className="py-3 px-4">Metric Value</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingHygiene ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Scanning endpoint metrics...
                  </td>
                </tr>
              ) : hygieneAlerts && hygieneAlerts.length > 0 ? (
                hygieneAlerts.map((alert) => (
                  <tr key={alert.assetId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200 font-mono">{alert.hostname}</div>
                      <div className="text-[11px] text-slate-400">{alert.assetTag || 'Unregistered'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {alert.assignedUser || <span className="text-slate-600">Unassigned</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium">
                        {getHygieneIcon(alert.issueType)}
                        <span className="text-slate-200">{alert.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-bold ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {alert.metricValue}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-md truncate" title={alert.detail}>
                      {alert.detail}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/assets?search=${encodeURIComponent(alert.hostname)}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                      >
                        Inspect PC
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>All endpoints comply with healthy operational thresholds.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

