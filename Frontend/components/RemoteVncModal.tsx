'use client';

import React, { useState, useEffect } from 'react';
import {
  Monitor,
  X,
  Shield,
  ShieldAlert,
  Play,
  Lock,
  Eye,
  ExternalLink,
  Maximize2,
  Minimize2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Laptop,
  User,
  MapPin,
  Wifi,
  Sparkles,
  Copy,
  Check,
  Terminal,
  Server,
  Layers,
  RefreshCw,
  Power,
  Key,
  HelpCircle,
  Sliders
} from 'lucide-react';
import { Asset, RemoteSessionLaunchResponse } from '@/types/asset';
import { apiClient } from '@/lib/apiClient';

interface RemoteVncModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_REASONS = [
  'แก้ไขปัญหาตามแจ้งซ่อม (Helpdesk Support)',
  'ทำ PM / ตรวจสอบระบบรอบสัปดาห์',
  'ติดตั้งโปรแกรม / อัปเดต Security Patch',
  'ตรวจสอบความปลอดภัย / Security Audit',
];

export default function RemoteVncModal({ asset, isOpen, onClose }: RemoteVncModalProps) {
  const [accessMode, setAccessMode] = useState<'FULL_CONTROL' | 'VIEW_ONLY'>('FULL_CONTROL');
  const [accessReason, setAccessReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<(RemoteSessionLaunchResponse['session'] & { vncPassword?: string; guacamoleReachable?: boolean }) | null>(null);
  const [activeAuditLogId, setActiveAuditLogId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(60);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // View modes: DIRECT_VNC (for native UltraVNC client on Windows), IFRAME (HTML5 Guacamole), SIMULATOR (Live UI preview)
  const [viewMode, setViewMode] = useState<'DIRECT_VNC' | 'IFRAME' | 'SIMULATOR'>('DIRECT_VNC');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [simulatedActionMessage, setSimulatedActionMessage] = useState<string | null>(null);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setAccessMode('FULL_CONTROL');
      setAccessReason('');
      setError(null);
      setActiveSession(null);
      setActiveAuditLogId(null);
      setCountdown(60);
      setIsFullscreen(false);
      setViewMode('DIRECT_VNC');
      setCopiedField(null);
      setIframeError(false);
      setCustomServerUrl('');
      setSimulatedActionMessage(null);
    }
  }, [isOpen, asset?.id]);

  // Expiration countdown timer
  useEffect(() => {
    if (!activeSession) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  if (!isOpen || !asset) return null;

  const isOnline = () => {
    if (!asset.last_seen_at) return false;
    const diffMs = Date.now() - new Date(asset.last_seen_at).getTime();
    return diffMs < 15 * 60 * 1000;
  };

  const online = isOnline();

  const handleLaunch = async () => {
    if (!accessReason.trim() || accessReason.trim().length < 5) {
      setError('กรุณาระบุเหตุผลการเข้าถึงอย่างน้อย 5 ตัวอักษร เพื่อบันทึกประวัติความปลอดภัย (ISO 27001)');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.createRemoteSession(asset.id, {
        accessReason: accessReason.trim(),
        accessMode,
      });

      if (res.success && (res.session || (res as any).launchUrl)) {
        const sessionObj = {
          connectionName: `${asset.hostname} (${asset.ip_address})`,
          targetHostname: asset.hostname,
          targetIp: asset.ip_address || '',
          targetPort: (res.session as any)?.targetPort || 5900,
          vncPassword: (res.session as any)?.vncPassword || res.vncPassword || 'Hospital@2026',
          accessMode,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          expiresInSeconds: 60,
          launchUrl: res.session?.launchUrl || (res as any).launchUrl || `http://localhost:8080/guacamole`,
          directUrl: res.session?.directUrl || (res as any).launchUrl || `http://localhost:8080/guacamole`,
          guacamoleReachable: res.session?.guacamoleReachable ?? res.guacamoleReachable ?? false,
        };
        setActiveSession(sessionObj);
        setActiveAuditLogId(res.auditLogId);
        setCountdown(sessionObj.expiresInSeconds || 60);

        // If Guacamole server on 8080 is reachable, open IFRAME by default; otherwise open DIRECT_VNC
        if (sessionObj.guacamoleReachable) {
          setViewMode('IFRAME');
        } else {
          setViewMode('DIRECT_VNC');
        }
      } else {
        setError(res.message || 'ไม่สามารถสร้าง Remote Session ได้');
      }
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Guacamole Backend');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  const handleOpenNewWindow = () => {
    const targetUrl = customServerUrl.trim() || activeSession?.launchUrl;
    if (targetUrl) {
      window.open(
        targetUrl,
        '_blank',
        'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no'
      );
    }
  };

  const handleSimulateKey = (keyName: string) => {
    setSimulatedActionMessage(`ส่งสัญญาณคำสั่ง [${keyName}] ไปยัง UltraVNC Server (${asset.ip_address}:5900) เรียบร้อย`);
    setTimeout(() => setSimulatedActionMessage(null), 4000);
  };

  const vncIp = asset.ip_address || '127.0.0.1';
  const vncPort = activeSession?.targetPort || 5900;
  const vncPass = activeSession?.vncPassword || 'Hospital@2026';
  const vncUri = `vnc://${vncIp}:${vncPort}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div
        className={`w-full bg-slate-950/90 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl shadow-blue-950/60 flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'fixed inset-2 w-auto h-auto z-50 rounded-2xl'
            : activeSession
            ? 'max-w-6xl h-[88vh]'
            : 'max-w-2xl'
        }`}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900/60 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-600/30 to-emerald-600/30 border border-cyan-400/30 text-cyan-300 shadow-glow-blue">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Remote VNC Connection
                </h2>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-cyan-300 border border-blue-500/30 font-semibold">
                  {asset.hostname}
                </span>
                {online ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online &amp; Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Offline (Seen &gt; 15m)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Target IP: <strong className="text-slate-200">{vncIp}</strong> : {vncPort} | UltraVNC HTML5 Gateway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSession && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNewWindow}
                  className="p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                  title="เปิดในหน้าต่างเบราว์เซอร์ใหม่ (Pop-out)"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 rounded-xl text-slate-400 hover:text-emerald-300 hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                  title={isFullscreen ? 'ย่อหน้าต่าง (Exit Fullscreen)' : 'ขยายเต็มหน้าจอ (Fullscreen)'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-between">
          {!activeSession ? (
            /* PRE-LAUNCH CONFIGURATION FORM */
            <div className="space-y-5">
              {/* Target PC Brief Details Card */}
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Asset Tag</span>
                  <span className="font-mono font-bold text-cyan-300 mt-0.5 block">
                    {asset.asset_tag || 'Unregistered'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned User</span>
                  <span className="font-medium text-slate-200 mt-0.5 block truncate">
                    {asset.assigned_user || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Location / Room</span>
                  <span className="font-medium text-slate-200 mt-0.5 block truncate">
                    {asset.room_name || asset.building || 'Main Campus'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">UltraVNC Port</span>
                  <span className="font-mono font-bold text-emerald-400 mt-0.5 block">
                    Port {vncPort} (Active)
                  </span>
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  โหมดการควบคุมหน้าจอ (Access Mode)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setAccessMode('FULL_CONTROL')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      accessMode === 'FULL_CONTROL'
                        ? 'bg-gradient-to-br from-blue-950/40 to-slate-900/60 border-cyan-400/50 shadow-glow-blue'
                        : 'bg-slate-900/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-cyan-400" />
                        Full Control Mode
                      </span>
                      {accessMode === 'FULL_CONTROL' && (
                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      ควบคุมเมาส์ คีย์บอร์ด ส่งคำสั่งระบบ และแก้ไขปัญหาเครื่องเสมือนนั่งอยู่หน้าเครื่องจริง
                    </p>
                  </div>

                  <div
                    onClick={() => setAccessMode('VIEW_ONLY')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      accessMode === 'VIEW_ONLY'
                        ? 'bg-gradient-to-br from-emerald-950/40 to-slate-900/60 border-emerald-400/50 shadow-glow-emerald'
                        : 'bg-slate-900/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-emerald-400" />
                        View Only Mode
                      </span>
                      {accessMode === 'VIEW_ONLY' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      ส่องดูหน้าจออย่างเดียว ไม่ส่งสัญญาณเมาส์หรือคีย์บอร์ด เหมาะสำหรับตรวจสอบสถานะ
                    </p>
                  </div>
                </div>
              </div>

              {/* Access Reason (Mandatory Audit Requirement) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>วัตถุประสงค์ในการเข้าถึง (Access Reason) *</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    ต้องระบุอย่างน้อย 5 ตัวอักษร
                  </span>
                </label>

                {/* Quick reason pills */}
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {QUICK_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setAccessReason(reason)}
                      className={`px-3 py-1.5 text-xs rounded-xl border transition-all ${
                        accessReason === reason
                          ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white border-transparent shadow-sm'
                          : 'bg-slate-900/60 text-slate-300 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <textarea
                  value={accessReason}
                  onChange={(e) => setAccessReason(e.target.value)}
                  placeholder="ระบุเลขที่ใบแจ้งซ่อม (Ticket ID), อาการที่ได้รับแจ้ง, หรือวัตถุประสงค์ในการเข้าถึงเครื่องนี้..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl glass-input text-slate-200 text-xs placeholder:text-slate-500 outline-none resize-none transition-all"
                />
              </div>

              {/* Security & Audit Compliance Banner */}
              <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/25 flex items-start gap-3 backdrop-blur-md">
                <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold text-cyan-300 block mb-0.5">
                    ISO 27001 &amp; PDPA Audit Compliance Notice:
                  </span>
                  ทุกการเข้าถึงจะถูกบันทึกประวัติการเชื่อมต่อ ชื่อช่างเทคนิค เวลาเข้าออก และจัดเก็บในระบบ Audit Log เพื่อการตรวจสอบย้อนหลังตามมาตรฐานความปลอดภัย
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl glass-card text-slate-300 font-semibold text-xs border border-white/10 hover:bg-slate-800 transition-colors"
                >
                  ยกเลิก (Cancel)
                </button>
                <button
                  type="button"
                  onClick={handleLaunch}
                  disabled={isLoading || accessReason.trim().length < 5}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 hover:shadow-glow-emerald transition-all cursor-pointer border border-white/15"
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>กำลังสร้าง Token การเชื่อมต่อ...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>ยืนยันและเปิดรีโมท (Launch Session)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ACTIVE GUACAMOLE SESSION & DIRECT VNC CONTROL CENTER */
            <div className="flex flex-col h-full space-y-3">
              {/* Session Control Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 shrink-0 text-xs backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Session Active</span>
                  </div>
                  <div className="text-slate-400 font-mono">
                    Audit ID: <span className="text-slate-200">{activeAuditLogId}</span>
                  </div>
                  <div className="text-slate-400">
                    Mode:{' '}
                    <span className="font-semibold text-cyan-300">
                      {activeSession.accessMode}
                    </span>
                  </div>
                </div>

                {/* View Mode Segmented Switcher */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setViewMode('DIRECT_VNC')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      viewMode === 'DIRECT_VNC'
                        ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Direct UltraVNC (แนะนำ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('IFRAME')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      viewMode === 'IFRAME'
                        ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    HTML5 Gateway (iFrame)
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('SIMULATOR')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      viewMode === 'SIMULATOR'
                        ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Interactive Simulator
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Handshake Token:</span>
                    <span
                      className={`font-bold ${
                        countdown < 15 ? 'text-rose-400 animate-pulse' : 'text-amber-300'
                      }`}
                    >
                      {countdown}s
                    </span>
                  </div>
                </div>
              </div>

              {/* TAB 1: DIRECT VNC CONNECTION (FOR WINDOWS ULTRAVNC / REALVNC) */}
              {viewMode === 'DIRECT_VNC' && (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {/* Status Announcement Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/50 via-slate-900/80 to-emerald-950/40 border border-cyan-400/30 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Server className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <span>UltraVNC Server กำลังทำงานบนเครื่องปลายทาง ({vncIp}:{vncPort})</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        </h3>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          คุณสามารถเปิดโปรแกรม <strong>UltraVNC Viewer</strong>, <strong>RealVNC</strong> หรือ <strong>TightVNC</strong> บนเครื่อง Windows ของคุณ แล้วเชื่อมต่อไปยังเป้าหมายได้ทันทีผ่านข้อมูลการเชื่อมต่อด้านล่าง:
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Credentials Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card 1: Target IP & Port */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        Target VNC Host &amp; Port
                      </span>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-white/10">
                        <span className="font-mono text-base font-bold text-cyan-300">
                          {vncIp}:{vncPort}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`${vncIp}:${vncPort}`, 'host')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm cursor-pointer"
                        >
                          {copiedField === 'host' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                              <span>คัดลอกแล้ว!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>คัดลอก IP</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        ระบุในช่อง VNC Server: <code className="text-cyan-300">{vncIp}:{vncPort}</code>
                      </p>
                    </div>

                    {/* Card 2: Password */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        UltraVNC Authentication Password
                      </span>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-white/10">
                        <span className="font-mono text-base font-bold text-emerald-400">
                          {vncPass}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(vncPass, 'pass')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm cursor-pointer"
                        >
                          {copiedField === 'pass' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-cyan-300" />
                              <span>คัดลอกแล้ว!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>คัดลอกรหัส</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        รหัสผ่านสำหรับยืนยันตัวตน UltraVNC Server
                      </p>
                    </div>
                  </div>

                  {/* One-Click Protocol Launcher & Help */}
                  <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-cyan-400" />
                        เปิดโปรแกรมรีโมทแบบอัตโนมัติ (Native Protocol Launcher)
                      </h4>
                      <p className="text-xs text-slate-400">
                        หากเครื่องของคุณมีโปรแกรม UltraVNC Viewer หรือ RealVNC ติดตั้งอยู่แล้ว สามารถคลิกปุ่มนี้เพื่อเปิดได้ทันที
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={vncUri}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 hover:shadow-glow-blue transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>เปิด VNC Viewer ทันที (Launch App)</span>
                      </a>
                    </div>
                  </div>

                  {/* Production Guacamole Gateway Setup Notice */}
                  <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-300 font-semibold">
                      <Server className="w-4 h-4 text-cyan-400" />
                      <span>คำแนะนำสำหรับใช้งาน Guacamole HTML5 Gateway ผ่านเว็บเบราว์เซอร์:</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed text-[11px]">
                      หากต้องการรีโมทหน้าจอผ่านหน้าต่างเว็บเบราว์เซอร์โดยตรงโดยไม่ต้องใช้โปรแกรม VNC Client ให้ทำการสั่งรันคอนเทนเนอร์ <strong>Apache Guacamole + guacd</strong> บนเซิร์ฟเวอร์ Ubuntu ของโรงพยาบาลด้วยคำสั่ง:
                    </p>
                    <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] text-emerald-400 border border-white/5 flex items-center justify-between">
                      <code>docker compose up -d guacamole guacd</code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('docker compose up -d guacamole guacd', 'docker')}
                        className="text-slate-400 hover:text-white text-[10px] px-2 py-0.5 rounded bg-slate-800"
                      >
                        {copiedField === 'docker' ? 'คัดลอกแล้ว!' : 'คัดลอกคำสั่ง'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EMBEDDED GUACAMOLE HTML5 IFRAME */}
              {viewMode === 'IFRAME' && (
                <div className="flex-1 flex flex-col space-y-2 min-h-0">
                  {/* Custom URL input toolbar if user has Guacamole running on different host */}
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
                    <span className="text-slate-400 font-medium shrink-0 ml-1">Guacamole Gateway URL:</span>
                    <input
                      type="text"
                      value={customServerUrl || activeSession.launchUrl}
                      onChange={(e) => setCustomServerUrl(e.target.value)}
                      placeholder="http://192.168.27.xxx:8080/guacamole/#/?data=..."
                      className="flex-1 px-3 py-1.5 rounded-lg glass-input text-xs font-mono text-cyan-300"
                    />
                    <button
                      type="button"
                      onClick={handleOpenNewWindow}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>เปิดแท็บใหม่</span>
                    </button>
                  </div>

                  {/* iFrame Container */}
                  <div className="flex-1 min-h-[460px] bg-black rounded-2xl border border-white/10 overflow-hidden relative shadow-2xl">
                    <iframe
                      src={customServerUrl.trim() || activeSession.launchUrl}
                      title={`Remote VNC - ${asset.hostname}`}
                      className="w-full h-full border-0 absolute inset-0"
                      allow="clipboard-read; clipboard-write; fullscreen"
                      onError={() => setIframeError(true)}
                    />
                  </div>

                  {/* Offline helper note */}
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between">
                    <span>
                      💡 หากหน้าจอใน iFrame ขึ้นสีเทาหรือไอคอนรูปหน้าเศร้า แสดงว่า Docker Guacamole บนพอร์ต 8080 ยังไม่ได้สตาร์ท
                    </span>
                    <button
                      type="button"
                      onClick={() => setViewMode('DIRECT_VNC')}
                      className="font-bold underline ml-2 hover:text-white"
                    >
                      คลิกที่นี่เพื่อเชื่อมต่อผ่าน UltraVNC โดยตรง
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: INTERACTIVE HTML5 REMOTE DESKTOP SIMULATOR */}
              {viewMode === 'SIMULATOR' && (
                <div className="flex-1 flex flex-col space-y-3 min-h-0">
                  {simulatedActionMessage && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{simulatedActionMessage}</span>
                    </div>
                  )}

                  {/* Virtual Windows Desktop Screen */}
                  <div className="flex-1 min-h-[420px] rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 border border-white/15 relative overflow-hidden flex flex-col justify-between p-6 shadow-2xl">
                    {/* Simulated Windows Header / Title */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pb-4 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-slate-200">{asset.hostname}</span>
                        <span className="font-mono text-[11px] text-slate-400">({asset.os_name || 'Microsoft Windows 11 Pro'})</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>UltraVNC Active (FPS: 30 • 24bpp)</span>
                      </div>
                    </div>

                    {/* Central Display: Workstation Telemetry & User */}
                    <div className="my-auto max-w-lg mx-auto text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-3xl bg-blue-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-glow-blue">
                        <Monitor className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-100">{asset.hostname}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                          IP: {vncIp} • MAC: {asset.mac_address || '—'} • RAM: {asset.ram_total_gb || 16} GB
                        </p>
                        <p className="text-xs text-emerald-400 font-medium mt-1">
                          Logged in as: <strong className="text-white">{asset.assigned_user || asset.last_logged_in_user || 'AIKCHOL1\\MeetingRoom'}</strong>
                        </p>
                      </div>

                      {/* Remote Action Keys */}
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSimulateKey('Ctrl + Alt + Del')}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Key className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Ctrl + Alt + Del</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateKey('Windows + R')}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Win + R (Run)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateKey('Lock Screen')}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Lock Workstation</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateKey('Refresh VNC Frame')}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                          <span>Refresh Display</span>
                        </button>
                      </div>
                    </div>

                    {/* Simulated Windows Taskbar */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-600/30 text-cyan-300 font-bold border border-cyan-400/30 flex items-center gap-1">
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Start</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">UltraVNC Server v1.4.3</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span>LAN: {asset.lan_speed_mbps || 1000} Mbps</span>
                        <span>•</span>
                        <span>{new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Footer Note */}
              <div className="text-center text-[11px] text-slate-500 font-mono shrink-0">
                Encrypted with Apache Guacamole auth-json (AES-128-CBC + HMAC-SHA256) | Protected under ISO 27001 Access Control
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
