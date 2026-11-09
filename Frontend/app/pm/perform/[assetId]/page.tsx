'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Wrench,
  Cpu,
  HardDrive,
  Network,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Check,
  Send,
  UserCheck,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import SignaturePad from '@/components/SignaturePad';

export default function SmartHybridPmPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const assetId = params?.assetId as string;

  // Form States: Section B (Physical Checklist)
  const [cleanCaseFan, setCleanCaseFan] = useState(false);
  const [cleanMonitorPeripherals, setCleanMonitorPeripherals] = useState(false);
  const [checkCables, setCheckCables] = useState(false);
  const [testUpsBattery, setTestUpsBattery] = useState(false);

  // Form States: Section C (Result & Sign-off)
  const [overallResult, setOverallResult] = useState<'PASS' | 'WARNING' | 'FAIL'>('PASS');
  const [technicianNotes, setTechnicianNotes] = useState('');
  const [userSignoffName, setUserSignoffName] = useState('');
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Section A: Fetch automated agent pre-fill diagnostics
  const {
    data: preFill,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['pm-prefill', assetId],
    queryFn: () => apiClient.getPmPreFill(assetId),
    enabled: !!assetId,
  });

  // PM Submission Mutation
  const pmMutation = useMutation({
    mutationFn: (payload: any) => apiClient.submitPm(payload),
    onSuccess: () => {
      setSubmitSuccess(true);
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ['pm-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
    onError: (err: any) => {
      setSubmitError(err.message || 'Failed to submit PM record.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureBase64) {
      setSubmitError('กรุณาลงลายมือชื่อดิจิทัล (Digital Signature is required).');
      return;
    }
    if (!userSignoffName.trim()) {
      setSubmitError('กรุณากรอกชื่อผู้ลงนามรับมอบงาน (Sign-off Name is required).');
      return;
    }

    pmMutation.mutate({
      assetId,
      overallResult,
      checklist: {
        physicalDusting: cleanCaseFan,
        cleanMonitorPeripherals,
        cablesSecured: checkCables,
        testUpsBattery,
        fansOperational: cleanCaseFan,
        osUpdatesApplied: !preFill?.autoDiagnostics.uptimeWarning,
        tempFilesCleaned: true,
        antivirusUpdated: true,
      },
      technicianNotes: technicianNotes.trim() || undefined,
      userSignoffName: userSignoffName.trim(),
      technicianSignatureBase64: signatureBase64,
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-3" />
        <p className="text-xs font-mono">Connecting to Windows Agent & querying real-time diagnostics...</p>
      </div>
    );
  }

  const diag = preFill?.autoDiagnostics;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/pm"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-cyan-400" />
              <span>Smart Hybrid PM Execution</span>
            </h1>
            <p className="text-xs text-slate-400">
              Endpoint: <strong className="text-slate-200 font-mono">{preFill?.hostname}</strong> ({preFill?.assetTag || 'Unregistered'})
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Refresh Live Agent</span>
        </button>
      </div>

      {submitSuccess ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-emerald-500/40 text-center space-y-4 shadow-xl">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-bold text-slate-100">Preventive Maintenance Completed!</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            บันทึกผลการบำรุงรักษาเชิงป้องกัน ตรวจเช็คฮาร์ดแวร์ และลายเซ็นส่งมอบงานเรียบร้อยแล้ว ระบบได้อัปเดตรอบ PM ครั้งถัดไปอัตโนมัติ
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/pm"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
            >
              Back to PM Queue
            </Link>
            <Link
              href="/scan"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md"
            >
              Scan Next Machine
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION A: Automated Agent Health Check (Read-Only) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Section A: Automated Agent Telemetry (Auto-Filled)
                </h2>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-semibold">
                Live WMI Sync
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* CPU & RAM */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    Processor & RAM
                  </span>
                  <span className="font-mono text-emerald-400 font-bold px-1.5 py-0.2 rounded bg-emerald-500/10">
                    PASS
                  </span>
                </div>
                <p className="text-slate-200 font-medium truncate">{diag?.cpuModel}</p>
                <p className="text-slate-400 text-[11px] font-mono">
                  Total Installed: <strong className="text-slate-200">{diag?.ramTotalGb} GB RAM</strong>
                </p>
              </div>

              {/* Disk & SMART */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                    <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                    Storage & S.M.A.R.T.
                  </span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.2 rounded ${
                      diag?.diskDiagnostics.isSmartHealthy
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-rose-400 bg-rose-500/10'
                    }`}
                  >
                    {diag?.diskDiagnostics.isSmartHealthy ? 'HEALTHY' : 'WARNING'}
                  </span>
                </div>
                <p className="text-slate-200 font-medium">
                  Drive {diag?.diskDiagnostics.driveLetter} Free: {diag?.diskDiagnostics.freeSpaceGb} GB ({diag?.diskDiagnostics.freeSpacePercent}%)
                </p>
                <p className="text-slate-400 text-[11px] font-mono">
                  S.M.A.R.T. Status: {diag?.diskDiagnostics.smartHealthStatus}
                </p>
              </div>

              {/* LAN Speed */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                    <Network className="w-3.5 h-3.5 text-amber-400" />
                    LAN Link Speed
                  </span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.2 rounded ${
                      diag?.isGigabitLan ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                    }`}
                  >
                    {diag?.lanLinkSpeedMbps} Mbps
                  </span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  {diag?.isGigabitLan
                    ? '1000 Mbps Gigabit Full Duplex Link'
                    : 'Degraded to 100 Mbps (Check patch cable or switch port)'}
                </p>
              </div>

              {/* Antivirus & Uptime */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    EDR Security & Uptime
                  </span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.2 rounded ${
                      diag?.uptimeWarning ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'
                    }`}
                  >
                    {diag?.uptimeDays}d Uptime
                  </span>
                </div>
                <p className="text-slate-200 font-medium">{diag?.antivirusStatus}</p>
                <p className="text-slate-400 text-[11px]">
                  {diag?.uptimeWarning ? 'Machine requires reboot for OS patches' : 'System reboot cycle healthy'}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION B: Physical Technician Checklist (Interactive Toggles) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-3.5">
            <div className="pb-2 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Section B: Physical Technician Checklist (Check All Applicable)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                รายการตรวจเช็คและทำความสะอาดอุปกรณ์ฮาร์ดแวร์ ณ จุดติดตั้งจริง
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Check 1 */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={cleanCaseFan}
                  onChange={(e) => setCleanCaseFan(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">
                    1. เป่าฝุ่นทำความสะอาดเคสและพัดลมระบายความร้อน (Clean Case & CPU Fan)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    กำจัดฝุ่นสะสมในช่องระบายอากาศ พัดลมระบายความร้อน และเช็คอุณหภูมิความร้อน
                  </span>
                </div>
              </label>

              {/* Check 2 */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={cleanMonitorPeripherals}
                  onChange={(e) => setCleanMonitorPeripherals(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">
                    2. ทำความสะอาดจอภาพ เมาส์ และคีย์บอร์ด (Clean Peripherals & Display)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    ใช้น้ำยาทำความสะอาดหน้าจอ ตรวจสอบปุ่มกดคีย์บอร์ด และเซนเซอร์เมาส์
                  </span>
                </div>
              </label>

              {/* Check 3 */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={checkCables}
                  onChange={(e) => setCheckCables(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">
                    3. จัดระเบียบสายไฟและตรวจสอบความแน่นของสาย LAN / Display (Cable Management)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    เสียบสายไฟแน่นหนา ไม่มีรอยหักงอหรือฉีกขาด จัดรัดสายใต้โต๊ะให้เรียบร้อย
                  </span>
                </div>
              </label>

              {/* Check 4 */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={testUpsBattery}
                  onChange={(e) => setTestUpsBattery(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">
                    4. ทดสอบการสำรองไฟของเครื่อง UPS (Manual UPS Battery Discharge Test)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    ทดสอบถอดปลั๊ก UPS เพื่อดูว่าแบตเตอรี่สำรองไฟได้ปกติ ไม่ตัดดับทันที
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* SECTION C: Issues, Result & Digital Sign-off */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
            <div className="pb-2 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Section C: Overall Result & Digital Sign-off
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ประเมินผลการตรวจโดยรวม บันทึกข้อสังเกต และเซ็นรับมอบงาน
              </p>
            </div>

            {/* Overall Result Radio Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Overall Maintenance Result
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOverallResult('PASS')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    overallResult === 'PASS'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  Pass (ปกติสมบูรณ์)
                </button>
                <button
                  type="button"
                  onClick={() => setOverallResult('WARNING')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    overallResult === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  Minor Issue (มีข้อสังเกต)
                </button>
                <button
                  type="button"
                  onClick={() => setOverallResult('FAIL')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    overallResult === 'FAIL'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500 shadow-sm shadow-rose-500/20'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  Needs Repair (ต้องส่งซ่อม)
                </button>
              </div>
            </div>

            {/* Technician Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Technician Observations & Action Notes
              </label>
              <textarea
                rows={2}
                value={technicianNotes}
                onChange={(e) => setTechnicianNotes(e.target.value)}
                placeholder="เช่น เปลี่ยนสาย LAN ใหม่เนื่องจากหัวหัก, แนะนำให้ผู้ใช้งานล้างไฟล์ดาวน์โหลด..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Sign-off Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                User / Employee Sign-off Name *
              </label>
              <input
                type="text"
                required
                value={userSignoffName}
                onChange={(e) => setUserSignoffName(e.target.value)}
                placeholder="ชื่อ-นามสกุล ผู้ใช้งานเครื่องที่รับมอบงาน"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* HTML5 Touch Signature Pad */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Touch Signature (ลายเซ็นผู้รับมอบงาน) *</span>
              </label>
              <SignaturePad onSignatureChange={setSignatureBase64} />
            </div>

            {submitError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={pmMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 shadow-lg shadow-indigo-600/30 transition-all"
            >
              {pmMutation.isPending ? (
                'Submitting PM Record & Signature...'
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit PM Sign-off & Update Schedule</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

