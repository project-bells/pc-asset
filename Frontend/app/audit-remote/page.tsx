'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  Search,
  Download,
  Filter,
  RefreshCw,
  Clock,
  User,
  Monitor,
  Lock,
  Eye,
  FileSpreadsheet,
  CheckCircle2,
  FileVideo,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { RemoteAccessLogItem } from '@/types/asset';

export default function RemoteAuditPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'FULL_CONTROL' | 'VIEW_ONLY'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['remoteAccessLogs', searchTerm, page],
    queryFn: () => apiClient.getRemoteAccessLogs({ search: searchTerm, page, limit: pageSize }),
    refetchInterval: 30000,
  });

  const rawLogs: RemoteAccessLogItem[] = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: pageSize, total: rawLogs.length, totalPages: 1 };

  // Filter logs locally if mode filter is applied
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((log) => {
      if (modeFilter !== 'ALL' && log.access_mode !== modeFilter) {
        return false;
      }
      return true;
    });
  }, [rawLogs, modeFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = pagination.total || rawLogs.length;
    const fullControl = rawLogs.filter((l) => l.access_mode === 'FULL_CONTROL').length;
    const viewOnly = rawLogs.filter((l) => l.access_mode === 'VIEW_ONLY').length;
    const uniqueTechs = new Set(rawLogs.map((l) => l.technician_username)).size;
    return { total, fullControl, viewOnly, uniqueTechs };
  }, [rawLogs, pagination.total]);

  // Export CSV with UTF-8 BOM for Thai language compatibility
  const handleExportCsv = () => {
    if (!rawLogs.length) return;

    const headers = [
      'Audit Log ID',
      'Timestamp',
      'Hostname',
      'Asset Tag',
      'Target IP',
      'Technician Username',
      'Technician User ID',
      'Access Mode',
      'Access Reason',
      'Building / Location',
      'Department',
      'Recording Filename',
      'Client Source IP',
    ];

    const rows = rawLogs.map((log) => [
      `"${log.id}"`,
      `"${new Date(log.created_at).toLocaleString('th-TH')}"`,
      `"${log.hostname}"`,
      `"${log.asset_tag || ''}"`,
      `"${log.target_ip}"`,
      `"${log.technician_username}"`,
      `"${log.technician_user_id}"`,
      `"${log.access_mode}"`,
      `"${(log.access_reason || '').replace(/"/g, '""')}"`,
      `"${log.building || ''} ${log.room_name || ''}"`,
      `"${log.department_name || ''}"`,
      `"${log.recording_filename || ''}"`,
      `"${log.client_source_ip}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Remote_VNC_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-indigo-400" />
              Remote Access Audit & Compliance
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              ISO 27001 / PDPA
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            บันทึกประวัติการเชื่อมต่อ UltraVNC ผ่าน Apache Guacamole พร้อม Session Recording สำหรับการตรวจสอบความมั่นคงปลอดภัย
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!rawLogs.length}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Total Remote Sessions</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">
            {stats.total.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">รวมประวัติการเข้าถึงทั้งหมด</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Full Control Sessions</span>
            <Lock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-400 font-mono">
            {stats.fullControl.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">ควบคุมเมาส์และคีย์บอร์ด</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>View Only Sessions</span>
            <Eye className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-cyan-400 font-mono">
            {stats.viewOnly.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">ดูหน้าจออย่างเดียว (Privacy Safe)</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Active Technicians</span>
            <User className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-300 font-mono">
            {stats.uniqueTechs.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">ช่าง/ผู้ดูแลระบบที่บันทึกไว้</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="ค้นหา Hostname, IP, ชื่อช่าง, หรือเหตุผล..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            Mode:
          </span>
          <button
            onClick={() => setModeFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              modeFilter === 'ALL'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setModeFilter('FULL_CONTROL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              modeFilter === 'FULL_CONTROL'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-800 text-indigo-400 hover:bg-slate-700'
            }`}
          >
            Full Control
          </button>
          <button
            onClick={() => setModeFilter('VIEW_ONLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              modeFilter === 'VIEW_ONLY'
                ? 'bg-cyan-600 text-white font-semibold'
                : 'bg-slate-800 text-cyan-400 hover:bg-slate-700'
            }`}
          >
            View Only
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Target Machine</th>
                <th className="py-3 px-4">Technician</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Access Reason & Purpose</th>
                <th className="py-3 px-4">Session Recording File</th>
                <th className="py-3 px-4 text-right">Client IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    กำลังดึงข้อมูล Audit Logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    ไม่พบบันทึกประวัติการรีโมทตามเงื่อนไขที่ค้นหา
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono text-slate-200">
                        {new Date(log.created_at).toLocaleDateString('th-TH', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-600" />
                        {new Date(log.created_at).toLocaleTimeString('th-TH')}
                      </div>
                    </td>

                    {/* Target Machine */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-200 font-mono flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                        {log.hostname}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        IP: {log.target_ip} {log.asset_tag ? `| Tag: ${log.asset_tag}` : ''}
                      </div>
                    </td>

                    {/* Technician */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-200 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {log.technician_username}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        UID: {log.technician_user_id.slice(0, 12)}
                      </div>
                    </td>

                    {/* Mode */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {log.access_mode === 'FULL_CONTROL' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3 text-indigo-400" />
                          Full Control
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1">
                          <Eye className="w-3 h-3 text-cyan-400" />
                          View Only
                        </span>
                      )}
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-slate-300 text-xs leading-relaxed line-clamp-2" title={log.access_reason}>
                        {log.access_reason}
                      </p>
                    </td>

                    {/* Session Recording */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                        <FileVideo className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate max-w-[140px]" title={log.recording_filename}>
                          {log.recording_filename}
                        </span>
                      </div>
                    </td>

                    {/* Client Source IP */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      {log.client_source_ip}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing {filteredLogs.length} of {pagination.total} records (Page {pagination.page} of {pagination.totalPages || 1})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono px-2">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
              disabled={page >= (pagination.totalPages || 1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

