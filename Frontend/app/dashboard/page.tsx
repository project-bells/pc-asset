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
  Sparkles,
  BarChart2,
  Wifi,
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
      {/* Top Header with Glassmorphic Flair */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Operations &amp; Security Overview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time endpoint telemetries, stocktake audit progress, and hardware health alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/executive"
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 rounded-xl transition-all shadow-lg shadow-blue-600/20 border border-white/10"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Executive Analytics &amp; Patch Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-900/60 hover:bg-slate-800/80 rounded-xl transition-all border border-white/10 backdrop-blur-md"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (5 key metrics in Glassy Blue & Emerald Design) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Assets (Ocean Blue Glass) */}
        <div className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-blue-500/30 shadow-lg shadow-black/20 relative overflow-hidden group transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Total Endpoints</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
            {loadingKpis ? '...' : kpis?.totalAssets ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Managed Workstations &amp; Laptops</p>
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Online Now (Emerald Green Glass) */}
        <div className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-emerald-500/40 shadow-lg shadow-black/20 relative overflow-hidden group transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Online Now</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform flex items-center justify-center">
              <Wifi className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight flex items-baseline gap-2">
            <span>{loadingKpis ? '...' : kpis?.onlineNow ?? 0}</span>
            <span className="text-xs font-sans font-medium text-emerald-300/80">Active</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span>Seen within last 15 min</span>
          </p>
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-emerald-500/15 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Unregistered PCs (Amber Glass) */}
        <Link
          href="/assets?status=Unregistered"
          className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-amber-500/40 shadow-lg shadow-black/20 transition-all relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Unregistered</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono tracking-tight">
            {loadingKpis ? '...' : kpis?.unregistered ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Awaiting Tag Binding</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
        </Link>

        {/* Critical Alerts (Rose Glass) */}
        <Link
          href="/alerts"
          className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-rose-500/40 shadow-lg shadow-black/20 transition-all relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">Hardware Alerts</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-400 font-mono tracking-tight">
            {loadingKpis ? '...' : kpis?.criticalAlerts ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>RAM/Display Tamper</span>
            <ArrowRight className="w-3.5 h-3.5 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
        </Link>

        {/* Urgent PM (Cyan/Teal Glass) */}
        <Link
          href="/pm"
          className="p-4 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 hover:border-cyan-500/40 shadow-lg shadow-black/20 transition-all relative overflow-hidden group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Urgent PM</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-cyan-400 font-mono tracking-tight">
            {loadingKpis ? '...' : kpis?.urgentPm ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Needs Maintenance</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
        </Link>
      </div>

      {/* Main Grid: Hygiene Alerts & Annual Stocktake Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Hygiene Alerts (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">Automated System Hygiene Alerts</h3>
                <p className="text-xs text-slate-400">High uptime (&gt;30d), disk space &lt;15%, degraded LAN speed</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              {hygieneAlerts?.length ?? 0} Issues
            </span>
          </div>

          <div className="divide-y divide-white/5 space-y-1">
            {loadingHygiene ? (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">Running automated diagnostics...</div>
            ) : hygieneAlerts && hygieneAlerts.length > 0 ? (
              hygieneAlerts.slice(0, 6).map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs hover:bg-white/[0.03] px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-slate-950/60 border border-white/10 shrink-0">
                      {getHygieneIcon(item.issueType)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200 flex items-center gap-2">
                        <span>{item.hostname}</span>
                        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-500/20">
                          {item.assetTag || 'Unregistered'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{item.detail}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-white/10 font-mono">
                      {item.metricValue || item.assignedUser || 'Warning'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-emerald-400 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 opacity-80" />
                <span>All workstations are running within optimal health thresholds.</span>
              </div>
            )}
          </div>
        </div>

        {/* Annual Audit & Preventive Maintenance Progress (1 Col) */}
        <div className="space-y-6">
          {/* Audit Progress Card */}
          <div className="rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                Annual Stocktake 2026
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {auditSummary?.progressPercent ?? 100}% Complete
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Physical inventory verification via mobile QR code scan.
            </p>

            {/* Progress Bar with Blue-to-Emerald Gradient */}
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/10 mb-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500 shadow-sm shadow-emerald-400/30"
                style={{ width: `${Math.min(100, auditSummary?.progressPercent ?? 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
              <span>Status: <strong className="text-emerald-300">In Progress</strong></span>
              <Link href="/audit" className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1">
                <span>View Details</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Quick Remote Access Action Card */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-950/40 to-emerald-950/30 backdrop-blur-xl border border-blue-500/20 p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-blue-500/20 text-cyan-300 border border-blue-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-100">Apache Guacamole Gateway</h3>
            </div>
            <p className="text-xs text-slate-300/90 leading-relaxed mb-4">
              Secure HTML5 UltraVNC remote support with ISO 27001 encrypted session recording.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/audit-remote"
                className="flex-1 text-center py-2 px-3 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-xs border border-white/10 shadow-sm transition-all"
              >
                Audit Logs
              </Link>
              <Link
                href="/assets"
                className="flex-1 text-center py-2 px-3 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold text-xs border border-white/10 shadow-sm transition-all"
              >
                Launch VNC
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
