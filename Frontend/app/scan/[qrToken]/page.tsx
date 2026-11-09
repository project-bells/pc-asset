'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  MapPin,
  User,
  Monitor,
  Wrench,
  ArrowLeft,
  ShieldCheck,
  Clock,
  Check,
  Building,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { AuditVerifyPayload } from '@/types/asset';

export default function MobileScanDetailHub() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const qrToken = params?.qrToken as string;

  const [verifiedLocationId, setVerifiedLocationId] = useState<string>('');
  const [discrepancyNote, setDiscrepancyNote] = useState<string>('');
  const [auditSuccessMsg, setAuditSuccessMsg] = useState<string | null>(null);
  const [auditErrorMsg, setAuditErrorMsg] = useState<string | null>(null);

  // Fetch asset metadata via QR token
  const {
    data: assetData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['scan-asset', qrToken],
    queryFn: async () => {
      const res = await apiClient.scanQrToken(qrToken);
      if (res?.location?.locationId) {
        setVerifiedLocationId(res.location.locationId);
      }
      return res;
    },
    enabled: !!qrToken,
  });

  // Fetch location options for location discrepancy confirmation
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => apiClient.getLocations(),
  });

  // Mutation: Confirm Physical Audit
  const auditMutation = useMutation({
    mutationFn: (payload: AuditVerifyPayload) => apiClient.verifyAudit(payload),
    onSuccess: (data) => {
      setAuditSuccessMsg('Physical Stocktake Audit verified and logged successfully!');
      setAuditErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['scan-asset', qrToken] });
      queryClient.invalidateQueries({ queryKey: ['audit-progress'] });
    },
    onError: (err: any) => {
      setAuditErrorMsg(err.message || 'Failed to submit physical audit.');
    },
  });

  const handleConfirmAudit = () => {
    if (!assetData) return;
    const campaignId = assetData.auditStatus.activeCampaignId || 'camp-2024-annual';

    auditMutation.mutate({
      campaignId,
      assetId: assetData.assetId,
      verifiedLocationId: verifiedLocationId || assetData.location.locationId,
      discrepancyNote: discrepancyNote.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto p-12 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-3" />
        <p className="text-xs font-mono">Querying endpoint telemetry by QR token...</p>
      </div>
    );
  }

  if (!assetData) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-100">QR Code Not Recognized</h2>
        <p className="text-xs text-slate-400">
          The scanned token <code className="text-rose-300 font-mono">{qrToken}</code> does not match any registered endpoint asset.
        </p>
        <Link
          href="/scan"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Scan Another QR Code</span>
        </Link>
      </div>
    );
  }

  const isLocationDiscrepant =
    verifiedLocationId && verifiedLocationId !== assetData.location.locationId;

  return (
    <div className="max-w-md mx-auto space-y-5 pb-8">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/scan"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Scanner</span>
        </Link>
        <span className="text-[11px] font-mono text-slate-500">Token: {qrToken.slice(0, 14)}...</span>
      </div>

      {/* Main Asset Status Card */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  assetData.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span className="font-bold text-base text-slate-100 font-mono">
                {assetData.hostname}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{assetData.model}</p>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {assetData.assetTag || 'NO TAG'}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1 font-mono">
              SN: {assetData.serialNumber}
            </span>
          </div>
        </div>

        {/* Assigned User and IP */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-slate-500 text-[10px] uppercase font-semibold flex items-center gap-1 mb-1">
              <User className="w-3 h-3 text-indigo-400" />
              Assigned User
            </span>
            <p className="text-slate-200 font-medium truncate">
              {assetData.assignedUser || 'Unassigned'}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-slate-500 text-[10px] uppercase font-semibold flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-emerald-400" />
              Last Seen Telemetry
            </span>
            <p className="text-slate-200 font-medium font-mono text-[11px]">
              {assetData.isOnline ? 'Online Now' : new Date(assetData.lastSeenAt || '').toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Connected Monitors Verification Badge */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs space-y-1.5">
          <span className="text-slate-400 text-[11px] font-semibold uppercase flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-amber-400" />
            <span>Agent-Reported Connected Displays (Verify Physical S/N):</span>
          </span>
          {assetData.monitors && assetData.monitors.length > 0 ? (
            assetData.monitors.map((mon, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1 px-2 rounded bg-slate-900 border border-slate-800 text-[11px]"
              >
                <span className="text-slate-300 font-medium">
                  {mon.manufacturer} {mon.model}
                </span>
                <span className="font-mono text-amber-300 font-semibold">{mon.serialNumber}</span>
              </div>
            ))
          ) : (
            <p className="text-slate-500 text-[11px]">No external monitor detected by agent.</p>
          )}
        </div>
      </div>

      {/* ACTION MODE 1: Annual Stocktake Physical Verification */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-indigo-900/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Action Mode 1: Annual Stocktake Audit
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
            One-Tap Audit
          </span>
        </div>

        {/* Registered vs Current Physical Location */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400">
            <span>Registered Location:</span>
            <span className="font-semibold text-slate-200">
              {assetData.location.building} - {assetData.location.floor} ({assetData.location.room})
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Confirm Current Physical Room:
            </label>
            <select
              value={verifiedLocationId}
              onChange={(e) => setVerifiedLocationId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.building} - {loc.floor} ({loc.room_name})
                </option>
              ))}
            </select>
          </div>

          {isLocationDiscrepant && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <span className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Location Discrepancy Detected
              </span>
              <p className="text-[11px] text-amber-200/80">
                Asset was found in a different room than registered. Please state reason:
              </p>
              <input
                type="text"
                placeholder="e.g. Employee relocated desk or temporary loaner..."
                value={discrepancyNote}
                onChange={(e) => setDiscrepancyNote(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded bg-slate-950 border border-amber-600/50 text-slate-100"
              />
            </div>
          )}
        </div>

        {auditSuccessMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{auditSuccessMsg}</span>
          </div>
        )}

        {auditErrorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {auditErrorMsg}
          </div>
        )}

        <button
          onClick={handleConfirmAudit}
          disabled={auditMutation.isPending || !!auditSuccessMsg}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 shadow-lg shadow-emerald-600/20 transition-all"
        >
          {auditMutation.isPending ? (
            'Recording Physical Scan...'
          ) : auditSuccessMsg ? (
            <>
              <Check className="w-4 h-4" />
              <span>Audit Completed</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Physical Audit Check</span>
            </>
          )}
        </button>
      </div>

      {/* ACTION MODE 2: Launch Smart PM Form */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Action Mode 2: Preventive Maintenance
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Cycle Check</span>
        </div>
        <p className="text-xs text-slate-400">
          Open technician checklist, auto-fill diagnostics from the live Windows Agent, and capture digital signature.
        </p>

        <Link
          href={`/pm/perform/${assetData.assetId}`}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Wrench className="w-4 h-4" />
          <span>Launch Smart PM Form Now</span>
        </Link>
      </div>
    </div>
  );
}

