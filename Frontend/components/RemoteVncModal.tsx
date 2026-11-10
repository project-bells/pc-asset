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
  const [activeSession, setActiveSession] = useState<RemoteSessionLaunchResponse['session'] | null>(null);
  const [activeAuditLogId, setActiveAuditLogId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(60);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
  const vncStatus = asset.vnc_status || (online ? 'READY' : 'UNKNOWN');

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

      if (res.success && res.session) {
        setActiveSession(res.session);
        setActiveAuditLogId(res.auditLogId);
        setCountdown(res.session.expiresInSeconds || 60);
      } else {
        setError(res.message || 'ไม่สามารถสร้าง Remote Session ได้');
      }
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Guacamole Backend');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenNewWindow = () => {
    if (activeSession?.launchUrl) {
      window.open(
        activeSession.launchUrl,
        '_blank',
        'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'fixed inset-2 w-auto h-auto z-50'
            : activeSession
            ? 'max-w-6xl h-[85vh]'
            : 'max-w-2xl'
        }`}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-base">
                  Remote VNC Connection
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                  {asset.hostname}
                </span>
                {online ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online & Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <AlertCircle className="w-3 h-3" />
                    Offline / Stale Telemetry
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Target IP: {asset.ip_address || '127.0.0.1'} : {asset.vnc_port || 5900} | UltraVNC HTML5 Gateway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSession && (
              <>
                <button
                  onClick={handleOpenNewWindow}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="เปิดหน้าต่างแยก (Pop-out Window)"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Pop-out</span>
                </button>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  title={isFullscreen ? 'ย่อขนาด' : 'เต็มหน้าจอ'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-indigo-400" />
                  )}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!activeSession ? (
            /* CONFIGURATION & LAUNCH FORM */
            <>
              {/* Target PC Summary Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Asset Tag:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {asset.asset_tag || 'Unregistered'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">OS & Model:</span>
                  <span className="font-medium text-slate-200 truncate block" title={asset.os_name}>
                    {asset.os_name.replace('Microsoft ', '')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Assigned User:</span>
                  <span className="font-medium text-slate-200 truncate block">
                    {asset.assigned_user || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Location:</span>
                  <span className="text-slate-200 truncate block">
                    {asset.building || 'Main Campus'} {asset.room_name || ''}
                  </span>
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  โหมดการเข้าถึง (Remote Access Mode)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setAccessMode('FULL_CONTROL')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      accessMode === 'FULL_CONTROL'
                        ? 'bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500 text-white'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm flex items-center gap-2">
                        <Lock className="w-4 h-4 text-indigo-400" />
                        Full Control (ควบคุมเต็มรูปแบบ)
                      </span>
                      <input
                        type="radio"
                        name="accessMode"
                        checked={accessMode === 'FULL_CONTROL'}
                        onChange={() => setAccessMode('FULL_CONTROL')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      สามารถขยับเมาส์ พิมพ์คีย์บอร์ด และจัดการระบบได้เต็มรูปแบบ เหมาะสำหรับงาน Helpdesk และซ่อมบำรุง
                    </p>
                  </div>

                  <div
                    onClick={() => setAccessMode('VIEW_ONLY')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      accessMode === 'VIEW_ONLY'
                        ? 'bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500 text-white'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4 text-cyan-400" />
                        View Only (ดูหน้าจอเท่านั้น)
                      </span>
                      <input
                        type="radio"
                        name="accessMode"
                        checked={accessMode === 'VIEW_ONLY'}
                        onChange={() => setAccessMode('VIEW_ONLY')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      สังเกตการณ์หน้าจอโดยไม่ส่งการคลิกหรือพิมพ์ ปลอดภัยต่อความเป็นส่วนตัวของผู้ใช้งาน
                    </p>
                  </div>
                </div>
              </div>

              {/* Mandatory Reason Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    เหตุผลในการเข้าถึง (Mandatory Audit Reason) <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-xs text-slate-500 font-mono">
                    {accessReason.length} ตัวอักษร (ขั้นต่ำ 5)
                  </span>
                </div>

                {/* Quick Selection Pills */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {QUICK_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setAccessReason(reason)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                        accessReason === reason
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-200 text-sm placeholder:text-slate-600 outline-none resize-none transition-all"
                />
              </div>

              {/* Security & Audit Compliance Banner */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  <span className="font-semibold text-amber-300 block mb-0.5">
                    ISO 27001 & PDPA Audit Compliance Notice:
                  </span>
                  ทุกการเข้าถึงจะถูกบันทึกประวัติการเชื่อมต่อ ชื่อผู้เข้าใช้ เวลา และสร้างไฟล์บันทึกภาพหน้าจออัตโนมัติ (Session Recording) บน Guacamole Server เพื่อการตรวจสอบย้อนหลัง
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
                >
                  ยกเลิก (Cancel)
                </button>
                <button
                  type="button"
                  onClick={handleLaunch}
                  disabled={isLoading || accessReason.trim().length < 5}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:cursor-not-allowed"
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
            </>
          ) : (
            /* ACTIVE GUACAMOLE SESSION VIEWER */
            <div className="flex flex-col h-full space-y-3">
              {/* Session Control Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 shrink-0 text-xs">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Session Active</span>
                  </div>
                  <div className="text-slate-400 font-mono">
                    Audit ID: <span className="text-slate-200">{activeAuditLogId}</span>
                  </div>
                  <div className="text-slate-400">
                    Mode:{' '}
                    <span className="font-semibold text-indigo-300">
                      {activeSession.accessMode}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Token Handshake:</span>
                    <span
                      className={`font-bold ${
                        countdown < 15 ? 'text-rose-400 animate-pulse' : 'text-amber-300'
                      }`}
                    >
                      {countdown}s
                    </span>
                  </div>
                  <button
                    onClick={handleOpenNewWindow}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>เปิดเต็มหน้าต่างใหม่ (New Window)</span>
                  </button>
                </div>
              </div>

              {/* Embedded Guacamole HTML5 iFrame */}
              <div className="flex-1 min-h-[480px] bg-black rounded-xl border border-slate-800 overflow-hidden relative shadow-inner">
                <iframe
                  src={activeSession.launchUrl}
                  title={`Remote VNC - ${asset.hostname}`}
                  className="w-full h-full border-0 absolute inset-0"
                  allow="clipboard-read; clipboard-write; fullscreen"
                />
              </div>

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
