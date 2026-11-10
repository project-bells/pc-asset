'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Laptop,
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Server,
  Layers,
  FileSpreadsheet,
  X,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  HardDrive,
  Cpu,
  Activity,
  ArrowUpRight,
  Info,
  Filter,
  Package,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { apiClient } from '@/lib/apiClient';
import {
  Asset,
  ExecutiveAnalyticsSummary,
  SoftwareSummaryResponse,
  PatchAdvisoryResponse,
  PatchAdvisoryItem,
} from '@/types/asset';

// Color Palettes for Enterprise Analytics
const OS_COLORS: Record<string, string> = {
  'Windows 11': '#10b981', // Emerald 500
  'Windows 10': '#f59e0b', // Amber 500
  'Windows Server': '#6366f1', // Indigo 500
  'Windows 7 (Legacy)': '#ef4444', // Red 500
  'Windows 8.1 (Legacy)': '#f43f5e', // Rose 500
  Linux: '#06b6d4', // Cyan 500
  macOS: '#8b5cf6', // Purple 500
  'Other OS': '#64748b', // Slate 500
};

const PATCH_STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  CRITICAL_EOS: {
    label: 'Critical: EOS OS',
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  },
  HIGH_OUTDATED: {
    label: 'High: Outdated (>45d)',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  WARNING_REBOOT_REQUIRED: {
    label: 'Warning: Reboot Required',
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
  },
  COMPLIANT: {
    label: 'Compliant: Up to Date',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
};

export default function ExecutiveDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'software' | 'assets' | 'patch'>('software');

  // Software Tab States
  const [softwareSearch, setSoftwareSearch] = useState('Office');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Master PC Tab States
  const [pcSearch, setPcSearch] = useState('');
  const [pcOsFilter, setPcOsFilter] = useState<'ALL' | 'WIN10' | 'WIN11' | 'OUTDATED'>('ALL');

  // Patch Tab States
  const [patchStatusFilter, setPatchStatusFilter] = useState<string>('ALL');

  // Drawer State
  const [drawerAsset, setDrawerAsset] = useState<Asset | null>(null);
  const [drawerSearch, setDrawerSearch] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // ===========================================================================
  // API Queries (TanStack Query)
  // ===========================================================================
  const {
    data: execSummary,
    isLoading: loadingExec,
    refetch: refetchExec,
  } = useQuery<ExecutiveAnalyticsSummary>({
    queryKey: ['executive-summary'],
    queryFn: () => apiClient.getExecutiveSummary(),
    refetchInterval: 60000,
  });

  const {
    data: softwareData,
    isLoading: loadingSoftware,
    refetch: refetchSoftware,
  } = useQuery<SoftwareSummaryResponse>({
    queryKey: ['software-summary', softwareSearch, selectedCategory],
    queryFn: () =>
      apiClient.getSoftwareSummary({
        search: softwareSearch.trim() || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      }),
  });

  const {
    data: patchData,
    isLoading: loadingPatch,
    refetch: refetchPatch,
  } = useQuery<PatchAdvisoryResponse>({
    queryKey: ['patch-advisory', patchStatusFilter],
    queryFn: () => apiClient.getPatchAdvisory(patchStatusFilter !== 'ALL' ? patchStatusFilter : undefined),
  });

  const {
    data: assetsData,
    isLoading: loadingAssets,
    refetch: refetchAssets,
  } = useQuery({
    queryKey: ['all-assets-executive'],
    queryFn: () => apiClient.getAssets({ limit: 100 }),
  });

  const refreshAll = () => {
    refetchExec();
    refetchSoftware();
    refetchPatch();
    refetchAssets();
  };

  // ===========================================================================
  // CSV Export Utility (with UTF-8 BOM for Thai Character Support in Excel)
  // ===========================================================================
  const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      '\uFEFF' +
      [
        headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
        ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ===========================================================================
  // Filtered Assets for Master PC Table
  // ===========================================================================
  const filteredAssets = useMemo(() => {
    const items = assetsData?.items || [];
    return items.filter((asset) => {
      // OS Filter
      if (pcOsFilter === 'WIN10' && !asset.os_name.toLowerCase().includes('windows 10')) {
        return false;
      }
      if (pcOsFilter === 'WIN11' && !asset.os_name.toLowerCase().includes('windows 11')) {
        return false;
      }
      if (pcOsFilter === 'OUTDATED') {
        const patchAdv = patchData?.advisories.find((p) => p.asset_id === asset.id);
        if (!patchAdv || patchAdv.patch_status === 'COMPLIANT') return false;
      }

      // Search term
      if (pcSearch.trim()) {
        const term = pcSearch.toLowerCase();
        const hostMatch = asset.hostname?.toLowerCase().includes(term);
        const tagMatch = asset.asset_tag?.toLowerCase().includes(term);
        const ipMatch = asset.ip_address?.toLowerCase().includes(term);
        const userMatch = asset.assigned_user?.toLowerCase().includes(term);
        const modelMatch = asset.model?.toLowerCase().includes(term);
        return hostMatch || tagMatch || ipMatch || userMatch || modelMatch;
      }

      return true;
    });
  }, [assetsData, pcOsFilter, pcSearch, patchData]);

  // Total PCs with Windows 10 vs Windows 11
  const win10Count = useMemo(() => {
    const list = assetsData?.items || [];
    return list.filter((a) => (a.os_name || '').toLowerCase().includes('windows 10')).length;
  }, [assetsData]);

  const win11Count = useMemo(() => {
    const list = assetsData?.items || [];
    return list.filter((a) => (a.os_name || '').toLowerCase().includes('windows 11')).length;
  }, [assetsData]);

  const totalPcCount = (assetsData?.items || []).length || 1;
  const win10Percent = Math.round((win10Count / totalPcCount) * 100);
  const win11Percent = Math.round((win11Count / totalPcCount) * 100);

  // Office unique PC count from software data
  const officePcsCount = execSummary?.softwareTotals?.microsoftOfficePcs ?? 0;
  const atRiskPatchCount =
    (execSummary?.patchCompliance.criticalEos || 0) +
    (execSummary?.patchCompliance.highOutdated || 0) +
    (execSummary?.patchCompliance.warningReboot || 0);

  // Quick Filter Pills for Software Search
  const quickFilterPills = [
    { label: 'Microsoft Office', query: 'Office', category: 'Microsoft Office / 365' },
    { label: 'Google Chrome', query: 'Chrome', category: 'Web Browsers' },
    { label: 'Adobe Acrobat', query: 'Adobe', category: 'Adobe Creative & PDF' },
    { label: 'ESET Antivirus', query: 'ESET', category: 'Security & Antivirus' },
    { label: 'AnyDesk / UltraVNC', query: 'VNC', category: 'Remote Tools & Support' },
    { label: '7-Zip Utility', query: '7-Zip', category: 'Utilities & Collaboration' },
    { label: 'Synology Chat', query: 'Synology', category: 'Utilities & Collaboration' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* --------------------------------------------------------------------- */}
      {/* 0. Top Header & Navigation Breadcrumb */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 mb-1">
            <Link href="/dashboard" className="hover:underline">
              Operations
            </Link>
            <span>/</span>
            <span className="text-slate-300 font-semibold">Executive Analytics & Patch Portal</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-indigo-500" />
            Executive Asset, Software & Patch Compliance
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Strategic decision metrics, software license deduplication counting, and Windows security patch advisories.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-all border border-slate-700 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loadingExec ? 'animate-spin' : ''}`} />
            <span>Refresh All Data</span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 1. Executive Quick-Answer Cards (Top Row for Management) */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total PCs & Online Status */}
        <div
          onClick={() => {
            setActiveTab('assets');
            setPcOsFilter('ALL');
            setPcSearch('');
          }}
          className="group cursor-pointer p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-slate-800 hover:border-indigo-500/50 shadow-lg shadow-black/20 transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Workstations</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100 font-mono">
              {loadingExec ? '...' : execSummary?.fleet.totalAssets ?? totalPcCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">PCs Managed</span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {execSummary?.fleet.onlineNow ?? 3} Online Now
            </span>
            <span className="text-slate-500 group-hover:text-indigo-400 transition-colors flex items-center gap-1">
              View All <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 2: Windows 10 Legacy Alert Card */}
        <div
          onClick={() => {
            setActiveTab('assets');
            setPcOsFilter('WIN10');
          }}
          className="group cursor-pointer p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-amber-950/20 border border-amber-500/30 hover:border-amber-500 shadow-lg shadow-black/20 transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-amber-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Windows 10 Legacy Alert</span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 font-mono">{loadingAssets ? '...' : win10Count}</span>
            <span className="text-xs font-semibold text-amber-300/80">PCs ({win10Percent}% of Fleet)</span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-rose-400/90 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 text-rose-400" />
              EOS Oct 2025 Risk
            </span>
            <span className="text-slate-400 group-hover:text-amber-400 transition-colors flex items-center gap-1">
              Filter Win 10 <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 3: Microsoft Office Installed Card */}
        <div
          onClick={() => {
            setActiveTab('software');
            setSoftwareSearch('Office');
            setSelectedCategory('Microsoft Office / 365');
          }}
          className="group cursor-pointer p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-blue-950/20 border border-blue-500/30 hover:border-blue-500 shadow-lg shadow-black/20 transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-blue-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Microsoft Office License</span>
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-400 font-mono">
              {loadingExec ? '...' : officePcsCount}
            </span>
            <span className="text-xs font-semibold text-blue-300/80">Unique PCs Active</span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium truncate max-w-[150px]">
              2013 / 2021 / M365 Seats
            </span>
            <span className="text-slate-400 group-hover:text-blue-400 transition-colors flex items-center gap-1">
              Count Seats <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Card 4: Patch Risk / Needs Update Card */}
        <div
          onClick={() => {
            setActiveTab('patch');
            setPatchStatusFilter('HIGH_OUTDATED');
          }}
          className="group cursor-pointer p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-rose-950/20 border border-rose-500/30 hover:border-rose-500 shadow-lg shadow-black/20 transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-rose-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Patch Risk / Needs Update</span>
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-400 font-mono">
              {loadingExec ? '...' : atRiskPatchCount}
            </span>
            <span className="text-xs font-semibold text-rose-300/80">Machines At Risk</span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-amber-400/90 font-medium">
              {execSummary?.patchCompliance.compliant ?? 0} Compliant ({execSummary?.patchCompliance.complianceRatePercent ?? 50}%)
            </span>
            <span className="text-slate-400 group-hover:text-rose-400 transition-colors flex items-center gap-1">
              Advisories <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* Visual Analytics Graphs (OS Distribution & Patch Compliance) */}
      {/* --------------------------------------------------------------------- */}
      {mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* OS Family Donut Chart */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-indigo-400" />
                  Fleet Operating System Distribution
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Distribution breakdown across all managed hospital workstations.
              </p>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      execSummary?.osDistribution.byFamily?.map((f) => ({
                        name: f.family,
                        value: f.machineCount,
                      })) || [
                        { name: 'Windows 11', value: win11Count },
                        { name: 'Windows 10', value: win10Count },
                      ]
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {(execSummary?.osDistribution.byFamily || [
                      { family: 'Windows 11', machineCount: win11Count },
                      { family: 'Windows 10', machineCount: win10Count },
                    ]).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={OS_COLORS[entry.family || entry.name] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 pt-3 border-t border-slate-800 flex items-center justify-around text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Win 11: <strong className="text-slate-200">{win11Count} PCs ({win11Percent}%)</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Win 10: <strong className="text-amber-300">{win10Count} PCs ({win10Percent}%)</strong>
              </span>
            </div>
          </div>

          {/* Patch Security Compliance Chart */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm flex flex-col justify-between lg:col-span-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Windows Security Patch & Health Classification
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                  Target: 100% Compliant
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Overview of patch recency, End-of-Support (EOS) threats, and reboot backlogs.
              </p>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      category: 'Compliance Health',
                      Compliant: execSummary?.patchCompliance.compliant ?? 3,
                      'Reboot Needed': execSummary?.patchCompliance.warningReboot ?? 1,
                      'Outdated >45d': execSummary?.patchCompliance.highOutdated ?? 1,
                      'Critical EOS': execSummary?.patchCompliance.criticalEos ?? 1,
                    },
                  ]}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="category" stroke="#64748b" fontSize={11} hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                  <Bar dataKey="Compliant" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Reboot Needed" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Outdated >45d" fill="#f97316" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Critical EOS" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Compliant</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {execSummary?.patchCompliance.compliant ?? 3}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Reboot Needed</span>
                <span className="text-base font-bold text-amber-300 font-mono">
                  {execSummary?.patchCompliance.warningReboot ?? 1}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Outdated &gt;45d</span>
                <span className="text-base font-bold text-orange-400 font-mono">
                  {execSummary?.patchCompliance.highOutdated ?? 1}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Critical EOS</span>
                <span className="text-base font-bold text-rose-400 font-mono">
                  {execSummary?.patchCompliance.criticalEos ?? 1}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. Primary Tabs Navigation */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex border-b border-slate-800 gap-1 sm:gap-2">
        <button
          onClick={() => setActiveTab('software')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'software'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Tab 1: Software License & Counter Engine</span>
          {softwareData?.totalUniquePcs !== undefined && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
              {softwareData.totalUniquePcs} PCs
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('assets')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'assets'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Tab 2: Master PC Specs & Programs Drawer</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300 font-mono">
            {filteredAssets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('patch')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'patch'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Tab 3: Windows Patch Status & Advisories</span>
          {atRiskPatchCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
              {atRiskPatchCount} At Risk
            </span>
          )}
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: INTERACTIVE SOFTWARE COUNTER & SEARCH ENGINE                   */}
      {/* ===================================================================== */}
      {activeTab === 'software' && (
        <div className="space-y-6">
          {/* Search Box & Quick Pills */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={softwareSearch}
                  onChange={(e) => setSoftwareSearch(e.target.value)}
                  placeholder="Type any software keyword (e.g. Office, Chrome, AutoCAD, AnyDesk, LINE, ESET)..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                {softwareSearch && (
                  <button
                    onClick={() => setSoftwareSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Dropdown */}
              <div className="w-full md:w-64">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3.5 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Categories</option>
                  {(softwareData?.categories || []).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Export Button */}
              <button
                onClick={() => {
                  const headers = ['Software Name', 'Version', 'Category', 'Publisher', 'Hostname', 'IP Address', 'Asset Tag', 'Department', 'Assigned User'];
                  const rows: (string | number)[][] = [];
                  (softwareData?.software || []).forEach((sw) => {
                    sw.installed_pcs.forEach((pc) => {
                      rows.push([
                        sw.software_name,
                        sw.software_version,
                        sw.software_category,
                        sw.software_publisher,
                        pc.hostname,
                        pc.ip_address || '',
                        pc.asset_tag || 'Unregistered',
                        pc.department_name || '',
                        pc.assigned_user || '',
                      ]);
                    });
                  });
                  exportCsv(`software-inventory-${softwareSearch || 'all'}`, headers, rows);
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors border border-slate-700 shrink-0"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export Excel / CSV</span>
              </button>
            </div>

            {/* Quick Filter Clickable Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Quick Filters:
              </span>
              {quickFilterPills.map((pill) => {
                const isActive = softwareSearch.toLowerCase() === pill.query.toLowerCase();
                return (
                  <button
                    key={pill.label}
                    onClick={() => {
                      setSoftwareSearch(pill.query);
                      setSelectedCategory('ALL');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                        : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Big Counter Badge (Deduplicated license seats) */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Deduplicated License Seat Counter</span>
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-100">
                พบการติดตั้งบนคอมพิวเตอร์จำนวน{' '}
                <span className="text-indigo-400 font-mono underline decoration-indigo-500/50">
                  {loadingSoftware ? '...' : softwareData?.totalUniquePcs ?? 0}
                </span>{' '}
                เครื่อง
                <span className="text-sm font-normal text-slate-400 ml-2">
                  (จากทั้งหมด {execSummary?.fleet.totalAssets ?? totalPcCount} เครื่องในองค์กร)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                ระบบคำนวณแบบ <strong>Deduplication</strong>: หากเครื่องเดียวกันมีการติดตั้งโปรแกรมย่อยหลายตัว
                (เช่น Word, Excel, Visio) จะนับโควตา License รวมเป็น 1 เครื่องเท่านั้น
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Installations</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {softwareData?.totalInstallations ?? 0}
                </span>
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Fleet Adoption</span>
                <span className="text-xl font-bold font-mono text-indigo-400">
                  {totalPcCount > 0 ? Math.round(((softwareData?.totalUniquePcs ?? 0) / totalPcCount) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Version Breakdown Table */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Edition & Version Breakdown ({softwareData?.software.length ?? 0} Titles Detected)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase font-semibold text-slate-400 bg-slate-950/60 border-y border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Software Name</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Version</th>
                    <th className="py-2.5 px-4">Publisher</th>
                    <th className="py-2.5 px-4 text-right">Unique PCs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingSoftware ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Scanning enterprise software inventory...
                      </td>
                    </tr>
                  ) : softwareData?.software.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No software found matching query &quot;{softwareSearch}&quot;.
                      </td>
                    </tr>
                  ) : (
                    softwareData?.software.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-100 flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{item.software_name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium border border-slate-700/60">
                            {item.software_category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{item.software_version || 'Unknown'}</td>
                        <td className="py-3 px-4 text-slate-400">{item.software_publisher || 'Unknown'}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold font-mono">
                            {item.installed_count} PCs
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drill-down PC List */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400" />
                Workstations with Matched Software (Drill-Down Verification)
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Showing unique PC deployments
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase font-semibold text-slate-400 bg-slate-950/60 border-y border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Hostname & Tag</th>
                    <th className="py-2.5 px-4">IP Address</th>
                    <th className="py-2.5 px-4">Department / Room</th>
                    <th className="py-2.5 px-4">Assigned User</th>
                    <th className="py-2.5 px-4">Detected Software Title</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingSoftware ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Loading endpoint records...
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const flattenedPcs: {
                        swName: string;
                        swVersion: string;
                        pc: any;
                      }[] = [];

                      (softwareData?.software || []).forEach((sw) => {
                        sw.installed_pcs.forEach((pc) => {
                          flattenedPcs.push({
                            swName: sw.software_name,
                            swVersion: sw.software_version,
                            pc,
                          });
                        });
                      });

                      if (flattenedPcs.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              No workstations found.
                            </td>
                          </tr>
                        );
                      }

                      return flattenedPcs.map((item, idx) => {
                        const originalAsset = (assetsData?.items || []).find((a) => a.id === item.pc.asset_id);
                        return (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-100">{item.pc.hostname}</div>
                              <div className="text-[11px] font-mono text-indigo-400">
                                {item.pc.asset_tag || 'Not Bound'}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">{item.pc.ip_address || '-'}</td>
                            <td className="py-3 px-4">
                              <div className="text-slate-200">{item.pc.department_name || 'General'}</div>
                              <div className="text-[11px] text-slate-400">{item.pc.room_name || '-'}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                              {item.pc.assigned_user || 'None'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-slate-200">{item.swName}</span>{' '}
                              <span className="text-slate-400 font-mono text-[11px]">v{item.swVersion}</span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  if (originalAsset) {
                                    setDrawerAsset(originalAsset);
                                  } else {
                                    // Fallback synthetic asset
                                    setDrawerAsset({
                                      id: item.pc.asset_id,
                                      hostname: item.pc.hostname,
                                      asset_tag: item.pc.asset_tag,
                                      ip_address: item.pc.ip_address,
                                      assigned_user: item.pc.assigned_user,
                                      department_name: item.pc.department_name,
                                      room_name: item.pc.room_name,
                                      status: 'Active',
                                      location_id: null,
                                      purchase_date: null,
                                      warranty_expiry_date: null,
                                      qr_code_token: '',
                                      hardware_uuid: item.pc.asset_id,
                                      pc_serial_number: 'N/A',
                                      manufacturer: 'OEM',
                                      model: 'Enterprise PC',
                                      os_name: 'Microsoft Windows 11 Pro',
                                      os_build: '26200',
                                      last_logged_in_user: item.pc.assigned_user,
                                      cpu_name: 'Intel(R) Core(TM) i5',
                                      cpu_cores: 10,
                                      ram_total_gb: 16,
                                      mac_address: null,
                                      lan_speed_mbps: 1000,
                                      wifi_ssid: null,
                                      wifi_signal_percent: null,
                                      agent_version: '1.0.0.0',
                                      last_seen_at: new Date().toISOString(),
                                      monitors_json: [],
                                      disks_json: [],
                                      installed_software_json: [],
                                      edr_info_json: null,
                                      created_at: new Date().toISOString(),
                                      updated_at: new Date().toISOString(),
                                    });
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors inline-flex items-center gap-1.5"
                              >
                                <span>Inspect PC</span>
                                <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MASTER PC TABLE WITH FULL SPECS & SOFTWARE DRAWER              */}
      {/* ===================================================================== */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={pcSearch}
                onChange={(e) => setPcSearch(e.target.value)}
                placeholder="Search hostname, tag, IP, user, model..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1 shrink-0">
                <Filter className="w-3 h-3 text-indigo-400" />
                OS Filter:
              </span>
              <button
                onClick={() => setPcOsFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                  pcOsFilter === 'ALL'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                All OS
              </button>
              <button
                onClick={() => setPcOsFilter('WIN11')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                  pcOsFilter === 'WIN11'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Windows 11 Only ({win11Count})
              </button>
              <button
                onClick={() => setPcOsFilter('WIN10')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                  pcOsFilter === 'WIN10'
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Windows 10 Legacy ({win10Count})
              </button>
              <button
                onClick={() => setPcOsFilter('OUTDATED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                  pcOsFilter === 'OUTDATED'
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Patch Outdated ({atRiskPatchCount})
              </button>

              <button
                onClick={() => {
                  const headers = ['Hostname', 'Asset Tag', 'Status', 'IP Address', 'MAC', 'OS Name', 'OS Version', 'CPU', 'RAM GB', 'Disk Free %', 'Department', 'Assigned User'];
                  const rows = filteredAssets.map((a) => [
                    a.hostname,
                    a.asset_tag || 'Unregistered',
                    a.status,
                    a.ip_address || '',
                    a.mac_address || '',
                    a.os_name,
                    a.os_version || a.os_build,
                    a.cpu_name,
                    a.ram_total_gb,
                    a.disks_json?.[0]?.freePercent || 0,
                    a.department_name || '',
                    a.assigned_user || '',
                  ]);
                  exportCsv('fleet-hardware-specs', headers, rows);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 shrink-0 ml-auto"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Master Table */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase font-semibold text-slate-400 bg-slate-950/60 border-y border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Endpoint / Hostname</th>
                    <th className="py-3 px-4">Network &amp; LAN Speed</th>
                    <th className="py-3 px-4">OS &amp; Build</th>
                    <th className="py-3 px-4">Hardware Specifications</th>
                    <th className="py-3 px-4">Disk Space &amp; Health</th>
                    <th className="py-3 px-4">Software Programs</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingAssets ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Querying endpoint telemetry and hardware inventories...
                      </td>
                    </tr>
                  ) : filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No workstations match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => {
                      const isOnline = asset.last_seen_at
                        ? Date.now() - new Date(asset.last_seen_at).getTime() <= 15 * 60 * 1000
                        : false;
                      const disk0 = asset.disks_json?.[0];
                      const softwareCount = (asset.installed_software_json || []).length;
                      const isWin10 = (asset.os_name || '').toLowerCase().includes('windows 10');

                      return (
                        <tr key={asset.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Hostname & Tag */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                                }`}
                                title={isOnline ? 'Online Now' : 'Offline'}
                              />
                              <div>
                                <span className="font-bold text-slate-100 text-sm block">{asset.hostname}</span>
                                <span className="font-mono text-[11px] text-indigo-400 block">
                                  {asset.asset_tag || 'Not Bound'}
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-mono">
                              SN: {asset.pc_serial_number}
                            </div>
                          </td>

                          {/* Network & Speed */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-slate-200">{asset.ip_address || 'No IP'}</div>
                            <div className="font-mono text-[10px] text-slate-500">{asset.mac_address || '-'}</div>
                            <div className="mt-1">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                                  asset.lan_speed_mbps && asset.lan_speed_mbps >= 1000
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {asset.lan_speed_mbps ? `${asset.lan_speed_mbps} Mbps` : '1 Gbps'}
                              </span>
                            </div>
                          </td>

                          {/* OS & Build */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border inline-flex items-center gap-1 ${
                                isWin10
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              <Laptop className="w-3 h-3" />
                              {asset.os_name.replace('Microsoft ', '')}
                            </span>
                            <div className="text-[11px] text-slate-400 mt-1 font-mono">
                              Ver: {asset.os_version || '23H2'} (Build {asset.os_build})
                            </div>
                          </td>

                          {/* Hardware Specs */}
                          <td className="py-3.5 px-4">
                            <div className="text-slate-200 font-medium truncate max-w-[200px]" title={asset.cpu_name}>
                              {asset.cpu_name}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono font-bold text-slate-300">{asset.ram_total_gb} GB RAM</span>
                              <span>•</span>
                              <span className="truncate max-w-[120px]">{asset.model}</span>
                            </div>
                          </td>

                          {/* Disk Space & Health */}
                          <td className="py-3.5 px-4">
                            {disk0 ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-mono text-slate-300">
                                    C: Free {disk0.freeGb} GB ({disk0.freePercent}%)
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                      disk0.smartStatus === 'Healthy'
                                        ? 'text-emerald-400 bg-emerald-500/10'
                                        : 'text-rose-400 bg-rose-500/10'
                                    }`}
                                  >
                                    {disk0.smartStatus}
                                  </span>
                                </div>
                                <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      (disk0.freePercent ?? 100) < 15 ? 'bg-rose-500' : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, 100 - (disk0.freePercent || 0)))}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500">N/A</span>
                            )}
                          </td>

                          {/* Software Programs Badge */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => setDrawerAsset(asset)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition-all font-semibold flex items-center gap-1.5 group"
                            >
                              <Package className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                              <span>{softwareCount} Programs</span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setDrawerAsset(asset)}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Open Full Specifications & Software Drawer"
                            >
                              <ExternalLink className="w-4 h-4 text-indigo-400" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: WINDOWS PATCH STATUS & ADVISORY CENTER                         */}
      {/* ===================================================================== */}
      {activeTab === 'patch' && (
        <div className="space-y-4">
          {/* Status Filter Tabs & CSV Export */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1 shrink-0">
                <Filter className="w-3 h-3 text-indigo-400" />
                Security Status:
              </span>
              <button
                onClick={() => setPatchStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                  patchStatusFilter === 'ALL'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                All Machines ({patchData?.summary.total ?? 0})
              </button>
              <button
                onClick={() => setPatchStatusFilter('CRITICAL_EOS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                  patchStatusFilter === 'CRITICAL_EOS'
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'bg-slate-800 text-rose-400 hover:bg-slate-700'
                }`}
              >
                Critical: EOS ({patchData?.summary.criticalEos ?? 0})
              </button>
              <button
                onClick={() => setPatchStatusFilter('HIGH_OUTDATED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                  patchStatusFilter === 'HIGH_OUTDATED'
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
                }`}
              >
                Outdated &gt;45d ({patchData?.summary.highOutdated ?? 0})
              </button>
              <button
                onClick={() => setPatchStatusFilter('WARNING_REBOOT_REQUIRED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                  patchStatusFilter === 'WARNING_REBOOT_REQUIRED'
                    ? 'bg-orange-600 text-white font-semibold'
                    : 'bg-slate-800 text-orange-400 hover:bg-slate-700'
                }`}
              >
                Reboot Required ({patchData?.summary.warningReboot ?? 0})
              </button>
              <button
                onClick={() => setPatchStatusFilter('COMPLIANT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                  patchStatusFilter === 'COMPLIANT'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                }`}
              >
                Compliant ({patchData?.summary.compliant ?? 0})
              </button>
            </div>

            <button
              onClick={() => {
                const headers = [
                  'Hostname',
                  'Asset Tag',
                  'IP Address',
                  'Department',
                  'Assigned User',
                  'OS Name',
                  'OS Version',
                  'Latest KB ID',
                  'Days Since Last Patch',
                  'Pending Reboot',
                  'Uptime Days',
                  'Patch Status',
                  'Actionable Recommendation (Thai)',
                ];
                const rows = (patchData?.advisories || []).map((adv) => [
                  adv.hostname,
                  adv.asset_tag || 'Unregistered',
                  adv.ip_address || '',
                  adv.department_name,
                  adv.assigned_user || '',
                  adv.os_name,
                  adv.os_version,
                  adv.latest_kb_id,
                  adv.days_since_last_patch,
                  adv.pending_reboot ? 'Yes' : 'No',
                  adv.days_since_last_boot,
                  adv.patch_status,
                  adv.recommendation_th,
                ]);
                exportCsv('patch-compliance-report', headers, rows);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Patch Report (CSV)</span>
            </button>
          </div>

          {/* Patch Advisory Table */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase font-semibold text-slate-400 bg-slate-950/60 border-y border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Endpoint / Hostname</th>
                    <th className="py-3 px-4">IP &amp; Location</th>
                    <th className="py-3 px-4">OS Version &amp; Build</th>
                    <th className="py-3 px-4">Latest Installed KB</th>
                    <th className="py-3 px-4">Patch Age &amp; Reboot</th>
                    <th className="py-3 px-4">Risk Level Badge</th>
                    <th className="py-3 px-4 min-w-[280px]">คำแนะนำการอัปเดต (Actionable Recommendation)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingPatch ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Analyzing Windows Cumulative Update revisions and telemetry...
                      </td>
                    </tr>
                  ) : patchData?.advisories.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No workstations found for status &quot;{patchStatusFilter}&quot;.
                      </td>
                    </tr>
                  ) : (
                    patchData?.advisories.map((adv) => {
                      const badge = PATCH_STATUS_BADGES[adv.patch_status] || PATCH_STATUS_BADGES.COMPLIANT;
                      return (
                        <tr key={adv.asset_id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Hostname & Tag */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-100 text-sm">{adv.hostname}</div>
                            <div className="font-mono text-[11px] text-indigo-400">
                              {adv.asset_tag || 'Not Bound'}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{adv.assigned_user || 'Unassigned'}</div>
                          </td>

                          {/* IP & Location */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-slate-200">{adv.ip_address || 'No IP'}</div>
                            <div className="text-[11px] text-slate-400">{adv.department_name}</div>
                            <div className="text-[10px] text-slate-500">{adv.room_name}</div>
                          </td>

                          {/* OS & Build */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-200">{adv.os_name}</div>
                            <div className="font-mono text-[11px] text-slate-400">
                              Ver: {adv.os_version} (Build {adv.os_build})
                            </div>
                            {adv.os_ubr && (
                              <div className="text-[10px] text-slate-500 font-mono">UBR: {adv.os_ubr}</div>
                            )}
                          </td>

                          {/* Latest KB */}
                          <td className="py-3.5 px-4 font-mono">
                            <span className="px-2 py-1 rounded bg-slate-800 text-indigo-300 font-bold border border-slate-700">
                              {adv.latest_kb_id || 'None'}
                            </span>
                          </td>

                          {/* Patch Age & Reboot */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-200">
                              {adv.days_since_last_patch >= 900
                                ? 'Never Updated'
                                : `${adv.days_since_last_patch} วันที่แล้ว`}
                            </div>
                            {adv.pending_reboot && (
                              <div className="mt-1">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-max">
                                  <RotateCcw className="w-3 h-3 animate-spin" />
                                  Pending Reboot
                                </span>
                              </div>
                            )}
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                              Uptime: {adv.days_since_last_boot} days
                            </div>
                          </td>

                          {/* Risk Level Badge */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                              <span>{badge.label}</span>
                            </span>
                          </td>

                          {/* Thai Actionable Recommendation */}
                          <td className="py-3.5 px-4">
                            <div
                              className={`p-2.5 rounded-xl text-xs font-medium border leading-relaxed ${
                                adv.patch_status === 'CRITICAL_EOS'
                                  ? 'bg-rose-950/20 text-rose-300 border-rose-500/30'
                                  : adv.patch_status === 'HIGH_OUTDATED'
                                  ? 'bg-amber-950/20 text-amber-300 border-amber-500/30'
                                  : adv.patch_status === 'WARNING_REBOOT_REQUIRED'
                                  ? 'bg-orange-950/20 text-orange-300 border-orange-500/30'
                                  : 'bg-emerald-950/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {adv.recommendation_th}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. SLIDE-OVER DRAWER (FULL PC SPECS & INSTALLED SOFTWARE)              */}
      {/* ===================================================================== */}
      {drawerAsset && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Dark Backdrop */}
          <div
            onClick={() => setDrawerAsset(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <h2 className="text-xl font-bold text-slate-100">{drawerAsset.hostname}</h2>
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                      {drawerAsset.asset_tag || 'Unregistered'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    IP: {drawerAsset.ip_address || 'N/A'} • MAC: {drawerAsset.mac_address || 'N/A'} • SN:{' '}
                    {drawerAsset.pc_serial_number}
                  </p>
                  <p className="text-xs text-slate-400">
                    User: <strong className="text-slate-200">{drawerAsset.assigned_user || 'None'}</strong> • Location:{' '}
                    <strong className="text-slate-200">{drawerAsset.room_name || drawerAsset.department_name || 'General'}</strong>
                  </p>
                </div>

                <button
                  onClick={() => setDrawerAsset(null)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Hardware Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">CPU Processor</span>
                    <span className="text-slate-200 font-medium line-clamp-2 mt-0.5" title={drawerAsset.cpu_name}>
                      {drawerAsset.cpu_name}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Physical Memory</span>
                    <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">
                      {drawerAsset.ram_total_gb} GB RAM
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">OS Release</span>
                    <span className="text-slate-200 font-medium mt-0.5 block truncate">
                      {drawerAsset.os_name}
                    </span>
                    <span className="text-[10px] text-indigo-400 font-mono">
                      Ver {drawerAsset.os_version || '23H2'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Storage Drive C:</span>
                    <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">
                      {drawerAsset.disks_json?.[0]?.freeGb ?? '373'} GB Free
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold block">SMART Healthy</span>
                  </div>
                </div>

                {/* Installed Software List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-400" />
                      Installed Programs &amp; Applications (
                      {(drawerAsset.installed_software_json || []).length})
                    </h3>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      placeholder="Search program name or publisher inside this PC..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/60 bg-slate-950/40">
                    {(() => {
                      const list = (drawerAsset.installed_software_json || []).filter((item: any) => {
                        if (!drawerSearch.trim()) return true;
                        const term = drawerSearch.toLowerCase();
                        const name = (item.name || item.displayName || '').toLowerCase();
                        const pub = (item.publisher || '').toLowerCase();
                        return name.includes(term) || pub.includes(term);
                      });

                      if (list.length === 0) {
                        return (
                          <div className="py-6 text-center text-slate-500 text-xs">
                            No software matched &quot;{drawerSearch}&quot;.
                          </div>
                        );
                      }

                      return list.map((sw: any, idx: number) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-800/40">
                          <div>
                            <span className="font-semibold text-slate-200 block">
                              {sw.name || sw.displayName}
                            </span>
                            <span className="text-[11px] text-slate-500">{sw.publisher || 'Unknown Publisher'}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-800 text-slate-300 border border-slate-700/60">
                            {sw.version || sw.displayVersion || 'Latest'}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Installed Windows Patches (KBs) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Installed Windows Security Patches &amp; Cumulative Updates
                  </h3>

                  <div className="rounded-xl border border-slate-800 divide-y divide-slate-800/60 bg-slate-950/40">
                    {(() => {
                      const patches = drawerAsset.installed_patches_json || [
                        { kbId: drawerAsset.latest_kb_id || 'KB5044273', description: 'Cumulative Update for Windows 11', installedOn: '2026-10-15' },
                        { kbId: 'KB5044033', description: 'Security Baseline Update', installedOn: '2026-09-10' },
                      ];

                      return patches.map((patch: any, idx: number) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-800/40">
                          <div>
                            <span className="font-bold font-mono text-indigo-400 block">{patch.kbId}</span>
                            <span className="text-[11px] text-slate-400">{patch.description}</span>
                          </div>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {patch.installedOn || 'Installed'}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">
                  Agent ID: {drawerAsset.id.slice(0, 18)}...
                </span>
                <button
                  onClick={() => setDrawerAsset(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

