'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  CheckCircle,
  Clock,
  Layers,
  Monitor,
  Cpu,
  AlertTriangle,
  Info,
  Check,
  X,
  FileText,
  User,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { AssetChangeLog, AlertSeverity } from '@/types/asset';
import { useAuth } from '@/context/AuthContext';

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [selectedAlertForAck, setSelectedAlertForAck] = useState<AssetChangeLog | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [ackError, setAckError] = useState<string | null>(null);

  const {
    data: alerts,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['critical-changes'],
    queryFn: () => apiClient.getCriticalChanges(),
  });

  const ackMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.acknowledgeChange(id, { resolutionNote: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['critical-changes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      setSelectedAlertForAck(null);
      setResolutionNote('');
      setAckError(null);
    },
    onError: (err: any) => {
      setAckError(err.message || 'Failed to acknowledge change alert.');
    },
  });

  const handleAcknowledgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlertForAck) return;
    if (!resolutionNote.trim()) {
      setAckError('Please enter a resolution note or maintenance ticket reference.');
      return;
    }
    ackMutation.mutate({ id: selectedAlertForAck.id, note: resolutionNote.trim() });
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            CRITICAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            WARNING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            <Info className="w-3 h-3 text-sky-400" />
            INFO
          </span>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    if (type.includes('RAM')) return <Cpu className="w-4 h-4 text-rose-400" />;
    if (type.includes('MONITOR')) return <Monitor className="w-4 h-4 text-amber-400" />;
    return <Layers className="w-4 h-4 text-indigo-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            <span>Hardware Tamper & Change Alert Center</span>
          </h1>
          <p className="text-sm text-slate-400">
            Automated tamper detection engine flagging unexpected physical component swaps, removals, or serial discrepancies.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {/* Alert Feed Cards */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 rounded-xl bg-slate-900 border border-slate-800">
            Loading hardware audit logs...
          </div>
        ) : alerts && alerts.length > 0 ? (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-xl border transition-all ${
                alert.is_acknowledged
                  ? 'bg-slate-900/40 border-slate-800/80 opacity-75'
                  : alert.severity === 'CRITICAL'
                  ? 'bg-slate-900/90 border-rose-500/40 shadow-lg shadow-rose-950/20'
                  : 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-950/20'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 shrink-0 mt-0.5">
                    {getTypeIcon(alert.change_type)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {getSeverityBadge(alert.severity)}
                      <span className="font-mono text-xs font-bold text-slate-300 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {alert.change_type}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-100">{alert.description}</h3>
                  </div>
                </div>

                {/* Status & Action */}
                <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                  {alert.is_acknowledged ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Acknowledged & Resolved</span>
                    </div>
                  ) : (
                    role !== 'VIEWER' && (
                      <button
                        onClick={() => {
                          setSelectedAlertForAck(alert);
                          setResolutionNote('');
                          setAckError(null);
                        }}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
                      >
                        Acknowledge & Resolve
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Endpoint Context Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 text-xs text-slate-300 border-b border-slate-800/60 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Hostname:</span>
                  <span className="font-semibold text-slate-200">{alert.hostname || 'Unknown'}</span>
                  {alert.asset_tag && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300">
                      {alert.asset_tag}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400 truncate">{alert.assigned_user || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400 truncate">{alert.location || 'Location Not Set'}</span>
                </div>
              </div>

              {/* Old vs. New Side-by-Side Diff Viewer */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old Baseline State */}
                <div className="p-3.5 rounded-lg bg-slate-950/70 border border-rose-900/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Previous Baseline (Before Change)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">OLD STATE</span>
                  </div>
                  <pre className="text-xs font-mono text-rose-200/90 whitespace-pre-wrap break-all bg-rose-950/20 p-2.5 rounded border border-rose-900/30">
                    {JSON.stringify(alert.old_value, null, 2)}
                  </pre>
                </div>

                {/* New Detected State */}
                <div className="p-3.5 rounded-lg bg-slate-950/70 border border-emerald-900/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Current Detected (After Ingestion)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">NEW STATE</span>
                  </div>
                  <pre className="text-xs font-mono text-emerald-200/90 whitespace-pre-wrap break-all bg-emerald-950/20 p-2.5 rounded border border-emerald-900/30">
                    {JSON.stringify(alert.new_value, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Resolution Note if acknowledged */}
              {alert.is_acknowledged && alert.resolution_note && (
                <div className="mt-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/60 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Resolution Record (by {alert.acknowledged_by || 'Technician'}):</span>
                  </div>
                  <p className="text-slate-200 italic">{alert.resolution_note}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-90" />
            <h3 className="text-base font-semibold text-slate-200">Zero Hardware Discrepancies</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              All monitored workstations match their baseline CPU, RAM capacity, motherboards, and verified monitors.
            </p>
          </div>
        )}
      </div>

      {/* Acknowledge & Resolve Modal Dialog */}
      {selectedAlertForAck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setSelectedAlertForAck(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
              <span>Acknowledge Hardware Change</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Endpoint: <strong className="text-slate-200 font-mono">{selectedAlertForAck.hostname}</strong> ({selectedAlertForAck.asset_tag || 'Unregistered'})
            </p>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 mb-4 text-xs">
              <p className="font-semibold text-amber-300 mb-1">{selectedAlertForAck.change_type}</p>
              <p className="text-slate-300">{selectedAlertForAck.description}</p>
            </div>

            <form onSubmit={handleAcknowledgeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Technician Resolution Note & Ticket Reference
                </label>
                <textarea
                  required
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="e.g., Authorized RAM upgrade ticket #IT-4902 or replacement of faulty display under vendor warranty."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {ackError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                  {ackError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAlertForAck(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ackMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-md shadow-indigo-600/30 transition-all"
                >
                  {ackMutation.isPending ? (
                    'Saving...'
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Resolution</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

